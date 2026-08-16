(function () {
    'use strict';

    const SESSION_KEY = 'domiknow_device_location';
    const NOTICE_DISMISSED_KEY = 'domiknow_location_notice_dismissed';
    const CACHE_LIFETIME_MS = 15 * 60 * 1000;
    const REQUEST_TIMEOUT_MS = 15000;
    const NOTICE_AUTO_DISMISS_MS = 12000;
    const SINILOAN_CENTER = Object.freeze({ lat: 14.42143, lng: 121.44583 });
    const SERVICE_REGION_RADIUS_KM = 150;
    let activeRequest = null;
    let noticeTimer = null;

    function distanceKm(lat1, lng1, lat2, lng2) {
        const earthRadiusKm = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function isWithinServiceRegion(location) {
        const lat = Number(location?.lat ?? location?.coords?.latitude);
        const lng = Number(location?.lng ?? location?.coords?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
        return distanceKm(lat, lng, SINILOAN_CENTER.lat, SINILOAN_CENTER.lng) <= SERVICE_REGION_RADIUS_KM;
    }

    function clearStoredLocation() {
        try {
            window.sessionStorage.removeItem(SESSION_KEY);
        } catch (error) {
            // No action is needed when session storage is unavailable.
        }
    }

    function readStoredLocation() {
        try {
            const value = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || 'null');
            if (!value || !Number.isFinite(value.lat) || !Number.isFinite(value.lng) || !Number.isFinite(value.timestamp)) return null;
            if (Date.now() - value.timestamp > CACHE_LIFETIME_MS) return null;
            return value;
        } catch (error) {
            return null;
        }
    }

    function storeLocation(position) {
        const location = {
            lat: Number(position.coords.latitude),
            lng: Number(position.coords.longitude),
            accuracy: Number(position.coords.accuracy),
            timestamp: Date.now()
        };
        try {
            window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(location));
        } catch (error) {
            // Location still works when session storage is unavailable.
        }
        return location;
    }

    function noticeWasDismissed() {
        try {
            return window.sessionStorage.getItem(NOTICE_DISMISSED_KEY) === 'true';
        } catch (error) {
            return false;
        }
    }

    function rememberNoticeDismissal() {
        try {
            window.sessionStorage.setItem(NOTICE_DISMISSED_KEY, 'true');
        } catch (error) {
            // The notice can still be removed when session storage is unavailable.
        }
    }

    function clearNoticeTimer() {
        if (noticeTimer !== null) {
            window.clearTimeout(noticeTimer);
            noticeTimer = null;
        }
    }

    function removeNotice(options = {}) {
        clearNoticeTimer();
        if (options.remember) rememberNoticeDismissal();
        document.getElementById('domiknowLocationNotice')?.remove();
    }

    function scheduleNoticeRemoval() {
        clearNoticeTimer();
        const notice = document.getElementById('domiknowLocationNotice');
        if (notice && (notice.matches(':hover') || notice.contains(document.activeElement))) return;
        noticeTimer = window.setTimeout(() => removeNotice(), NOTICE_AUTO_DISMISS_MS);
    }

    function showNotice(message, actionLabel = 'Try again', options = {}) {
        if (noticeWasDismissed() && !options.force) return;

        let notice = document.getElementById('domiknowLocationNotice');
        if (!notice) {
            notice = document.createElement('aside');
            notice.id = 'domiknowLocationNotice';
            notice.className = 'location-permission-notice';
            notice.setAttribute('role', 'status');
            notice.setAttribute('aria-live', 'polite');

            const icon = document.createElement('span');
            icon.className = 'location-permission-notice__icon';
            if (window.domiknowIcon) icon.insertAdjacentHTML('beforeend', window.domiknowIcon('target'));
            const content = document.createElement('div');
            content.className = 'location-permission-notice__content';
            const title = document.createElement('strong');
            title.textContent = 'Location access needed';
            const text = document.createElement('span');
            text.className = 'location-permission-notice__message';
            content.append(title, text);
            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'location-permission-notice__action';
            action.addEventListener('click', () => {
                action.disabled = true;
                action.textContent = 'Locating…';
                requestLocation({ userInitiated: true }).finally(() => {
                    if (!action.isConnected) return;
                    action.disabled = false;
                    action.textContent = action.dataset.label || 'Try again';
                });
            });
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'location-permission-notice__close';
            close.setAttribute('aria-label', 'Dismiss location notice');
            if (window.domiknowIcon) close.insertAdjacentHTML('beforeend', window.domiknowIcon('x'));
            else close.textContent = '×';
            close.addEventListener('click', () => removeNotice({ remember: true }));

            notice.addEventListener('pointerenter', clearNoticeTimer);
            notice.addEventListener('pointerleave', scheduleNoticeRemoval);
            notice.addEventListener('focusin', clearNoticeTimer);
            notice.addEventListener('focusout', event => {
                if (!notice.contains(event.relatedTarget)) scheduleNoticeRemoval();
            });
            notice.append(icon, content, action, close);
            document.body.appendChild(notice);
        }
        notice.querySelector('.location-permission-notice__message').textContent = message;
        const action = notice.querySelector('.location-permission-notice__action');
        action.textContent = actionLabel;
        action.dataset.label = actionLabel;
        action.disabled = options.actionable === false;
        action.hidden = options.actionable === false;
        scheduleNoticeRemoval();
    }

    function dispatch(name, detail) {
        document.dispatchEvent(new CustomEvent(name, { detail }));
    }

    function permissionErrorMessage(error) {
        if (error?.code === 1) return 'Location is blocked. Enable it in this site’s browser permissions, then try again.';
        if (error?.code === 3) return 'The location request timed out. Turn on GPS or Wi-Fi, then try again.';
        return 'Your device location is unavailable. Check location services, then try again.';
    }

    function requestLocation(options = {}) {
        if (activeRequest) return activeRequest;
        if (!navigator.geolocation) {
            const message = 'This browser does not support device location.';
            showNotice(message, 'Unavailable', { actionable: false, force: Boolean(options.userInitiated) });
            dispatch('domiknow:location-error', { message, code: 'unsupported' });
            return Promise.resolve(null);
        }
        if (!window.isSecureContext) {
            const message = 'Location permission requires a secure HTTPS connection.';
            showNotice(message, 'HTTPS required', { actionable: false, force: Boolean(options.userInitiated) });
            dispatch('domiknow:location-error', { message, code: 'insecure' });
            return Promise.resolve(null);
        }

        activeRequest = new Promise(resolve => {
            navigator.geolocation.getCurrentPosition(position => {
                if (!isWithinServiceRegion(position)) {
                    clearStoredLocation();
                    const message = 'The browser returned a location outside DOMIKNOW’s Siniloan service region. Turn off VPN or location spoofing, enable device GPS, then try again.';
                    showNotice(message, 'Try again', { force: Boolean(options.userInitiated) });
                    dispatch('domiknow:location-error', { message, code: 'outside_service_region' });
                    resolve(null);
                    return;
                }
                const location = storeLocation(position);
                removeNotice();
                dispatch('domiknow:location-ready', location);
                resolve(location);
            }, error => {
                const message = permissionErrorMessage(error);
                showNotice(message, error?.code === 1 ? 'Check permission' : 'Try again', { force: Boolean(options.userInitiated) });
                dispatch('domiknow:location-error', { message, code: error?.code || 'unavailable', userInitiated: Boolean(options.userInitiated) });
                resolve(null);
            }, {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: REQUEST_TIMEOUT_MS
            });
        }).finally(() => {
            activeRequest = null;
        });
        return activeRequest;
    }

    window.DomiknowLocation = Object.freeze({
        clear: clearStoredLocation,
        read: readStoredLocation,
        request: requestLocation
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => requestLocation(), { once: true });
    } else {
        requestLocation();
    }
})();
