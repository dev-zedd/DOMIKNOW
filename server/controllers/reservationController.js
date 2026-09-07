const reservationModel = require('../models/reservationModel');
const propertyModel = require('../models/propertyModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');

const reservationController = {
    async createReservation(req, res) {
        try {
            const { property_id, move_in_date, message } = req.body;
            const tenantId = req.user.id;

            // 2. Check property exists
            const property = await propertyModel.findById(property_id);
            if (!property) {
                return responseHelper.error(res, 'Property does not exist.', null, 404);
            }

            // 3. Check property status is approved
            if (property.status !== 'approved') {
                return responseHelper.error(res, 'Property is not available for reservation.');
            }

            // 4. Check duplicate pending reservation for same property
            const existingPending = await reservationModel.findDuplicatePending(tenantId, property_id);
            if (existingPending) {
                return responseHelper.error(res, 'You already have a pending reservation request for this property.');
            }

            // 5. Create reservation
            const newReservation = await reservationModel.createReservation({
                tenant_id: tenantId,
                property_id,
                move_in_date,
                message,
                status: 'pending'
            });

            // 6. Log audit
            await auditLogModel.log(tenantId, 'SUBMIT_RESERVATION', `Tenant submitted reservation for property: ${property.property_name}`);

            // Dispatch notification to landlord
            if (property.landlord_id) {
                await notificationModel.create({
                    user_id: property.landlord_id,
                    type: 'reservation_submitted',
                    title: 'New Unit Reservation Request',
                    message: `A tenant submitted a new unit reservation request for property "${property.property_name}".`,
                    reference_id: newReservation.id
                });
            }

            return responseHelper.success(res, 'Reservation submitted successfully', newReservation, 201);

        } catch (error) {
            console.error('Create reservation error:', error);
            return responseHelper.error(res, 'Failed to submit reservation', error, 500);
        }
    },

    async getTenantReservations(req, res) {
        try {
            const reservations = await reservationModel.findByTenantId(req.user.id);
            return responseHelper.success(res, 'Your reservations retrieved successfully', reservations);
        } catch (error) {
            console.error('Get tenant reservations error:', error);
            return responseHelper.error(res, 'Failed to fetch your reservations', error, 500);
        }
    },

    async getAllReservations(req, res) {
        try {
            const reservations = await reservationModel.findAllReservations();
            return responseHelper.success(res, 'All reservations retrieved successfully', reservations);
        } catch (error) {
            console.error('Get all reservations error:', error);
            return responseHelper.error(res, 'Failed to fetch reservations directory', error, 500);
        }
    },

    async updateReservationStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const allowedStatuses = ['approved', 'rejected', 'cancelled'];
            if (!allowedStatuses.includes(status)) {
                return responseHelper.error(res, 'Invalid reservation status');
            }

            // Check reservation exists
            const record = await reservationModel.findById(id);
            if (!record) {
                return responseHelper.error(res, 'Reservation not found', null, 404);
            }

            // Update status
            const updatedRecord = await reservationModel.updateReservationStatus(id, status);

            // Audit log
            let actionType = 'CANCEL_RESERVATION';
            if (status === 'approved') actionType = 'APPROVE_RESERVATION';
            if (status === 'rejected') actionType = 'REJECT_RESERVATION';

            await auditLogModel.log(req.user.id, actionType, `Reservation ${id} status changed to ${status}`);

            // Dispatch notification to tenant
            if (record.tenant_id) {
                if (status === 'approved') {
                    await notificationModel.create({
                        user_id: record.tenant_id,
                        type: 'reservation_approved',
                        title: 'Unit Reservation Approved!',
                        message: `Your reservation request for property "${record.property_name || 'rental unit'}" has been approved by the landlord!`,
                        reference_id: id
                    });
                } else if (status === 'rejected') {
                    await notificationModel.create({
                        user_id: record.tenant_id,
                        type: 'reservation_rejected',
                        title: 'Reservation Status Update',
                        message: `Your reservation request for property "${record.property_name || 'rental unit'}" was declined by the landlord.`,
                        reference_id: id
                    });
                }
            }

            return responseHelper.success(res, `Reservation successfully ${status}`, updatedRecord);

        } catch (error) {
            console.error('Update reservation error:', error);
            return responseHelper.error(res, 'Failed to update reservation status', error, 500);
        }
    }
};

module.exports = reservationController;
