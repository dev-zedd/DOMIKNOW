const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const responseHelper = require('../server/utils/responseHelper');
const { withBillingBalance } = require('../server/utils/billingBalanceHelper');
const requireRole = require('../server/middleware/roleMiddleware');

function createFixture(customTables = {}) {
    const tables = {
        billing_records: [],
        lease_records: [],
        payment_records: [],
        notifications: [],
        audit_logs: [],
        ...customTables
    };
    let sequence = 0;

    const db = {
        from(table) {
            const filters = [];
            let payload = null;
            let inserted = null;
            let deleted = false;

            const query = {
                select() { return this; },
                eq(key, value) { filters.push(row => row[key] === value); return this; },
                in(key, values) { filters.push(row => values.includes(row[key])); return this; },
                lt(key, value) { filters.push(row => String(row[key]) < String(value)); return this; },
                order() { return this; },
                update(data) { payload = data; return this; },
                insert(data) { inserted = Array.isArray(data) ? data : [data]; return this; },
                delete() { deleted = true; return this; },
                execute(single = false) {
                    if (!tables[table]) tables[table] = [];
                    if (inserted) {
                        const rows = inserted.map(r => ({ id: r.id || `fixture-${++sequence}`, ...r }));
                        tables[table].push(...rows);
                        return { data: single ? { ...rows[0] } : rows.map(r => ({ ...r })), error: null };
                    }
                    if (deleted) {
                        const remaining = [];
                        const removed = [];
                        for (const row of tables[table]) {
                            if (filters.every(f => f(row))) removed.push(row);
                            else remaining.push(row);
                        }
                        tables[table] = remaining;
                        return { data: removed, error: null };
                    }
                    const rows = tables[table].filter(row => filters.every(f => f(row)));
                    if (payload) {
                        rows.forEach(row => Object.assign(row, payload));
                    }
                    return { data: single ? (rows[0] ? { ...rows[0] } : null) : rows.map(r => ({ ...r })), error: null };
                },
                maybeSingle() { return Promise.resolve(this.execute(true)); },
                single() { return Promise.resolve(this.execute(true)); },
                then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); }
            };
            return query;
        }
    };

    const auditLogModel = {
        log: async (userId, action, description) => {
            tables.audit_logs.push({ userId, action, description, created_at: new Date() });
            return true;
        }
    };

    const notificationModel = {
        create: async payload => {
            const row = { id: `notif-${++sequence}`, ...payload, created_at: new Date() };
            tables.notifications.push(row);
            return row;
        }
    };

    // Load billingModel in sandbox
    const modelContext = {
        module: { exports: {} },
        Date,
        console: { error() {}, warn() {}, log() {} },
        require(name) {
            if (name.endsWith('billingBalanceHelper')) return { withBillingBalance };
            if (name.endsWith('supabaseClient')) return db;
            throw new Error(`Unmocked model dependency: ${name}`);
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/models/billingModel.js'), 'utf8'), modelContext);
    const billingModel = modelContext.module.exports;

    // Load billingController in sandbox
    const controllerContext = {
        module: { exports: {} },
        Date,
        console: { error() {}, warn() {}, log() {} },
        require(name) {
            if (name.endsWith('billingModel')) return billingModel;
            if (name.endsWith('auditLogModel')) return auditLogModel;
            if (name.endsWith('notificationModel')) return notificationModel;
            if (name.endsWith('responseHelper')) return responseHelper;
            if (name.endsWith('supabaseClient')) return db;
            throw new Error(`Unmocked controller dependency: ${name}`);
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/controllers/billingController.js'), 'utf8'), controllerContext);
    const billingController = controllerContext.module.exports;

    return { db, tables, billingModel, billingController, auditLogModel, notificationModel };
}

test('billingModel.updateBilling allows modifying overdue statements but rejects paid ones', async () => {
    const fixture = createFixture({
        billing_records: [
            { id: 'bill-overdue', landlord_id: 'landlord-1', billing_status: 'overdue', rent_amount: 5000 },
            { id: 'bill-paid', landlord_id: 'landlord-1', billing_status: 'paid', rent_amount: 5000 }
        ]
    });

    const updated = await fixture.billingModel.updateBilling('bill-overdue', 'landlord-1', { rent_amount: 4500 });
    assert.equal(updated.rent_amount, 4500);

    await assert.rejects(
        fixture.billingModel.updateBilling('bill-paid', 'landlord-1', { rent_amount: 4500 }),
        err => err.message.includes('Only billings in Draft, Pending, or Overdue status can be updated')
    );
});

test('billingModel.overrideBilling rejects paid statements and updates overdue bills', async () => {
    const fixture = createFixture({
        billing_records: [
            { id: 'bill-overdue', landlord_id: 'landlord-1', billing_status: 'overdue', penalty_amount: 300, total_amount: 5300 },
            { id: 'bill-paid', landlord_id: 'landlord-1', billing_status: 'paid', penalty_amount: 0, total_amount: 5000 },
            { id: 'bill-other', landlord_id: 'landlord-2', billing_status: 'overdue', penalty_amount: 300, total_amount: 5300 }
        ]
    });

    // Enforce ownership
    const unauthorized = await fixture.billingModel.overrideBilling('bill-other', 'landlord-1', { penalty_amount: 0 });
    assert.equal(unauthorized, null);

    // Reject paid statement
    await assert.rejects(
        fixture.billingModel.overrideBilling('bill-paid', 'landlord-1', { penalty_amount: 0 }),
        err => err.message.includes('Cannot apply leeway or override to a fully paid billing statement')
    );

    // Allow override on overdue statement
    const overridden = await fixture.billingModel.overrideBilling('bill-overdue', 'landlord-1', {
        penalty_amount: 0,
        total_amount: 5000,
        billing_status: 'pending_payment',
        remarks: '[LEEWAY GRANTED] Waived penalty'
    });
    assert.equal(overridden.penalty_amount, 0);
    assert.equal(overridden.billing_status, 'pending_payment');
});

test('billingController.manualOverrideBilling extends due date, waives penalty, and resets overdue status', async () => {
    const fixture = createFixture({
        billing_records: [
            {
                id: 'bill-1',
                lease_id: 'lease-1',
                landlord_id: 'landlord-1',
                tenant_id: 'tenant-1',
                billing_month: '2026-10',
                rent_amount: 6000,
                water: 300,
                electricity: 700,
                penalty_amount: 500,
                total_amount: 7500,
                due_date: '2026-10-05',
                billing_status: 'overdue',
                remarks: 'Initial bill notification'
            }
        ]
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const futureDateStr = futureDate.toISOString().slice(0, 10);

    const req = {
        params: { id: 'bill-1' },
        user: { id: 'landlord-1', role: 'landlord' },
        body: {
            extended_due_date: futureDateStr,
            waive_penalty: true,
            discount_amount: 500,
            override_reason: 'Tenant requested temporary extension and discount'
        }
    };

    let responseCode = null;
    let responseBody = null;
    const res = {
        status(code) { responseCode = code; return this; },
        json(data) { responseBody = data; return this; }
    };

    await fixture.billingController.manualOverrideBilling(req, res);

    assert.equal(responseBody.success, true);
    assert.equal(responseBody.data.billing_status, 'pending_payment');
    assert.equal(responseBody.data.penalty_amount, 0);
    // Adjusted rent: 6000 - 500 = 5500. Total = 5500 + 300 + 700 = 6500
    assert.equal(responseBody.data.total_amount, 6500);
    assert.equal(responseBody.data.due_date, futureDateStr);
    assert.ok(responseBody.data.remarks.includes('[LEEWAY GRANTED]') || responseBody.data.remarks.includes('[PINAGBIGYAN]'));
    assert.ok(responseBody.data.remarks.includes('Extended Due Date') || responseBody.data.remarks.includes('Palugit sa Due Date'));

    // Check audit log
    assert.equal(fixture.tables.audit_logs.length, 1);
    assert.equal(fixture.tables.audit_logs[0].action, 'BILLING_OVERRIDE');

    // Check tenant notification
    assert.equal(fixture.tables.notifications.length, 1);
    assert.equal(fixture.tables.notifications[0].user_id, 'tenant-1');
    assert.equal(fixture.tables.notifications[0].type, 'billing_override');
});

test('billingController.manualOverrideBilling rejects override on paid billings', async () => {
    const fixture = createFixture({
        billing_records: [
            {
                id: 'bill-paid',
                landlord_id: 'landlord-1',
                tenant_id: 'tenant-1',
                billing_status: 'paid',
                rent_amount: 5000,
                total_amount: 5000,
                due_date: '2026-10-05'
            }
        ]
    });

    const req = {
        params: { id: 'bill-paid' },
        user: { id: 'landlord-1', role: 'landlord' },
        body: { extended_due_date: '2026-10-30', waive_penalty: false }
    };

    let statusCode = null;
    let responseBody = null;
    const res = {
        status(code) { statusCode = code; return this; },
        json(data) { responseBody = data; return this; }
    };

    await fixture.billingController.manualOverrideBilling(req, res);
    assert.equal(statusCode, 400);
    assert.equal(responseBody.success, false);
});

test('billingController.autoGenerateMonthlyBillings generates statements for active leases and avoids duplicates', async () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentYearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const fixture = createFixture({
        lease_records: [
            {
                id: 'lease-active',
                landlord_id: 'landlord-1',
                tenant_id: 'tenant-1',
                property_id: 'prop-1',
                unit_id: 'unit-1',
                lease_status: 'active',
                lease_start_date: `${currentYearMonth}-01`,
                monthly_rent: 8000,
                security_deposit: 8000,
                advance_payment: 8000,
                payment_due_day: 5
            }
        ],
        billing_records: []
    });

    // Run auto generation
    await fixture.billingController.autoGenerateMonthlyBillings('landlord-1', true);

    // Initial Move-In statement should be generated for the start month
    const generatedBills = fixture.tables.billing_records;
    assert.equal(generatedBills.length, 1);
    assert.equal(generatedBills[0].lease_id, 'lease-active');
    assert.equal(generatedBills[0].billing_status, 'pending_payment');
    assert.equal(generatedBills[0].rent_amount, 8000);
    // Move-in includes deposit + advance: 8000 + 8000 + 8000 = 24000
    assert.equal(generatedBills[0].total_amount, 24000);

    // Run a second time to test idempotence (no duplicates created)
    await fixture.billingController.autoGenerateMonthlyBillings('landlord-1', true);
    assert.equal(fixture.tables.billing_records.length, 1);
});

test('role access contract protects manual override route for landlord only', () => {
    const routes = [];
    const controller = (_req, _res, next) => next();
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

    vm.runInContext(fs.readFileSync(path.join(__dirname, '../server/routes/billingRoutes.js'), 'utf8'), context);
    const overrideRoute = routes.find(r => r.verb === 'put' && r.url === '/:id/override');
    assert.ok(overrideRoute, 'PUT /:id/override exists');

    for (const role of ['tenant', 'landlord', 'admin', 'maintenance']) {
        let reached = false;
        let statusCode = null;
        const req = { user: { id: 'fixture', role }, headers: {} };
        const res = { status(code) { statusCode = code; return this; }, json() {} };
        let index = 0;
        const next = () => {
            if (index === overrideRoute.handlers.length) {
                reached = true;
                return;
            }
            overrideRoute.handlers[index++](req, res, next);
        };
        next();

        if (role === 'landlord') {
            assert.equal(reached, true, 'Landlord should be allowed');
        } else {
            assert.equal(reached, false, `${role} should be blocked`);
            assert.equal(statusCode, 403, `${role} should receive 403`);
        }
    }
});
