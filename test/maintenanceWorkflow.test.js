const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const responseHelper = require('../server/utils/responseHelper');

function workflow(status) {
    const record = { id: 'request', status, tenant_id: 'tenant', landlord_id: 'landlord', assigned_maintenance_id: 'worker', issue_title: 'Leaking tap' };
    const updates = [], notifications = [], reports = [], materials = [];
    const deps = {
        '../utils/responseHelper': responseHelper,
        '../models/maintenanceModel': {
            findRequestDetails: async () => record,
            updateRequestStatus: async (_id, payload) => { updates.push(payload); return Object.assign(record, payload); },
            createProgressUpdate: async () => {},
            createAssignment: async () => {},
            createReport: async value => { reports.push(value); return value; },
            deleteRequestMaterials: async () => { materials.length = 0; },
            addMaterial: async value => materials.push(value)
        },
        '../config/supabaseClient': { from() { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { role: 'maintenance', created_by_landlord_id: 'landlord' }, error: null }) }; } },
        '../models/auditLogModel': { log: async () => {} },
        '../models/notificationModel': { create: async payload => { notifications.push(payload); } }
    };
    const context = vm.createContext({ require: name => deps[name] || {}, module: { exports: {} }, console, Date, Promise });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../server/controllers/maintenanceController.js'), 'utf8'), context);
    return {
        record, updates, notifications, reports, materials,
        async act(method, user, body) {
            const res = { status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
            await context.module.exports[method]({ params: { id: 'request' }, user: { id: user }, body }, res);
            return res;
        }
    };
}

test('landlord approval hands the request to assignment and notifies its tenant', async () => {
    const flow = workflow('pending');
    assert.equal((await flow.act('landlordRespondRequest', 'landlord', { decision: 'approve' })).statusCode, 200);
    assert.equal(flow.record.status, 'approved');
    assert.equal(flow.notifications[0].user_id, 'tenant');
    assert.equal((await flow.act('landlordRespondRequest', 'landlord', { decision: 'approve' })).statusCode, 400);
    assert.equal(flow.updates.length, 1);
});

test('worker progresses sequentially and informs tenant and landlord at each step', async () => {
    const flow = workflow('accepted');
    for (const status of ['travelling', 'arrived', 'repairing']) {
        assert.equal((await flow.act('workerUpdateStatus', 'worker', { status })).statusCode, 200);
        assert.equal(flow.record.status, status);
    }
    assert.equal(flow.notifications.length, 6);
    assert.deepEqual([...new Set(flow.notifications.map(n => n.user_id))].sort(), ['landlord', 'tenant']);
});

test('worker cannot skip stages, repeat a stage, or update someone else’s task', async () => {
    const flow = workflow('accepted');
    assert.equal((await flow.act('workerUpdateStatus', 'worker', { status: 'repairing' })).statusCode, 400);
    assert.equal((await flow.act('workerUpdateStatus', 'another-worker', { status: 'travelling' })).statusCode, 404);
    assert.equal(flow.updates.length, 0);
    await flow.act('workerUpdateStatus', 'worker', { status: 'travelling' });
    assert.equal((await flow.act('workerUpdateStatus', 'worker', { status: 'travelling' })).statusCode, 400);
    assert.equal(flow.updates.length, 1);
});

test('tenant closes only completed work and rework requires an explanation', async () => {
    const early = workflow('repairing');
    assert.equal((await early.act('tenantConfirmRequest', 'tenant', { decision: 'confirm' })).statusCode, 400);
    assert.equal(early.updates.length, 0);
    const completed = workflow('completed');
    assert.equal((await completed.act('tenantConfirmRequest', 'tenant', { decision: 'rework', remarks: '' })).statusCode, 400);
    assert.equal((await completed.act('tenantConfirmRequest', 'tenant', { decision: 'confirm' })).statusCode, 200);
    assert.equal(completed.record.status, 'closed');
});

test('tenant rework returns the task to repair and informs the responsible people', async () => {
    const flow = workflow('verified');
    assert.equal((await flow.act('tenantConfirmRequest', 'tenant', { decision: 'rework', remarks: 'The tap is still leaking.' })).statusCode, 200);
    assert.equal(flow.record.status, 'repairing');
    assert.deepEqual(flow.notifications.map(n => n.user_id).sort(), ['landlord', 'worker']);
});

test('assignment, worker acceptance, repair report, landlord verification and tenant closure', async () => {
    const flow = workflow('approved');
    assert.equal((await flow.act('landlordAssignRequest', 'landlord', { assigned_maintenance_id: 'worker', due_date: '2099-01-01' })).statusCode, 200);
    assert.equal((await flow.act('workerRespondJob', 'worker', { response: 'accept' })).statusCode, 200);
    for (const status of ['travelling', 'arrived', 'repairing']) await flow.act('workerUpdateStatus', 'worker', { status });
    assert.equal((await flow.act('workerSubmitReport', 'worker', {
        problem_found: 'Worn seal', repair_performed: 'Replaced the seal', labor_cost: 100,
        materials: [{ material_name: 'Seal', quantity: 2, cost: 0.1 }, { material_name: 'Donated washer', quantity: 1, cost: 0 }]
    })).statusCode, 200);
    assert.equal(flow.materials.length, 2);
    assert.equal(flow.record.material_cost, 0.2);
    assert.equal(flow.record.status, 'completed');
    assert.equal((await flow.act('landlordVerifyCompletion', 'landlord', { decision: 'accept' })).statusCode, 200);
    assert.equal((await flow.act('tenantConfirmRequest', 'tenant', { decision: 'confirm' })).statusCode, 200);
    assert.equal(flow.record.status, 'closed');
});

test('declined work returns to assignment without retaining the worker', async () => {
    const flow = workflow('assigned');
    assert.equal((await flow.act('workerRespondJob', 'worker', { response: 'decline' })).statusCode, 200);
    assert.equal(flow.record.status, 'approved');
    assert.equal(flow.record.assigned_maintenance_id, null);
});

test('invalid completion costs do not write reports, materials, or status', async () => {
    for (const extra of [{ labor_cost: -1 }, { labor_cost: '5oops' }, { materials: [{ material_name: 'Seal', quantity: 1.5, cost: 20 }] }, { materials: [{ material_name: 'Seal', quantity: 1, cost: -20 }] }]) {
        const flow = workflow('repairing');
        const result = await flow.act('workerSubmitReport', 'worker', { problem_found: 'Worn seal', repair_performed: 'Replaced seal', ...extra });
        assert.equal(result.statusCode, 400);
        assert.equal(flow.reports.length, 0);
        assert.equal(flow.materials.length, 0);
        assert.equal(flow.updates.length, 0);
    }
});
