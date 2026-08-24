-- Persistent in-app notifications for every authenticated DOMIKNOW role.
-- The server uses the Supabase service-role client; notification records are
-- never queried directly from the browser.

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(80) NOT NULL DEFAULT 'system_update',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    reference_id TEXT,
    read_status BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
    ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
    ON notifications (user_id, read_status)
    WHERE read_status = FALSE;

COMMENT ON TABLE notifications IS
    'User-scoped notification inbox populated by rental, lease, payment, maintenance, report, and governance events.';
