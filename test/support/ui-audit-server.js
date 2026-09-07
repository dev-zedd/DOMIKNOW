// Isolated UI fixtures: no database, email, storage or production API access.
// Run with node test/support/ui-audit-server.js, then visit localhost:3101-3104.
const express = require('express');
const path = require('node:path');
const roles = ['tenant', 'landlord', 'admin', 'maintenance'];
const landing = ['applications.html', 'properties.html', 'users.html', 'tasks.html'];
const billing = {
    id: 'fixture-bill', tenant_id: 'fixture-user', landlord_id: 'fixture-user',
    billing_month: 'September 2026', rent_amount: 1000, total_amount: 1000,
    paid_amount: 400, remaining_balance: 600, billing_status: 'partially_paid',
    due_date: '2099-09-30', properties: { property_name: 'Audit Rental', address: 'Test address' },
    lease_records: { lease_number: 'TEST-001', monthly_rent: 1000, utilities_covered: {} }
};

roles.forEach((role, index) => {
    const app = express();
    app.get('/', (_req, res) => res.type('html').send(`<!doctype html><title>DOMIKNOW isolated UI audit</title>
        <script>
        localStorage.setItem('domiknow_token', 'isolated-ui-fixture');
        localStorage.setItem('domiknow_role', '${role}');
        location.replace('/pages/${role}/${landing[index]}');
        </script>`));
    app.use('/api', (req, res) => {
        if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Read-only UI fixture. No changes were saved.' });
        let data = [];
        if (req.path === '/dashboard/me' || req.path === '/users/profile' || req.path === '/users/me') {
            data = { id: 'fixture-user', role, full_name: `Audit ${role}`, email: `${role}@example.invalid`, account_status: 'active', email_verified: true };
        } else if (req.path === '/users') {
            data = [{ id: 'analytics-fixture', full_name: 'Audit User', email: 'audit@example.invalid', role: 'tenant', account_status: 'active', created_at: '2026-09-01T00:00:00Z' }];
        } else if (req.path === '/maintenance/requests/worker') {
            data = ['assigned', 'repairing', 'verified', 'closed'].map((status, index) => ({
                id: `fixture-task-${index}`, status, issue_title: ['Leaking tap', 'Broken light', 'Door repair', 'Window repair'][index],
                priority_level: index === 0 ? 'high' : 'normal', properties: { property_name: 'Audit Rental' },
                unit_number: String(index + 1), issue_category: 'general', created_at: '2026-09-01'
            }));
        } else if (req.path.startsWith('/notifications')) {
            data = { notifications: [], unread_count: 0, total: 0, page: 1, total_pages: 1 };
        } else if (req.path === '/billings/my' || req.path === '/billings') {
            data = [billing];
        } else if (req.path === '/billings/fixture-bill') {
            data = billing;
        } else if (req.path === '/landlord/applications') {
            data = ['Alex Fixture', 'Sam Fixture'].map((name, index) => ({
                id: `fixture-application-${index}`, status: 'pending', document_count: 0,
                users: { full_name: name, email: `person${index}@example.invalid` },
                properties: { property_name: 'Audit Rental' }, desired_move_in_date: '2099-09-01', created_at: '2026-09-01'
            }));
        }
        res.json({ success: true, data });
    });
    app.use(express.static(path.join(__dirname, '../../public')));
    app.listen(3101 + index, '127.0.0.1', () => console.log(`Isolated ${role}: http://127.0.0.1:${3101 + index}`));
});
