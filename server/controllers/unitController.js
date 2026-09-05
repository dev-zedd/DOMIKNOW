const unitModel = { ...require('../models/unitModel') };
const propertyModel = require('../models/propertyModel');
const supabase = require('../config/supabaseClient');
const { uploadFile } = require('../utils/storageHelper');
const cache = require('../utils/cacheHelper');

// Cache TTLs (seconds)
const TTL = {
    unitList: 120,  // Units under a property – 2 min
    unitDetail: 180 // Single unit detail – 3 min
};

/** Cache key helpers */
const unitListKey   = (propertyId) => `units:property:${propertyId}`;
const unitDetailKey = (unitId)     => `units:detail:${unitId}`;

const unitController = {
    /**
     * GET /api/properties/:propertyId/units
     * Fetch all units/rooms under a property
     */
    async getUnitsByProperty(req, res) {
        try {
            const { propertyId } = req.params;
            const { status } = req.query;

            // Include optional status filter in key so filtered and unfiltered lists are cached separately
            const cacheKey = status ? `${unitListKey(propertyId)}:${status}` : unitListKey(propertyId);
            const cached = cache.get(cacheKey);
            if (cached) {
                return res.json({ success: true, count: cached.length, data: cached });
            }

            const units = await unitModel.findByPropertyId(propertyId, status || null);
            cache.set(cacheKey, units, TTL.unitList);

            res.json({
                success: true,
                count: units.length,
                data: units
            });
        } catch (error) {
            console.error('Error fetching property units:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch property units.',
                error: error.message
            });
        }
    },

    /**
     * GET /api/units/:id
     * Fetch a single unit/room detail
     */
    async getUnitById(req, res) {
        try {
            const { id } = req.params;
            const cacheKey = unitDetailKey(id);
            const cached = cache.get(cacheKey);
            if (cached) {
                return res.json({ success: true, data: cached });
            }

            const unit = await unitModel.findById(id);

            if (!unit) {
                return res.status(404).json({
                    success: false,
                    message: 'Room / Unit not found.'
                });
            }

            cache.set(cacheKey, unit, TTL.unitDetail);
            res.json({
                success: true,
                data: unit
            });
        } catch (error) {
            console.error('Error fetching unit:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch room details.',
                error: error.message
            });
        }
    },

    /**
     * POST /api/properties/:propertyId/units
     * Add a new unit/room to a property (Landlord / Admin)
     */
    async createUnit(req, res) {
        try {
            const { propertyId } = req.params;
            const {
                unit_number,
                unit_type,
                monthly_rent,
                security_deposit,
                capacity,
                bedrooms,
                bathrooms,
                floor_area_sqm,
                status,
                main_image_url,
                description,
                amenities,
                images,
                // New fields
                rental_style,
                num_beds,
                rent_per_bed,
                floor,
                gender_restriction,
                room_name
            } = req.body;

            if (!unit_number) {
                return res.status(400).json({
                    success: false,
                    message: 'Unit / Room number is required.'
                });
            }

            if (rental_style === 'per_bed') {
                if (!num_beds || !rent_per_bed) {
                    return res.status(400).json({
                        success: false,
                        message: 'Number of beds and rent per bed are required for per-bed rental style.'
                    });
                }
            } else {
                if (!monthly_rent) {
                    return res.status(400).json({
                        success: false,
                        message: 'Monthly rent is required.'
                    });
                }
            }

            // Verify property existence
            const property = await propertyModel.findById(propertyId);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Property not found.'
                });
            }

            // Check authorization: Landlord must own property or be admin
            if (req.user.role !== 'admin' && property.landlord_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized: You do not own this property.'
                });
            }

            // Check approval status: Property must be approved by Admin
            if (req.user.role !== 'admin' && property.status !== 'approved') {
                return res.status(403).json({
                    success: false,
                    message: 'Rental Unit Management is locked until property registration is approved by the administrator.'
                });
            }

            let createdUnit;
            if (rental_style === 'per_bed') {
                const totalBeds = parseInt(num_beds, 10);
                const rentVal = parseFloat(rent_per_bed);
                
                // Build beds array
                const bedsList = [];
                for (let i = 1; i <= totalBeds; i++) {
                    bedsList.push({
                        bed_number: i,
                        bed_label: `Bed ${i}`,
                        status: 'available',
                        monthly_rent: rentVal
                    });
                }

                createdUnit = await unitModel.createUnit({
                    property_id: propertyId,
                    unit_number,
                    unit_type: 'bedspace',
                    monthly_rent: rentVal,
                    security_deposit: rentVal,
                    capacity: totalBeds,
                    bedrooms: parseInt(bedrooms || 1, 10),
                    bathrooms: parseInt(bathrooms || 1, 10),
                    floor_area_sqm: parseFloat(floor_area_sqm || 0),
                    status: status || 'available',
                    main_image_url: main_image_url || null,
                    description: description || '',
                    amenities: Array.isArray(amenities) ? amenities : [],
                    images: Array.isArray(images) ? images : [],
                    rental_style: 'per_bed',
                    floor: floor || null,
                    gender_restriction: gender_restriction || null,
                    room_name: room_name || null,
                    beds: bedsList
                });
            } else {
                createdUnit = await unitModel.createUnit({
                    property_id: propertyId,
                    unit_number,
                    unit_type: unit_type || 'room',
                    monthly_rent: parseFloat(monthly_rent),
                    security_deposit: parseFloat(security_deposit || monthly_rent),
                    capacity: parseInt(capacity || 1, 10),
                    bedrooms: parseInt(bedrooms || 1, 10),
                    bathrooms: parseInt(bathrooms || 1, 10),
                    floor_area_sqm: parseFloat(floor_area_sqm || 0),
                    status: status || 'available',
                    main_image_url: main_image_url || null,
                    description: description || '',
                    amenities: Array.isArray(amenities) ? amenities : [],
                    images: Array.isArray(images) ? images : [],
                    rental_style: rental_style || 'whole_room',
                    floor: floor || null,
                    gender_restriction: gender_restriction || null,
                    room_name: room_name || null
                });
            }

            res.status(201).json({
                success: true,
                message: rental_style === 'per_bed' 
                    ? `Room ${unit_number} with ${num_beds} beds successfully created.`
                    : `Room/Unit '${unit_number}' successfully created.`,
                data: createdUnit
            });

            // Invalidate unit list for this property
            cache.invalidatePrefix(unitListKey(propertyId));
        } catch (error) {
            console.error('Error creating room/unit:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create room/unit.',
                error: error.message
            });
        }
    },

    /**
     * PUT /api/units/:id
     * Update room/unit details (Landlord / Admin)
     */
    async updateUnit(req, res) {
        try {
            const { id } = req.params;
            const unit = await unitModel.findById(id);

            if (!unit) {
                return res.status(404).json({
                    success: false,
                    message: 'Room / Unit not found.'
                });
            }

            // Check authorization
            if (req.user.role !== 'admin' && unit.property && unit.property.landlord_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized to update this unit.'
                });
            }

            // Extract per_bed specific parameters
            let { num_beds, rent_per_bed, ...updateFields } = req.body;

            if (unit.rental_style === 'per_bed') {
                if (num_beds) {
                    updateFields.capacity = parseInt(num_beds, 10);
                }
                if (rent_per_bed) {
                    updateFields.monthly_rent = parseFloat(rent_per_bed);
                }
            }

            // If per_bed, check bed size changes before updating database
            if (unit.rental_style === 'per_bed') {
                const rentVal = parseFloat(rent_per_bed || unit.monthly_rent);
                const targetBedCount = parseInt(num_beds || unit.capacity, 10);

                // Fetch current beds
                const { data: currentBeds } = await supabase
                    .from('unit_beds')
                    .select('*')
                    .eq('unit_id', id)
                    .order('bed_number', { ascending: true });

                const currentCount = currentBeds ? currentBeds.length : 0;

                if (targetBedCount < currentCount) {
                    // Check if excess beds are occupied or reserved
                    const excessBeds = currentBeds.slice(targetBedCount);
                    const occupiedExcess = excessBeds.some(b => b.status === 'occupied' || b.status === 'reserved');
                    if (occupiedExcess) {
                        return res.status(400).json({
                            success: false,
                            message: 'Cannot reduce bed count: some of the beds to be removed are currently occupied or reserved.'
                        });
                    }
                    const idsToRemove = excessBeds.map(b => b.id);
                    await supabase.from('unit_beds').delete().in('id', idsToRemove);
                }

                if (targetBedCount > currentCount) {
                    // Add new beds
                    const newBeds = [];
                    for (let i = currentCount + 1; i <= targetBedCount; i++) {
                        newBeds.push({
                            unit_id: id,
                            bed_number: i,
                            bed_label: `Bed ${i}`,
                            status: 'available',
                            monthly_rent: rentVal
                        });
                    }
                    await supabase.from('unit_beds').insert(newBeds);
                }

                // Update rent for all remaining beds
                await supabase
                    .from('unit_beds')
                    .update({ monthly_rent: rentVal })
                    .eq('unit_id', id);
            }

            const updatedUnit = await unitModel.updateUnit(id, updateFields);

            res.json({
                success: true,
                message: 'Room / Unit updated successfully.',
                data: updatedUnit
            });

            // Invalidate unit detail and property list
            cache.del(unitDetailKey(id));
            if (updatedUnit && updatedUnit.property_id) {
                cache.invalidatePrefix(unitListKey(updatedUnit.property_id));
            }
        } catch (error) {
            console.error('Error updating unit:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update unit details.',
                error: error.message
            });
        }
    },

    /**
     * PATCH /api/units/:id/status
     * Update room status (available, occupied, reserved, under_maintenance, unavailable)
     */
    async updateUnitStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const validStatuses = ['available', 'occupied', 'reserved', 'under_maintenance', 'unavailable'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            const updatedUnit = await unitModel.updateStatus(id, status);

            res.json({
                success: true,
                message: `Unit status updated to '${status}'.`,
                data: updatedUnit
            });

            // Invalidate unit detail and property list
            cache.del(unitDetailKey(id));
            if (updatedUnit && updatedUnit.property_id) {
                cache.invalidatePrefix(unitListKey(updatedUnit.property_id));
            }
        } catch (error) {
            console.error('Error updating unit status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update unit status.',
                error: error.message
            });
        }
    },

    /**
     * PATCH /api/units/:unitId/beds/:bedId/status
     * Update status of a specific bed (available, occupied, reserved, under_maintenance)
     */
    async updateBedStatus(req, res) {
        try {
            const { unitId, bedId } = req.params;
            const { status } = req.body;

            const validStatuses = ['available', 'occupied', 'reserved', 'under_maintenance'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            // Check if bed exists and belongs to the unit
            const { data: bed, error: fetchError } = await supabase
                .from('unit_beds')
                .select('*')
                .eq('id', bedId)
                .eq('unit_id', unitId)
                .maybeSingle();

            if (fetchError || !bed) {
                return res.status(404).json({
                    success: false,
                    message: 'Bed space not found in this unit.'
                });
            }

            // Update status
            const { data: updatedBed, error: updateError } = await supabase
                .from('unit_beds')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', bedId)
                .select()
                .single();

            if (updateError) throw updateError;

            // Automatically update parent property_unit status based on all beds
            const { data: allBeds } = await supabase
                .from('unit_beds')
                .select('status')
                .eq('unit_id', unitId);

            let newUnitStatus = 'occupied';
            if (allBeds && allBeds.length > 0) {
                const statuses = allBeds.map(b => b.status);
                if (statuses.includes('available')) {
                    newUnitStatus = 'available';
                } else if (statuses.includes('reserved')) {
                    newUnitStatus = 'reserved';
                } else if (statuses.includes('under_maintenance')) {
                    newUnitStatus = 'under_maintenance';
                }
            }

            await unitModel.updateStatus(unitId, newUnitStatus);

            res.json({
                success: true,
                message: `Bed status updated to '${status}'.`,
                data: updatedBed
            });

            // Invalidate unit detail (bed status is embedded in unit detail)
            cache.del(unitDetailKey(unitId));
        } catch (error) {
            console.error('Error updating bed status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update bed status.',
                error: error.message
            });
        }
    },

    /**
     * DELETE /api/units/:id
     * Remove a unit/room — only allowed if no active or reserved lease exists for it
     */
    async deleteUnit(req, res) {
        try {
            const { id } = req.params;
            const unit = await unitModel.findById(id);

            if (!unit) {
                return res.status(404).json({
                    success: false,
                    message: 'Room / Unit not found.'
                });
            }

            // Guard: virtual/fallback unit — property has no real registered rooms yet
            // unitModel returns a pseudo-unit where id === property_id in this case
            if (unit.id === unit.property_id) {
                return res.status(400).json({
                    success: false,
                    message: 'This is a default placeholder unit and cannot be deleted. Please register actual rooms first via Room Management.'
                });
            }

            if (req.user.role !== 'admin' && unit.property && unit.property.landlord_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized to delete this unit.'
                });
            }

            // Guard: check if any active or reserved lease is tied to this unit
            const { data: activeLease, error: leaseCheckError } = await supabase
                .from('leases')
                .select('id, lease_status')
                .eq('unit_id', id)
                .in('lease_status', ['active', 'reserved'])
                .maybeSingle();

            if (leaseCheckError) {
                console.error('Lease check error:', leaseCheckError.message);
            }

            if (activeLease) {
                return res.status(409).json({
                    success: false,
                    message: `Cannot delete this room — it currently has an ${activeLease.lease_status} lease. End or terminate the lease first before removing the room.`
                });
            }

            await unitModel.deleteUnit(id);

            // Invalidate unit detail and property list
            cache.del(unitDetailKey(id));
            if (unit && unit.property_id) {
                cache.invalidatePrefix(unitListKey(unit.property_id));
            }

            res.json({
                success: true,
                message: 'Room / Unit successfully deleted.'
            });
        } catch (error) {
            console.error('Error deleting unit:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete room/unit.',
                error: error.message
            });
        }
    },

    /**
     * POST /api/units/:id/images
     * Upload an image for a unit/room
     */
    async uploadUnitImage(req, res) {
        try {
            const { id } = req.params;
            const { file_name, is_main, base64_content, mime_type, file_size, replace_image_id } = req.body;
            const landlordId = req.user.id;

            const unit = await unitModel.findById(id);
            if (!unit) {
                return res.status(404).json({
                    success: false,
                    message: 'Unit / Room not found.'
                });
            }

            // Check authorization
            if (req.user.role !== 'admin' && unit.property && unit.property.landlord_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized: You do not own this room.'
                });
            }

            // Validate image formats
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(mime_type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid image format. Allowed formats: JPG, JPEG, PNG, WEBP.'
                });
            }

            // Validate size (limit 5MB)
            if (parseInt(file_size) > 5 * 1024 * 1024) {
                return res.status(400).json({
                    success: false,
                    message: 'Image size exceeds maximum limit of 5MB.'
                });
            }

            // Clean existing image if replacing
            if (replace_image_id) {
                await supabase
                    .from('unit_images')
                    .delete()
                    .eq('id', replace_image_id)
                    .eq('unit_id', id);
            } else if (is_main === true || is_main === 'true') {
                // Ensure only one main image per unit
                await supabase
                    .from('unit_images')
                    .delete()
                    .eq('unit_id', id)
                    .eq('is_main', true);
            }

            const uniqueName = `${Date.now()}-${file_name}`;
            const storagePath = `units/${id}/${uniqueName}`;
            const uploadResult = await uploadFile('property-images', storagePath, base64_content, mime_type);

            // Insert into unit_images
            const { data: imgRecord, error: insertError } = await supabase
                .from('unit_images')
                .insert([{
                    unit_id: id,
                    image_url: uploadResult.url,
                    image_path: uploadResult.path,
                    is_main: is_main === true || is_main === 'true'
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            // Update main_image_url on unit table if it is main image
            if (is_main === true || is_main === 'true') {
                await supabase
                    .from('property_units')
                    .update({ main_image_url: uploadResult.url })
                    .eq('id', id);
            }

            res.status(201).json({
                success: true,
                message: 'Room photo uploaded successfully.',
                data: imgRecord
            });

            // Invalidate unit detail so new image appears on next fetch
            cache.del(unitDetailKey(id));
        } catch (error) {
            console.error('Upload unit image error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to upload room image.',
                error: error.message
            });
        }
    },

    /**
     * DELETE /api/units/:unitId/images/:imageId
     * Remove an image from a unit
     */
    async deleteUnitImage(req, res) {
        try {
            const { unitId, imageId } = req.params;

            const unit = await unitModel.findById(unitId);
            if (!unit) {
                return res.status(404).json({
                    success: false,
                    message: 'Room / Unit not found.'
                });
            }

            if (req.user.role !== 'admin' && unit.property && unit.property.landlord_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized to delete this image.'
                });
            }

            const { data: imgRecord } = await supabase
                .from('unit_images')
                .select('*')
                .eq('id', imageId)
                .eq('unit_id', unitId)
                .maybeSingle();

            if (!imgRecord) {
                return res.status(404).json({
                    success: false,
                    message: 'Image not found.'
                });
            }

            const { error: dbError } = await supabase
                .from('unit_images')
                .delete()
                .eq('id', imageId);

            if (dbError) throw dbError;

            if (imgRecord.is_main) {
                const { data: otherImg } = await supabase
                    .from('unit_images')
                    .select('*')
                    .eq('unit_id', unitId)
                    .limit(1)
                    .maybeSingle();

                const newMainUrl = otherImg ? otherImg.image_url : null;
                if (otherImg) {
                    await supabase
                        .from('unit_images')
                        .update({ is_main: true })
                        .eq('id', otherImg.id);
                }

                await supabase
                    .from('property_units')
                    .update({ main_image_url: newMainUrl })
                    .eq('id', unitId);
            }

            res.json({
                success: true,
                message: 'Image deleted successfully.'
            });

            // Invalidate unit detail so image removal is reflected
            cache.del(unitDetailKey(unitId));
        } catch (error) {
            console.error('Delete unit image error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete room image.',
                error: error.message
            });
        }
    }
};

module.exports = unitController;
