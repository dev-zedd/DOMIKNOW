const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const jwt = require('jsonwebtoken');
const roleMiddleware = require('../server/middleware/roleMiddleware');
const root = path.join(__dirname, '../server');
const secret = 'isolated-workflow-contract-test-secret';
const pass = (_req, _res, next) => next();

// Real Express routers, mount order, JWT verification and role middleware.
// Controllers are endpoints only here; business behavior has separate tests.
function mountedApp() {
    const authContext = { module: { exports: {} }, process: { env: { JWT_SECRET: secret } }, require: name => name === 'jsonwebtoken' ? jwt : require('../server/utils/responseHelper') };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'middleware/authMiddleware.js'), 'utf8'), authContext);
    const routers = new Map();
    for (const file of fs.readdirSync(path.join(root, 'routes'))) {
        const context = { module: { exports: {} }, require(name) {
            if (name.endsWith('authMiddleware')) return authContext.module.exports;
            if (name.endsWith('roleMiddleware')) return roleMiddleware;
            if (name.endsWith('validationMiddleware')) return pass;
            if (name === 'express-rate-limit') return () => pass;
            if (name.endsWith('responseHelper')) return require('../server/utils/responseHelper');
            if (name.includes('/utils/')) return new Proxy({}, { get: () => () => { throw new Error('External utility invoked during route-only test'); } });
            if (name.includes('/controllers/')) return new Proxy({}, { get: (_target, method) => (_req, res) => res.json({ controller: `${path.basename(name)}.${String(method)}` }) });
            return require(name);
        } };
        vm.runInNewContext(fs.readFileSync(path.join(root, 'routes', file), 'utf8'), context);
        routers.set(file.replace('.js', ''), context.module.exports);
    }
    const app = express(); app.use(express.json());
    const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    for (const match of source.matchAll(/app\.use\('([^']+)',\s*(\w+Routes)\)/g)) app.use(match[1], routers.get(match[2]));
    app.use((_req, res) => res.status(404).json({ message: 'No endpoint' }));
    return app;
}

const roles = ['tenant', 'landlord', 'admin', 'maintenance'];
const cases = [
    ['get', '/api/properties', 'propertyController.getAllProperties', ['public', ...roles]],
    ['get', '/api/properties/fixture/units', 'unitController.getUnitsByProperty', ['public', ...roles]],
    ['get', '/api/units/fixture', 'unitController.getUnitById', ['public', ...roles]],
    ['get', '/api/public/feedback', 'feedbackController.getPublicFeedback', ['public', ...roles]],
    ['get', '/api/policies', 'policyController.getAllPolicies', ['public', ...roles]],
    ['get', '/api/users/me', 'userController.getProfile', roles],
    ['put', '/api/users/me', 'userController.updateProfile', roles],
    ['put', '/api/users/me/password', 'userController.changePassword', roles],
    ['get', '/api/notifications/my', 'notificationController.getMyNotifications', roles],
    ['put', '/api/notifications/read-all', 'notificationController.markAllRead', roles],
    ['put', '/api/notifications/fixture/read', 'notificationController.markAsRead', roles],
    ['delete', '/api/notifications/fixture', 'notificationController.deleteNotification', roles],
    ['post', '/api/landlord/properties', 'landlordController.createProperty', ['landlord']],
    ['post', '/api/landlord/properties/fixture/documents', 'landlordController.uploadDocument', ['landlord']],
    ['post', '/api/properties/fixture/units', 'unitController.createUnit', ['landlord', 'admin']],
    ['put', '/api/admin/properties/fixture/approve', 'adminReviewController.approveProperty', ['admin']],
    ['put', '/api/admin/properties/fixture/reject', 'adminReviewController.rejectProperty', ['admin']],
    ['put', '/api/users/fixture/status', 'userController.updateUserStatus', ['admin']],
    ['post', '/api/tenant/applications', 'tenantAppController.createApplication', ['tenant']],
    ['post', '/api/tenant/applications/fixture/documents', 'tenantAppController.uploadDocument', ['tenant']],
    ['put', '/api/landlord/applications/fixture/status', 'landlordController.updateApplicationStatus', ['landlord']],
    ['post', '/api/leases', 'leaseController.createLease', ['landlord']],
    ['put', '/api/leases/fixture', 'leaseController.updateLeaseDetails', ['landlord']],
    ['put', '/api/leases/fixture/accept', 'leaseController.acceptLease', ['tenant']],
    ['put', '/api/leases/fixture/reject', 'leaseController.rejectLease', ['tenant']],
    ['put', '/api/leases/fixture/status', 'leaseController.updateLeaseStatus', ['landlord']],
    ['post', '/api/utilities', 'utilityController.createUtilityRecord', ['landlord']],
    ['get', '/api/utilities/my', 'utilityController.getTenantUtilities', ['tenant']],
    ['post', '/api/billings', 'billingController.createBilling', ['landlord']],
    ['get', '/api/billings/my', 'billingController.getTenantBillings', ['tenant']],
    ['post', '/api/payments', 'paymentController.submitPayment', ['tenant']],
    ['put', '/api/payments/fixture/verify', 'paymentController.verifyPayment', ['landlord']],
    ['post', '/api/tenant/complaints', 'complaintController.submitComplaint', ['tenant']],
    ['put', '/api/landlord/complaints/fixture/status', 'complaintController.updateComplaintStatus', ['landlord']],
    ['post', '/api/tenant/feedback', 'feedbackController.submitFeedback', ['tenant']],
    ['put', '/api/admin/feedback/fixture/status', 'feedbackController.updateFeedbackStatus', ['admin']],
    ['post', '/api/tenant/ratings', 'ratingsController.submitRating', ['tenant']],
    ['get', '/api/landlord/ratings', 'ratingsController.getLandlordRatings', ['landlord']],
    ['post', '/api/reports', 'reportController.submitReport', ['tenant', 'landlord', 'maintenance']],
    ['put', '/api/admin/reports/fixture/status', 'reportController.updateReportStatus', ['admin']],
    ['post', '/api/tenant-reports', 'tenantReportController.submitTenantReport', ['landlord']],
    ['put', '/api/tenant-reports/fixture/explain', 'tenantReportController.submitExplanation', ['tenant']],
    ['put', '/api/admin/tenant-reports/fixture/decision', 'tenantReportController.adminDecision', ['admin']],
    ['post', '/api/landlord-reports', 'landlordReportController.submitLandlordReport', ['tenant']],
    ['put', '/api/landlord-reports/fixture/explain', 'landlordReportController.submitLandlordExplanation', ['landlord']],
    ['put', '/api/admin/landlord-reports/fixture/decision', 'landlordReportController.processAdminDecision', ['admin']],
    ['post', '/api/maintenance/requests', 'maintenanceController.createMaintenanceRequest', ['tenant']],
    ['put', '/api/maintenance/requests/fixture/landlord-respond', 'maintenanceController.landlordRespondRequest', ['landlord']],
    ['put', '/api/maintenance/requests/fixture/landlord-assign', 'maintenanceController.landlordAssignRequest', ['landlord']],
    ['put', '/api/maintenance/requests/fixture/worker-respond', 'maintenanceController.workerRespondJob', ['maintenance']],
    ['put', '/api/maintenance/requests/fixture/worker-status', 'maintenanceController.workerUpdateStatus', ['maintenance']],
    ['post', '/api/maintenance/requests/fixture/worker-report', 'maintenanceController.workerSubmitReport', ['maintenance']],
    ['put', '/api/maintenance/requests/fixture/landlord-verify', 'maintenanceController.landlordVerifyCompletion', ['landlord']],
    ['put', '/api/maintenance/requests/fixture/tenant-confirm', 'maintenanceController.tenantConfirmRequest', ['tenant']]
];

test('mounted public and four-role workflow API contracts', async t => {
    const server = mountedApp().listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [method, url, controller, allowed] of cases) {
        await t.test(`${method.toUpperCase()} ${url}`, async () => {
            for (const role of ['public', ...roles]) {
                const headers = { 'Content-Type': 'application/json' };
                if (role !== 'public') headers.Authorization = `Bearer ${jwt.sign({ id: 'fixture', role }, secret, { expiresIn: '5m' })}`;
                const response = await fetch(base + url, { method: method.toUpperCase(), headers, ...(method !== 'get' ? { body: '{}' } : {}) });
                const body = await response.json();
                assert.equal(response.status, allowed.includes(role) ? 200 : role === 'public' ? 401 : 403, `${role}: ${JSON.stringify(body)}`);
                if (allowed.includes(role)) assert.equal(body.controller, controller);
            }
        });
    }
    for (const token of ['bad-token', jwt.sign({ id: 'fixture', role: 'admin' }, secret, { expiresIn: -1 })]) {
        const response = await fetch(base + '/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status, 401);
    }
});
