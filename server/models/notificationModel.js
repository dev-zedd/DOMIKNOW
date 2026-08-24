const supabase = require('../config/supabaseClient');

// In-memory fallback notifications store
let memoryNotifications = [];
const sameUser = (left, right) => String(left) === String(right);

const notificationModel = {
    async create(notificationData) {
        const generatedId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const item = {
            id: notificationData.id || generatedId,
            user_id: notificationData.user_id,
            type: notificationData.type || 'system_update',
            title: notificationData.title || 'System Notification',
            message: notificationData.message || '',
            reference_id: notificationData.reference_id || null,
            read_status: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            // Let PostgreSQL generate its native UUID. The synthetic ID is only
            // used by the process-local fallback when storage is unavailable.
            const databaseItem = { ...item };
            if (!notificationData.id) delete databaseItem.id;
            const { data, error } = await supabase
                .from('notifications')
                .insert([databaseItem])
                .select('*')
                .single();

            if (!error && data) return data;
            console.warn('[notificationModel] Supabase insert fallback to memory notification store');
        } catch (err) {
            console.warn('[notificationModel] Supabase storage fallback to memory notification store');
        }

        memoryNotifications.unshift(item);
        return item;
    },

    async createForRole(role, notificationData) {
        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('id')
                .eq('role', role);

            if (error) {
                console.warn(`[notificationModel] Unable to resolve ${role} recipients`);
                return [];
            }

            return Promise.all((users || []).map(user => this.create({
                ...notificationData,
                user_id: user.id
            })));
        } catch (err) {
            console.warn(`[notificationModel] Unable to create notifications for role ${role}`);
            return [];
        }
    },

    async findByUserId(userId) {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (!error) return data || [];
        } catch (err) {
            console.warn('[notificationModel] Supabase query fallback to memory store');
        }

        return memoryNotifications.filter(n => sameUser(n.user_id, userId));
    },

    async markAsRead(id, userId) {
        const item = memoryNotifications.find(n => String(n.id) === String(id) && sameUser(n.user_id, userId));
        if (item) {
            item.read_status = true;
            item.updated_at = new Date().toISOString();
        }

        try {
            const { data, error } = await supabase
                .from('notifications')
                .update({ read_status: true, updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_id', userId)
                .select('*')
                .single();

            if (!error && data) return data;
        } catch (err) {
            console.warn('[notificationModel] Supabase markAsRead fallback');
        }

        return item || { id, read_status: true };
    },

    async markAllRead(userId) {
        memoryNotifications.forEach(n => {
            if (sameUser(n.user_id, userId)) {
                n.read_status = true;
                n.updated_at = new Date().toISOString();
            }
        });

        try {
            await supabase
                .from('notifications')
                .update({ read_status: true, updated_at: new Date().toISOString() })
                .eq('user_id', userId);
        } catch (err) {
            console.warn('[notificationModel] Supabase markAllRead fallback');
        }

        return true;
    },

    async delete(id, userId) {
        memoryNotifications = memoryNotifications.filter(n => !(String(n.id) === String(id) && sameUser(n.user_id, userId)));

        try {
            await supabase
                .from('notifications')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);
        } catch (err) {
            console.warn('[notificationModel] Supabase delete fallback');
        }

        return true;
    }
};

module.exports = notificationModel;
