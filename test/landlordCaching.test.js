const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cache = require('../server/utils/cacheHelper');

// Mock response recorder
function responseRecorder() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Server TTLCache & cacheHelper unit tests
// ─────────────────────────────────────────────────────────────────────────────

test('cacheHelper stores and retrieves values with TTL', () => {
    cache.flush();
    const key = 'test:item:1';
    cache.set(key, { name: 'DomiKnow Unit 101' }, 10);

    const hit = cache.get(key);
    assert.deepEqual(hit, { name: 'DomiKnow Unit 101' });
    assert.equal(cache.size, 1);
});

test('cacheHelper del removes specific key', () => {
    cache.flush();
    cache.set('item:1', 'val1', 60);
    cache.set('item:2', 'val2', 60);
    assert.equal(cache.size, 2);

    cache.del('item:1');
    assert.equal(cache.get('item:1'), undefined);
    assert.equal(cache.get('item:2'), 'val2');
    assert.equal(cache.size, 1);
});

test('cacheHelper invalidatePrefix removes all keys matching prefix', () => {
    cache.flush();
    cache.set('landlord:usr_1:properties:list', [{ id: 'p1' }], 60);
    cache.set('landlord:usr_1:properties:p1', { id: 'p1' }, 60);
    cache.set('landlord:usr_1:leases:list', [{ id: 'l1' }], 60);
    cache.set('landlord:usr_2:properties:list', [{ id: 'p2' }], 60);

    assert.equal(cache.size, 4);

    cache.invalidateLandlord('usr_1', 'properties');

    assert.equal(cache.get('landlord:usr_1:properties:list'), undefined);
    assert.equal(cache.get('landlord:usr_1:properties:p1'), undefined);
    // Other domains for user 1 preserved
    assert.deepEqual(cache.get('landlord:usr_1:leases:list'), [{ id: 'l1' }]);
    // Other users preserved
    assert.deepEqual(cache.get('landlord:usr_2:properties:list'), [{ id: 'p2' }]);
});

test('cacheHelper invalidateAllLandlord clears all keys for that landlord', () => {
    cache.flush();
    cache.set('landlord:usr_1:properties:list', [{ id: 'p1' }], 60);
    cache.set('landlord:usr_1:leases:list', [{ id: 'l1' }], 60);
    cache.set('landlord:usr_1:billings:list', [{ id: 'b1' }], 60);
    cache.set('landlord:usr_2:leases:list', [{ id: 'l2' }], 60);

    cache.invalidateAllLandlord('usr_1');

    assert.equal(cache.get('landlord:usr_1:properties:list'), undefined);
    assert.equal(cache.get('landlord:usr_1:leases:list'), undefined);
    assert.equal(cache.get('landlord:usr_1:billings:list'), undefined);
    assert.deepEqual(cache.get('landlord:usr_2:leases:list'), [{ id: 'l2' }]);
});

test('cacheHelper expires items when TTL elapsed', async () => {
    cache.flush();
    // 1 second TTL
    cache.set('quick:expire', 'temp', 1);
    assert.equal(cache.get('quick:expire'), 'temp');

    // Wait 1.1s for expiration
    await new Promise(r => setTimeout(r, 1100));
    assert.equal(cache.get('quick:expire'), undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Server Controller Caching Integration tests
// ─────────────────────────────────────────────────────────────────────────────

test('complaintController getLandlordComplaints returns cached response when present', async () => {
    cache.flush();
    const complaintController = require('../server/controllers/complaintController');
    const landlordId = 'landlord_cache_test_1';
    const cacheKey = cache.landlordKey(landlordId, 'complaints', 'all');

    // Seed cache
    const mockComplaints = [{ id: 'comp_1', title: 'Noise issue' }];
    cache.set(cacheKey, mockComplaints, 60);

    const req = {
        user: { id: landlordId },
        query: {}
    };
    const res = responseRecorder();

    await complaintController.getLandlordComplaints(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, mockComplaints);
});

test('tenantReportController getLandlordTenantReports returns cached response when present', async () => {
    cache.flush();
    const tenantReportController = require('../server/controllers/tenantReportController');
    const landlordId = 'landlord_cache_test_2';
    const cacheKey = cache.landlordKey(landlordId, 'tenantReports');

    const mockReports = [{ id: 'rep_1', report_category: 'Property Damage' }];
    cache.set(cacheKey, mockReports, 60);

    const req = {
        user: { id: landlordId }
    };
    const res = responseRecorder();

    await tenantReportController.getLandlordTenantReports(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, mockReports);
});

test('feedbackController getLandlordFeedback returns cached response when present', async () => {
    cache.flush();
    const feedbackController = require('../server/controllers/feedbackController');
    const landlordId = 'landlord_cache_test_3';
    const cacheKey = cache.landlordKey(landlordId, 'feedback');

    const mockFeedback = [{ id: 'fb_1', feedback_text: 'Great landlord' }];
    cache.set(cacheKey, mockFeedback, 60);

    const req = {
        user: { id: landlordId }
    };
    const res = responseRecorder();

    await feedbackController.getLandlordFeedback(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, mockFeedback);
});

test('propertyRatingController getLandlordPropertyRatings returns cached response when present', async () => {
    cache.flush();
    const propertyRatingController = require('../server/controllers/propertyRatingController');
    const landlordId = 'landlord_cache_test_4';
    const cacheKey = cache.landlordKey(landlordId, 'propertyRatings');

    const mockRatings = [{ id: 'pr_1', overall_rating: 5 }];
    cache.set(cacheKey, mockRatings, 60);

    const req = {
        user: { id: landlordId },
        query: {}
    };
    const res = responseRecorder();

    await propertyRatingController.getLandlordPropertyRatings(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, mockRatings);
});

test('billingController getLandlordBillings returns cached response when present', async () => {
    cache.flush();
    const billingController = require('../server/controllers/billingController');
    const landlordId = 'landlord_cache_test_5';
    const cacheKey = cache.landlordKey(landlordId, 'billings');

    const mockBillings = [{ id: 'bill_1', total_amount: 5000, billing_status: 'paid' }];
    cache.set(cacheKey, mockBillings, 60);

    const req = {
        user: { id: landlordId },
        query: {}
    };
    const res = responseRecorder();

    await billingController.getLandlordBillings(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, mockBillings);
});

test('cross-role invalidations verify landlord domain bust on write', () => {
    cache.flush();
    const landlordId = 'll_target_1';
    
    // Seed landlord caches across multiple domains
    cache.set(cache.landlordKey(landlordId, 'leases'), [{ id: 'l1' }], 60);
    cache.set(cache.landlordKey(landlordId, 'billings'), [{ id: 'b1' }], 60);
    cache.set(cache.landlordKey(landlordId, 'payments'), [{ id: 'p1' }], 60);
    cache.set(cache.landlordKey(landlordId, 'maintenance'), [{ id: 'm1' }], 60);
    cache.set(cache.landlordKey(landlordId, 'applications'), [{ id: 'a1' }], 60);

    assert.equal(cache.size, 5);

    // Invalidate leases and billings (simulate lease accept/reject)
    cache.invalidateLandlord(landlordId, 'leases');
    cache.invalidateLandlord(landlordId, 'billings');

    assert.equal(cache.get(cache.landlordKey(landlordId, 'leases')), undefined);
    assert.equal(cache.get(cache.landlordKey(landlordId, 'billings')), undefined);
    // Other domains intact
    assert.ok(cache.get(cache.landlordKey(landlordId, 'payments')));
    assert.ok(cache.get(cache.landlordKey(landlordId, 'maintenance')));
    assert.ok(cache.get(cache.landlordKey(landlordId, 'applications')));
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Client-side LandlordCache tests
// ─────────────────────────────────────────────────────────────────────────────

test('client landlord-cache.js evaluates and manages cache with session storage', () => {
    // Setup mock browser environment
    const storageMap = new Map();
    const mockSessionStorage = {
        getItem(key) { return storageMap.has(key) ? storageMap.get(key) : null; },
        setItem(key, val) { storageMap.set(key, String(val)); },
        removeItem(key) { storageMap.delete(key); },
        clear() { storageMap.clear(); },
        key(i) { return Array.from(storageMap.keys())[i] || null; },
        get length() { return storageMap.size; }
    };

    const mockLocalStorage = {
        getItem(key) {
            if (key === 'domiknow_token') {
                // Mock JWT with sub/userId = 'landlord_client_test'
                const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
                const payload = Buffer.from(JSON.stringify({ id: 'landlord_client_test', role: 'landlord' })).toString('base64');
                return `${header}.${payload}.sig`;
            }
            return null;
        },
        setItem() {},
        removeItem() {}
    };

    const mockWindow = {
        sessionStorage: mockSessionStorage,
        localStorage: mockLocalStorage,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {}
    };

    // Load and evaluate client script in controlled sandbox
    const code = fs.readFileSync(path.resolve(__dirname, '../public/js/landlord-cache.js'), 'utf8');
    const fn = new Function('window', 'sessionStorage', 'localStorage', 'document', `${code}; return window.landlordCache;`);
    const clientCache = fn(mockWindow, mockSessionStorage, mockLocalStorage, { addEventListener() {} });

    assert.ok(clientCache, 'clientCache instance should be created');

    // Test Set & Get
    clientCache.set('properties', 'list', [{ id: 'prop-1', name: 'Apartment' }]);
    const cachedProperties = clientCache.get('properties', 'list');
    assert.deepEqual(cachedProperties, [{ id: 'prop-1', name: 'Apartment' }]);

    // Test domain invalidation
    clientCache.set('properties', 'p-1', { id: 'p-1' });
    clientCache.set('leases', 'list', [{ id: 'lease-1' }]);

    clientCache.invalidate('properties');
    assert.equal(clientCache.get('properties', 'list'), null);
    assert.equal(clientCache.get('properties', 'p-1'), null);
    assert.deepEqual(clientCache.get('leases', 'list'), [{ id: 'lease-1' }]);

    // Test invalidateMultiple with array
    clientCache.set('billings', 'list', [{ id: 'b-1' }]);
    clientCache.set('payments', 'list', [{ id: 'pay-1' }]);

    clientCache.invalidateMultiple(['leases', 'billings', 'payments']);
    assert.equal(clientCache.get('leases', 'list'), null);
    assert.equal(clientCache.get('billings', 'list'), null);
    assert.equal(clientCache.get('payments', 'list'), null);

    // Test invalidateMultiple with varargs
    clientCache.set('leases', 'list', [{ id: 'lease-2' }]);
    clientCache.set('billings', 'list', [{ id: 'b-2' }]);
    clientCache.invalidateMultiple('leases', 'billings');
    assert.equal(clientCache.get('leases', 'list'), null);
    assert.equal(clientCache.get('billings', 'list'), null);

    // Test invalidateAll
    clientCache.set('properties', 'list', [{ id: 'prop-2' }]);
    clientCache.set('disputes', 'all', [{ id: 'disp-1' }]);
    clientCache.invalidateAll();
    assert.equal(clientCache.get('properties', 'list'), null);
    assert.equal(clientCache.get('disputes', 'all'), null);
});

test('leases.html client-side script implements caching for list, details, and applications queue', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../public/pages/landlord/leases.html'), 'utf8');

    // Asserts script inclusion
    assert.ok(html.includes('src="../../js/landlord-cache.js"'), 'leases.html must include landlord-cache.js');

    // Asserts leases list caching
    assert.ok(html.includes("window.landlordCache?.get('leases', 'list')"), 'leases.html must check cached leases');
    assert.ok(html.includes("window.landlordCache?.set('leases', 'list', leases)"), 'leases.html must cache leases');

    // Asserts individual contract caching
    assert.ok(html.includes("window.landlordCache?.get('leases', String(leaseId))"), 'leases.html must check cached lease contract');
    assert.ok(html.includes("window.landlordCache?.set('leases', String(leaseId), lease)"), 'leases.html must cache lease contract');

    // Asserts approved applications queue caching
    assert.ok(html.includes("window.landlordCache?.get('applications', 'list')"), 'leases.html must check cached applications queue');
    assert.ok(html.includes("window.landlordCache?.set('applications', 'list', allApps)"), 'leases.html must cache applications queue');

    // Asserts invalidation event listener
    assert.ok(html.includes("domiknow:landlord-cache-invalidated"), 'leases.html must listen for cache invalidations');
});
