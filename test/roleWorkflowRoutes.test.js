const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const requireRole = require('../server/middleware/roleMiddleware');

// Exercise the real route-specific role middleware without touching a database.
const cases = [
    ['tenantAppRoutes', 'post', '/', ['tenant']],
    ['leaseRoutes', 'post', '/', ['landlord']],
    ['leaseRoutes', 'put', '/:id/accept', ['tenant']],
    ['paymentRoutes', 'post', '/', ['tenant']],
    ['paymentRoutes', 'put', '/:id/verify', ['landlord']],
    ['adminReviewRoutes', 'put', '/properties/:id/approve', ['admin']],
    ['maintenanceRoutes', 'post', '/maintenance/requests', ['tenant']],
    ['maintenanceRoutes', 'put', '/maintenance/requests/:id/landlord-assign', ['landlord']],
    ['maintenanceRoutes', 'put', '/maintenance/requests/:id/worker-status', ['maintenance']],
    ['maintenanceRoutes', 'put', '/maintenance/requests/:id/tenant-confirm', ['tenant']]
];
for (const [file, method, routePath, allowed] of cases) {
    test(`${file} ${method.toUpperCase()} ${routePath}: role access contract`, () => {
        const routes = [];
        const controller = (_req, _res, next) => next();
        const router = { use() {} };
        for (const verb of ['get', 'post', 'put', 'patch', 'delete']) {
            router[verb] = (url, ...handlers) => routes.push({ verb, url, handlers });
        }
        const context = vm.createContext({ module: { exports: {} }, require(name) {
            if (name === 'express') return { Router: () => router };
            if (name.endsWith('roleMiddleware')) return requireRole;
            if (name.endsWith('authMiddleware')) return controller;
            return new Proxy({}, { get: () => controller });
        } });
        vm.runInContext(fs.readFileSync(path.join(__dirname, `../server/routes/${file}.js`), 'utf8'), context);
        const route = routes.find(r => r.verb === method && r.url === routePath);
        assert.ok(route, 'route exists');
        for (const role of ['tenant', 'landlord', 'admin', 'maintenance']) {
            let reached = false, status;
            const req = { user: { id: 'fixture', role }, headers: {} };
            const res = { status(code) { status = code; return this; }, json() {} };
            let index = 0;
            const next = () => {
                if (index === route.handlers.length) { reached = true; return; }
                route.handlers[index++](req, res, next);
            };
            next();
            assert.equal(reached, allowed.includes(role), role);
            if (!allowed.includes(role)) assert.equal(status, 403);
        }
    });
}
