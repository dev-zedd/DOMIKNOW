/*
 * DOMIKNOW shared, dependency-free UI bootstrap.
 *
 * This file intentionally owns presentation and accessibility enhancements
 * only. It must not alter forms, application routes, API calls, or business
 * workflows.
 */
(function () {
    'use strict';

    const THEME_STORAGE_KEY = 'domiknow_theme';
    const THEME_QUERY = '(prefers-color-scheme: dark)';
    const THEMES = new Set(['light', 'dark']);
    const MAIN_TARGET_ID = 'domiknow-main-content';

    let enhancementFrame = null;
    let mutationObserver = null;

    const ICON_PATHS = {
        clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h6M8 17h4"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        worker: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M8 4l2-2 2 2 2-2 2 2"/>',
        calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h2M14 14h2M8 18h2"/>',
        pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
        wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3l8.7-8.7a4 4 0 0 0-2-2Z"/><path d="m5 5 4 4M4 4l2-2 4 4-2 2Z"/>',
        water: '<path d="M12 3s6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10Z"/>',
        bolt: '<path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>',
        snowflake: '<path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18M5 12h14"/><path d="m12 2-2 3m2-3 2 3m0 14-2 3-2-3M4.9 6l3.5.5M4.9 6l1 3.4m12.2 8.6-3.5-.5m3.5.5-1-3.4M19.1 6l-3.5.5m3.5-.5-1 3.4M4.9 18l3.5-.5m-3.5.5 1-3.4"/>',
        door: '<path d="M5 21V3h14v18M5 21h14M15 12h.01"/>',
        roof: '<path d="m3 12 9-8 9 8M5 10v10h14V10M9 20v-5h6v5"/>',
        signal: '<path d="M4 18h.01M8 15h.01M12 12h.01M16 9h.01M20 6h.01" stroke-width="3" stroke-linecap="round"/>',
        plug: '<path d="M8 7v5M16 7v5M6 12h12M9 12v3a3 3 0 0 0 6 0v-3M12 18v4"/>',
        warning: '<path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4M12 16h.01"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        x: '<path d="m6 6 12 12M18 6 6 18"/>',
        paperclip: '<path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
        edit: '<path d="m4 16 9-9 5 5-9 9H4v-5ZM14 6l2-2a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3l-2 2"/>',
        arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
        'arrow-left': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
        folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>',
        lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
        note: '<path d="M5 3h14v14l-4 4H5V3Z"/><path d="M15 21v-4h4M8 8h8M8 12h8M8 16h4"/>',
        message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.5-4A7 7 0 0 1 3 14V8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7Z"/>',
        flag: '<path d="M5 22V3M5 4h11l-2 4 2 4H5"/>',
        sparkle: '<path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3ZM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 13l.8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8L5 13Z"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
        map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
        ban: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
        building: '<path d="M4 21V5l8-3 8 3v16M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2M10 21v-3h4v3"/>',
        money: '<circle cx="12" cy="12" r="9"/><path d="M16 8.5c-.8-1-2-1.5-4-1.5-2.2 0-3.5 1-3.5 2.5 0 4 7 1.5 7 5 0 1.5-1.3 2.5-3.5 2.5-2 0-3.2-.5-4-1.5M12 5v14"/>',
        trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
        eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
        plus: '<path d="M12 5v14M5 12h14"/>'
    };

    function domiknowIcon(name, label = '') {
        const paths = ICON_PATHS[name] || ICON_PATHS.clipboard;
        const icon = document.createElement('span');
        icon.className = 'ui-icon';
        icon.setAttribute('data-icon', name);
        icon.setAttribute('aria-hidden', label ? 'false' : 'true');
        if (label) icon.setAttribute('aria-label', label);
        icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
        return icon.outerHTML;
    }

    window.domiknowIcon = domiknowIcon;

    function ensureBrandFavicons() {
        if (!document.head.querySelector('link[data-domiknow-favicon]')) {
            const favicon = document.createElement('link');
            favicon.rel = 'icon';
            favicon.type = 'image/svg+xml';
            favicon.sizes = 'any';
            favicon.href = '/images/domiknow-mark.svg';
            favicon.setAttribute('data-domiknow-favicon', '');
            document.head.appendChild(favicon);
        }

        if (!document.head.querySelector('link[rel="apple-touch-icon"]')) {
            const touchIcon = document.createElement('link');
            touchIcon.rel = 'apple-touch-icon';
            touchIcon.sizes = '180x180';
            touchIcon.href = '/images/domiknow-apple-touch-v1.png';
            document.head.appendChild(touchIcon);
        }
    }

    function enhanceIcons() {
        document.querySelectorAll('[data-icon]:not([data-icon-rendered])').forEach((placeholder) => {
            const iconName = placeholder.getAttribute('data-icon');
            const label = placeholder.getAttribute('aria-label') || '';
            placeholder.outerHTML = domiknowIcon(iconName, label).replace('<span', '<span data-icon-rendered="true"');
        });
    }

    function readStoredTheme() {
        try {
            const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
            return THEMES.has(storedTheme) ? storedTheme : null;
        } catch (error) {
            return null;
        }
    }

    function getSystemTheme() {
        if (typeof window.matchMedia === 'function' && window.matchMedia(THEME_QUERY).matches) {
            return 'dark';
        }
        return 'light';
    }

    function getCurrentTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        return THEMES.has(currentTheme) ? currentTheme : getSystemTheme();
    }

    function writeStoredTheme(theme) {
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (error) {
            // Theme selection still applies for this page when storage is unavailable.
        }
    }

    function applyTheme(theme, persist) {
        const nextTheme = THEMES.has(theme) ? theme : getSystemTheme();
        document.documentElement.setAttribute('data-theme', nextTheme);
        document.documentElement.style.colorScheme = nextTheme;

        if (persist) {
            writeStoredTheme(nextTheme);
        }

        updateThemeControls();
    }

    function updateThemeControls() {
        const currentTheme = getCurrentTheme();
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.querySelectorAll('[data-theme-toggle]').forEach((control) => {
            control.setAttribute('aria-pressed', String(currentTheme === 'dark'));
            control.setAttribute('data-theme-state', currentTheme);
            control.setAttribute('aria-label', `Switch to ${nextTheme} theme`);

            const nextThemeLabel = `Switch to ${nextTheme} theme`;
            if ((!control.hasAttribute('title') || control.hasAttribute('data-ui-floating-theme-toggle')) &&
                control.getAttribute('title') !== nextThemeLabel) {
                control.setAttribute('title', nextThemeLabel);
            }

            let themeIcon = control.querySelector('[data-ui-theme-icon]');
            if (!themeIcon && !control.querySelector('svg, img') && !(control.textContent || '').trim()) {
                themeIcon = document.createElement('span');
                themeIcon.className = 'ui-theme-toggle__icon';
                themeIcon.setAttribute('data-ui-theme-icon', '');
                themeIcon.setAttribute('aria-hidden', 'true');
                control.appendChild(themeIcon);
            }

            if (themeIcon) {
                const nextIcon = currentTheme === 'dark' ? '\u2600' : '\u263e';
                if (themeIcon.textContent !== nextIcon) {
                    themeIcon.textContent = nextIcon;
                }
            }
        });
    }

    function isPublicOrAuthPage() {
        const path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
        return path.includes('/pages/auth/') ||
            path.includes('/pages/public/') ||
            !path.includes('/pages/');
    }

    function ensureNonAdminMobileExperience() {
        const path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
        if (path.includes('/pages/admin/')) return;

        const viewport = document.head.querySelector('meta[name="viewport"]');
        if (viewport) {
            const directives = (viewport.content || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
            if (!directives.some((item) => item.toLowerCase().startsWith('viewport-fit='))) {
                directives.push('viewport-fit=cover');
                viewport.content = directives.join(', ');
            }
        }

        let stylesheet = document.head.querySelector('link[href*="mobile-first.css"]');
        if (!stylesheet) {
            stylesheet = document.createElement('link');
            stylesheet.rel = 'stylesheet';
            stylesheet.href = '/css/mobile-first.css?v=20260817-1';
            document.head.appendChild(stylesheet);
        }
        stylesheet.setAttribute('data-mobile-first', '');
    }

    function ensureDomiKnowModalSystem() {
        if (!document.head.querySelector('link[data-domiknow-modal-system]')) {
            const stylesheet = document.createElement('link');
            stylesheet.rel = 'stylesheet';
            stylesheet.href = '/css/modal-system.css?v=20260817-3';
            stylesheet.setAttribute('data-domiknow-modal-system', '');
            document.head.appendChild(stylesheet);
        }

        let resolveReady;
        let rejectReady;
        const existingReady = window.DomiKnowModalReady;
        if (!existingReady) {
            window.DomiKnowModalReady = new Promise((resolve, reject) => {
                resolveReady = resolve;
                rejectReady = reject;
            });
        }

        if (window.DomiKnowModal) {
            resolveReady?.(window.DomiKnowModal);
        } else if (!document.head.querySelector('script[data-domiknow-modal-system]')) {
            const script = document.createElement('script');
            script.src = '/js/modal-system.js?v=20260817-2';
            script.defer = true;
            script.setAttribute('data-domiknow-modal-system', '');
            script.addEventListener('load', () => resolveReady?.(window.DomiKnowModal));
            script.addEventListener('error', () => rejectReady?.(new Error('DOMIKNOW modal system failed to load.')));
            document.head.appendChild(script);
        }

        async function useModal(method, input, fallback) {
            try {
                const modal = window.DomiKnowModal || await window.DomiKnowModalReady;
                if (modal && typeof modal[method] === 'function') return modal[method](input);
            } catch (error) {
                console.warn(error.message);
            }
            return fallback();
        }

        window.domiknowAlert = (input) => useModal('alert', input, () => {
            window.alert(typeof input === 'string' ? input : input?.message || '');
        });
        window.domiknowConfirm = (input) => useModal('confirm', input, () =>
            window.confirm(typeof input === 'string' ? input : input?.message || '')
        );
        window.domiknowPrompt = (input) => useModal('prompt', input, () =>
            window.prompt(
                typeof input === 'string' ? input : input?.message || '',
                typeof input === 'object' ? input?.input?.value || input?.value || '' : ''
            )
        );
    }

    function ensureDomiKnowWalkthroughSystem() {
        if (!document.head.querySelector('link[data-domiknow-walkthrough]')) {
            const stylesheet = document.createElement('link');
            stylesheet.rel = 'stylesheet';
            stylesheet.href = '/css/walkthrough-system.css?v=20260817-1';
            stylesheet.setAttribute('data-domiknow-walkthrough', '');
            document.head.appendChild(stylesheet);
        }

        if (!document.head.querySelector('script[data-domiknow-walkthrough]')) {
            const script = document.createElement('script');
            script.src = '/js/walkthrough-system.js?v=20260817-1';
            script.defer = true;
            script.setAttribute('data-domiknow-walkthrough', '');
            document.head.appendChild(script);
        }
    }

    function ensureFloatingThemeToggle() {
        const currentFloatingToggle = document.querySelector('[data-ui-floating-theme-toggle]');
        const shellToggle = Array.from(document.querySelectorAll('[data-theme-toggle]'))
            .find((toggle) => !toggle.hasAttribute('data-ui-floating-theme-toggle'));

        if (!isPublicOrAuthPage() || shellToggle) {
            if (currentFloatingToggle) {
                currentFloatingToggle.remove();
            }
            return;
        }

        if (currentFloatingToggle) {
            return;
        }

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'theme-toggle ui-theme-toggle';
        toggle.setAttribute('data-theme-toggle', '');
        toggle.setAttribute('data-ui-floating-theme-toggle', '');

        const icon = document.createElement('span');
        icon.className = 'ui-theme-toggle__icon';
        icon.setAttribute('data-ui-theme-icon', '');
        icon.setAttribute('aria-hidden', 'true');
        toggle.appendChild(icon);

        document.body.appendChild(toggle);
        updateThemeControls();
    }

    function getMainContentContainer() {
        const semanticMain = document.querySelector('main') || document.querySelector('[role="main"]');
        if (semanticMain) {
            return semanticMain;
        }

        if (document.body.classList.contains('auth-page')) {
            const authCard = document.querySelector('.auth-card');
            if (authCard) {
                authCard.setAttribute('role', 'main');
                return authCard;
            }
        }

        return document.querySelector('.main-content-inner') ||
            document.querySelector('.dashboard-container') ||
            document.querySelector('.details-container') ||
            document.querySelector('.search-container') ||
            document.body;
    }

    function ensureSkipLink() {
        let skipLink = document.querySelector('[data-ui-skip-link]');
        if (!skipLink) {
            skipLink = document.createElement('a');
            skipLink.className = 'ui-skip-link';
            skipLink.setAttribute('data-ui-skip-link', '');
            skipLink.textContent = 'Skip to main content';
        }

        skipLink.setAttribute('href', `#${MAIN_TARGET_ID}`);
        if (document.body.firstElementChild !== skipLink) {
            document.body.insertBefore(skipLink, document.body.firstChild);
        }

        let mainTarget = document.getElementById(MAIN_TARGET_ID);
        if (!mainTarget || !mainTarget.hasAttribute('data-ui-main-anchor')) {
            mainTarget = document.createElement('span');
            mainTarget.id = MAIN_TARGET_ID;
            mainTarget.className = 'ui-main-anchor';
            mainTarget.tabIndex = -1;
            mainTarget.setAttribute('data-ui-main-anchor', '');
            mainTarget.setAttribute('aria-label', 'Main content');
        }

        const mainContainer = getMainContentContainer();
        if (!document.querySelector('main, [role="main"]') && mainContainer !== document.body) {
            mainContainer.setAttribute('role', 'main');
            mainContainer.setAttribute('data-ui-main-landmark', '');
        }

        if (mainTarget.parentElement !== mainContainer || mainContainer.firstElementChild !== mainTarget) {
            mainContainer.insertBefore(mainTarget, mainContainer.firstChild);
        }
    }

    function normalizePath(pathname) {
        let normalized = pathname.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
        if (normalized.endsWith('/index.html')) {
            normalized = normalized.slice(0, -'index.html'.length);
        }
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized || '/';
    }

    function isCurrentNavigationLink(link) {
        if (link.classList.contains('active')) {
            return true;
        }

        const rawHref = link.getAttribute('href');
        if (!rawHref || rawHref.startsWith('#')) {
            return false;
        }

        let linkUrl;
        try {
            linkUrl = new URL(rawHref, document.baseURI);
        } catch (error) {
            return false;
        }

        if (!['http:', 'https:', 'file:'].includes(linkUrl.protocol) || linkUrl.hash) {
            return false;
        }

        return normalizePath(linkUrl.pathname) === normalizePath(window.location.pathname);
    }

    function enhanceNavigation() {
        const navigationLinks = document.querySelectorAll(
            'nav a[href], aside a[href], [role="navigation"] a[href], .sidebar a[href], .bottom-nav-bar a[href]'
        );

        navigationLinks.forEach((link) => {
            const isCurrent = isCurrentNavigationLink(link);

            if (isCurrent) {
                if (!link.hasAttribute('aria-current')) {
                    link.setAttribute('aria-current', 'page');
                    link.setAttribute('data-ui-aria-current', '');
                }
            } else if (link.hasAttribute('data-ui-aria-current')) {
                link.removeAttribute('aria-current');
                link.removeAttribute('data-ui-aria-current');
            }
        });
    }

    function enhanceNewWindowLinks() {
        document.querySelectorAll('a[target="_blank"]').forEach((link) => {
            const relValues = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
            relValues.add('noopener');
            relValues.add('noreferrer');
            link.setAttribute('rel', Array.from(relValues).join(' '));
        });
    }

    function getControlText(control) {
        if (control instanceof HTMLInputElement) {
            return (control.getAttribute('alt') || control.value || '').trim();
        }

        const clone = control.cloneNode(true);
        clone.querySelectorAll('svg, img, picture, canvas, i, [aria-hidden="true"]')
            .forEach((node) => node.remove());
        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function isIconOnlyControl(control) {
        const controlText = getControlText(control);
        return !controlText || /^[\p{P}\p{S}\s]+$/u.test(controlText);
    }

    function enhanceIconOnlyControls() {
        const titledControls = document.querySelectorAll(
            'button[title], a[href][title], [role="button"][title], ' +
            'input[type="button"][title], input[type="submit"][title], input[type="image"][title]'
        );

        titledControls.forEach((control) => {
            const title = (control.getAttribute('title') || '').trim();
            if (!title || control.hasAttribute('aria-labelledby') || !isIconOnlyControl(control)) {
                return;
            }

            if (!control.hasAttribute('aria-label') || control.hasAttribute('data-ui-derived-aria-label')) {
                control.setAttribute('aria-label', title);
                control.setAttribute('data-ui-derived-aria-label', '');
            }
        });
    }

    function appendDescribedBy(control, descriptionIds) {
        const existingIds = (control.getAttribute('aria-describedby') || '')
            .split(/\s+/)
            .filter(Boolean);
        const combinedIds = Array.from(new Set(existingIds.concat(descriptionIds)));

        if (combinedIds.length) {
            control.setAttribute('aria-describedby', combinedIds.join(' '));
        }
    }

    function ensureElementId(element, preferredId) {
        if (element.id) {
            return element.id;
        }

        let candidateId = preferredId;
        let suffix = 2;
        while (document.getElementById(candidateId)) {
            candidateId = `${preferredId}_${suffix}`;
            suffix += 1;
        }

        element.id = candidateId;
        element.setAttribute('data-ui-generated-id', '');
        return candidateId;
    }

    function getNearbyHelpElements(control) {
        const fieldContainer = control.closest(
            '.form-group, .field-group, .input-group, .form-field, [data-form-field]'
        );
        if (!fieldContainer) {
            return [];
        }

        return Array.from(fieldContainer.querySelectorAll('.form-help'));
    }

    function cleanControlLabel(rawLabel) {
        return (rawLabel || '')
            .replace(/\s+/g, ' ')
            .replace(/\s*[*:]\s*$/, '')
            .trim();
    }

    function getElementLabelText(element) {
        const clone = element.cloneNode(true);
        clone.querySelectorAll('input, select, textarea, button, svg, img, [aria-hidden="true"]')
            .forEach((node) => node.remove());
        return cleanControlLabel(clone.textContent);
    }

    function humanizeControlIdentifier(identifier) {
        return cleanControlLabel((identifier || '')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\bqty\b/gi, 'quantity')
            .replace(/\bmsg\b/gi, 'message')
            .replace(/\butil\b/gi, 'utility'));
    }

    function getTableColumnLabel(control) {
        const cell = control.closest('td, th');
        const table = control.closest('table');
        if (!cell || !table || typeof cell.cellIndex !== 'number') {
            return '';
        }

        const headers = table.querySelectorAll('thead th');
        const header = headers[cell.cellIndex];
        return header ? getElementLabelText(header) : '';
    }

    function deriveControlLabel(control) {
        const fieldContainer = control.closest(
            '.form-group, .field-group, .input-group, .form-field, .filter-group, [data-form-field]'
        );

        if (fieldContainer) {
            const candidates = fieldContainer.querySelectorAll(
                'label, .form-label, .field-label, .filter-label, .input-label'
            );

            for (const candidate of candidates) {
                const targetId = candidate.getAttribute('for');
                if (targetId && (!control.id || targetId !== control.id)) {
                    continue;
                }

                const labelText = getElementLabelText(candidate);
                if (labelText) {
                    return labelText;
                }
            }
        }

        const tableLabel = getTableColumnLabel(control);
        if (tableLabel) {
            return tableLabel;
        }

        const descriptiveText = cleanControlLabel(
            control.getAttribute('placeholder') || control.getAttribute('title')
        );
        if (descriptiveText) {
            return descriptiveText;
        }

        const classIdentifier = Array.from(control.classList).find((className) =>
            !['form-input', 'filter-input', 'sig-input', 'doc-file-input', 'input', 'hidden'].includes(className)
        );

        return humanizeControlIdentifier(
            control.getAttribute('name') || control.id || classIdentifier
        );
    }

    function enhanceFormAccessibility() {
        document.querySelectorAll(
            '.form-error, [id$="_error"], .alert, [id$="Feedback"], [id$="ErrorMessage"], [id$="SuccessMessage"]'
        ).forEach((errorContainer) => {
            if (!errorContainer.hasAttribute('aria-live')) {
                errorContainer.setAttribute('aria-live', 'polite');
            }
        });

        document.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach((control) => {
            const hasAssociatedLabel = control.labels && control.labels.length > 0;
            if (!hasAssociatedLabel &&
                !control.hasAttribute('aria-label') &&
                !control.hasAttribute('aria-labelledby')) {
                const derivedLabel = deriveControlLabel(control);
                if (derivedLabel) {
                    control.setAttribute('aria-label', derivedLabel);
                    control.setAttribute('data-ui-derived-form-label', '');
                }
            }

            if (!control.id) {
                return;
            }

            const errorContainer = document.getElementById(`${control.id}_error`);
            const helpElements = getNearbyHelpElements(control);
            const descriptionIds = [];

            if (errorContainer) {
                errorContainer.setAttribute('aria-live', 'polite');
                descriptionIds.push(errorContainer.id);

                const hasError = (errorContainer.textContent || '').trim().length > 0;
                control.setAttribute('aria-invalid', String(hasError));
                control.setAttribute('data-ui-aria-invalid', '');
            }

            helpElements.forEach((helpElement, index) => {
                descriptionIds.push(
                    ensureElementId(helpElement, `${control.id}_help${index ? `_${index + 1}` : ''}`)
                );
            });

            appendDescribedBy(control, descriptionIds);
        });
    }

    function enhanceDialogs() {
        const focusableSelector = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');

        document.querySelectorAll('.modal-overlay, .chat-head-modal, .nav-sheet-overlay').forEach((overlay) => {
            const dialog = overlay.matches('.chat-head-modal')
                ? overlay
                : overlay.querySelector(
                    ':scope > .modal-container, :scope > .modal-box, :scope > .modal-content, ' +
                    ':scope > .form-modal, :scope > .details-modal, :scope > .nav-sheet'
                ) || overlay.firstElementChild;

            if (!(dialog instanceof HTMLElement)) {
                return;
            }

            if (!dialog.hasAttribute('role')) {
                dialog.setAttribute('role', 'dialog');
            }
            dialog.setAttribute('aria-modal', 'true');

            if (!dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) {
                const heading = dialog.querySelector(
                    '.modal-header h2, .modal-header h3, .modal-title, .form-modal-head h2, ' +
                    '.form-modal-head h3, .details-head h2, .details-head h3, h2, h3'
                );

                if (heading) {
                    dialog.setAttribute(
                        'aria-labelledby',
                        ensureElementId(heading, `dialog_title_${document.querySelectorAll('[role="dialog"]').length}`)
                    );
                } else {
                    dialog.setAttribute('aria-label', 'Dialog');
                    dialog.setAttribute('data-ui-derived-dialog-label', '');
                }
            }

            if (dialog.hasAttribute('data-ui-focus-trap')) {
                return;
            }

            dialog.setAttribute('data-ui-focus-trap', '');
            dialog.addEventListener('keydown', (event) => {
                const isOpen = overlay.getAttribute('aria-hidden') === 'false' ||
                    overlay.classList.contains('open') || dialog.classList.contains('open');
                if (event.key !== 'Tab' || !isOpen) {
                    return;
                }

                const focusable = Array.from(dialog.querySelectorAll(focusableSelector))
                    .filter((element) => element.getClientRects().length > 0);
                if (!focusable.length) {
                    event.preventDefault();
                    return;
                }

                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            });
        });
    }

    function enhanceTables() {
        document.querySelectorAll('table').forEach((table) => {
            table.classList.add('ui-table');
            table.setAttribute('data-ui-table', '');

            const tableContainer = table.parentElement;
            if (tableContainer && !['BODY', 'MAIN', 'FORM'].includes(tableContainer.tagName)) {
                tableContainer.classList.add('ui-table-wrapper');
                tableContainer.setAttribute('data-ui-table-wrapper', '');
            }

            let columnHeaders = table.querySelectorAll('thead th');
            if (!columnHeaders.length) {
                const firstRow = table.querySelector('tr');
                columnHeaders = firstRow ? firstRow.querySelectorAll('th') : [];
            }

            columnHeaders.forEach((header) => {
                if (!header.hasAttribute('scope')) {
                    header.setAttribute('scope', 'col');
                }
            });

            const headerLabels = Array.from(columnHeaders).map((header, index) =>
                getElementLabelText(header) || `Column ${index + 1}`
            );

            if (headerLabels.length > 0 && headerLabels.length <= 5 &&
                !table.classList.contains('no-responsive-cards')) {
                table.classList.add('responsive-cards');
                table.setAttribute('data-ui-responsive-table', '');

                table.querySelectorAll('tbody tr').forEach((row) => {
                    Array.from(row.cells).forEach((cell, index) => {
                        if (cell.colSpan <= 1 && headerLabels[index] && !cell.hasAttribute('data-label')) {
                            cell.setAttribute('data-label', headerLabels[index]);
                        }
                    });
                });
            }

            if (!table.querySelector('caption') &&
                !table.hasAttribute('aria-label') &&
                !table.hasAttribute('aria-labelledby')) {
                const tableSection = table.closest(
                    '.table-card, .list-card, .history-card, .profile-card, .detail-card, section'
                );
                const heading = tableSection && tableSection.querySelector('h2, h3, h4');

                if (heading && !table.contains(heading)) {
                    table.setAttribute(
                        'aria-labelledby',
                        ensureElementId(heading, `table_title_${document.querySelectorAll('table').length}`)
                    );
                }
            }
        });
    }

    function runEnhancements() {
        ensureSkipLink();
        enhanceNavigation();
        enhanceNewWindowLinks();
        enhanceIconOnlyControls();
        enhanceFormAccessibility();
        enhanceDialogs();
        enhanceTables();
        enhanceIcons();
        ensureFloatingThemeToggle();
        updateThemeControls();
    }

    function scheduleEnhancements() {
        if (enhancementFrame !== null) {
            return;
        }

        enhancementFrame = window.requestAnimationFrame(() => {
            enhancementFrame = null;
            runEnhancements();
        });
    }

    function handleDocumentClick(event) {
        const clickTarget = event.target instanceof Element ? event.target : null;
        if (!clickTarget) {
            return;
        }

        const themeToggle = clickTarget.closest('[data-theme-toggle]');
        if (themeToggle) {
            const rawHref = themeToggle.getAttribute('href');
            if (rawHref === '#' || rawHref === '') {
                event.preventDefault();
            }

            const nextTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme, true);
            return;
        }

        const skipLink = clickTarget.closest('[data-ui-skip-link]');
        if (skipLink) {
            const mainTarget = document.getElementById(MAIN_TARGET_ID);
            if (mainTarget) {
                window.requestAnimationFrame(() => mainTarget.focus());
            }
        }
    }

    function observeDynamicContent() {
        if (mutationObserver) {
            return;
        }

        mutationObserver = new MutationObserver(scheduleEnhancements);
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'href', 'title', 'data-theme-toggle']
        });
    }

    function initialize() {
        runEnhancements();
        observeDynamicContent();
    }

    ensureBrandFavicons();
    ensureDomiKnowModalSystem();
    ensureDomiKnowWalkthroughSystem();
    ensureNonAdminMobileExperience();
    applyTheme(readStoredTheme() || getSystemTheme(), false);
    document.addEventListener('click', handleDocumentClick);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }

    if (typeof window.matchMedia === 'function') {
        const themeMediaQuery = window.matchMedia(THEME_QUERY);
        const handleSystemThemeChange = (event) => {
            if (!readStoredTheme()) {
                applyTheme(event.matches ? 'dark' : 'light', false);
            }
        };

        if (typeof themeMediaQuery.addEventListener === 'function') {
            themeMediaQuery.addEventListener('change', handleSystemThemeChange);
        } else if (typeof themeMediaQuery.addListener === 'function') {
            themeMediaQuery.addListener(handleSystemThemeChange);
        }
    }

    window.addEventListener('storage', (event) => {
        if (event.key === THEME_STORAGE_KEY && THEMES.has(event.newValue)) {
            applyTheme(event.newValue, false);
        }
    });
})();
