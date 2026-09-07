const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const balances = require('../server/utils/billingBalanceHelper');
const responseHelper = require('../server/utils/responseHelper');

function modelFixture(firstAmount = 400, nextAmount = 600) {
    const tables = {
        billing_records: [{ id: 'bill', total_amount: 1000, billing_status: 'waiting_verification' }],
        payment_records: [
            { id: 'first', billing_id: 'bill', landlord_id: 'landlord', payment_amount: firstAmount, payment_status: 'verified' },
            { id: 'next', billing_id: 'bill', landlord_id: 'landlord', payment_amount: nextAmount, payment_status: 'pending_verification' }
        ]
    };
    const supabase = { from(table) {
        const filters = []; let payload;
        const query = {
            select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
            update(value) { payload = value; return this; },
            execute(single = false) {
                const rows = tables[table].filter(row => filters.every(([key, value]) => row[key] === value));
                if (payload) rows.forEach(row => Object.assign(row, payload));
                const copies = rows.map(row => ({ ...row }));
                return { data: single ? copies[0] || null : copies, error: null };
            },
            maybeSingle() { return Promise.resolve(this.execute(true)); },
            single() { return Promise.resolve(this.execute(true)); },
            then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); }
        };
        return query;
    } };
    const context = vm.createContext({ module: { exports: {} }, Date, require(name) {
        return name.endsWith('billingBalanceHelper') ? balances : supabase;
    } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../server/models/paymentModel.js'), 'utf8'), context);
    return { model: context.module.exports, tables };
}

test('two verified instalments settle the full bill', async () => {
    const app = modelFixture();
    await app.model.verifyPayment('next', 'landlord', 'verified', 'Received');
    assert.equal(app.tables.billing_records[0].billing_status, 'paid');
    assert.equal(balances.getBillingBalance(1000, app.tables.payment_records).remaining_balance, 0);
});

test('a rejected later proof preserves earlier verified instalments', async () => {
    const app = modelFixture();
    await app.model.verifyPayment('next', 'landlord', 'rejected', 'Unreadable proof');
    assert.equal(app.tables.billing_records[0].billing_status, 'partially_paid');
    assert.equal(balances.getBillingBalance(1000, app.tables.payment_records).remaining_balance, 600);
});

test('reviewed payments cannot be verified or rejected a second time', async () => {
    const app = modelFixture();
    await app.model.verifyPayment('next', 'landlord', 'verified', 'Received');
    await assert.rejects(app.model.verifyPayment('next', 'landlord', 'rejected', 'Changed mind'), error => error.statusCode === 409);
    assert.equal(app.tables.billing_records[0].billing_status, 'paid');
    assert.equal(app.tables.payment_records[1].payment_status, 'verified');
});

test('another landlord cannot review the payment', async () => {
    const app = modelFixture();
    assert.equal(await app.model.verifyPayment('next', 'other', 'verified', ''), null);
    assert.equal(app.tables.payment_records[1].payment_status, 'pending_verification');
});

test('balances use integer centavos and exclude unverified proofs', () => {
    assert.deepEqual(balances.getBillingBalance(0.3, [
        { payment_amount: 0.1, payment_status: 'verified' },
        { payment_amount: 0.2, payment_status: 'verified' },
        { payment_amount: 99, payment_status: 'pending_verification' }
    ]), { paid_amount: 0.3, remaining_balance: 0 });
    assert.deepEqual(balances.withBillingBalance({ id: 'bill', total_amount: 100, payment_records: [{ payment_amount: 25, payment_status: 'verified' }] }),
        { id: 'bill', total_amount: 100, paid_amount: 25, remaining_balance: 75 });
});

test('invalid payment amounts are rejected before any database or upload operation', async () => {
    let accessed = false;
    const context = vm.createContext({ module: { exports: {} }, console, require(name) {
        if (name.endsWith('responseHelper')) return responseHelper;
        return new Proxy({}, { get() { accessed = true; throw new Error('External dependency accessed'); } });
    } });
    // Storage helpers are imported via destructuring, but must not be called.
    context.require = name => name.endsWith('responseHelper') ? responseHelper
        : name.endsWith('supabaseClient') ? { from() { accessed = true; throw new Error('Database accessed'); } } : {};
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../server/controllers/paymentController.js'), 'utf8'), context);
    for (const amount of [-5, 'abc', '25oops', 'Infinity', '0.001', true]) {
        const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; } };
        await context.module.exports.submitPayment({ user: { id: 'tenant' }, body: {
            billing_id: 'bill', payment_amount: amount, payment_method: 'cash', payment_reference_number: 'fixture',
            base64_content: 'fixture', file_name: 'proof.png', mime_type: 'image/png', file_size: 7
        } }, res);
        assert.equal(res.code, 400, String(amount));
    }
    assert.equal(accessed, false);
});
