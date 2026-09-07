const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
    const records = [];
    const model = {
        checkLeaseEligibility: async (tenant, property, lease) => tenant === 'tenant' && property === 'property' && lease === 'lease',
        checkDuplicateFeedback: async (_tenant, lease, type) => records.find(row => row.lease_id === lease && row.feedback_type === type),
        createFeedback: async value => { const row = { id: 'feedback', ...value }; records.push(row); return row; },
        updateFeedbackStatus: async (_id, status) => Object.assign(records[0], { status }),
        findPublicFeedback: async () => records.filter(row => row.status === 'visible').map(row => ({ ...row, tenant_email: 'private@example.invalid', properties: { property_name: 'Fixture home' } }))
    };
    const deps = { feedbackModel: model, auditLogModel: { log: async () => {} }, responseHelper: require('../server/utils/responseHelper') };
    const context = { module: { exports: {} }, require: name => deps[path.basename(name)], console: { error() {} } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/controllers/feedbackController.js'), 'utf8'), context);
    return { records, async call(method, body = {}, user = 'tenant') {
        const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
        await context.module.exports[method]({ body, user: { id: user }, params: { id: 'feedback' }, query: {} }, res);
        return res;
    } };
}
const feedback = { property_id: 'property', lease_id: 'lease', rating: 4, feedback_type: 'property', feedback_text: 'Helpful rental team.' };

test('eligible tenant feedback requires moderation and publishes without tenant identifiers', async () => {
    const app = fixture();
    assert.equal((await app.call('submitFeedback', feedback, 'other')).code, 400);
    assert.equal((await app.call('submitFeedback', feedback)).code, 201);
    assert.equal((await app.call('submitFeedback', feedback)).code, 400);
    assert.equal((await app.call('getPublicFeedback')).body.data.length, 0);
    assert.equal((await app.call('updateFeedbackStatus', { status: 'visible' }, 'admin')).code, 200);
    const publicFeedback = (await app.call('getPublicFeedback')).body.data;
    assert.equal(publicFeedback.length, 1);
    assert.equal(publicFeedback[0].property_name, 'Fixture home');
    assert.equal(publicFeedback[0].tenant_id, undefined);
    assert.equal(publicFeedback[0].tenant_email, undefined);
    assert.equal(publicFeedback[0].lease_id, undefined);
    await app.call('updateFeedbackStatus', { status: 'hidden' }, 'admin');
    assert.equal((await app.call('getPublicFeedback')).body.data.length, 0);
});

test('feedback rejects fractional, malformed and out-of-range ratings without saving', async () => {
    const app = fixture();
    for (const rating of [1.5, '4stars', true, 0, 6, 'Infinity']) assert.equal((await app.call('submitFeedback', { ...feedback, rating })).code, 400);
    assert.equal(app.records.length, 0);
});
