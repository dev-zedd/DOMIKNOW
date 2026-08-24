const supabase = require('../config/supabaseClient');

const userModel = {
    async createUser(userData) {
        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async findByEmail(email) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'not found'
        return data || null;
    },

    async findById(id) {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, email, role, contact_number, address, profile_image_url, is_verified, account_status, created_at')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    },

    async findCredentialsById(id) {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, password_hash')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    },

    async updateProfile(id, profileData) {
        // Only allow updating these fields
        const { full_name, contact_number, address, profile_image_url } = profileData;
        const updates = {};
        if (full_name !== undefined) updates.full_name = full_name;
        if (contact_number !== undefined) updates.contact_number = contact_number;
        if (address !== undefined) updates.address = address;
        if (profile_image_url !== undefined) updates.profile_image_url = profile_image_url;
        
        updates.updated_at = new Date();

        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select('id, full_name, email, role, contact_number, address, profile_image_url, is_verified, account_status')
            .single();
            
        if (error) throw error;
        return data;
    },

    async updateStatus(id, status) {
        const { data, error } = await supabase
            .from('users')
            .update({ account_status: status, suspension_lifted_at: null, updated_at: new Date() })
            .eq('id', id)
            .select('id, email, account_status')
            .single();
            
        if (error) throw error;
        return data;
    },

    /**
     * Suspend a user for a specific number of days.
     * Stores suspension_lifted_at so the server can auto-lift it on next login.
     */
    async updateSuspension(id, days) {
        const liftAt = new Date();
        liftAt.setDate(liftAt.getDate() + (days || 7));

        const { data, error } = await supabase
            .from('users')
            .update({
                account_status: 'disabled',
                suspension_lifted_at: liftAt.toISOString(),
                updated_at: new Date()
            })
            .eq('id', id)
            .select('id, email, account_status, suspension_lifted_at')
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Check if a suspended user's suspension has expired and auto-lift if so.
     * Call this on every login for suspended accounts.
     * Returns the (possibly updated) user record.
     */
    async liftExpiredSuspension(user) {
        if (user.account_status !== 'disabled') return user;
        if (!user.suspension_lifted_at) return user;

        const liftAt = new Date(user.suspension_lifted_at);
        if (new Date() < liftAt) return user; // Still within suspension period

        // Period over — restore to active
        const { data, error } = await supabase
            .from('users')
            .update({
                account_status: 'active',
                suspension_lifted_at: null,
                updated_at: new Date()
            })
            .eq('id', user.id)
            .select('id, email, account_status, suspension_lifted_at')
            .single();

        if (error) throw error;
        console.log(`[Auth] Suspension lifted for user ${user.id} (${user.email}) — period expired.`);
        return data;
    },

    async updateVerified(id, role) {
        let newStatus = 'pending';
        // Account status rules:
        if (role === 'tenant') {
            newStatus = 'active';
        } else if (role === 'landlord' || role === 'maintenance') {
            newStatus = 'pending'; // Requires admin approval
        } else if (role === 'admin') {
            newStatus = 'active';
        }

        const { data, error } = await supabase
            .from('users')
            .update({ 
                is_verified: true, 
                account_status: newStatus,
                updated_at: new Date() 
            })
            .eq('id', id)
            .select('id, is_verified, account_status')
            .single();
            
        if (error) throw error;
        return data;
    },

    async getAllUsers() {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, email, role, is_verified, account_status, created_at')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return data;
    },
    async updatePassword(id, passwordHash) {
        const { data, error } = await supabase
            .from('users')
            .update({ password_hash: passwordHash, updated_at: new Date() })
            .eq('id', id)
            .select('id, email')
            .single();
        if (error) throw error;
        return data;
    }
};

module.exports = userModel;
