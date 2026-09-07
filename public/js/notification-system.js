(function () {
    'use strict';

    if (window.DomiKnowNotifications) {
        window.DomiKnowNotifications.refreshSurface?.();
        return;
    }

    const API_URL = '/api/notifications';
    const POLL_INTERVAL_MS = 60000;
    const STALE_AFTER_MS = 15000;
    const pathRole = ['tenant', 'landlord', 'maintenance', 'admin']
        .find(candidate => window.location.pathname.includes(`/pages/${candidate}/`));
    const role = pathRole || document.body.dataset.role || localStorage.getItem('domiknow_role') || 'tenant';
    const state = {
        notifications: [],
        unreadCount: 0,
        filter: 'all',
        loading: false,
        error: '',
        lastLoadedAt: 0,
        panelOpen: false,
        trigger: null,
        previousFocus: null
    };

    const icons = {
        bell: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
        check: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
        trash: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></svg>',
        arrow: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
        refresh: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0 2 5.3M20 4v7h-7"/></svg>',
        calendar: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
        document: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>',
        shield: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
        alert: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
        inbox: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16l2 12H2L4 4Z"/><path d="M2 16h5l2 3h6l2-3h5"/></svg>'
    };

    function token() {
        return localStorage.getItem('domiknow_token');
    }

    async function request(path = '', options = {}) {
        const response = await fetch(`${API_URL}${path}`, {
            ...options,
            cache: 'no-store',
            headers: {
                'Authorization': `Bearer ${token()}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Notification request failed.');
        return result;
    }

    function isRead(notification) {
        return notification.read_status === true || notification.read_status === 1 || notification.read_status === 'true';
    }

    function categoryFor(type) {
        const value = String(type || '').toLowerCase();
        if (value.includes('lease')) return 'lease';
        if (value.includes('reservation') || value.includes('application')) return 'reservation';
        if (value.includes('payment') || value.includes('billing')) return 'payment';
        if (value.includes('maintenance') || value.includes('task')) return 'maintenance';
        if (value.includes('property') || value.includes('listing')) return 'property';
        if (value.includes('report')) return 'report';
        if (value.includes('security') || value.includes('profile') || value.includes('account')) return 'governance';
        if (value.includes('admin') || value.includes('suspension') || value.includes('policy')) return 'governance';
        return 'general';
    }

    function categoryLabel(type) {
        const category = categoryFor(type);
        return {
            lease: 'Lease',
            reservation: 'Rental activity',
            payment: 'Payment',
            maintenance: 'Maintenance',
            property: 'Property',
            report: 'Case update',
            governance: 'Account notice',
            general: 'System'
        }[category];
    }

    function iconFor(category) {
        if (category === 'lease') return icons.document;
        if (category === 'reservation') return icons.calendar;
        if (category === 'payment') return icons.document;
        if (category === 'maintenance') return icons.shield;
        if (category === 'property') return icons.document;
        if (category === 'report') return icons.shield;
        if (category === 'governance') return icons.alert;
        return icons.bell;
    }

    function actionFor(notification) {
        const type = String(notification.type || '').toLowerCase();
        const prefix = `/pages/${role}`;
        if (type.includes('security') || type.includes('profile') || type.includes('account')) {
            return { href: `${prefix}/profile.html`, label: 'Review account security' };
        }
        if (type.includes('lease')) {
            if (role === 'tenant' || role === 'landlord') return { href: `${prefix}/leases.html`, label: 'Open leases' };
            return { href: role === 'admin' ? `${prefix}/users.html` : `${prefix}/tasks.html`, label: 'Open workspace' };
        }
        if (type.includes('reservation') || type.includes('application')) {
            if (role === 'tenant' || role === 'landlord') return { href: `${prefix}/applications.html`, label: 'Open applications' };
            return { href: role === 'admin' ? `${prefix}/users.html` : `${prefix}/tasks.html`, label: 'Open workspace' };
        }
        if (type.includes('report')) {
            if (role === 'maintenance') return { href: `${prefix}/dashboard.html`, label: 'Open dashboard' };
            return { href: `${prefix}/reports.html`, label: 'Open reports' };
        }
        if (type.includes('complaint')) {
            if (role === 'tenant' || role === 'landlord') {
                return { href: `${prefix}/disputes.html`, label: 'Open complaints and disputes' };
            }
            return { href: role === 'admin' ? `${prefix}/reports.html` : `${prefix}/dashboard.html`, label: 'Open reports' };
        }
        if (type.includes('rating') || type.includes('feedback')) {
            if (role === 'tenant' || role === 'landlord') return { href: `${prefix}/feedback.html`, label: 'Open ratings and feedback' };
            return { href: role === 'admin' ? `${prefix}/reports.html` : `${prefix}/dashboard.html`, label: 'Open feedback' };
        }
        if (type.includes('payment') || type.includes('billing')) {
            if (role === 'tenant') return { href: `${prefix}/billings.html`, label: 'Open billings and payments' };
            if (role === 'landlord' || role === 'admin') return { href: `${prefix}/payments.html`, label: 'Open payments' };
            return { href: `${prefix}/dashboard.html`, label: 'Open dashboard' };
        }
        if (type.includes('property') || type.includes('listing')) {
            if (role === 'admin') return { href: `${prefix}/property-review.html`, label: 'Open property review' };
            if (role === 'tenant' || role === 'landlord') return { href: `${prefix}/properties.html`, label: 'Open properties' };
            return { href: `${prefix}/dashboard.html`, label: 'Open dashboard' };
        }
        if (type.includes('maintenance') || type.includes('task')) {
            if (role === 'maintenance') return { href: `${prefix}/tasks.html`, label: 'Open assigned tasks' };
            if (role === 'tenant' || role === 'landlord') return { href: `${prefix}/maintenance.html`, label: 'Open maintenance' };
            return { href: role === 'admin' ? `${prefix}/users.html` : `${prefix}/dashboard.html`, label: 'Open workspace' };
        }
        if (type.includes('admin') || type.includes('policy') || type.includes('suspension')) {
            if (role === 'tenant') return { href: `${prefix}/policy-violations.html`, label: 'Review account notices' };
            if (role === 'landlord') return { href: `${prefix}/reports.html`, label: 'Review account notices' };
            if (role === 'admin') return { href: `${prefix}/policy-management.html`, label: 'Open policy management' };
            return { href: `${prefix}/dashboard.html`, label: 'Open dashboard' };
        }
        if (type.includes('welcome')) {
            return { href: `${prefix}/profile.html`, label: 'Open your profile' };
        }
        return null;
    }

    function centerUrl() {
        return `/pages/${role}/notifications.html`;
    }

    function relativeTime(value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return 'Recently';
        const delta = date.getTime() - Date.now();
        const absolute = Math.abs(delta);
        const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
        if (absolute < 60000) return 'Just now';
        if (absolute < 3600000) return formatter.format(Math.round(delta / 60000), 'minute');
        if (absolute < 86400000) return formatter.format(Math.round(delta / 3600000), 'hour');
        if (absolute < 604800000) return formatter.format(Math.round(delta / 86400000), 'day');
        return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
    }

    function ensureSurface() {
        state.trigger = document.querySelector('[data-notification-trigger]');
        if (state.trigger && !state.trigger.dataset.notificationBound) {
            state.trigger.dataset.notificationBound = 'true';
            state.trigger.addEventListener('click', togglePanel);
        }

        if (!document.getElementById('domiknowNotificationOverlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'domiknowNotificationOverlay';
            overlay.className = 'notification-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = `
                <aside class="notification-panel" role="dialog" aria-modal="true" aria-labelledby="notificationPanelTitle" tabindex="-1">
                    <header class="notification-panel__header">
                        <div>
                            <p class="notification-panel__eyebrow">Updates that need you</p>
                            <h2 id="notificationPanelTitle">Notifications</h2>
                        </div>
                        <button type="button" class="notification-icon-button" data-notification-close aria-label="Close notifications">${icons.close}</button>
                    </header>
                    <div class="notification-panel__toolbar">
                        <div class="notification-filters" role="group" aria-label="Filter notifications">
                            <button type="button" class="notification-filter is-active" data-notification-filter="all">All</button>
                            <button type="button" class="notification-filter" data-notification-filter="unread">Unread</button>
                        </div>
                        <button type="button" class="notification-mark-all" data-notification-mark-all>Mark all read</button>
                    </div>
                    <div class="notification-panel__body" data-notification-panel-list aria-live="polite"></div>
                    <footer class="notification-panel__footer"><a href="${centerUrl()}">View notification center</a></footer>
                </aside>`;
            overlay.addEventListener('click', event => {
                if (event.target === overlay) closePanel();
            });
            overlay.querySelector('[data-notification-close]').addEventListener('click', closePanel);
            document.body.appendChild(overlay);
        }

        if (!document.querySelector('.notification-toast-region')) {
            const region = document.createElement('div');
            region.className = 'notification-toast-region';
            region.setAttribute('aria-live', 'polite');
            region.setAttribute('aria-atomic', 'true');
            document.body.appendChild(region);
        }

        bindSharedControls(document);
        bindCenterControls();
        updateBadge();
    }

    function bindSharedControls(root) {
        root.querySelectorAll('[data-notification-filter]').forEach(button => {
            if (button.dataset.notificationBound) return;
            button.dataset.notificationBound = 'true';
            button.addEventListener('click', () => setFilter(button.dataset.notificationFilter));
        });
        root.querySelectorAll('[data-notification-mark-all]').forEach(button => {
            if (button.dataset.notificationBound) return;
            button.dataset.notificationBound = 'true';
            button.addEventListener('click', markAllRead);
        });
        root.querySelectorAll('[data-notification-refresh]').forEach(button => {
            if (button.dataset.notificationBound) return;
            button.dataset.notificationBound = 'true';
            button.addEventListener('click', () => loadNotifications());
        });
    }

    function bindCenterControls() {
        const center = document.querySelector('[data-notification-center]');
        if (!center) return;
        bindSharedControls(center);
        renderCenter();
    }

    function togglePanel() {
        if (state.panelOpen) closePanel();
        else openPanel();
    }

    function openPanel() {
        ensureSurface();
        const overlay = document.getElementById('domiknowNotificationOverlay');
        if (!overlay) return;
        state.panelOpen = true;
        state.previousFocus = document.activeElement;
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('notification-panel-open');
        state.trigger?.setAttribute('aria-expanded', 'true');
        overlay.querySelector('.notification-panel')?.focus({ preventScroll: true });
        loadNotifications({ silent: state.notifications.length > 0 });
    }

    function closePanel() {
        const overlay = document.getElementById('domiknowNotificationOverlay');
        if (!overlay || !state.panelOpen) return;
        state.panelOpen = false;
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('notification-panel-open');
        state.trigger?.setAttribute('aria-expanded', 'false');
        if (state.previousFocus instanceof HTMLElement) state.previousFocus.focus({ preventScroll: true });
    }

    function setFilter(filter) {
        state.filter = filter === 'unread' ? 'unread' : 'all';
        document.querySelectorAll('[data-notification-filter]').forEach(button => {
            const active = button.dataset.notificationFilter === state.filter;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        renderPanel();
        renderCenter();
    }

    function filteredNotifications() {
        return state.filter === 'unread'
            ? state.notifications.filter(notification => !isRead(notification))
            : state.notifications;
    }

    function renderLoading(container, count = 5) {
        if (!container) return;
        const skeleton = document.createElement('div');
        skeleton.className = 'notification-skeleton';
        skeleton.setAttribute('role', 'status');
        skeleton.setAttribute('aria-label', 'Loading notifications');
        for (let index = 0; index < count; index += 1) {
            const item = document.createElement('div');
            item.className = 'notification-skeleton__item';
            item.innerHTML = `<span class="dk-skeleton dk-skeleton--circle"></span><span class="notification-skeleton__copy"><span class="dk-skeleton dk-skeleton--line is-medium"></span><span class="dk-skeleton dk-skeleton--line"></span><span class="dk-skeleton dk-skeleton--line is-short"></span></span>`;
            skeleton.appendChild(item);
        }
        container.replaceChildren(skeleton);
        container.setAttribute('aria-busy', 'true');
    }

    function renderState(container, kind) {
        if (!container) return;
        const stateBox = document.createElement('div');
        stateBox.className = 'notification-state';
        const icon = document.createElement('span');
        icon.className = 'notification-state__icon';
        icon.innerHTML = kind === 'error' ? icons.alert : icons.inbox;
        const title = document.createElement('strong');
        const message = document.createElement('p');
        if (kind === 'error') {
            title.textContent = 'Notifications are temporarily unavailable';
            message.textContent = state.error || 'Check your connection and try again.';
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'btn btn-secondary';
            retry.textContent = 'Try again';
            retry.addEventListener('click', () => loadNotifications());
            stateBox.append(icon, title, message, retry);
        } else {
            title.textContent = state.filter === 'unread' ? 'You are all caught up' : 'No notifications yet';
            message.textContent = state.filter === 'unread'
                ? 'New updates will appear here when they need your attention.'
                : 'Rental, lease, payment, maintenance, and account updates will appear here.';
            stateBox.append(icon, title, message);
        }
        container.replaceChildren(stateBox);
        container.removeAttribute('aria-busy');
    }

    function createNotificationItem(notification, center = false) {
        const category = categoryFor(notification.type);
        const item = document.createElement('article');
        item.className = `notification-item${isRead(notification) ? '' : ' is-unread'}`;
        item.dataset.notificationId = notification.id;
        item.dataset.category = category;

        const icon = document.createElement('span');
        icon.className = 'notification-item__icon';
        icon.innerHTML = iconFor(category);
        icon.setAttribute('aria-hidden', 'true');

        const content = document.createElement('div');
        content.className = 'notification-item__content';
        const title = document.createElement('h3');
        title.className = 'notification-item__title';
        // Older stored notifications may still include decorative pictographs.
        // Their category already supplies the corresponding SVG icon.
        const plainNotificationText = value => String(value || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim();
        title.textContent = plainNotificationText(notification.title) || 'System notification';
        const message = document.createElement('p');
        message.className = 'notification-item__message';
        message.textContent = plainNotificationText(notification.message) || 'A new update is available.';
        const meta = document.createElement('div');
        meta.className = 'notification-item__meta';
        const type = document.createElement('span');
        type.className = 'notification-item__type';
        type.textContent = categoryLabel(notification.type);
        const time = document.createElement('time');
        time.dateTime = notification.created_at || '';
        time.textContent = relativeTime(notification.created_at);
        meta.append(type, time);
        content.append(title, message, meta);

        const actions = document.createElement('div');
        actions.className = 'notification-item__actions';
        if (!isRead(notification)) {
            const read = document.createElement('button');
            read.type = 'button';
            read.className = 'notification-item__action';
            read.innerHTML = icons.check;
            read.setAttribute('aria-label', `Mark ${title.textContent} as read`);
            read.addEventListener('click', () => markRead(notification.id));
            actions.appendChild(read);
        }
        const target = actionFor(notification);
        if (target) {
            const action = document.createElement('a');
            action.className = 'notification-item__action';
            action.href = target.href;
            action.innerHTML = icons.arrow;
            action.title = target.label;
            action.setAttribute('aria-label', target.label);
            action.addEventListener('click', () => markRead(notification.id, { silent: true, keepalive: true }));
            actions.appendChild(action);
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'notification-item__delete';
        remove.innerHTML = icons.trash;
        remove.setAttribute('aria-label', `Delete ${title.textContent}`);
        remove.addEventListener('click', () => deleteNotification(notification));
        actions.appendChild(remove);

        item.append(icon, content, actions);
        if (!center) {
            item.addEventListener('dblclick', () => markRead(notification.id));
        }
        return item;
    }

    function renderList(container, notifications, options = {}) {
        if (!container) return;
        if (state.error) {
            renderState(container, 'error');
            return;
        }
        if (!notifications.length) {
            renderState(container, 'empty');
            return;
        }
        const list = document.createElement('div');
        list.className = `notification-list${options.center ? ' notification-list--center' : ''}`;
        notifications.forEach(notification => list.appendChild(createNotificationItem(notification, options.center)));
        container.replaceChildren(list);
        container.removeAttribute('aria-busy');
    }

    function renderPanel() {
        const container = document.querySelector('[data-notification-panel-list]');
        if (!container) return;
        if (state.loading && !state.notifications.length) {
            renderLoading(container, 5);
            return;
        }
        renderList(container, filteredNotifications().slice(0, 7));
        syncControls();
    }

    function renderCenter() {
        const center = document.querySelector('[data-notification-center]');
        if (!center) return;
        bindSharedControls(center);
        const container = center.querySelector('[data-notification-center-list]');
        if (state.loading && !state.notifications.length) renderLoading(container, 6);
        else renderList(container, filteredNotifications(), { center: true });

        const total = center.querySelector('[data-notification-total]');
        const unread = center.querySelector('[data-notification-unread]');
        const today = center.querySelector('[data-notification-today]');
        if (total) total.textContent = String(state.notifications.length);
        if (unread) unread.textContent = String(state.unreadCount);
        if (today) {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            today.textContent = String(state.notifications.filter(notification => new Date(notification.created_at).getTime() >= start.getTime()).length);
        }
        syncControls();
    }

    function syncControls() {
        document.querySelectorAll('[data-notification-mark-all]').forEach(button => {
            button.disabled = state.unreadCount === 0 || state.loading;
        });
        document.querySelectorAll('[data-notification-filter]').forEach(button => {
            const active = button.dataset.notificationFilter === state.filter;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }

    function updateBadge() {
        const badge = document.querySelector('[data-notification-badge]');
        state.trigger = document.querySelector('[data-notification-trigger]');
        if (!badge || !state.trigger) return;
        badge.textContent = state.unreadCount > 99 ? '99+' : String(state.unreadCount);
        badge.hidden = state.unreadCount === 0;
        const label = state.unreadCount
            ? `Open notifications, ${state.unreadCount} unread`
            : 'Open notifications, no unread updates';
        state.trigger.setAttribute('aria-label', label);
        document.title = document.title.replace(/^\(\d+\)\s*/, '');
        if (state.unreadCount > 0) document.title = `(${state.unreadCount}) ${document.title}`;
    }

    async function loadNotifications(options = {}) {
        if (state.loading || !token()) return;
        state.loading = true;
        state.error = '';
        if (!options.silent) {
            renderPanel();
            renderCenter();
        }
        try {
            const result = await request('/my', {
                domiknowLoading: !options.silent,
                headers: options.silent ? { 'X-DOMIKNOW-SILENT': '1' } : undefined
            });
            const data = result.data || {};
            state.notifications = Array.isArray(data.notifications) ? data.notifications : [];
            const providedUnreadCount = Number(data.unreadCount);
            state.unreadCount = Number.isFinite(providedUnreadCount)
                ? providedUnreadCount
                : state.notifications.filter(notification => !isRead(notification)).length;
            state.lastLoadedAt = Date.now();
        } catch (error) {
            state.error = error.message || 'Unable to load notifications.';
        } finally {
            state.loading = false;
            updateBadge();
            renderPanel();
            renderCenter();
        }
    }

    async function markRead(id, options = {}) {
        const notification = state.notifications.find(item => String(item.id) === String(id));
        if (!notification || isRead(notification)) return;
        notification.read_status = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
        updateBadge();
        renderPanel();
        renderCenter();
        try {
            await request(`/${encodeURIComponent(id)}/read`, { method: 'PUT', keepalive: Boolean(options.keepalive) });
        } catch (error) {
            notification.read_status = false;
            state.unreadCount += 1;
            updateBadge();
            renderPanel();
            renderCenter();
            if (!options.silent) toast('The notification could not be marked as read.', 'error');
        }
    }

    async function markAllRead() {
        if (!state.unreadCount) return;
        const unread = state.notifications.filter(notification => !isRead(notification));
        unread.forEach(notification => { notification.read_status = true; });
        const previousCount = state.unreadCount;
        state.unreadCount = 0;
        updateBadge();
        renderPanel();
        renderCenter();
        try {
            await request('/read-all', { method: 'PUT' });
            toast('All notifications marked as read.', 'success');
        } catch (error) {
            unread.forEach(notification => { notification.read_status = false; });
            state.unreadCount = previousCount;
            updateBadge();
            renderPanel();
            renderCenter();
            toast('Notifications could not be updated.', 'error');
        }
    }

    async function deleteNotification(notification) {
        const options = {
            variant: 'danger',
            eyebrow: 'Remove update',
            title: 'Delete this notification?',
            message: 'This removes the notification from your account. The related rental or account record will not be deleted.',
            confirmLabel: 'Delete notification',
            cancelLabel: 'Keep notification'
        };
        const confirmed = typeof window.domiknowConfirm === 'function'
            ? await window.domiknowConfirm(options)
            : window.confirm(options.message);
        if (!confirmed) return;

        const index = state.notifications.findIndex(item => String(item.id) === String(notification.id));
        if (index < 0) return;
        const [removed] = state.notifications.splice(index, 1);
        if (!isRead(removed)) state.unreadCount = Math.max(0, state.unreadCount - 1);
        updateBadge();
        renderPanel();
        renderCenter();
        try {
            await request(`/${encodeURIComponent(notification.id)}`, { method: 'DELETE' });
            toast('Notification deleted.', 'success');
        } catch (error) {
            state.notifications.splice(index, 0, removed);
            if (!isRead(removed)) state.unreadCount += 1;
            updateBadge();
            renderPanel();
            renderCenter();
            toast('The notification could not be deleted.', 'error');
        }
    }

    function toast(message, variant = 'info') {
        ensureSurface();
        const region = document.querySelector('.notification-toast-region');
        if (!region) return;
        const item = document.createElement('div');
        item.className = 'notification-toast';
        item.dataset.variant = variant;
        item.setAttribute('role', variant === 'error' ? 'alert' : 'status');
        const icon = document.createElement('span');
        icon.innerHTML = variant === 'error' ? icons.alert : icons.check;
        const text = document.createElement('span');
        text.textContent = message;
        item.append(icon, text);
        region.appendChild(item);
        window.setTimeout(() => item.remove(), 4200);
    }

    function refreshSurface() {
        ensureSurface();
        renderPanel();
        renderCenter();
        if (token() && (!state.lastLoadedAt || Date.now() - state.lastLoadedAt > STALE_AFTER_MS)) {
            loadNotifications({ silent: state.notifications.length > 0 });
        }
    }

    function initialize() {
        if (!token()) return;
        ensureSurface();
        loadNotifications();
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && state.panelOpen) closePanel();
        });
        document.addEventListener('domiknow:page-content-updated', refreshSurface);
        document.addEventListener('domiknow:shell-ready', refreshSurface);
        window.addEventListener('focus', () => {
            if (Date.now() - state.lastLoadedAt > POLL_INTERVAL_MS) loadNotifications({ silent: true });
        });
        window.setInterval(() => {
            if (!document.hidden) loadNotifications({ silent: true });
        }, POLL_INTERVAL_MS);
    }

    window.DomiKnowNotifications = {
        open: openPanel,
        close: closePanel,
        refresh: loadNotifications,
        refreshSurface,
        toast,
        getState: () => ({ ...state, notifications: [...state.notifications] })
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
