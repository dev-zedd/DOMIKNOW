const test = require('node:test');
const assert = require('node:assert/strict');
const {
    day,
    summarize,
    monthlySeries,
    calculateOccupancy,
    summarizeBillings,
    getAttentionItems
} = require('../public/js/landlord-analytics');

test('occupancy calculation correctly computes occupied units and rate', () => {
    const properties = [
        {
            id: 'prop-1',
            units: [
                { id: 'u1', status: 'occupied' },
                { id: 'u2', status: 'available' },
                { id: 'u3', status: 'occupied' }
            ]
        },
        {
            id: 'prop-2',
            units: [
                { id: 'u4', status: 'maintenance' },
                { id: 'u5', status: 'available' }
            ]
        }
    ];

    const result = calculateOccupancy(properties);
    assert.equal(result.totalProperties, 2);
    assert.equal(result.totalUnits, 5);
    assert.equal(result.occupiedUnits, 2);
    assert.equal(result.availableUnits, 2);
    assert.equal(result.maintenanceUnits, 1);
    assert.equal(result.occupancyRate, 40); // 2/5 = 40.0%

    // Empty list
    const empty = calculateOccupancy([]);
    assert.equal(empty.totalProperties, 0);
    assert.equal(empty.totalUnits, 0);
    assert.equal(empty.occupancyRate, 0);
});

test('billing summary calculates total billed, collected, overdue, and settlement rate', () => {
    const billings = [
        { amount: 10000, balance: 0, status: 'paid' },
        { amount: 8000, balance: 8000, status: 'overdue', is_overdue: true },
        { amount: 12000, balance: 4000, paid_amount: 8000, status: 'partially_paid' }
    ];

    const summary = summarizeBillings(billings);
    assert.equal(summary.totalBillings, 3);
    assert.equal(summary.totalBilled, 30000);
    assert.equal(summary.totalCollected, 18000); // 10000 + 0 + 8000
    assert.equal(summary.totalOverdue, 8000);
    assert.equal(summary.totalOutstanding, 12000); // 0 + 8000 + 4000
    assert.equal(summary.settlementRate, 60); // 18000 / 30000 = 60.0%

    const empty = summarizeBillings([]);
    assert.equal(empty.totalBillings, 0);
    assert.equal(empty.totalBilled, 0);
    assert.equal(empty.settlementRate, 0);
});

test('attention queue detects actionable items across operational domains', () => {
    const operationalData = {
        billings: [
            { id: 'b1', status: 'overdue' },
            { id: 'b2', status: 'paid' }
        ],
        payments: [
            { id: 'p1', payment_status: 'pending' },
            { id: 'p2', payment_status: 'verified' }
        ],
        maintenance: [
            { id: 'm1', status: 'pending' },
            { id: 'm2', status: 'in_progress' },
            { id: 'm3', status: 'completed' }
        ],
        applications: [
            { id: 'a1', status: 'pending' },
            { id: 'a2', status: 'approved' }
        ],
        complaints: [
            { id: 'c1', status: 'open' }
        ],
        reportsAgainstMe: []
    };

    const items = getAttentionItems(operationalData);
    assert.equal(items.length, 5);

    const overdue = items.find(i => i.title.includes('Overdue'));
    assert.ok(overdue);
    assert.equal(overdue.count, 1);
    assert.equal(overdue.level, 'urgent');

    const pays = items.find(i => i.title.includes('Payment Proofs'));
    assert.ok(pays);
    assert.equal(pays.count, 1);

    const apps = items.find(i => i.title.includes('Applications'));
    assert.ok(apps);
    assert.equal(apps.count, 1);

    // When everything is resolved
    const clearData = {
        billings: [{ status: 'paid' }],
        payments: [{ status: 'verified' }],
        maintenance: [{ status: 'closed' }],
        applications: [{ status: 'approved' }],
        complaints: [{ status: 'resolved' }],
        reportsAgainstMe: []
    };
    assert.equal(getAttentionItems(clearData).length, 0);
});

test('landlord analytics dates and monthly series match time-zone standards', () => {
    assert.equal(day('2026-09-01T16:00:00Z'), '2026-09-02');
    const series = monthlySeries({ '2026-04': 3, '2026-06': 5 });
    assert.equal(series.length, 3);
    assert.deepEqual(series, [
        { month: '2026-04', count: 3 },
        { month: '2026-05', count: 0 },
        { month: '2026-06', count: 5 }
    ]);
});
