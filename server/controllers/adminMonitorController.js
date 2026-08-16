const screeningModel = require('../models/screeningModel');
const leaseModel = require('../models/leaseModel');
const billingModel = require('../models/billingModel');
const paymentModel = require('../models/paymentModel');
const auditLogModel = require('../models/auditLogModel');
const responseHelper = require('../utils/responseHelper');
const supabase = require('../config/supabaseClient');

const adminMonitorController = {
    async getAllScreenings(req, res) {
        try {
            const list = await screeningModel.findAllScreenings();
            return responseHelper.success(res, 'Admin: Global screenings list retrieved', list);
        } catch (error) {
            console.error('Admin get all screenings error:', error);
            return responseHelper.error(res, 'Failed to fetch global screenings', error, 500);
        }
    },

    async getAllLeases(req, res) {
        try {
            const list = await leaseModel.findAllLeases();
            return responseHelper.success(res, 'Admin: Global leases list retrieved', list);
        } catch (error) {
            console.error('Admin get all leases error:', error);
            return responseHelper.error(res, 'Failed to fetch global leases', error, 500);
        }
    },

    async getAllBillings(req, res) {
        try {
            const list = await billingModel.findAllBillings();
            return responseHelper.success(res, 'Admin: Global billings list retrieved', list);
        } catch (error) {
            console.error('Admin get all billings error:', error);
            return responseHelper.error(res, 'Failed to fetch global billings', error, 500);
        }
    },

    async getAllPayments(req, res) {
        try {
            const list = await paymentModel.findAllPayments();
            const { getSignedUrl } = require('../utils/storageHelper');
            for (const payment of list) {
                if (payment.payment_proof_path) {
                    try {
                        payment.payment_proof_url = await getSignedUrl('payment-proofs', payment.payment_proof_path);
                    } catch (err) {
                        console.error('Error generating signed URL for payment proof:', err);
                    }
                }
            }
            return responseHelper.success(res, 'Admin: Global payments list retrieved', list);
        } catch (error) {
            console.error('Admin get all payments error:', error);
            return responseHelper.error(res, 'Failed to fetch global payments', error, 500);
        }
    },

    async getAuditLogs(req, res) {
        try {
            const { user_role, action, date_from, date_to } = req.query;

            let query = supabase
                .from('audit_logs')
                .select(`
                    id,
                    action,
                    description,
                    created_at,
                    users!audit_logs_user_id_fkey (
                        full_name,
                        role
                    )
                `);

            if (user_role) {
                // To filter by joined relation field in Supabase, we can use filtering on the relation or referencing it.
                // An elegant way is using: .eq('users.role', user_role) but requires users relation to match, so we must filter out non-matching relations or use a custom filter.
                // Alternatively, we can query matching users first or use supabase filters properly.
                // Let's filter on the related table using .filter('users.role', 'eq', user_role)
                // Let's make sure it filters out rows where related users role doesn't match by using not.is.null if we want, or do direct user filter.
                // A very robust way is: filter by matching users.
                // Let's check: if we filter using query.eq('users.role', user_role), Supabase filters by the joined table column role.
                query = query.filter('users.role', 'eq', user_role);
            }

            if (action) {
                query = query.ilike('action', `%${action}%`);
            }

            if (date_from) {
                query = query.gte('created_at', date_from);
            }

            if (date_to) {
                const endExclusive = new Date(`${date_to}T00:00:00.000Z`);
                endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
                query = query.lt('created_at', endExclusive.toISOString());
            }

            const { data: logs, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            // Enforce clean formatting and role filter output
            const filteredLogs = logs.filter(log => log.users !== null);

            // Audit admin viewing audit logs
            await auditLogModel.log(req.user.id, 'ADMIN_VIEWED_AUDIT_LOGS', 'Admin viewed audit log registry');

            return responseHelper.success(res, 'Audit logs retrieved successfully.', filteredLogs);
        } catch (error) {
            console.error('Get audit logs error:', error);
            return responseHelper.error(res, 'Failed to retrieve audit logs.', error, 500);
        }
    }
};

module.exports = adminMonitorController;

