const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../public');
function files(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
        const target = path.join(dir, item.name);
        return item.isDirectory() ? files(target) : [target];
    });
}
const sources = files(root).filter(file => /\.(css|html|js)$/.test(file)).map(file => [file, fs.readFileSync(file, 'utf8')]);

test('system UI uses SVG icons rather than literal or encoded emoji', () => {
    const pictographs = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u23F0-\u23FF\u2139\uFE0F]/u;
    const controllers = files(path.join(root, '../server/controllers')).filter(file => file.endsWith('.js'));
    for (const [file, source] of [...sources, ...controllers.map(file => [file, fs.readFileSync(file, 'utf8')])]) {
        const decoded = source.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)));
        assert.equal(pictographs.test(decoded), false, `${path.relative(root, file)} includes a pictograph`);
    }
});

test('UI tokens without fallbacks are defined in the shared asset set', () => {
    const definitions = new Set(sources.flatMap(([, source]) => [...source.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1])));
    for (const [file, source] of sources) {
        for (const match of source.matchAll(/var\((--[\w-]+)\s*\)/g)) {
            assert.ok(definitions.has(match[1]), `${path.relative(root, file)}: undefined ${match[1]}`);
        }
    }
});

test('all local HTML navigation and asset references resolve', () => {
    for (const [file, source] of sources.filter(([file]) => file.endsWith('.html'))) {
        for (const match of source.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
            const link = match[1].split(/[?#]/)[0];
            if (!link || /[:{]/.test(link)) continue;
            const target = link.startsWith('/') ? path.join(root, link) : path.resolve(path.dirname(file), link);
            assert.ok(fs.existsSync(target), `${path.relative(root, file)}: missing ${link}`);
        }
    }
});

test('every browser script and executable inline script parses', () => {
    for (const [file, source] of sources) {
        if (file.endsWith('.js')) assert.doesNotThrow(() => new vm.Script(source, { filename: file }));
        if (!file.endsWith('.html')) continue;
        for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
            if (/type=["'](?:application\/ld\+json|application\/json|module)/.test(match[1])) continue;
            assert.doesNotThrow(() => new vm.Script(match[2], { filename: file }));
        }
    }
});

test('small action and navigation text retains contrast in both themes', () => {
    const css = fs.readFileSync(path.join(root, 'css/design-system.css'), 'utf8');
    const light = css.match(/:root\s*\{([\s\S]*?)\}/)[1];
    const dark = css.slice(css.indexOf(':root[data-theme="dark"]')).match(/\{([\s\S]*?)\}/)[1];
    const luminance = hex => {
        const c = hex.match(/../g).map(v => parseInt(v, 16) / 255)
            .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    };
    for (const [theme, block] of [['light', light], ['dark', dark]]) {
        const token = name => (block.match(new RegExp(`${name}: #([a-f0-9]{6})`, 'i')) || light.match(new RegExp(`${name}: #([a-f0-9]{6})`, 'i')))[1];
        for (const [foreground, background] of [
            ['--color-link', '--color-bg-surface'], ['--color-link', '--color-bg-selected'],
            ['--color-text-on-action', '--color-action-primary'],
            ['--color-text-on-action', '--color-action-primary-hover']
        ]) {
            const a = luminance(token(foreground)), b = luminance(token(background));
            const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            assert.ok(ratio >= 4.5, `${theme}: ${foreground} on ${background} has contrast ${ratio}`);
        }
    }
});

test('public CTA overrides use theme tokens in every interaction state', () => {
    const css = fs.readFileSync(path.join(root, 'css/public-module.css'), 'utf8');
    for (const [suffix, token] of [['', '--color-action-primary'], [':hover', '--color-action-primary-hover'], [':active', '--color-action-primary-pressed']]) {
        const selector = `.public-landing-page .public-hero .btn-primary${suffix} {`;
        const block = css.slice(css.indexOf(selector) + selector.length).split('}')[0];
        assert.ok(block.includes(`background: var(${token}) !important`), `${suffix || 'default'} must not override the theme with white`);
    }
    const secondary = css.split('.public-final-cta__actions .btn-secondary {')[1].split('}')[0];
    assert.ok(secondary.includes('color: var(--color-text-primary) !important'));
    assert.ok(css.includes('[data-theme="dark"] .public-final-cta {'));
});

test('literal browser fetch paths and methods resolve to mounted server routes', () => {
    const serverRoot = path.join(root, '../server');
    const app = fs.readFileSync(path.join(serverRoot, 'app.js'), 'utf8');
    const routes = [];
    for (const [, mount, name] of app.matchAll(/app\.use\('([^']+)',\s*(\w+Routes)\)/g)) {
        const source = fs.readFileSync(path.join(serverRoot, 'routes', `${name}.js`), 'utf8');
        for (const [, method, url] of source.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)) {
            routes.push({ method, path: new RegExp(`^${(mount + (url === '/' ? '' : url)).replace(/:[A-Za-z_]+/g, '[^/]+')}/?$`) });
        }
    }
    let checked = 0;
    for (const [file, source] of sources) {
        if (!/\.(html|js)$/.test(file)) continue;
        for (const match of source.matchAll(/fetch\(\s*(['"`])(\/api\/.*?)\1\s*(?:,\s*\{)?/g)) {
            const url = match[2].replace(/\$\{[^}]+\}/g, 'fixture').split('?')[0];
            const options = source.slice(match.index + match[0].length, match.index + match[0].length + 220);
            const method = (options.match(/method:\s*['"](GET|POST|PUT|PATCH|DELETE)['"]/)?.[1] || 'GET').toLowerCase();
            assert.ok(routes.some(route => route.method === method && route.path.test(url)), `${path.relative(root, file)}: ${method} ${url}`);
            checked++;
        }
    }
    assert.ok(checked >= 100, 'scan must cover the direct client API connections');
});
