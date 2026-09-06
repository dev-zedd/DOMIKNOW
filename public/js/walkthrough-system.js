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
                [() => mobileTarget('.topbar-left', '.app-brand'), 'Welcome to DomiKnow', 'Your central hub for finding rentals, submitting applications, managing leases, and requesting maintenance.'],
                [() => mobileTarget('.bottom-nav-bar', '.sidebar-menu'), 'Navigation Menu', 'Quickly browse available rentals, active leases, payment records, maintenance tickets, and reports.'],
                ['.tenant-module-intro, .tenant-journey, .status-card, .properties-header, .main-content-inner > :first-child', 'Page Overview & Progress', 'Track your current stage in the rental process, view status alerts, and see recommended next actions.'],
                ['.properties-layout, .feature-grid, .table-container, .main-content-inner', 'Workspace', 'Browse rental listings, review applications, view payment history, and manage maintenance requests here.'],
                ['.topbar-right', 'Account & Quick Settings', 'Access your profile, notifications, dark mode, replay this guide, or log out from your account menu.']
            ]
        },
        landlord: {
            label: 'Landlord console guide',
            steps: [
                [() => mobileTarget('.topbar-left', '.app-brand'), 'Welcome to Landlord Console', 'Manage your rental properties, tenant applications, active leases, monthly revenue, and maintenance.'],
                [() => mobileTarget('.bottom-nav-bar', '.sidebar-menu'), 'Navigation Menu', 'Access your property portfolio, review applicants, monitor active leases, track payments, and manage tasks.'],
                ['.landlord-flow, .landlord-module-intro, .status-card, .properties-header, .main-content-inner > :first-child', 'Workflow & Status', 'Follow the operating workflow to easily manage listings, approve applications, and track lease milestones.'],
                ['.properties-layout, .table-container, .main-content-inner', 'Operations Workspace', 'Add and edit properties, review tenant documents, manage payment confirmations, and oversee repairs.'],
                ['.topbar-right', 'Account & Quick Settings', 'Check notifications, switch to dark mode, replay this guide, or log out from your account menu.']
            ]
        },
        maintenance: {
            label: 'Maintenance portal guide',
            steps: [
                [() => mobileTarget('.topbar-left', '.app-brand'), 'Welcome to Maintenance Portal', 'View and manage repair requests assigned to you by property landlords.'],
                [() => mobileTarget('.bottom-nav-bar', '.sidebar-menu'), 'Work Navigation', 'Switch between your overview dashboard, assigned task list, and completed work history.'],
                ['.maintenance-workflow, .maintenance-page-summary, .status-card, .page-header, .main-content-inner > :first-child', 'Repair Workflow', 'Track repair stages step-by-step: accept assignments, log travel, inspect units, and submit completion reports.'],
                ['.task-detail-card, .task-list, .table-container, .main-content-inner', 'Task Workspace', 'Update repair status, log materials and costs, add notes, and upload photo evidence of completed work.'],
                ['.topbar-right', 'Account & Quick Settings', 'Toggle dark mode, check notifications, replay this guide, or log out.']
            ]
        },
        admin: {
            label: 'Admin portal guide',
            steps: [
                [() => mobileTarget('.topbar-left', '.app-brand'), 'Welcome to Admin Dashboard', 'Oversee the DomiKnow platform, verify rental listings, monitor transactions, and manage user accounts.'],
                [() => mobileTarget('#menuToggleBtn', '.sidebar-menu'), 'Admin Navigation', 'Access user management, listing approvals, financial audits, dispute cases, and system logs.'],
                ['.admin-module-intro, .admin-page-summary, .status-card, .page-header, .main-content-inner > :first-child', 'Governance & Review Stage', 'View queue summaries, pending verification requests, and key administrative actions for this section.'],
                ['.table-container, .admin-card, .main-content-inner', 'Management Workspace', 'Review submitted documents, approve or reject listings, resolve disputes, and maintain platform rules.'],
                ['.topbar-right', 'Account & Quick Settings', 'Toggle dark mode, replay this guide, view your admin profile, or log out.']
            ]
        }
    };

    const CONTEXT_TOURS = {
        'public-home': {
            label: 'Visitor guide',
            steps: [
                ['.landing-header', 'Welcome to DomiKnow', 'Browse verified rental properties, learn how the rental process works, or sign in to your account.'],
                ['.public-hero-copy, .public-hero', 'Find Your Next Rental', 'Search verified boarding houses, apartments, and rooms in Siniloan, Laguna with transparent rates.'],
                ['.public-discovery-bridge', 'Interactive Map Preview', 'Compare rental locations, distances from campus or town center, and monthly rates before opening full listings.'],
                ['#howItWorks .steps-grid, #howItWorks', 'How DomiKnow Works', 'See the rental journey from searching and viewing, to submitting applications, signing digital leases, and paying rent.'],
                ['.public-feedback-section .public-section-shell, .public-feedback-section', 'Tenant Reviews', 'Read authentic reviews and ratings submitted by verified tenants who lived in these rentals.'],
                ['.public-faq-section .public-faq-layout, .public-faq-section', 'Frequently Asked Questions', 'Find answers to common questions about properties, accounts, applications, security deposits, and rental rules.'],
                ['.landing-header .auth-buttons, .landing-header', 'Sign In or Register', 'Create a tenant or landlord account to get started, or sign in if you already have an account.']
            ]
        },
        'public-discovery': {
            label: 'Rental discovery guide',
            steps: [
                ['.public-workspace-header', 'Navigation & Quick Actions', 'Return to the home page, switch between light and dark mode, or sign in from the top header.'],
                ['.discovery-controls', 'Filter Rentals', 'Search by property name or street, and narrow listings by property type, maximum rent, and barangay.'],
                ['.location-toolbar', 'Search by Location', 'Find rentals near your current location, click a point on the map, or quickly view rentals near LSPU.'],
                [() => mobileTarget('.discovery-view-toggle', '.discovery-map-panel'), 'Interactive Map', 'Explore available rentals on the map. Click price markers to see property highlights and view full details.'],
                ['.discovery-results-panel', 'Available Rentals', 'Browse rental cards showing real-time vacancy, monthly rates, capacity, location, and photos.']
            ]
        },
        'public-property': {
            label: 'Property details guide',
            steps: [
                ['.public-workspace-header, .public-header', 'Header & Navigation', 'Return to rental search, switch color themes, replay this guide, or sign in to your account.'],
                ['.property-image-banner', 'Property Highlights', 'Review property photos, verified badge, address, available spaces, capacity, and community rating.'],
                ['#availableSpacesSection, .detail-card', 'Available Units & Spaces', 'Compare available rooms or bedspaces, pricing, capacity, and room amenities before applying.'],
                ['.domiknow-map-frame', 'Property Location', 'Check the exact property location, nearby landmarks, and barangay address on the interactive map.'],
                ['.sticky-card', 'Rental Summary & Application', 'Check monthly rent and security deposits, and click Apply when you are ready to submit an application.']
            ]
        },
        auth: {
            label: 'Account access guide',
            steps: [
                ['.auth-header', 'Account Access', 'Switch easily between signing in, creating a new account, or recovering your password.'],
                ['.registration-progress, .auth-card', 'Account Information', 'Enter your account details and credentials. Clear guidelines and validation help you complete each field.'],
                ['.registration-actions, .auth-card form', 'Submit & Continue', 'Click the primary button to submit your information and securely enter your DomiKnow portal.']
            ]
        }
    };

    let shell;
    let activeTour;
    let activeSteps = [];
    let activeIndex = 0;
    let returnFocus;
    let autoStartTimer;

    function isElementVisible(el) {
        if (!(el instanceof HTMLElement)) return false;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return false;
        if (rect.right <= 0 || rect.bottom <= 0) return false;
        return true;
    }

    function mobileTarget(mobileSelector, desktopSelector) {
        const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
        const primarySelector = isMobile ? mobileSelector : desktopSelector;
        const fallbackSelector = isMobile ? desktopSelector : mobileSelector;

        for (const sel of [primarySelector, fallbackSelector]) {
            const elements = document.querySelectorAll(sel);
            for (const el of elements) {
                if (isElementVisible(el)) return el;
            }
        }
        return null;
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
        if (path.includes('/pages/public/property-details')) return normalizeTour('public-property', CONTEXT_TOURS['public-property']);
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
        if (typeof step.selector === 'function') {
            const target = step.selector();
            return isElementVisible(target) ? target : null;
        }
        const selectors = step.selector.split(',').map(s => s.trim()).filter(Boolean);
        for (const sel of selectors) {
            const elements = document.querySelectorAll(sel);
            for (const el of elements) {
                if (isElementVisible(el)) return el;
            }
        }
        return null;
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
            <header class="dk-tour-card__header">
              <div class="dk-tour-card__badge">
                <span class="dk-tour-card__icon" data-tour-icon aria-hidden="true"></span>
                <span class="dk-tour-card__eyebrow" data-tour-counter></span>
                <span class="dk-tour-card__dot" aria-hidden="true">&bull;</span>
                <span class="dk-tour-card__context" data-tour-context></span>
              </div>
              <button type="button" class="dk-tour-card__close" data-tour-close aria-label="Close guide">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </header>
            <div class="dk-tour-card__body">
              <h2 class="dk-tour-card__title" id="dkTourTitle" data-tour-title></h2>
              <p class="dk-tour-card__description" id="dkTourDescription" data-tour-description></p>
            </div>
            <div class="dk-tour-progress" data-tour-progress aria-hidden="true"></div>
            <footer class="dk-tour-card__footer">
              <button type="button" class="dk-tour-button dk-tour-button--quiet" data-tour-skip>Skip</button>
              <span class="dk-tour-card__spacer"></span>
              <button type="button" class="dk-tour-button" data-tour-back>Back</button>
              <button type="button" class="dk-tour-button dk-tour-button--primary" data-tour-next>Next</button>
            </footer>
          </section>`;
        document.body.appendChild(root);
        shell = {
            root, card: root.querySelector('.dk-tour-card'), highlight: root.querySelector('.dk-tour-highlight'),
            masks: { top: root.querySelector('.dk-tour-mask--top'), right: root.querySelector('.dk-tour-mask--right'), bottom: root.querySelector('.dk-tour-mask--bottom'), left: root.querySelector('.dk-tour-mask--left') },
            icon: root.querySelector('[data-tour-icon]'), counter: root.querySelector('[data-tour-counter]'), context: root.querySelector('[data-tour-context]'),
            title: root.querySelector('[data-tour-title]'), description: root.querySelector('[data-tour-description]'), progress: root.querySelector('[data-tour-progress]'),
            close: root.querySelector('[data-tour-close]'), skip: root.querySelector('[data-tour-skip]'), back: root.querySelector('[data-tour-back]'), next: root.querySelector('[data-tour-next]')
        };
        shell.icon.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>';
        shell.close.addEventListener('click', () => finish(true));
        shell.skip.addEventListener('click', () => finish(true));
        shell.back.addEventListener('click', previous);
        shell.next.addEventListener('click', next);
        root.addEventListener('keydown', handleKeys);
        return shell;
    }

    let trackingRafId = null;

    function spotlight(rect) {
        const top = rect.top - TARGET_PADDING;
        const left = rect.left - TARGET_PADDING;
        const width = rect.width + (TARGET_PADDING * 2);
        const height = rect.height + (TARGET_PADDING * 2);

        Object.assign(shell.highlight.style, {
            top: `${top}px`,
            left: `${left}px`,
            width: `${width}px`,
            height: `${height}px`
        });
    }

    function isNavigationBar(target, rect) {
        if (!target) return false;
        if (target.closest('.landing-header, header, nav, .topbar, .topbar-left, .topbar-right, .app-brand, .public-workspace-header, .public-header, .auth-buttons')) {
            return true;
        }
        if (rect && rect.top <= 15 && rect.bottom <= 120 && rect.width >= window.innerWidth * 0.35) {
            return true;
        }
        return false;
    }

    function positionCard(rect) {
        const gap = 12, edge = 16;
        const width = shell.card.offsetWidth || 480;
        const height = shell.card.offsetHeight || 128;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (vw <= 640) {
            const placeAtTop = rect.top >= height + 24;
            shell.card.dataset.cardPosition = placeAtTop ? 'top' : 'bottom';
            shell.card.style.top = shell.card.style.left = '';
            return;
        }
        delete shell.card.dataset.cardPosition;

        // Horizontally center the description modal on the screen
        const centeredLeft = Math.max(edge, Math.min((vw - width) / 2, vw - width - edge));
        const topDefault = 12; // Standard top center position

        let top;
        const step = activeSteps[activeIndex];
        const target = step?.target;
        const isNav = isNavigationBar(target, rect);
        const isTenant = activeTour?.id === 'tenant' || window.location.pathname.toLowerCase().includes('/tenant/') || Boolean(document.querySelector('.dashboard-layout-tenant'));

        if (isTenant) {
            // In tenant portal: always place the description modal at the bottom part of the screen
            top = Math.max(edge, vh - height - edge);
        } else if (isNav) {
            // Only when the navigation bar is highlighted: place directly below it
            top = Math.min(rect.bottom + gap, vh - height - edge);
        } else {
            // For all other sections (e.g. public home): always place at the top center of the screen
            top = topDefault;
        }

        Object.assign(shell.card.style, {
            left: `${centeredLeft}px`,
            top: `${top}px`,
            right: 'auto',
            bottom: 'auto'
        });
    }

    function renderProgress() {
        shell.progress.replaceChildren();
        activeSteps.forEach((step, index) => {
            const bar = document.createElement('span');
            bar.className = `dk-tour-progress__bar${index < activeIndex ? ' is-complete' : index === activeIndex ? ' is-current' : ''}`;
            shell.progress.appendChild(bar);
        });
    }

    function updateTargetPosition() {
        const step = activeSteps[activeIndex];
        const target = step?.target;
        if (!activeTour || !target?.isConnected || shell.root.hidden) return;
        const rect = target.getBoundingClientRect();
        spotlight(rect);
        positionCard(rect);
    }

    function startPositionTracking(durationMs = 1000) {
        cancelAnimationFrame(trackingRafId);
        const startTime = performance.now();
        function frame(now) {
            updateTargetPosition();
            if (now - startTime < durationMs && activeTour && !shell.root.hidden) {
                trackingRafId = requestAnimationFrame(frame);
            }
        }
        trackingRafId = requestAnimationFrame(frame);
    }

    function scrollToCenterTarget(target) {
        if (!target) return;
        const vh = window.innerHeight;

        const rect = target.getBoundingClientRect();
        const targetPageTop = rect.top + window.scrollY;
        const targetHeight = target.offsetHeight || rect.height;

        // If target is the navigation bar at the top of the page, keep at scroll 0
        if (isNavigationBar(target, rect) || targetPageTop < 80) {
            window.scrollTo({
                top: 0,
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
            });
            return;
        }

        // Center the highlighted section in the viewport so both top and bottom parts are fully visible
        let desiredScrollY;
        if (targetHeight >= vh) {
            desiredScrollY = targetPageTop - 12;
        } else {
            desiredScrollY = targetPageTop - Math.max(0, (vh - targetHeight) / 2);
        }

        const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
        desiredScrollY = Math.max(0, Math.min(desiredScrollY, maxScroll));

        window.scrollTo({
            top: desiredScrollY,
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
    }

    function showStep() {
        const step = activeSteps[activeIndex];
        if (!step) return finish(true);
        const target = resolveTarget(step) || step.target;
        if (!target?.isConnected) { activeSteps.splice(activeIndex, 1); return showStep(); }
        step.target = target;

        shell.counter.textContent = `Step ${activeIndex + 1} of ${activeSteps.length}`;
        shell.context.textContent = activeTour.label;
        shell.title.textContent = step.title;
        shell.description.textContent = step.description;
        shell.back.hidden = activeIndex === 0;
        shell.skip.hidden = activeIndex === activeSteps.length - 1;
        shell.next.textContent = activeIndex === activeSteps.length - 1 ? 'Finish' : 'Next';
        renderProgress();

        // Update immediately for initial render
        updateTargetPosition();

        // Center the section in the visible part of the page below the top card
        scrollToCenterTarget(target);

        // Continuously update position on every frame throughout the smooth scroll
        startPositionTracking(1000);
        shell.card.focus();
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
        cancelAnimationFrame(trackingRafId);
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
        button.setAttribute('aria-label', 'Play the DOMIKNOW guide'); button.title = 'Play guide';
        button.innerHTML = window.domiknowIcon ? window.domiknowIcon('play') : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></svg>';
        button.addEventListener('click', () => start({ force: true }));
        const host = document.querySelector('.topbar-right, .public-workspace-actions, .landing-header .auth-buttons, .public-header .login-prompt');
        if (host) host.insertBefore(button, host.querySelector('[data-theme-toggle]') || host.firstChild);
        else { button.classList.add('dk-tour-replay--floating'); document.body.appendChild(button); }
    }

    function scheduleAutoStart(delayOverride) {
        clearTimeout(autoStartTimer);
        const context = getContext();
        if (!context) return;
        addReplayButton();
        if (wasCompleted(context.id)) return;
        const delay = Number.isFinite(delayOverride)
            ? delayOverride
            : (context.id === 'public-property' ? 3500 : AUTO_START_DELAY_MS);
        autoStartTimer = setTimeout(() => {
            if (document.querySelector('.dk-modal-root:not([hidden]), .modal-overlay.active, .nav-sheet-overlay.open, #domiknowLocationNotice')) return scheduleAutoStart();
            start();
        }, delay);
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
        document.addEventListener('domiknow:property-ready', () => scheduleAutoStart(300));
        window.addEventListener('resize', updateTargetPosition, { passive: true });
        window.addEventListener('scroll', updateTargetPosition, { passive: true });
    }

    window.DomiKnowWalkthrough = Object.freeze({ start, replay: () => start({ force: true }), close: () => finish(false) });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
}());
