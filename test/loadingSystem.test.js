const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/js/loading-system.js'), 'utf8');

class FakeClassList {
    constructor() {
        this.values = new Set();
    }

    add(...names) {
        names.forEach(name => this.values.add(name));
    }

    remove(...names) {
        names.forEach(name => this.values.delete(name));
    }

    contains(name) {
        return this.values.has(name);
    }

    toggle(name, force) {
        if (force === true) this.values.add(name);
        else if (force === false) this.values.delete(name);
        else if (this.values.has(name)) this.values.delete(name);
        else this.values.add(name);
    }
}

class FakeElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.attributes = new Map();
        this.children = [];
        this.classList = new FakeClassList();
        this.textContent = '';
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    append(...children) {
        this.children.push(...children);
    }

    querySelectorAll() {
        return [];
    }

    closest() {
        return null;
    }

    contains(node) {
        return node === this || this.children.includes(node);
    }
}

class FakeButtonElement extends FakeElement {
    constructor() {
        super('button');
        this.disabled = false;
        this.innerHTML = '';
    }
}

function createRuntime(fetchImplementation) {
    const body = new FakeElement('body');
    const documentListeners = new Map();
    const windowListeners = new Map();

    const document = {
        body,
        readyState: 'complete',
        createElement: tagName => tagName === 'button' ? new FakeButtonElement() : new FakeElement(tagName),
        querySelector: selector => {
            if (selector !== '[data-domiknow-loading-bar]') return null;
            return body.children.find(child => child.hasAttribute('data-domiknow-loading-bar')) || null;
        },
        addEventListener: (name, handler) => documentListeners.set(name, handler)
    };

    const runtimeWindow = {
        fetch: fetchImplementation,
        location: {
            origin: 'http://localhost:3000',
            href: 'http://localhost:3000/pages/tenant/properties.html',
            pathname: '/pages/tenant/properties.html',
            search: ''
        },
        setTimeout,
        clearTimeout,
        requestAnimationFrame: callback => setTimeout(callback, 0),
        queueMicrotask,
        addEventListener: (name, handler) => windowListeners.set(name, handler)
    };

    class FakeMutationObserver {
        observe() {}
    }

    const context = vm.createContext({
        window: runtimeWindow,
        document,
        Element: FakeElement,
        HTMLButtonElement: FakeButtonElement,
        MutationObserver: FakeMutationObserver,
        Headers,
        Request,
        URL,
        Promise,
        setTimeout,
        clearTimeout,
        queueMicrotask
    });

    vm.runInContext(source, context);
    return { body, window: runtimeWindow };
}

test('shared loading operations remain busy until every token is finished', () => {
    const runtime = createRuntime(() => Promise.resolve({ ok: true }));
    const first = runtime.window.DomiKnowLoading.start({ timeout: 0 });
    const second = runtime.window.DomiKnowLoading.start({ timeout: 0 });

    assert.equal(runtime.window.DomiKnowLoading.isBusy(), true);
    assert.equal(runtime.body.getAttribute('data-domiknow-loading'), 'true');

    runtime.window.DomiKnowLoading.finish(second);
    assert.equal(runtime.window.DomiKnowLoading.isBusy(), true);

    runtime.window.DomiKnowLoading.finish(first);
    assert.equal(runtime.window.DomiKnowLoading.isBusy(), false);
    assert.equal(runtime.body.hasAttribute('data-domiknow-loading'), false);
});

test('foreground fetches are tracked while explicitly silent fetches remain idle', async () => {
    const pending = [];
    const runtime = createRuntime((input, init) => new Promise(resolve => pending.push({ input, init, resolve })));

    const foreground = runtime.window.fetch('/api/dashboard/me');
    assert.equal(runtime.window.DomiKnowLoading.isBusy(), true);
    pending.shift().resolve({ ok: true });
    await foreground;
    assert.equal(runtime.window.DomiKnowLoading.isBusy(), false);

    const silent = runtime.window.fetch('/api/notifications/my', { domiknowLoading: false });
    assert.equal(runtime.window.DomiKnowLoading.isBusy(), false);
    const silentRequest = pending.shift();
    assert.equal(Object.hasOwn(silentRequest.init, 'domiknowLoading'), false);
    silentRequest.resolve({ ok: true });
    await silent;
});
