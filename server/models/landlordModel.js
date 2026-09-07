const supabase = require('../config/supabaseClient');

const landlordModel = {
    async createProperty(propData) {
        const { data, error } = await supabase
            .from('properties')
            .insert([{
                ...propData,
                status: 'pending_review',
                average_rating: 0.00,
                feedback_count: 0
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async saveAmenities(propertyId, amenitiesList) {
        if (!amenitiesList || amenitiesList.length === 0) return;
        
        const mapName = (name) => {
            if (!name) return '';
            const trimmed = name.trim();
            if (trimmed === 'Wi-Fi') return 'WiFi';
            if (trimmed === 'Parking Area') return 'Parking';
            return trimmed;
        };

        for (const rawName of amenitiesList) {
            const cleanName = mapName(rawName);
            if (!cleanName) continue;
            try {
                const { error } = await supabase
                    .from('property_amenities')
                    .insert([{ property_id: propertyId, amenity_name: cleanName }]);
                if (error) {
                    console.warn(`Amenity insert notice for "${cleanName}":`, error.message);
                }
            } catch (err) {
                console.warn(`Amenity insert notice for "${cleanName}":`, err.message || err);
            }
        }
    },


    async deleteAmenities(propertyId) {
        const { error } = await supabase
            .from('property_amenities')
            .delete()
            .eq('property_id', propertyId);

        if (error) throw error;
    },

    async saveImage(imageData) {
        const { data, error } = await supabase
            .from('property_images')
            .insert([imageData])
            .select()
            .single();

        if (error) throw error;

        // If is_main = true, update main_image_url in properties table
        if (imageData.is_main) {
            const { error: propError } = await supabase
                .from('properties')
                .update({ main_image_url: imageData.image_url })
                .eq('id', imageData.property_id);
            if (propError) throw propError;
        }

        return data;
    },

    async saveDocument(docData) {
        const { data, error } = await supabase
            .from('property_documents')
            .insert([docData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findByLandlordId(landlordId) {
        const { data: properties, error } = await supabase
            .from('properties')
            .select('*')
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (properties.length === 0) return [];

        const propertyIds = properties.map(p => p.id);

        // Fetch document counts
        const { data: docs, error: docsErr } = await supabase
            .from('property_documents')
            .select('property_id');
        if (docsErr) throw docsErr;

        // Fetch image counts
        const { data: imgs, error: imgsErr } = await supabase
            .from('property_images')
            .select('property_id');
        if (imgsErr) throw imgsErr;

        // Map counts
        const docsMap = {};
        docs.forEach(d => {
            docsMap[d.property_id] = (docsMap[d.property_id] || 0) + 1;
        });

        const imgsMap = {};
        imgs.forEach(i => {
            imgsMap[i.property_id] = (imgsMap[i.property_id] || 0) + 1;
        });

        return properties.map(p => ({
            ...p,
            document_count: docsMap[p.id] || 0,
            image_count: imgsMap[p.id] || 0
        }));
    },

    async findPropertyById(id, landlordId) {
        let query = supabase
            .from('properties')
            .select(`
                *,
                landlord:users!landlord_id (id, full_name, email, contact_number)
            `)
            .eq('id', id);

        if (landlordId) {
            query = query.eq('landlord_id', landlordId);
        }

        const { data: property, error } = await query.maybeSingle();

        if (error) throw error;
        if (!property) return null;

        // Fetch amenities
        const { data: amenities, error: amenError } = await supabase
            .from('property_amenities')
            .select('amenity_name')
            .eq('property_id', id);
        if (amenError) throw amenError;

        // Fetch images
        const { data: images, error: imgError } = await supabase
            .from('property_images')
            .select('*')
            .eq('property_id', id)
            .order('uploaded_at', { ascending: true });
        if (imgError) throw imgError;

        // Fetch documents
        const { data: documents, error: docError } = await supabase
            .from('property_documents')
            .select('*')
            .eq('property_id', id)
            .order('uploaded_at', { ascending: true });
        if (docError) throw docError;

        // Fetch units
        const { data: units } = await supabase
            .from('property_units')
            .select('*')
            .eq('property_id', id)
            .order('created_at', { ascending: true });

        return {
            ...property,
            landlord_name: property.landlord ? property.landlord.full_name : null,
            landlord_email: property.landlord ? property.landlord.email : null,
            landlord_phone: property.landlord ? property.landlord.contact_number : null,
            amenities: (amenities || []).map(a => a.amenity_name),
            images: images || [],
            documents: documents || [],
            units: units || []
        };
    },

    async updateProperty(id, landlordId, propData) {
        // Enforce update only allowed if status is pending_review or rejected
        const { data: existing, error: checkError } = await supabase
            .from('properties')
            .select('status')
            .eq('id', id)
            .eq('landlord_id', landlordId)
            .maybeSingle();

        if (checkError) throw checkError;
        if (!existing) return null;

        if (existing.status !== 'pending_review' && existing.status !== 'rejected') {
            throw new Error('You can only update properties that are pending review or rejected.');
        }

        const { data, error } = await supabase
            .from('properties')
            .update({
                ...propData,
                updated_at: new Date()
            })
            .eq('id', id)
            .eq('landlord_id', landlordId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findTenantApplications(landlordId) {
        // Find tenant applications submitted to properties owned by this landlord
        const { data, error } = await supabase
            .from('tenant_applications')
            .select(`
                id,
                tenant_id,
                property_id,
                unit_id,
                bed_id,
                landlord_id,
                desired_move_in_date,
                application_message,
                status,
                landlord_remarks,
                created_at,
                users!tenant_id (
                    full_name,
                    email,
                    contact_number
                ),
                properties (
                    id,
                    property_name,
                    property_type,
                    monthly_rent,
                    max_occupants,
                    house_rules,
                    landlord_id
                ),
                property_units (
                    unit_number,
                    rental_style,
                    monthly_rent,
                    capacity
                ),
                unit_beds (
                    bed_label,
                    monthly_rent
                )
            `)
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        const filtered = data || [];
        if (filtered.length === 0) return [];

        // Fetch document counts
        const appIds = filtered.map(a => a.id);
        const { data: docRecords, error: docsErr } = await supabase
            .from('tenant_application_documents')
            .select('application_id')
            .in('application_id', appIds);
        if (docsErr) throw docsErr;

        const docsMap = {};
        (docRecords || []).forEach(doc => {
            docsMap[doc.application_id] = (docsMap[doc.application_id] || 0) + 1;
        });

        return filtered.map(a => ({
            ...a,
            document_count: docsMap[a.id] || 0
        }));
    },

    async findApplicationDetails(id, landlordId) {
        // Fetch details of a tenant application
        const { data: application, error } = await supabase
            .from('tenant_applications')
            .select(`
                id,
                tenant_id,
                property_id,
                unit_id,
                bed_id,
                landlord_id,
                reservation_id,
                application_message,
                desired_move_in_date,
                status,
                landlord_remarks,
                created_at,
                users!tenant_id (
                    full_name,
                    email,
                    contact_number,
                    address
                ),
                properties (
                    property_name,
                    property_type,
                    monthly_rent,
                    max_occupants,
                    house_rules,
                    address,
                    barangay,
                    landlord_id,
                    users!landlord_id (
                        full_name,
                        email,
                        contact_number
                    )
                ),
                property_units (
                    unit_number,
                    rental_style,
                    monthly_rent,
                    capacity
                ),
                unit_beds (
                    bed_label,
                    monthly_rent
                )
            `)
            .eq('id', id)
            .eq('landlord_id', landlordId)
            .maybeSingle();

        if (error) throw error;
        if (!application || !application.properties) return null;

        // Fetch uploaded tenant application documents
        const { data: documents, error: docError } = await supabase
            .from('tenant_application_documents')
            .select('*')
            .eq('application_id', id);

        if (docError) throw docError;

        // Fetch property amenities & unit amenities
        const { data: propAmenities } = await supabase
            .from('property_amenities')
            .select('amenity_name')
            .eq('property_id', application.property_id);

        let unitAmenities = [];
        if (application.unit_id) {
            const { data: uAmenities } = await supabase
                .from('unit_amenities')
                .select('amenity_name')
                .eq('unit_id', application.unit_id);
            unitAmenities = (uAmenities || []).map(a => a.amenity_name);
        }

        const combinedAmenities = Array.from(new Set([
            ...(propAmenities || []).map(a => a.amenity_name),
            ...unitAmenities
        ]));

        if (application.properties) {
            application.properties.amenities = combinedAmenities;
        }

        // Fetch screening if exists for this application or tenant
        let screening = null;
        try {
            const { data: appScreening } = await supabase
                .from('tenant_screening')
                .select('*')
                .eq('application_id', id)
                .maybeSingle();

            if (appScreening) {
                screening = appScreening;
            } else if (application.tenant_id) {
                const { data: tenantScreening } = await supabase
                    .from('tenant_screening')
                    .select('*')
                    .eq('tenant_id', application.tenant_id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (tenantScreening) {
                    screening = tenantScreening;
                }
            }
        } catch (sErr) {
            console.error('Error fetching screening in findApplicationDetails:', sErr);
        }

        // Fetch tenant platform history (leases, violations, outstanding bills)
        let tenantHistory = {
            leases: [],
            violations: [],
            unpaid_balance: 0,
            unpaid_bills_count: 0
        };

        if (application.tenant_id) {
            try {
                // Fetch prior/active leases
                const { data: priorLeases } = await supabase
                    .from('lease_records')
                    .select(`
                        id,
                        lease_number,
                        lease_status,
                        lease_start_date,
                        lease_end_date,
                        monthly_rent,
                        properties (
                            property_name
                        )
                    `)
                    .eq('tenant_id', application.tenant_id)
                    .order('created_at', { ascending: false });
                tenantHistory.leases = priorLeases || [];

                // Fetch reported policy violations
                const { data: vios } = await supabase
                    .from('policy_violations')
                    .select('id, violation_type, status, created_at')
                    .eq('violator_id', application.tenant_id);
                tenantHistory.violations = vios || [];

                // Fetch unpaid / overdue bills
                const { data: unpaidBills } = await supabase
                    .from('billing_records')
                    .select('total_amount, billing_status, due_date')
                    .eq('tenant_id', application.tenant_id)
                    .in('billing_status', ['unpaid', 'overdue']);
                if (unpaidBills && unpaidBills.length > 0) {
                    tenantHistory.unpaid_bills_count = unpaidBills.length;
                    tenantHistory.unpaid_balance = unpaidBills.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
                }
            } catch (hErr) {
                console.error('Error fetching tenant history in findApplicationDetails:', hErr);
            }
        }

        return {
            ...application,
            documents,
            screening,
            tenant_history: tenantHistory
        };
    },

    async updateApplicationStatus(id, landlordId, status, remarks) {
        const conflict = message => Object.assign(new Error(message), { statusCode: 409 });
        const { data: application, error: checkError } = await supabase
            .from('tenant_applications').select('id, landlord_id, status, unit_id, bed_id')
            .eq('id', id).eq('landlord_id', landlordId).maybeSingle();
        if (checkError) throw checkError;
        if (!application) return null;
        if (application.status !== 'pending') throw conflict('This application has already been reviewed. Refresh the application.');

        // A pending application owns no inventory. Rejecting it must never
        // release a room or bed reserved/occupied by another tenant.
        const inventoryTable = application.bed_id ? 'unit_beds' : application.unit_id ? 'property_units' : null;
        const inventoryId = application.bed_id || application.unit_id;
        let reserved = false;
        if (status === 'approved' && inventoryTable) {
            const { data: slot, error } = await supabase.from(inventoryTable)
                .update({ status: 'reserved' }).eq('id', inventoryId).eq('status', 'available')
                .select('id').maybeSingle();
            if (error) throw error;
            if (!slot) throw conflict('This room or bed is no longer available. Refresh the application before deciding.');
            reserved = true;
        }
        try {
            const { data, error } = await supabase.from('tenant_applications')
                .update({ status, landlord_remarks: remarks, reviewed_at: new Date(), updated_at: new Date() })
                .eq('id', id).eq('landlord_id', landlordId).eq('status', 'pending').select().maybeSingle();
            if (error) throw error;
            if (!data) throw conflict('This application was reviewed by another request. Refresh the application.');
            return data;
        } catch (error) {
            if (reserved) {
                const { error: rollbackError } = await supabase.from(inventoryTable)
                    .update({ status: 'available' }).eq('id', inventoryId).eq('status', 'reserved');
                if (rollbackError) error.message += ' The inventory reservation could not be released; contact support.';
            }
            throw error;
        }
    },

    async deleteProperty(id, landlordId) {
        const { data: prop, error: checkError } = await supabase
            .from('properties')
            .select('id, landlord_id, status')
            .eq('id', id)
            .maybeSingle();

        if (checkError) throw checkError;
        if (!prop || prop.landlord_id !== landlordId) {
            return null;
        }

        if (prop.status !== 'pending_review' && prop.status !== 'rejected') {
            throw new Error('You can only delete properties that are pending review or rejected.');
        }

        // Clean dependencies
        await supabase.from('property_amenities').delete().eq('property_id', id);
        await supabase.from('property_images').delete().eq('property_id', id);
        await supabase.from('property_documents').delete().eq('property_id', id);
        await supabase.from('property_units').delete().eq('property_id', id);
        await supabase.from('tenant_applications').delete().eq('property_id', id);

        const { error } = await supabase
            .from('properties')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
};

module.exports = landlordModel;
