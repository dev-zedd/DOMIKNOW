const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('maintenance-details.html implements robust category resolution and safe icon rendering', () => {
    const detailsPath = path.resolve(__dirname, '../public/pages/landlord/maintenance-details.html');
    const html = fs.readFileSync(detailsPath, 'utf8');

    // Asserts resolveCategory and renderIcon exist
    assert.ok(html.includes('function resolveCategory('), 'maintenance-details.html must define resolveCategory');
    assert.ok(html.includes('function renderIcon('), 'maintenance-details.html must define renderIcon');
    assert.ok(html.includes('function showLoadError('), 'maintenance-details.html must define showLoadError');

    // Asserts no raw icon injection strings remain
    assert.ok(!html.includes('${icon} ${req.issue_category}'), 'maintenance-details.html must not inject raw icon string into sideCat');
    assert.ok(!html.includes('${icon} Select ${trade}'), 'maintenance-details.html must not inject raw icon string into workerSelect label');

    // Asserts category map coverage
    assert.ok(html.includes('plumbing:'), 'CATEGORY_MAP must cover plumbing');
    assert.ok(html.includes('electrical:'), 'CATEGORY_MAP must cover electrical');
    assert.ok(html.includes('aircon:'), 'CATEGORY_MAP must cover aircon');
    assert.ok(html.includes('door:'), 'CATEGORY_MAP must cover door');
    assert.ok(html.includes('roof:'), 'CATEGORY_MAP must cover roof');
    assert.ok(html.includes('internet:'), 'CATEGORY_MAP must cover internet');
    assert.ok(html.includes('appliance:'), 'CATEGORY_MAP must cover appliance');
    assert.ok(html.includes('structural:'), 'CATEGORY_MAP must cover structural');
    assert.ok(html.includes('cleanliness:'), 'CATEGORY_MAP must cover cleanliness');
    assert.ok(html.includes('security:'), 'CATEGORY_MAP must cover security');
    assert.ok(html.includes('other:'), 'CATEGORY_MAP must cover other');
    assert.ok(html.includes('others:'), 'CATEGORY_MAP must cover others');

    // Verify resolveCategory logic in isolation
    const scriptMatch = html.match(/const CATEGORY_MAP = \{[\s\S]*?\n\s*\};\s*function resolveCategory[\s\S]*?\n\s*\}/);
    assert.ok(scriptMatch, 'Must be able to extract resolveCategory function');
    const sandbox = {};
    const fn = new Function('sandbox', `${scriptMatch[0]}; sandbox.resolveCategory = resolveCategory;`);
    fn(sandbox);

    // Test edge cases
    assert.equal(sandbox.resolveCategory('plumbing').label, 'Plumbing');
    assert.equal(sandbox.resolveCategory('PLUMBING').label, 'Plumbing');
    assert.equal(sandbox.resolveCategory('other').label, 'General / Other');
    assert.equal(sandbox.resolveCategory('others').label, 'General / Other');
    assert.equal(sandbox.resolveCategory('structural').trade, 'Civil / Structural Worker');
    assert.equal(sandbox.resolveCategory('cleanliness').icon, 'trash');
    assert.equal(sandbox.resolveCategory('hvac').trade, 'Aircon Technician');
    assert.equal(sandbox.resolveCategory(null).label, 'General');
    assert.equal(sandbox.resolveCategory(undefined).label, 'General');
});

test('maintenance.html list view formats categories cleanly', () => {
    const listPath = path.resolve(__dirname, '../public/pages/landlord/maintenance.html');
    const html = fs.readFileSync(listPath, 'utf8');

    assert.ok(html.includes('function formatCategory('), 'maintenance.html must define formatCategory');
    assert.ok(html.includes('formatCategory(req.issue_category)'), 'maintenance.html must use formatCategory in renderQueueTable');
});

test('maintenance-details.html avoids stuck auto-skeleton on issueCategory and priorityLevel', () => {
    const detailsPath = path.resolve(__dirname, '../public/pages/landlord/maintenance-details.html');
    const html = fs.readFileSync(detailsPath, 'utf8');

    // Initial placeholder should be em-dash, not 'Loading…' to prevent auto-skeleton from latching
    assert.ok(html.includes('id="issueCategory">—</div>'), 'issueCategory placeholder should not be Loading…');
    assert.ok(html.includes('id="priorityLevel">—</div>'), 'priorityLevel placeholder should not be Loading…');

    // renderInfo must explicitly clean up any dk-auto-skeleton class and attributes
    assert.ok(html.includes("catEl.classList.remove('dk-auto-skeleton')"), 'renderInfo must clear dk-auto-skeleton on catEl');
    assert.ok(html.includes("prioEl.classList.remove('dk-auto-skeleton')"), 'renderInfo must clear dk-auto-skeleton on prioEl');
});
