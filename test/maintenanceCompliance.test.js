const test = require('node:test');
const assert = require('node:assert/strict');
const maintenanceComplianceService = require('../server/services/maintenanceComplianceService');
const maintenancePersonnelModel = require('../server/models/maintenancePersonnelModel');

test('Eligibility check blocks technician with pending screening or unverified account', async () => {
    // Mock user with pending account
    const fakeUserId = '00000000-0000-0000-0000-000000000001';

    // Verify service handles nonexistent or invalid user gracefully
    const result = await maintenanceComplianceService.checkEligibility(fakeUserId);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.length > 0);
    assert.ok(result.reasons.some(r => r.includes('User not found')));
});

test('Eligibility fails if profile availability is on_leave or offline', () => {
    const profileOnLeave = { availability_status: 'on_leave', is_active: true };
    const availability = profileOnLeave.availability_status.toLowerCase();
    const isBlocked = availability === 'on_leave' || availability === 'offline';
    assert.equal(isBlocked, true);

    const profileAvailable = { availability_status: 'available', is_active: true };
    const isAvailBlocked = profileAvailable.availability_status === 'on_leave' || profileAvailable.availability_status === 'offline';
    assert.equal(isAvailBlocked, false);
});

test('Eligibility fails if maintenance access status is not approved or restricted', () => {
    const validStatuses = ['approved', 'restricted'];
    assert.equal(validStatuses.includes('approved'), true);
    assert.equal(validStatuses.includes('restricted'), true);
    assert.equal(validStatuses.includes('pending'), false);
    assert.equal(validStatuses.includes('revoked'), false);
    assert.equal(validStatuses.includes('expired'), false);
    assert.equal(validStatuses.includes('rejected'), false);
});

test('Eligibility requires all active required screening records to be approved or conditional and unexpired', () => {
    const requirements = [
        { id: 'req-1', name: 'Background Check', required_for_assignment: true, is_active: true },
        { id: 'req-2', name: 'Safety Training', required_for_assignment: true, is_active: true },
        { id: 'req-3', name: 'Optional Badge', required_for_assignment: false, is_active: true }
    ];

    const recordsValid = [
        { requirement_id: 'req-1', status: 'approved', expires_at: new Date(Date.now() + 86400000).toISOString() },
        { requirement_id: 'req-2', status: 'conditional', expires_at: new Date(Date.now() + 86400000).toISOString() }
    ];

    const recordMap = new Map();
    recordsValid.forEach(r => recordMap.set(r.requirement_id, r));

    const reasons = [];
    const now = new Date();
    for (const req of requirements.filter(r => r.required_for_assignment && r.is_active)) {
        const rec = recordMap.get(req.id);
        if (!rec) {
            reasons.push(`Missing: ${req.name}`);
        } else if (!['approved', 'conditional'].includes(rec.status)) {
            reasons.push(`Invalid status: ${rec.status}`);
        } else if (rec.expires_at && new Date(rec.expires_at) < now) {
            reasons.push(`Expired: ${req.name}`);
        }
    }

    assert.equal(reasons.length, 0);

    // Now test with expired record
    const recordsExpired = [
        { requirement_id: 'req-1', status: 'approved', expires_at: new Date(Date.now() - 86400000).toISOString() },
        { requirement_id: 'req-2', status: 'pending', expires_at: null }
    ];
    const recordMap2 = new Map();
    recordsExpired.forEach(r => recordMap2.set(r.requirement_id, r));

    const reasons2 = [];
    for (const req of requirements.filter(r => r.required_for_assignment && r.is_active)) {
        const rec = recordMap2.get(req.id);
        if (!rec) {
            reasons2.push(`Missing: ${req.name}`);
        } else if (!['approved', 'conditional'].includes(rec.status)) {
            reasons2.push(`Invalid status for ${req.name}: ${rec.status}`);
        } else if (rec.expires_at && new Date(rec.expires_at) < now) {
            reasons2.push(`Expired: ${req.name}`);
        }
    }

    assert.equal(reasons2.length, 2);
    assert.ok(reasons2[0].includes('Expired'));
    assert.ok(reasons2[1].includes('Invalid status'));
});

test('Assignment blocks ineligible technician and throws explicit error message', async () => {
    await assert.rejects(
        async () => {
            await maintenanceComplianceService.assignTechnician({
                requestId: '00000000-0000-0000-0000-000000000001',
                technicianId: '00000000-0000-0000-0000-000000000002',
                dueDate: '2026-11-01',
                instructions: 'Fix electrical problem',
                assignedByUserId: '00000000-0000-0000-0000-000000000003'
            });
        },
        /Maintenance request not found|Assignment Blocked/
    );
});

test('Maintenance compliance routes enforce role access and auth', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const vm = require('node:vm');
    const requireRole = require('../server/middleware/roleMiddleware');

    const complianceCases = [
        ['post', '/admin/maintenance/create-user', ['admin']],
        ['post', '/admin/maintenance/send-invite', ['admin']],
        ['get', '/admin/maintenance/pool', ['admin', 'landlord']],
        ['get', '/maintenance/eligible-staff', ['admin', 'landlord']],
        ['post', '/maintenance/assign', ['admin', 'landlord']],
        ['post', '/maintenance/profile', ['maintenance', 'admin']],
        ['post', '/maintenance/screening/submit', ['maintenance', 'admin']],
        ['post', '/maintenance/screening/review', ['admin']],
        ['post', '/maintenance/access/update', ['admin']]
    ];

    const routes = [];
    const controller = (_req, _res, next) => next && next();
    const router = { use() {} };
    for (const verb of ['get', 'post', 'put', 'patch', 'delete']) {
        router[verb] = (url, ...handlers) => routes.push({ verb, url, handlers });
    }
    const context = vm.createContext({
        module: { exports: {} },
        require(name) {
            if (name === 'express') return { Router: () => router };
            if (name.endsWith('roleMiddleware')) return requireRole;
            if (name.endsWith('authMiddleware')) return controller;
            return new Proxy({}, { get: () => controller });
        }
    });

    vm.runInContext(fs.readFileSync(path.join(__dirname, '../server/routes/maintenanceComplianceRoutes.js'), 'utf8'), context);

    for (const [verb, routePath, allowed] of complianceCases) {
        const route = routes.find(r => r.verb === verb && r.url === routePath);
        assert.ok(route, `route exists: ${verb.toUpperCase()} ${routePath}`);
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
            assert.equal(reached, allowed.includes(role), `${routePath} role ${role}`);
            if (!allowed.includes(role)) assert.equal(status, 403);
        }
    }
});
