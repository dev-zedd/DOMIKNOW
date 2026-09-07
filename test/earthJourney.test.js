const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function journey({ reduced = false, fail = false } = {}) {
    const elements = new Map(), frames = new Map(), documentEvents = {};
    let observer, resize, clock = 1, nextFrame = 0, requests = 0, draws = 0;
    const ctx = new Proxy({}, { get: (_target, key) => key === 'createRadialGradient'
        ? () => ({ addColorStop() {} }) : () => { if (key === 'clearRect') draws++; }, set: () => true });
    for (const id of ['earthJourney', 'earthCanvas', 'earthJourneyStatus', 'earthJourneyPause', 'earthJourneyReplay', 'earthJourneyTitle']) {
        elements.set(id, { dataset: {}, attributes: {}, listeners: {}, textContent: '', disabled: true,
            setAttribute(key, value) { this.attributes[key] = value; },
            addEventListener(key, value) { this.listeners[key] = value; },
            getContext: () => ctx, getBoundingClientRect: () => ({ width: 600, height: 500 }) });
    }
    const document = { hidden: false, getElementById: id => elements.get(id), addEventListener: (name, fn) => { documentEvents[name] = fn; } };
    const media = { matches: reduced, addEventListener() {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/earth-journey.js'), 'utf8'), {
        document, window: { addEventListener() {}, domiknowIcon: name => `<svg data-name="${name}"></svg>` },
        matchMedia: () => media, getComputedStyle: () => ({ getPropertyValue: () => '#123456' }), devicePixelRatio: 1,
        requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame: id => frames.delete(id),
        ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} },
        IntersectionObserver: class { constructor(fn) { observer = fn; } observe() {} },
        fetch: async () => { requests++; return { ok: !fail, json: async () => ({ rings: [[[119, 13], [122, 13], [121, 16]]], lakes: [] }) }; }
    });
    resize();
    const show = async visible => { observer([{ isIntersecting: visible }]); await new Promise(resolve => setImmediate(resolve)); };
    const step = (count = 1) => { for (let i = 0; i < count; i++) { clock += 80; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(clock)); } };
    return { elements, frames, show, step, document, documentEvents, requests: () => requests, draws: () => draws };
}

test('Earth journey loads on visibility, pauses, resumes, arrives and replays', async () => {
    const app = await journey();
    assert.equal(app.requests(), 0);
    await app.show(true); app.step(10);
    const pause = app.elements.get('earthJourneyPause');
    pause.listeners.click();
    const draws = app.draws(); app.step(10);
    assert.equal(app.draws(), draws);
    assert.equal(pause.attributes['aria-label'], 'Resume Earth journey');
    pause.listeners.click(); app.step(100);
    assert.equal(app.elements.get('earthJourney').dataset.arrived, 'true');
    assert.equal(app.frames.size, 0);
    assert.match(app.elements.get('earthJourneyStatus').textContent, /Siniloan/);
    app.elements.get('earthJourneyReplay').listeners.click();
    assert.equal(app.elements.get('earthJourney').dataset.arrived, 'false');
    assert.equal(app.requests(), 1);
    await app.show(false);
    assert.equal(app.frames.size, 0);
    await app.show(true);
    assert.equal(app.frames.size, 1);
});

test('reduced motion renders Siniloan without scheduling an animation, including replay', async () => {
    const app = await journey({ reduced: true }); await app.show(true);
    assert.equal(app.elements.get('earthJourney').dataset.arrived, 'true');
    assert.equal(app.frames.size, 0);
    app.elements.get('earthJourneyReplay').listeners.click();
    assert.equal(app.frames.size, 0);
});

test('failed map data leaves a readable destination and no animation', async () => {
    const app = await journey({ fail: true }); await app.show(true);
    assert.equal(app.elements.get('earthJourney').dataset.arrived, 'true');
    assert.match(app.elements.get('earthJourneyStatus').textContent, /rental discovery/);
    assert.equal(app.frames.size, 0);
    assert.equal(app.elements.get('earthJourneyPause').disabled, true);
});
