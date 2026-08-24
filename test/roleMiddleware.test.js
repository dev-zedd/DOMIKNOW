const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const requireRole = require('../server/middleware/roleMiddleware');

const TEST_SECRET = 'domiknow-role-middleware-test-secret';

function responseRecorder() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

test('role middleware authenticates a bearer token when requireAuth was not added separately', () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
    try {
        const token = jwt.sign({ id: 'tenant-1', role: 'tenant' }, TEST_SECRET);
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = responseRecorder();
        let nextCalled = false;

        requireRole('tenant')(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, true);
        assert.equal(req.user.id, 'tenant-1');
        assert.equal(req.user.role, 'tenant');
        assert.equal(res.statusCode, null);
    } finally {
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    }
});

test('role middleware returns 401 when authentication is missing', () => {
    const req = { headers: {} };
    const res = responseRecorder();
    let nextCalled = false;

    requireRole('tenant')(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
});

test('role middleware returns 403 for an authenticated but unauthorized role', () => {
    const req = { headers: {}, user: { id: 'landlord-1', role: 'landlord' } };
    const res = responseRecorder();
    let nextCalled = false;

    requireRole('tenant')(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
});
