const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const responseHelper = require('../server/utils/responseHelper');
const { validateLeaseTerms } = require('../server/utils/leaseValidation');

function load(file, dependencies) {
    const context = { module: { exports: {} }, Date, console: { error() {}, warn() {} }, require(name) {
        const key = path.basename(name);
        if (key === 'responseHelper') return responseHelper;
        if (key === 'leaseValidation') return { validateLeaseTerms };
        if (!(key in dependencies)) throw new Error(`Unmocked dependency: ${name}`);
        return dependencies[key];
    } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server', file), 'utf8'), context);
    return context.module.exports;
}
function fixture() {
    const tables = {
        properties: [{ id: 'property', landlord_id: 'landlord', property_name: 'Fixture rental', status: 'pending_review' }],
        property_units: [{ id: 'unit', property_id: 'property', status: 'available', rental_style: 'whole_room' }],
        property_documents: [
            { property_id: 'property', document_type: 'government_permit', status: 'submitted' },
            { property_id: 'property', document_type: 'ownership_proof', status: 'submitted' }
        ], tenant_applications: [], lease_records: [], billing_records: [], unit_beds: []
    };
    let sequence = 0;
    const db = { from(table) {
        const filters = []; let payload, inserted, limit = Infinity;
        const query = {
            select() { return this; }, eq(key, value) { filters.push(row => row[key] === value); return this; },
            in(key, values) { filters.push(row => values.includes(row[key])); return this; },
            limit(value) { limit = value; return this; }, update(value) { payload = value; return this; },
            insert(value) { inserted = Array.isArray(value) ? value : [value]; return this; },
            execute(single = false) {
                if (inserted) { const rows = inserted.map(row => ({ id: `fixture-${++sequence}`, ...row })); tables[table].push(...rows); return { data: single ? { ...rows[0] } : rows, error: null }; }
                const rows = tables[table].filter(row => filters.every(filter => filter(row))).slice(0, limit);
                if (payload) rows.forEach(row => Object.assign(row, payload));
                return { data: single ? (rows[0] ? { ...rows[0] } : null) : rows.map(row => ({ ...row })), error: null };
            },
            maybeSingle() { return Promise.resolve(this.execute(true)); }, single() { return Promise.resolve(this.execute(true)); },
            then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); }
        }; return query;
    } };
    const notifications = [], audits = [];
    const dependencies = {
        supabaseClient: db, storageHelper: {},
        notificationModel: { create: async value => notifications.push(value) },
        auditLogModel: { log: async (...value) => audits.push(value) },
        userModel: { findById: async id => ({ id, full_name: id === 'tenant' ? 'Tenant Fixture' : 'Landlord Fixture' }) },
        propertyModel: { findById: async id => tables.properties.find(row => row.id === id) },
        unitModel: { findById: async id => tables.property_units.find(row => row.id === id) },
        tenantAppModel: {
            findDuplicateApplication: async (tenant, property) => tables.tenant_applications.find(row => row.tenant_id === tenant && row.property_id === property && row.status === 'pending'),
            createApplication: async row => (await db.from('tenant_applications').insert(row).single()).data
        },
        adminModel: {
            findPropertyReviewDetails: async () => ({ ...tables.properties[0], documents: tables.property_documents }),
            approveProperty: async () => { tables.properties[0].status = 'approved'; return { ...tables.properties[0] }; }
        },
        billingModel: { createBilling: async row => { tables.billing_records.push(row); return row; } }
    };
    dependencies.landlordModel = load('models/landlordModel.js', dependencies);
    dependencies.landlordModel.findApplicationDetails = async (id, landlord) => tables.tenant_applications.find(row => row.id === id && row.landlord_id === landlord);
    dependencies.leaseModel = load('models/leaseModel.js', dependencies);
    const controllers = Object.fromEntries(['adminReview', 'tenantApp', 'landlord', 'lease'].map(name => [name, load(`controllers/${name}Controller.js`, dependencies)]));
    const call = async (controller, method, role, body = {}, id = 'property') => {
        const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
        await controllers[controller][method]({ user: { id: role, role }, params: { id }, body, query: {} }, res);
        return res;
    };
    return { tables, dependencies, controllers, call, notifications, audits };
}
const terms = { lease_start_date: '2099-01-01', lease_end_date: '2100-01-01', monthly_rent: 1000, security_deposit: 1000, advance_payment: 1000, payment_due_day: 5 };

test('admin publication -> tenant application -> landlord approval/draft -> tenant signature -> landlord closure', async () => {
    const app = fixture();
    const application = { property_id: 'property', unit_id: 'unit', desired_move_in_date: '2099-01-01' };
    assert.equal((await app.call('tenantApp', 'createApplication', 'tenant', application)).code, 400);
    assert.equal((await app.call('adminReview', 'approveProperty', 'admin')).code, 200);
    const submitted = await app.call('tenantApp', 'createApplication', 'tenant', application);
    assert.equal(submitted.code, 201);
    const applicationId = submitted.body.data.id;
    assert.equal((await app.call('tenantApp', 'createApplication', 'tenant', application)).code, 400);
    assert.equal((await app.call('landlord', 'updateApplicationStatus', 'landlord', { status: 'approved' }, applicationId)).code, 200);
    assert.equal(app.tables.property_units[0].status, 'reserved');
    const drafted = await app.call('lease', 'createLease', 'landlord', { ...terms, application_id: applicationId });
    assert.equal(drafted.code, 201, JSON.stringify(drafted.body));
    const leaseId = drafted.body.data.id;
    assert.equal(app.tables.lease_records[0].lease_status, 'pending_tenant_acceptance');
    assert.equal((await app.call('lease', 'acceptLease', 'tenant', { signature_name: 'Tenant Fixture' }, leaseId)).code, 200);
    assert.equal(app.tables.lease_records[0].lease_status, 'active');
    assert.equal(app.tables.property_units[0].status, 'occupied');
    assert.equal(app.tables.billing_records.length, 1);
    assert.equal(app.tables.billing_records[0].total_amount, 3000);
    assert.equal((await app.call('lease', 'acceptLease', 'tenant', { signature_name: 'Tenant Fixture' }, leaseId)).code, 409);
    assert.equal(app.tables.billing_records.length, 1);
    assert.equal((await app.call('lease', 'updateLeaseStatus', 'landlord', { lease_status: 'ended' }, leaseId)).code, 200);
    assert.equal(app.tables.property_units[0].status, 'available');
    assert.ok(app.notifications.some(item => item.type === 'lease_signed' && item.user_id === 'landlord'));
    assert.ok(app.audits.some(item => item[1] === 'ACCEPT_LEASE'));
});

test('rejecting a competing application never releases another tenant occupancy', async () => {
    const app = fixture();
    app.tables.property_units[0].status = 'occupied';
    app.tables.tenant_applications.push({ id: 'application', landlord_id: 'landlord', tenant_id: 'tenant', unit_id: 'unit', status: 'pending' });
    assert.equal((await app.call('landlord', 'updateApplicationStatus', 'landlord', { status: 'rejected' }, 'application')).code, 200);
    assert.equal(app.tables.property_units[0].status, 'occupied');
    assert.equal((await app.call('landlord', 'updateApplicationStatus', 'landlord', { status: 'approved' }, 'application')).code, 409);
});

test('two applicants cannot reserve the same room', async () => {
    const app = fixture();
    for (const id of ['first', 'second']) app.tables.tenant_applications.push({ id, landlord_id: 'landlord', tenant_id: 'tenant', unit_id: 'unit', status: 'pending' });
    const results = await Promise.all(['first', 'second'].map(id => app.call('landlord', 'updateApplicationStatus', 'landlord', { status: 'approved' }, id)));
    assert.deepEqual(results.map(result => result.code).sort(), [200, 409]);
    assert.equal(app.tables.tenant_applications.filter(row => row.status === 'approved').length, 1);
});

test('lease decline, revision and signature respect ownership and current state', async () => {
    const app = fixture();
    app.tables.lease_records.push({ id: 'lease', landlord_id: 'landlord', tenant_id: 'tenant', lease_status: 'pending_tenant_acceptance', ...terms });
    assert.equal(await app.dependencies.leaseModel.acceptLease('lease', 'outsider', 'Other'), null);
    await app.dependencies.leaseModel.rejectLease('lease', 'tenant', 'Tenant Fixture', 'Please change the dates');
    assert.equal(app.tables.lease_records[0].lease_status, 'rejected');
    await app.dependencies.leaseModel.updateLease('lease', 'landlord', { ...terms, lease_status: 'pending_tenant_acceptance' });
    await app.dependencies.leaseModel.acceptLease('lease', 'tenant', 'Tenant Fixture');
    await assert.rejects(app.dependencies.leaseModel.updateLease('lease', 'landlord', terms), error => error.statusCode === 409);
    await assert.rejects(app.dependencies.leaseModel.updateLeaseStatus('lease', 'landlord', 'pending_tenant_acceptance'), error => error.statusCode === 400);
});

test('invalid lease dates, amounts and day values are rejected before drafting', async () => {
    assert.equal(validateLeaseTerms(terms), null);
    for (const invalid of [{ lease_start_date: '2099-02-30' }, { lease_end_date: '2098-01-01' }, { monthly_rent: -1 }, { monthly_rent: '1000oops' }, { security_deposit: 'NaN' }, { advance_payment: 0.001 }, { payment_due_day: '5days' }, { max_occupants: 1.5 }]) {
        const app = fixture();
        assert.equal((await app.call('lease', 'createLease', 'landlord', { ...terms, ...invalid, application_id: 'application' })).code, 400);
        assert.equal(app.tables.lease_records.length, 0);
    }
});

test('admin cannot publish a property without required evidence', async () => {
    const app = fixture(); app.tables.property_documents.length = 0;
    assert.equal((await app.call('adminReview', 'approveProperty', 'admin')).code, 400);
    assert.equal(app.tables.properties[0].status, 'pending_review');
});
