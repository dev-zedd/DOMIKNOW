const supabase = require('../config/supabaseClient');

const unitModel = {
    /**
     * Find all units under a specific property
     */
    async findByPropertyId(propertyId, statusFilter = null) {
        let query = supabase
            .from('property_units')
            .select('*')
            .eq('property_id', propertyId);

        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data: units, error } = await query.order('created_at', { ascending: true });

        if (error) {
            console.warn('Note on property_units fetch:', error.message);
            return [];
        }

        if (!units || units.length === 0) {
            return [];
        }

        const unitIds = units.map(u => u.id);

        // Fetch beds for all units
        const { data: beds } = await supabase
            .from('unit_beds')
            .select('*')
            .in('unit_id', unitIds)
            .order('bed_number', { ascending: true });

        // Fetch amenities for all units
        const { data: amenities } = await supabase
            .from('unit_amenities')
            .select('unit_id, amenity_name')
            .in('unit_id', unitIds);

        // Fetch images for all units
        const { data: images } = await supabase
            .from('unit_images')
            .select('unit_id, image_url, image_path, is_main')
            .in('unit_id', unitIds);

        const bedsMap = {};
        (beds || []).forEach(b => {
            if (!bedsMap[b.unit_id]) bedsMap[b.unit_id] = [];
            bedsMap[b.unit_id].push(b);
        });

        const amenitiesMap = {};
        (amenities || []).forEach(a => {
            if (!amenitiesMap[a.unit_id]) amenitiesMap[a.unit_id] = [];
            amenitiesMap[a.unit_id].push(a.amenity_name);
        });

        const imagesMap = {};
        (images || []).forEach(img => {
            if (!imagesMap[img.unit_id]) imagesMap[img.unit_id] = [];
            imagesMap[img.unit_id].push(img);
        });

        return units.map(u => ({
            ...u,
            beds: bedsMap[u.id] || [],
            amenities: amenitiesMap[u.id] || [],
            images: imagesMap[u.id] || (u.main_image_url ? [{ image_url: u.main_image_url, is_main: true }] : [])
        }));
    },

    /**
     * Find single unit by unit ID
     */
    async findById(unitId) {
        const { data: unit, error } = await supabase
            .from('property_units')
            .select('*')
            .eq('id', unitId)
            .maybeSingle();

        if (error || !unit) return null;

        // Fetch beds, amenities & images
        const { data: beds } = await supabase
            .from('unit_beds')
            .select('*')
            .eq('unit_id', unitId)
            .order('bed_number', { ascending: true });

        const { data: amenities } = await supabase
            .from('unit_amenities')
            .select('amenity_name')
            .eq('unit_id', unitId);

        const { data: images } = await supabase
            .from('unit_images')
            .select('image_url, image_path, is_main')
            .eq('unit_id', unitId);

        // Fetch parent property details
        const { data: property } = await supabase
            .from('properties')
            .select('*')
            .eq('id', unit.property_id)
            .maybeSingle();

        return {
            ...unit,
            beds: beds || [],
            amenities: (amenities || []).map(a => a.amenity_name),
            images: images || (unit.main_image_url ? [{ image_url: unit.main_image_url, is_main: true }] : []),
            property: property || null
        };
    },

    /**
     * Create a new unit/room under a property
     */
    async createUnit(unitData) {
        const {
            property_id,
            unit_number,
            unit_type = 'room',
            monthly_rent,
            security_deposit = 0,
            capacity = 1,
            bedrooms = 1,
            bathrooms = 1,
            floor_area_sqm = 0,
            status = 'available',
            main_image_url = null,
            description = '',
            amenities = [],
            images = [],
            rental_style = 'whole_room',
            floor = null,
            gender_restriction = null,
            room_name = null,
            beds = []
        } = unitData;

        const { data: newUnit, error } = await supabase
            .from('property_units')
            .insert([{
                property_id,
                unit_number,
                unit_type,
                monthly_rent: parseFloat(monthly_rent),
                security_deposit: parseFloat(security_deposit || monthly_rent),
                capacity: parseInt(capacity, 10),
                bedrooms: parseInt(bedrooms, 10),
                bathrooms: parseInt(bathrooms, 10),
                floor_area_sqm: parseFloat(floor_area_sqm || 0),
                status,
                main_image_url,
                description,
                floor,
                gender_restriction,
                rental_style,
                room_name
            }])
            .select()
            .single();

        if (error) throw error;

        // Insert beds if provided (for per_bed style)
        if (beds && beds.length > 0) {
            const bedRecords = beds.map(b => ({
                unit_id: newUnit.id,
                bed_number: b.bed_number,
                bed_label: b.bed_label || `Bed ${b.bed_number}`,
                status: b.status || 'available',
                monthly_rent: parseFloat(b.monthly_rent || monthly_rent)
            }));
            const { error: bedError } = await supabase.from('unit_beds').insert(bedRecords);
            if (bedError) throw bedError;
        }

        // Insert unit amenities if provided
        if (amenities && amenities.length > 0) {
            const amenityRecords = amenities.map(name => ({
                unit_id: newUnit.id,
                amenity_name: name
            }));
            await supabase.from('unit_amenities').insert(amenityRecords);
        }

        // Insert unit images if provided
        if (images && images.length > 0) {
            const imageRecords = images.map((img, idx) => ({
                unit_id: newUnit.id,
                image_url: typeof img === 'string' ? img : img.image_url,
                image_path: typeof img === 'string' ? '' : (img.image_path || ''),
                is_main: idx === 0
            }));
            await supabase.from('unit_images').insert(imageRecords);
        }

        await this.syncPropertyTotalCapacity(property_id);
        return this.findById(newUnit.id);
    },

    /**
     * Update unit details
     */
    async updateUnit(unitId, updateData) {
        const { amenities, images, beds, ...fields } = updateData;

        if (Object.keys(fields).length > 0) {
            fields.updated_at = new Date().toISOString();
            const { error } = await supabase
                .from('property_units')
                .update(fields)
                .eq('id', unitId);
            if (error) throw error;
        }

        if (Array.isArray(amenities)) {
            // Delete existing amenities and re-insert
            await supabase.from('unit_amenities').delete().eq('unit_id', unitId);
            if (amenities.length > 0) {
                const amenityRecords = amenities.map(name => ({
                    unit_id: unitId,
                    amenity_name: name
                }));
                await supabase.from('unit_amenities').insert(amenityRecords);
            }
        }

        // Optionally update beds if provided
        if (Array.isArray(beds)) {
            // Simple approach: delete existing beds and insert new list
            // NOTE: If some beds are occupied under active leases, delete will fail if FK references exist.
            // But we can check or handle updates individually. For now, since the landlord manages beds,
            // let's do a basic sync or let them update bed status via the specific status endpoint.
            // Let's implement status updates on a bed level first.
        }

        const updatedUnit = await this.findById(unitId);
        if (updatedUnit && updatedUnit.property_id) {
            await this.syncPropertyTotalCapacity(updatedUnit.property_id);
        }
        return updatedUnit;
    },

    /**
     * Update unit status
     */
    async updateStatus(unitId, status) {
        const { data, error } = await supabase
            .from('property_units')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', unitId)
            .select()
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Delete unit
     */
    async deleteUnit(unitId) {
        const { data: unit } = await supabase
            .from('property_units')
            .select('property_id')
            .eq('id', unitId)
            .maybeSingle();

        const { error } = await supabase
            .from('property_units')
            .delete()
            .eq('id', unitId);
        if (error) throw error;

        if (unit && unit.property_id) {
            await this.syncPropertyTotalCapacity(unit.property_id);
        }
        return true;
    },

    /**
     * Sync building total capacity as the sum of all its room capacities
     */
    async syncPropertyTotalCapacity(propertyId) {
        try {
            const { data: units, error } = await supabase
                .from('property_units')
                .select('capacity')
                .eq('property_id', propertyId);
            if (error) throw error;

            const total = (units || []).reduce((sum, u) => sum + parseInt(u.capacity || 0, 10), 0);

            await supabase
                .from('properties')
                .update({ total_capacity: total })
                .eq('id', propertyId);
        } catch (err) {
            console.error('Error syncing property total capacity:', err.message);
        }
    }
};

module.exports = unitModel;
