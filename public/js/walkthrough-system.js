(function () {
    'use strict';
    if (window.DomiKnowWalkthrough) return;

    const STORAGE_PREFIX = 'domiknow_walkthrough_v1';
    const MOBILE_BREAKPOINT = 1023;
    const AUTO_START_DELAY_MS = 1100;
    const TARGET_PADDING = 8;

    const ROLE_TOURS = {
        tenant: {
            label: 'Tenant portal guide',
            steps: [
                ['.app-brand', 'Welcome to your tenant portal', 'Rental discovery, applications, leases, payments, and support tools stay together in this workspace.'],
                [() => mobileTarget('.bottom-nav-bar', '.sidebar-menu'), 'Your main navigation', 'Move between rental journey stages here. On mobile, the most important destinations remain within thumb reach.'],
                ['.tenant-module-intro, .tenant-page-summary', 'Know where you are', 'Each page explains its purpose, the current rental stage, and the most relevant next action.'],
                ['.main-content-inner', 'Your working area', 'Property results, forms, records, and status updates appear in this main workspace.'],
                ['.topbar-right', 'Theme and account tools', 'Change the color theme, replay this guide, verify your account identity, or log out from the navigation menu.']
            ]
        },
        landlord: {
            label: 'Landlord console guide',
            steps: [
                ['.app-brand', 'Welcome to your landlord console', 'Manage your portfolio, applicants, leases, revenue, maintenance, and compliance workflows here.'],
                [() => mobileTarget('.bottom-nav-bar', '.sidebar-menu'), 'Your operating navigation', 'Move between property and tenancy workflows here. Additional tools are available under More on mobile.'],
                ['.landlord-module-intro, .landlord-page-summary', 'Follow the operating flow', 'Page guidance connects the current task to the broader portfolio-to-revenue workflow.'],
                ['.main-content-inner', 'Manage the current operation', 'Review records, complete forms, make decisions, and monitor status changes in this area.'],
                ['.topbar-right', 'Theme and account tools', 'Change the theme, replay this guide, verify the signed-in account, or log out safely.']
            ]
        },
        maintenance: {
            label: 'Field operations guide',
            steps: [
                ['.app-brand', 'Welcome to field operations', 'Your landlord-provided account is focused on assigned maintenance work.'],
                [() => mobileTarget('.bottom-nav-bar', '.sidebar-menu'), 'Your work navigation', 'Move between the work overview and assigned task queue here.'],
                ['.maintenance-workflow, .maintenance-page-summary', 'Follow every repair stage', 'Move consistently from accepting an assignment through repair reporting and closure.'],
                ['.main-content-inner', 'Document the work', 'Task details, status updates, materials, evidence, and completion reports belong here.'],
                ['.topbar-right', 'Theme and account tools', 'Change the theme, replay this guide, confirm your account, or log out.']
            ]
        },
        admin: {
            label: 'Administration guide',
            steps: [
                ['.app-brand', 'Welcome to platform control', 'Manage access, listing reviews, transactions, cases, policies, and audit records here.'],
                [() => mobileTarget('#menuToggleBtn', '.sidebar-menu'), 'Administrative navigation', 'Move between operational queues without losing the current review context.'],
                ['.admin-module-intro, .admin-page-summary', 'Follow the governance flow', 'The page context identifies the current governance stage and relevant next action.'],
                ['.main-content-inner', 'Review before deciding', 'Evidence, records, filters, and decision controls appear in this working area.'],
                ['.topbar-right', 'Theme and account tools', 'Change the theme, replay this guide, verify the administrator account, or log out.']
            ]
        }
    };

    const CONTEXT_TOURS = {
        'public-home': {
            label: 'DOMIKNOW visitor guide',
            steps: [
                ['.landing-header', 'Welcome to DOMIKNOW', 'Understand the rental process, browse verified listings, and create the right account.'],
                ['.public-hero, .hero-dark-card', 'Start with verified rental discovery', 'The main action takes you directly to available rentals in the DOMIKNOW service area.'],
                ['.public-discovery-bridge', 'Preview the map-based experience', 'Compare location, availability, distance, and price before opening the complete listing.'],
                ['#howItWorks, .how-it-works', 'Understand the rental journey', 'Review how discovery, applications, agreements, payments, and support work before signing up.'],
                ['.public-feedback-section', 'Read verified resident experiences', 'Public feedback comes from authenticated, lease-connected submissions approved for public visibility.'],
                ['.public-faq-section', 'Get answers before continuing', 'Review common questions about listings, location access, accounts, applications, and rental terms.'],
                ['.landing-header .auth-buttons', 'Sign in or create an account', 'Tenants and landlords can create accounts. Maintenance personnel use credentials supplied by their landlord.']
            ]
        },
        'public-discovery': {
            label: 'Rental discovery guide',
            steps: [
                ['.public-workspace-header', 'Browse without losing your way', 'Return home, sign in, change the theme, or replay this guide from the header.'],
                ['.discovery-controls', 'Filter the rental list', 'Search by property or address, then narrow results by type, price, and availability.'],
                ['.location-toolbar', 'Search around a real location', 'Use your device location, choose a map point, search near LSPU, or clear the location filter.'],
                ['.discovery-map-panel', 'Explore through the customized map', 'Select a price marker for a concise rental summary and a link to the full property details.'],
                ['.discovery-results-panel', 'Compare matching rentals', 'Cards keep the image, availability, capacity, location, price, and detail action together.']
            ]
        },
        auth: {
            label: 'Account access guide',
            steps: [
                ['.auth-header', 'Secure account access', 'This area explains whether you are signing in, creating an account, verifying access, or recovering a password.'],
                ['.registration-progress, .auth-card', 'Complete one clear step at a time', 'Required information, validation messages, and progress guidance stay within the account form.'],
                ['.registration-actions, .auth-card form', 'Review before continuing', 'Use the primary action to continue. Registration includes Back and Next so earlier information remains reviewable.']
            ]
        }
    };

    let shell;
    let activeTour;
    let activeSteps = [];
    let activeIndex = 0;
    let returnFocus;
    let autoStartTimer;

    function mobileTarget(mobileSelector, desktopSelector) {
        return document.querySelector(window.innerWidth <= MOBILE_BREAKPOINT ? mobileSelector : desktopSelector);
    }

    function normalizeTour(id, source) {
        return {
            id,
            label: source.label,
            steps: source.steps.map(([selector, title, description]) => ({ selector, title, description }))
        };
    }

    function getContext() {
        const path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
        const layout = document.querySelector('.dashboard-layout');
        if (layout) {
            const role = Object.keys(ROLE_TOURS).find(value => layout.classList.contains(`dashboard-layout-${value}`));
            if (role) return normalizeTour(role, ROLE_TOURS[role]);
        }
        if (path.includes('/pages/public/properties')) return normalizeTour('public-discovery', CONTEXT_TOURS['public-discovery']);
        if (path.includes('/pages/auth/')) return normalizeTour('auth', CONTEXT_TOURS.auth);
        if (!path.includes('/pages/')) return normalizeTour('public-home', CONTEXT_TOURS['public-home']);
        return null;
    }

    function userKey() {
        try {
            const token = localStorage.getItem('domiknow_token');
            if (!token) return 'visitor';
            const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')));
            return String(payload.id || payload.sub || payload.user_id || payload.role || 'account');
        } catch (error) {
            return localStorage.getItem('domiknow_role') || 'account';
        }
    }

    function storageKey(id) {
        return `${STORAGE_PREFIX}:${id}:${ROLE_TOURS[id] ? userKey() : 'visitor'}`;
    }

    function wasCompleted(id) {
        try { return localStorage.getItem(storageKey(id)) === 'complete'; } catch (error) { return false; }
    }

    function rememberCompletion(id) {
        try { localStorage.setItem(storageKey(id), 'complete'); } catch (error) { /* Tour can still close. */ }
    }

    function resolveTarget(step) {
        const target = typeof step.selector === 'function' ? step.selector() : document.querySelector(step.selector);
        if (!(target instanceof HTMLElement)) return null;
        const style = getComputedStyle(target);
        const rect = target.getBoundingClientRect();
        return style.display === 'none' || style.visibility === 'hidden' || rect.width < 2 || rect.height < 2 ? null : target;
    }

    function ensureShell() {
        if (shell?.root?.isConnected) return shell;
        const root = document.createElement('div');
        root.className = 'dk-tour-root';
        root.hidden = true;
        root.innerHTML = `
          <div class="dk-tour-mask dk-tour-mask--top"></div><div class="dk-tour-mask dk-tour-mask--right"></div>
          <div class="dk-tour-mask dk-tour-mask--bottom"></div><div class="dk-tour-mask dk-tour-mask--left"></div>
          <div class="dk-tour-highlight" aria-hidden="true"></div>
          <section class="dk-tour-card" role="dialog" aria-modal="true" aria-labelledby="dkTourTitle" aria-describedby="dkTourDescription" tabindex="-1">
            <header class="dk-tour-card__header"><span class="dk-tour-card__icon" data-tour-icon aria-hidden="true"></span><div class="dk-tour-card__heading"><p class="dk-tour-card__eyebrow" data-tour-counter></p><p class="dk-tour-card__context" data-tour-context></p></div><button type="button" class="dk-tour-card__close" data-tour-close aria-label="Close walkthrough">&times;</button></header>
            <div class="dk-tour-card__body"><h2 class="dk-tour-card__title" id="dkTourTitle" data-tour-title></h2><p class="dk-tour-card__description" id="dkTourDescription" data-tour-description></p></div>
            <div class="dk-tour-progress" data-tour-progress aria-hidden="true"></div>
            <footer class="dk-tour-card__footer"><button type="button" class="dk-tour-button dk-tour-button--quiet" data-tour-skip>Skip</button><span class="dk-tour-card__spacer"></span><button type="button" class="dk-tour-button" data-tour-back>Back</button><button type="button" class="dk-tour-button dk-tour-button--primary" data-tour-next>Next</button></footer>
          </section>`;
        document.body.appendChild(root);
        shell = {
            root, card: root.querySelector('.dk-tour-card'), highlight: root.querySelector('.dk-tour-highlight'),
            masks: { top: root.querySelector('.dk-tour-mask--top'), right: root.querySelector('.dk-tour-mask--right'), bottom: root.querySelector('.dk-tour-mask--bottom'), left: root.querySelector('.dk-tour-mask--left') },
            icon: root.querySelector('[data-tour-icon]'), counter: root.querySelector('[data-tour-counter]'), context: root.querySelector('[data-tour-context]'),
            title: root.querySelector('[data-tour-title]'), description: root.querySelector('[data-tour-description]'), progress: root.querySelector('[data-tour-progress]'),
            close: root.querySelector('[data-tour-close]'), skip: root.querySelector('[data-tour-skip]'), back: root.querySelector('[data-tour-back]'), next: root.querySelector('[data-tour-next]')
        };
        shell.icon.innerHTML = window.domiknowIcon ? window.domiknowIcon('sparkle') : '?';
        shell.close.addEventListener('click', () => finish(true));
        shell.skip.addEventListener('click', () => finish(true));
        shell.back.addEventListener('click', previous);
        shell.next.addEventListener('click', next);
        root.addEventListener('keydown', handleKeys);
        return shell;
    }

    function spotlight(rect) {
        const vw = innerWidth, vh = innerHeight;
        const top = Math.max(0, rect.top - TARGET_PADDING), left = Math.max(0, rect.left - TARGET_PADDING);
        const right = Math.min(vw, rect.right + TARGET_PADDING), bottom = Math.min(vh, rect.bottom + TARGET_PADDING);
        shell.masks.top.style.height = `${top}px`;
        Object.assign(shell.masks.left.style, { top: `${top}px`, width: `${left}px`, height: `${bottom - top}px` });
        Object.assign(shell.masks.right.style, { top: `${top}px`, width: `${vw - right}px`, height: `${bottom - top}px` });
        shell.masks.bottom.style.height = `${vh - bottom}px`;
        Object.assign(shell.highlight.style, { top: `${top}px`, left: `${left}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    }

    function positionCard(rect) {
        const gap = 16, edge = 16, width = shell.card.offsetWidth || 390, height = shell.card.offsetHeight || 300;
        if (innerWidth <= 640) {
            shell.card.dataset.cardPosition = rect.bottom > innerHeight * .58 ? 'top' : 'bottom';
            shell.card.style.top = shell.card.style.left = '';
            return;
        }
        delete shell.card.dataset.cardPosition;
        let left, top;
        if (rect.right + gap + width <= innerWidth - edge) { left = rect.right + gap; top = rect.top + (rect.height - height) / 2; }
        else if (rect.left - gap - width >= edge) { left = rect.left - gap - width; top = rect.top + (rect.height - height) / 2; }
        else if (rect.bottom + gap + height <= innerHeight - edge) { left = rect.left + (rect.width - width) / 2; top = rect.bottom + gap; }
        else { left = rect.left + (rect.width - width) / 2; top = rect.top - gap - height; }
        Object.assign(shell.card.style, { left: `${Math.max(edge, Math.min(left, innerWidth - width - edge))}px`, top: `${Math.max(edge, Math.min(top, innerHeight - height - edge))}px`, right: 'auto', bottom: 'auto' });
    }

    function renderProgress() {
        shell.progress.replaceChildren();
        activeSteps.forEach((step, index) => {
            const bar = document.createElement('span');
            bar.className = `dk-tour-progress__bar${index < activeIndex ? ' is-complete' : index === activeIndex ? ' is-current' : ''}`;
            shell.progress.appendChild(bar);
        });
    }

    function showStep() {
        const step = activeSteps[activeIndex];
        if (!step) return finish(true);
        const target = resolveTarget(step) || step.target;
        if (!target?.isConnected) { activeSteps.splice(activeIndex, 1); return showStep(); }
        step.target = target;
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        setTimeout(() => {
            const rect = target.getBoundingClientRect();
            spotlight(rect);
            shell.counter.textContent = `Step ${activeIndex + 1} of ${activeSteps.length}`;
            shell.context.textContent = activeTour.label;
            shell.title.textContent = step.title;
            shell.description.textContent = step.description;
            shell.back.hidden = activeIndex === 0;
            shell.skip.hidden = activeIndex === activeSteps.length - 1;
            shell.next.textContent = activeIndex === activeSteps.length - 1 ? 'Finish' : 'Next';
            renderProgress(); positionCard(rect); shell.card.focus();
        }, 260);
    }

    function start(options = {}) {
        const context = getContext();
        if (!context || (!options.force && wasCompleted(context.id))) return false;
        const steps = context.steps.map(step => ({ ...step, target: resolveTarget(step) })).filter(step => step.target);
        if (!steps.length) return false;
        ensureShell(); activeTour = context; activeSteps = steps; activeIndex = 0;
        returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        shell.root.hidden = false; document.body.classList.add('dk-tour-open'); showStep(); return true;
    }

    function finish(remember) {
        if (!shell || shell.root.hidden) return;
        if (remember && activeTour) rememberCompletion(activeTour.id);
        shell.root.hidden = true; document.body.classList.remove('dk-tour-open');
        const focus = returnFocus; returnFocus = null; activeTour = null; activeSteps = []; activeIndex = 0;
        requestAnimationFrame(() => focus?.isConnected && focus.focus());
    }

    function next() { if (activeIndex >= activeSteps.length - 1) finish(true); else { activeIndex += 1; showStep(); } }
    function previous() { if (activeIndex > 0) { activeIndex -= 1; showStep(); } }

    function handleKeys(event) {
        if (event.key === 'Escape') { event.preventDefault(); finish(true); return; }
        if (event.key === 'ArrowRight') { event.preventDefault(); next(); return; }
        if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); return; }
        if (event.key !== 'Tab') return;
        const items = [...shell.card.querySelectorAll('button:not([hidden]):not([disabled])')];
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    function addReplayButton() {
        if (document.querySelector('[data-walkthrough-replay]') || !getContext()) return;
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'dk-tour-replay'; button.dataset.walkthroughReplay = '';
        button.setAttribute('aria-label', 'Open the DOMIKNOW walkthrough'); button.title = 'Guide';
        button.innerHTML = window.domiknowIcon ? window.domiknowIcon('sparkle') : '?';
        button.addEventListener('click', () => start({ force: true }));
        const host = document.querySelector('.topbar-right, .public-workspace-actions, .landing-header .auth-buttons, .public-header .login-prompt');
        if (host) host.insertBefore(button, host.querySelector('[data-theme-toggle]') || host.firstChild);
        else { button.classList.add('dk-tour-replay--floating'); document.body.appendChild(button); }
    }

    function scheduleAutoStart() {
        clearTimeout(autoStartTimer);
        const context = getContext();
        if (!context) return;
        addReplayButton();
        if (wasCompleted(context.id)) return;
        autoStartTimer = setTimeout(() => {
            if (document.querySelector('.dk-modal-root:not([hidden]), .modal-overlay.active, .nav-sheet-overlay.open, #domiknowLocationNotice')) return scheduleAutoStart();
            start();
        }, AUTO_START_DELAY_MS);
    }

    function initialize() {
        scheduleAutoStart();
        const observer = new MutationObserver(() => {
            if (!getContext()) return;
            addReplayButton(); scheduleAutoStart(); observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 15000);
        document.addEventListener('domiknow:shell-ready', scheduleAutoStart);
        addEventListener('resize', () => {
            const target = activeSteps[activeIndex]?.target;
            if (!activeTour || !target?.isConnected) return;
            const rect = target.getBoundingClientRect(); spotlight(rect); positionCard(rect);
        });
    }

    window.DomiKnowWalkthrough = Object.freeze({ start, replay: () => start({ force: true }), close: () => finish(false) });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
}());
