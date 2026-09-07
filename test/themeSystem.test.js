const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function themeRuntime({ stored = null, blocked = false, dark = false } = {}) {
    const attributes = new Map(), buttonAttributes = new Map(), events = [], listeners = {};
    const control = {
        textContent: 'Theme', querySelector: () => null,
        setAttribute: (key, value) => buttonAttributes.set(key, value),
        getAttribute: key => buttonAttributes.get(key), hasAttribute: key => buttonAttributes.has(key)
    };
    const asset = { setAttribute() {}, content: 'width=device-width' };
    const media = { matches: dark, addEventListener: (type, fn) => { listeners.media = fn; } };
    const window = {
        location: { pathname: '/pages/admin/users.html' },
        localStorage: {
            getItem: () => { if (blocked) throw new Error('Blocked'); return stored; },
            setItem: (_key, value) => { if (blocked) throw new Error('Blocked'); stored = value; }
        },
        matchMedia: () => media,
        addEventListener: (type, fn) => { listeners[type] = fn; },
        dispatchEvent: event => events.push(event)
    };
    const document = {
        head: { querySelector: () => asset }, readyState: 'loading', addEventListener() {},
        documentElement: { style: {}, setAttribute: (k, v) => attributes.set(k, v), getAttribute: k => attributes.get(k) },
        querySelectorAll: selector => selector === '[data-theme-toggle]' ? [control] : []
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/ui.js'), 'utf8'), {
        window, document, console, Promise, Set,
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
    });
    return { window, attributes, buttonAttributes, events, listeners, clearStored: () => { stored = null; } };
}

test('theme follows system until explicitly selected and synchronizes controls', () => {
    const app = themeRuntime({ dark: true });
    assert.equal(app.window.DomiKnowTheme.get(), 'dark');
    app.window.DomiKnowTheme.toggle();
    assert.equal(app.attributes.get('data-theme'), 'light');
    assert.equal(app.buttonAttributes.get('aria-pressed'), 'false');
    assert.equal(app.buttonAttributes.get('aria-label'), 'Switch to dark theme');
    assert.equal(app.events.at(-1).detail.theme, 'light');
    app.listeners.media({ matches: true });
    assert.equal(app.window.DomiKnowTheme.get(), 'light');
});

test('blocked storage does not break theme selection', () => {
    const app = themeRuntime({ blocked: true });
    assert.doesNotThrow(() => app.window.DomiKnowTheme.toggle());
    assert.equal(app.window.DomiKnowTheme.get(), 'dark');
});

test('removing stored preferences in another tab returns to the system theme', () => {
    const app = themeRuntime({ stored: 'light', dark: true });
    app.clearStored();
    app.listeners.storage({ key: 'domiknow_theme', newValue: null });
    assert.equal(app.window.DomiKnowTheme.get(), 'dark');
});
