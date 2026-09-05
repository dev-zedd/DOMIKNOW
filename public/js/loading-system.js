(function () {
    'use strict';

    if (window.DomiKnowLoading) return;

    const LEGACY_LOADING_PATTERN = /^(loading|fetching|checking|preparing|retrieving|sending|verifying|signing in|creating|resetting|processing)(?:\b|[.\u2026])/i;
    const DEFAULT_REVEAL_DELAY = 160;
    const MAX_OPERATION_DURATION = 30000;
    const trackedButtons = new WeakMap();
    const operations = new Map();
    const pendingUpgradeRoots = new Set();
    let operationId = 0;
    let revealTimer = null;
    let finishTimer = null;
    let upgradeFrame = null;

    function getProgressBar() {
        let bar = document.querySelector('[data-domiknow-loading-bar]');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.className = 'dk-loading-bar';
        bar.setAttribute('data-domiknow-loading-bar', '');
        bar.setAttribute('aria-hidden', 'true');
        document.body.appendChild(bar);
        return bar;
    }

    function setBusyState(isBusy) {
        if (!document.body) return;
        if (isBusy) document.body.setAttribute('data-domiknow-loading', 'true');
        else document.body.removeAttribute('data-domiknow-loading');
    }

    function start(options = {}) {
        const token = `dk-loading-${++operationId}`;
        const wasIdle = operations.size === 0;
        const timeout = Number.isFinite(options.timeout) ? options.timeout : MAX_OPERATION_DURATION;
        const timeoutId = timeout > 0 ? window.setTimeout(() => finish(token), timeout) : null;

        operations.set(token, { timeoutId });
        setBusyState(true);
        window.clearTimeout(finishTimer);

        if (wasIdle) {
            const delay = Number.isFinite(options.delay) ? options.delay : DEFAULT_REVEAL_DELAY;
            window.clearTimeout(revealTimer);
            revealTimer = window.setTimeout(() => {
                if (!operations.has(token) && operations.size === 0) return;
                const bar = getProgressBar();
                bar.classList.remove('is-finishing');
                bar.classList.add('is-visible');
                bar.setAttribute('aria-hidden', 'false');
                bar.setAttribute('role', 'progressbar');
                bar.setAttribute('aria-label', 'Loading');
            }, Math.max(0, delay));
        }

        return token;
    }

    function finish(token) {
        let operationToken = token;
        if (!operationToken) operationToken = operations.keys().next().value;
        const operation = operations.get(operationToken);
        if (!operation) return;

        if (operation.timeoutId) window.clearTimeout(operation.timeoutId);
        operations.delete(operationToken);
        if (operations.size) return;

        setBusyState(false);
        window.clearTimeout(revealTimer);
        const bar = document.querySelector('[data-domiknow-loading-bar]');
        if (!bar) return;
        bar.classList.add('is-finishing', 'is-visible');
        bar.setAttribute('aria-hidden', 'false');
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-label', 'Loading');
        finishTimer = window.setTimeout(() => {
            bar.classList.remove('is-visible', 'is-finishing');
            bar.setAttribute('aria-hidden', 'true');
            bar.removeAttribute('role');
            bar.removeAttribute('aria-label');
        }, 170);
    }

    function reset() {
        operations.forEach(operation => {
            if (operation.timeoutId) window.clearTimeout(operation.timeoutId);
        });
        operations.clear();
        window.clearTimeout(revealTimer);
        window.clearTimeout(finishTimer);
        setBusyState(false);
        const bar = document.querySelector('[data-domiknow-loading-bar]');
        bar?.classList.remove('is-visible', 'is-finishing');
        bar?.setAttribute('aria-hidden', 'true');
        bar?.removeAttribute('role');
        bar?.removeAttribute('aria-label');
    }

    function setButton(button, loading, label) {
        if (!button) return;
        if (loading) {
            if (!trackedButtons.has(button)) {
                trackedButtons.set(button, {
                    html: button.innerHTML,
                    disabled: Boolean(button.disabled),
                    ariaLabel: button.getAttribute('aria-label')
                });
            }
            button.disabled = true;
            button.classList.add('dk-button-loading');
            button.classList.remove('dk-auto-button-loading');
            button.setAttribute('aria-busy', 'true');
            button.innerHTML = '';
            const content = document.createElement('span');
            content.className = 'dk-button-loading__content';
            const spinner = document.createElement('span');
            spinner.className = 'dk-spinner';
            spinner.setAttribute('aria-hidden', 'true');
            const text = document.createElement('span');
            text.textContent = label || 'Working\u2026';
            content.append(spinner, text);
            button.appendChild(content);
            return;
        }

        const previous = trackedButtons.get(button);
        if (!previous) return;
        button.innerHTML = previous.html;
        button.disabled = previous.disabled;
        button.classList.remove('dk-button-loading');
        button.classList.remove('dk-auto-button-loading');
        button.removeAttribute('aria-busy');
        if (previous.ariaLabel === null) button.removeAttribute('aria-label');
        else button.setAttribute('aria-label', previous.ariaLabel);
        trackedButtons.delete(button);
    }

    function skeletonLine(widthClass = '') {
        const line = document.createElement('span');
        line.className = `dk-skeleton dk-skeleton--line ${widthClass}`.trim();
        line.setAttribute('aria-hidden', 'true');
        return line;
    }

    function createCardSkeleton() {
        const card = document.createElement('div');
        card.className = 'dk-skeleton-card';
        card.setAttribute('aria-hidden', 'true');
        const media = document.createElement('span');
        media.className = 'dk-skeleton dk-skeleton-card__media';
        const body = document.createElement('span');
        body.className = 'dk-skeleton-card__body';
        body.append(skeletonLine('is-short'), skeletonLine(), skeletonLine('is-medium'), skeletonLine('is-short'));
        card.append(media, body);
        return card;
    }

    function createTableSkeleton(rows = 5) {
        const table = document.createElement('div');
        table.className = 'dk-skeleton-table';
        table.setAttribute('aria-hidden', 'true');
        for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
            const row = document.createElement('div');
            row.className = 'dk-skeleton-table__row';
            row.append(skeletonLine(), skeletonLine('is-medium'), skeletonLine('is-short'), skeletonLine('is-short'));
            table.appendChild(row);
        }
        return table;
    }

    function createDetailSkeleton() {
        const detail = document.createElement('div');
        detail.className = 'dk-skeleton-detail';
        detail.setAttribute('aria-hidden', 'true');
        const media = document.createElement('span');
        media.className = 'dk-skeleton dk-skeleton-detail__media';
        const content = document.createElement('span');
        content.className = 'dk-skeleton-detail__content';
        const title = document.createElement('span');
        title.className = 'dk-skeleton dk-skeleton--title';
        content.append(title, skeletonLine('is-medium'), skeletonLine(), skeletonLine(), skeletonLine('is-short'));
        detail.append(media, content);
        return detail;
    }

    function mount(container, options = {}) {
        if (!container) return null;
        const type = options.type || 'card';
        const count = Math.max(1, Number(options.count) || 1);
        const wrapper = document.createElement('div');
        wrapper.className = type === 'card' && count > 1 ? 'dk-skeleton-grid' : 'dk-skeleton-stack';
        wrapper.setAttribute('data-domiknow-skeleton', '');
        wrapper.setAttribute('role', 'status');
        wrapper.setAttribute('aria-label', options.label || 'Loading content');
        if (type === 'table') wrapper.appendChild(createTableSkeleton(count));
        else if (type === 'detail') wrapper.appendChild(createDetailSkeleton());
        else for (let index = 0; index < count; index += 1) wrapper.appendChild(createCardSkeleton());
        container.replaceChildren(wrapper);
        container.setAttribute('aria-busy', 'true');
        return wrapper;
    }

    function clear(container) {
        if (!container) return;
        container.querySelectorAll('[data-domiknow-skeleton]').forEach(node => node.remove());
        container.removeAttribute('aria-busy');
    }

    function upgradeLegacyLoading(root = document.body) {
        if (!root || root.closest?.('[data-domiknow-loading-ignore]')) return;
        const candidates = [];
        if (root instanceof Element) candidates.push(root);
        root.querySelectorAll?.('div, span, p, td, dd, button').forEach(node => candidates.push(node));
        candidates.forEach(node => {
            if (node.closest('[data-domiknow-loading-ignore]')) return;
            if (node instanceof HTMLButtonElement) {
                if (node.classList.contains('dk-button-loading') || (typeof node.querySelector === 'function' && node.querySelector('.dk-spinner'))) {
                    node.classList.remove('dk-auto-button-loading');
                    return;
                }
                const loadingButton = node.disabled && LEGACY_LOADING_PATTERN.test(node.textContent.trim());
                node.classList.toggle('dk-auto-button-loading', loadingButton);
                if (loadingButton) node.setAttribute('aria-busy', 'true');
                else if (!node.classList.contains('dk-button-loading')) node.removeAttribute('aria-busy');
                return;
            }
            if (node.children.length || node.closest('[data-domiknow-skeleton], .dk-button-loading')) return;
            const text = node.textContent.trim();
            if (LEGACY_LOADING_PATTERN.test(text)) {
                node.classList.add('dk-auto-skeleton');
                node.setAttribute('data-dk-auto-loading', '');
                node.setAttribute('aria-busy', 'true');
                if (!node.hasAttribute('role')) {
                    node.setAttribute('role', 'status');
                    node.setAttribute('data-dk-auto-role', '');
                }
            } else if (
                node.classList.contains('dk-auto-skeleton')
                || node.hasAttribute('data-dk-auto-loading')
                || (node.getAttribute('aria-busy') === 'true' && node.getAttribute('role') === 'status')
            ) {
                node.classList.remove('dk-auto-skeleton');
                node.removeAttribute('data-dk-auto-loading');
                node.removeAttribute('aria-busy');
                if (node.hasAttribute('data-dk-auto-role')) {
                    node.removeAttribute('data-dk-auto-role');
                    node.removeAttribute('role');
                }
            }
        });
    }

    function scheduleLegacyUpgrade(root) {
        if (!(root instanceof Element) || root.closest('[data-domiknow-loading-ignore]')) return;
        for (const queuedRoot of pendingUpgradeRoots) {
            if (queuedRoot.contains(root)) return;
            if (root.contains(queuedRoot)) pendingUpgradeRoots.delete(queuedRoot);
        }
        pendingUpgradeRoots.add(root);
        if (upgradeFrame !== null) return;
        upgradeFrame = window.requestAnimationFrame(() => {
            const roots = Array.from(pendingUpgradeRoots);
            pendingUpgradeRoots.clear();
            upgradeFrame = null;
            roots.forEach(upgradeLegacyLoading);
        });
    }

    function track(promise, options = {}) {
        const token = start(options);
        return Promise.resolve(promise).finally(() => finish(token));
    }

    function getFetchOptions(input, init) {
        const options = init && typeof init === 'object' ? init : {};
        let headers;
        try {
            headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
        } catch (_error) {
            headers = new Headers();
        }
        return { options, headers };
    }

    function shouldTrackFetch(input, init) {
        const { options, headers } = getFetchOptions(input, init);
        if (options.domiknowLoading === false || headers.get('X-DOMIKNOW-SILENT') === '1') return false;
        if (String(options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase() === 'HEAD') return false;
        try {
            const requestUrl = new URL(input instanceof Request ? input.url : input, window.location.href);
            return requestUrl.origin === window.location.origin;
        } catch (_error) {
            return true;
        }
    }

    function stripFetchOptions(init) {
        if (!init || typeof init !== 'object' || !Object.prototype.hasOwnProperty.call(init, 'domiknowLoading')) return init;
        const nativeOptions = { ...init };
        delete nativeOptions.domiknowLoading;
        return nativeOptions;
    }

    const originalFetch = window.fetch?.bind(window);
    if (originalFetch) {
        window.fetch = function (input, init) {
            const trackRequest = shouldTrackFetch(input, init);
            const token = trackRequest ? start() : null;
            let request;
            try {
                request = originalFetch(input, stripFetchOptions(init));
            } catch (error) {
                if (token) finish(token);
                throw error;
            }
            return token ? Promise.resolve(request).finally(() => finish(token)) : request;
        };
    }

    function initialize() {
        getProgressBar();
        upgradeLegacyLoading();
        const observer = new MutationObserver(records => {
            records.forEach(record => {
                if (record.type === 'characterData') scheduleLegacyUpgrade(record.target.parentElement);
                if (record.type === 'childList') {
                    const mutationRoot = record.target instanceof Element
                        ? record.target
                        : record.target.parentElement;
                    if (mutationRoot) scheduleLegacyUpgrade(mutationRoot);
                }
                record.addedNodes.forEach(node => {
                    if (node instanceof Element) scheduleLegacyUpgrade(node);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });

        document.addEventListener('click', event => {
            const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
            if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;
            if (link.closest('.dashboard-layout')) return;
            const url = new URL(link.href, window.location.href);
            const sameDocumentHash = url.hash && url.pathname === window.location.pathname && url.search === window.location.search;
            if (url.origin !== window.location.origin || url.href === window.location.href || sameDocumentHash) return;
            window.queueMicrotask(() => {
                if (!event.defaultPrevented) start({ delay: 0, timeout: 10000 });
            });
        });

        window.addEventListener('pageshow', reset);
    }

    window.DomiKnowLoading = {
        start,
        finish,
        reset,
        track,
        setButton,
        mount,
        clear,
        upgradeLegacyLoading,
        isBusy: () => operations.size > 0
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
