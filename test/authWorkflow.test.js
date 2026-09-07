const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const responseHelper = require('../server/utils/responseHelper');

function fixture() {
    const users = [], codes = [], mail = [];
    const deps = {
        bcrypt, jsonwebtoken: jwt, responseHelper,
        generateCode: () => '123456',
        auditLogModel: { log: async () => {} }, notificationModel: { create: async () => {} },
        mailer: { sendVerificationEmail: async (...value) => mail.push(value), sendForgotPasswordEmail: async (...value) => mail.push(value) },
        userModel: {
            findByEmail: async email => users.find(user => user.email === email),
            createUser: async value => { const user = { id: `user-${users.length}`, ...value }; users.push(user); return user; },
            updateVerified: async id => { const user = users.find(user => user.id === id); user.is_verified = true; user.account_status = user.role === 'tenant' ? 'active' : 'pending'; return user; },
            updatePassword: async (id, hash) => { users.find(user => user.id === id).password_hash = hash; },
            liftExpiredSuspension: async user => user
        },
        verificationModel: {
            saveCode: async (id, email, code, expires) => codes.push({ id: codes.length, email, user_id: id, verification_code: code, expires_at: expires, used: false }),
            findLatestCode: async email => [...codes].reverse().find(code => code.email === email && !code.used && code.expires_at > new Date()),
            markUsed: async id => { codes.find(code => code.id === id).used = true; }
        }
    };
    const context = { module: { exports: {} }, require: name => deps[path.basename(name)], Date, process: { env: { JWT_SECRET: 'isolated-auth-workflow-secret' } }, console: { error() {} } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/controllers/authController.js'), 'utf8'), context);
    const call = async (method, body) => {
        const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; } };
        await context.module.exports[method]({ body }, res); return res;
    };
    return { users, codes, mail, call };
}
const credentials = { email: 'fixture@example.invalid', password: 'TestPassword123', full_name: 'Test Account' };

for (const role of ['tenant', 'landlord']) {
    test(`${role} registration, verification and approval gate`, async () => {
        const app = fixture();
        assert.equal((await app.call('register', { ...credentials, role })).code, 201);
        assert.equal((await app.call('register', { ...credentials, role })).code, 400);
        assert.equal((await app.call('login', credentials)).code, 403);
        assert.equal((await app.call('verifyCode', { email: credentials.email, verification_code: 'wrong' })).code, 400);
        assert.equal((await app.call('verifyCode', { email: credentials.email, verification_code: '123456' })).code, 200);
        assert.equal((await app.call('verifyCode', { email: credentials.email, verification_code: '123456' })).code, 400);
        assert.equal((await app.call('login', credentials)).code, role === 'tenant' ? 200 : 403);
        if (role === 'landlord') { app.users[0].account_status = 'active'; assert.equal((await app.call('login', credentials)).code, 200); }
        assert.equal(app.mail.length, 1);
    });
}

test('public registration cannot create admin or maintenance accounts', async () => {
    const app = fixture();
    for (const role of ['admin', 'maintenance']) assert.equal((await app.call('register', { ...credentials, role })).code, 400);
    assert.equal(app.users.length, 0);
    assert.equal(app.mail.length, 0);
});

test('all roles reject bad credentials and disabled accounts and issue role-specific tokens when active', async () => {
    const app = fixture(); const hash = await bcrypt.hash(credentials.password, 4);
    for (const role of ['tenant', 'landlord', 'admin', 'maintenance']) {
        const user = { id: role, email: `${role}@example.invalid`, role, is_verified: true, account_status: 'active', password_hash: hash };
        app.users.push(user);
        const body = { email: user.email, password: credentials.password };
        assert.equal((await app.call('login', { ...body, password: 'incorrect' })).code, 401);
        const result = await app.call('login', body);
        assert.equal(result.code, 200);
        assert.equal(jwt.verify(result.body.data.token, 'isolated-auth-workflow-secret').role, role);
        user.account_status = 'disabled';
        assert.equal((await app.call('login', body)).code, 403);
    }
});

test('password recovery consumes its code and replaces the credential', async () => {
    const app = fixture();
    app.users.push({ id: 'tenant', email: credentials.email, role: 'tenant', is_verified: true, account_status: 'active', password_hash: await bcrypt.hash(credentials.password, 4) });
    assert.equal((await app.call('forgotPassword', { email: 'unknown@example.invalid' })).code, 200);
    assert.equal(app.mail.length, 0);
    assert.equal((await app.call('forgotPassword', { email: credentials.email })).code, 200);
    const reset = { email: credentials.email, verification_code: '123456', new_password: 'ReplacementPassword123' };
    assert.equal((await app.call('resetPassword', reset)).code, 200);
    assert.equal((await app.call('resetPassword', reset)).code, 400);
    assert.equal((await app.call('login', credentials)).code, 401);
    assert.equal((await app.call('login', { email: credentials.email, password: reset.new_password })).code, 200);
});
