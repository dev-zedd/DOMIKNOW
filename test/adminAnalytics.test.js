const test = require('node:test');
const assert = require('node:assert/strict');
const { day, summarize, monthlySeries } = require('../public/js/admin-analytics');

test('monthly chart fills gaps and limits the view to twelve months', () => {
    assert.deepEqual(monthlySeries({ '2026-01': 2, '2026-03': 4 }), [
        { month: '2026-01', count: 2 }, { month: '2026-02', count: 0 }, { month: '2026-03', count: 4 }
    ]);
    const long = monthlySeries({ '2020-01': 1, '2026-03': 2 });
    assert.equal(long.length, 12);
    assert.equal(long[0].month, '2025-04');
    assert.deepEqual(monthlySeries({}), []);
});

test('analytics dates include both Philippine calendar boundaries', () => {
    assert.equal(day('2026-09-01T16:00:00Z'), '2026-09-02');
    const data = summarize([
        { created_at: '2026-08-31T16:00:00Z', status: 'pending' },
        { created_at: '2026-09-01T15:59:59Z', status: 'closed' },
        { created_at: '2026-09-01T16:00:00Z', status: 'closed' },
        { created_at: null, status: 'pending' }
    ], 'status', '2026-09-01', '2026-09-01');
    assert.equal(data.total, 2);
    assert.equal(data.statuses.pending, 1);
    assert.equal(data.statuses.closed, 1);
    assert.equal(data.months['2026-09'], 2);
});

test('all-date analytics preserve unknown status and undated records without fabricating months', () => {
    const data = summarize([{ created_at: 'invalid' }, { status: '__proto__' }], 'status');
    assert.equal(data.total, 2);
    assert.equal(data.undated, 2);
    assert.equal(data.statuses.unknown, 1);
    assert.equal(data.statuses.__proto__, 1);
    assert.equal(Object.keys(data.months).length, 0);
    assert.equal(summarize([], 'status').total, 0);
});
