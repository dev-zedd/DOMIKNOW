const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeStoragePath,
    isStorageObjectNotFound
} = require('../server/utils/storageHelper');

test('storage paths remain relative to their selected Supabase bucket', () => {
    assert.equal(
        normalizeStoragePath('payment-proofs', 'payments/billing-1/receipt.png'),
        'payments/billing-1/receipt.png'
    );
    assert.equal(
        normalizeStoragePath('payment-proofs', 'payment-proofs/payments/billing-1/receipt.png'),
        'payments/billing-1/receipt.png'
    );
});

test('complete Supabase object URLs are reduced to bucket-relative paths', () => {
    assert.equal(
        normalizeStoragePath(
            'payment-proofs',
            'https://example.supabase.co/storage/v1/object/sign/payment-proofs/payments/billing-1/My%20Receipt.png?token=secret'
        ),
        'payments/billing-1/My Receipt.png'
    );
});

test('storage path normalization rejects traversal and identifies missing objects', () => {
    assert.throws(
        () => normalizeStoragePath('payment-proofs', 'payments/../private.txt'),
        /Invalid storage object path/
    );
    assert.equal(isStorageObjectNotFound({ status: 400, statusCode: '404', message: 'Object not found' }), true);
    assert.equal(isStorageObjectNotFound({ status: 503, message: 'Service unavailable' }), false);
});
