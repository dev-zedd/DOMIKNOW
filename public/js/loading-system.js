(function () {
    'use strict';

    if (window.DomiKnowLoading) return;

    const LEGACY_LOADING_PATTERN = /^(loading|fetching|checking|preparing|retrieving|sending|verifying|signing in|creating|resetting|processing)(?:\b|[.\u2026])/i;
    const trackedButtons = new WeakMap();
    let activeRequests = 0;
    let revealTimer = null;
    let finishTimer = null;

    function getProgressBar() {
        let bar = document.querySelector('[data-domiknow-loading-bar]');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.className = 'dk-loading-bar';
        bar.setAttribute('data-domiknow-loading-bar', '');
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-label', 'Loading');
        document.body.appendChild(bar);
        return bar;
    }

    function start(options = {}) {
        activeRequests += 1;
        window.clearTimeout(finishTimer);
        if (activeRequests > 1) return;
        const delay = Number.isFinite(options.delay) ? options.delay : 160;
        window.clearTimeout(revealTimer);
        revealTimer = window.setTimeout(() => {
            const bar = getProgressBar();
            bar.classList.remove('is-finishing');
            bar.classList.add('is-visible');
        }, Math.max(0, delay));
    }

    function finish() {
        activeRequests = Math.max(0, activeRequests - 1);
        if (activeRequests) return;
        window.clearTimeout(revealTimer);
        const bar = document.querySelector('[data-domiknow-loading-bar]');
        if (!bar) return;
        bar.classList.add('is-finishing', 'is-visible');
        finishTimer = window.setTimeout(() => {
            bar.classList.remove('is-visible', 'is-finishing');
        }, 170);
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
            button.setAttribute('aria-busy', 'true');
            button.innerHTML = '';
            const content = document.createElement('span');
            content.className = 'dk-button-loading__content';
            const spinner = document.createElement('span');
            spinner.className = 'dk-spinner';
            spinner.setAttribute('aria-hidden', 'true');
            const text = document.createElement('span');
            text.textContent = label || 'Working…';
            content.append(spinner, text);
            button.appendChild(content);
            return;
        }

        const previous = trackedButtons.get(button);
        if (!previous) return;
        button.innerHTML = previous.html;
        button.disabled = previous.disabled;
        button.classList.remove('dk-button-loading');
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
        if (!root) return;
        const candidates = [];
        if (root instanceof Element) candidates.push(root);
        root.querySelectorAll?.('div, span, p, td, dd, button').forEach(node => candidates.push(node));
        candidates.forEach(node => {
            if (node instanceof HTMLButtonElement) {
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
                node.setAttribute('aria-busy', 'true');
                if (!node.hasAttribute('role')) node.setAttribute('role', 'status');
            } else if (node.classList.contains('dk-auto-skeleton')) {
                node.classList.remove('dk-auto-skeleton');
                node.removeAttribute('aria-busy');
            }
        });
    }

    function track(promise, options = {}) {
        start(options);
        return Promise.resolve(promise).finally(finish);
    }

    const originalFetch = window.fetch?.bind(window);
    if (originalFetch) {
        window.fetch = function (...args) {
            start();
            let request;
            try {
                request = originalFetch(...args);
            } catch (error) {
                finish();
                throw error;
            }
            return Promise.resolve(request).finally(finish);
        };
    }

    function initialize() {
        getProgressBar();
        upgradeLegacyLoading();
        const observer = new MutationObserver(records => {
            records.forEach(record => {
                if (record.type === 'characterData') upgradeLegacyLoading(record.target.parentElement);
                record.addedNodes.forEach(node => {
                    if (node instanceof Element) upgradeLegacyLoading(node);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });

        document.addEventListener('click', event => {
            const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
            if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            if (link.target && link.target !== '_self') return;
            const url = new URL(link.href, window.location.href);
            if (url.origin !== window.location.origin || url.href === window.location.href || url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return;
            start({ delay: 0 });
        }, true);
    }

    window.DomiKnowLoading = { start, finish, track, setButton, mount, clear, upgradeLegacyLoading };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
