const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/js/dashboard.js'), 'utf8');

function runtime(role, status = 200, token = 'test-token') {
    const listeners = {};
    const values = new Map([['domiknow_token', token], ['domiknow_role', role]]);
    const context = vm.createContext({
        console, URL, encodeURIComponent,
        document: { addEventListener: (type, callback) => { listeners[type] = callback; }, querySelectorAll: () => [] },
        window: { location: { pathname: `/pages/${role}/profile.html`, search: '?section=security', hash: '#password' } },
        localStorage: { getItem: key => values.get(key), removeItem: key => values.delete(key) },
        sessionStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
        fetch: async () => ({ ok: status === 200, status, json: async () => ({ data: { role } }) })
    });
    vm.runInContext(source, context);
    context.renderNewDashboardLayout = () => {};
    context.populateDashboardUI = () => { context.populated = true; };
    context.showDashboardLoadError = () => { context.retryShown = true; };
    return { context, values, initialize: listeners.DOMContentLoaded };
}

for (const role of ['tenant', 'landlord', 'admin', 'maintenance']) {
    test(`${role}: verified session initializes the workspace`, async () => {
        const app = runtime(role);
        await app.initialize();
        assert.equal(app.context.populated, true);
        assert.equal(app.context.window.location.href, undefined);
    });
    test(`${role}: service outages preserve the session and show recovery`, async () => {
        const app = runtime(role, 503);
        await app.initialize();
        assert.equal(app.context.retryShown, true);
        assert.equal(app.values.get('domiknow_token'), 'test-token');
        assert.equal(app.context.window.location.href, undefined);
    });
    test(`${role}: expired sessions preserve the exact return route`, async () => {
        const app = runtime(role, 401);
        await app.initialize();
        const target = new URL(app.context.window.location.href, 'http://localhost');
        assert.equal(target.pathname, '/pages/auth/login.html');
        assert.equal(target.searchParams.get('redirect'), `/pages/${role}/profile.html?section=security#password`);
        assert.equal(app.values.has('domiknow_token'), false);
    });
}

test('sidebar scroll is role-specific and navigation tolerates blocked storage', () => {
    const app = runtime('tenant');
    const callbacks = {};
    const sidebar = { scrollTop: 48, addEventListener: (type, fn) => { callbacks[type] = fn; } };
    app.context.initDashboardNavigation('tenant', sidebar);
    callbacks.scroll();
    assert.equal(app.values.get('domiknow_sidebar_scroll_tenant'), '48');
    assert.equal(app.values.has('domiknow_sidebar_scroll_landlord'), false);
    app.context.sessionStorage.getItem = () => { throw new Error('Blocked'); };
    app.context.sessionStorage.setItem = () => { throw new Error('Blocked'); };
    assert.doesNotThrow(() => app.context.initDashboardNavigation('tenant', sidebar));
    assert.doesNotThrow(() => callbacks.scroll());
});

test('missing and unsafe documents are readable unavailable states, never dead links', () => {
    const { context } = runtime('tenant');
    context.window.location.origin = 'http://localhost';
    for (const value of [null, '', '#', 'javascript:alert(1)']) {
        const markup = context.domiknowDocumentLink(value, 'Proof of income');
        assert.match(markup, /File unavailable/);
        assert.doesNotMatch(markup, /<a\b/);
    }
    const markup = context.domiknowDocumentLink('https://example.com/proof.pdf?a=1&b=2', '<Proof>');
    assert.match(markup, /rel="noopener noreferrer"/);
    assert.match(markup, /&lt;Proof&gt;/);
    assert.match(markup, /a=1&amp;b=2/);
});
