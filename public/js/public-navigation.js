(function () {
    'use strict';

    const HOME_PATHS = new Set(['/', '/index.html']);
    const SECTION_LINKS = Object.freeze({
        howItWorks: '#howItWorks',
        communityFeedback: '#communityFeedback',
        faqSection: '#faqSection'
    });

    function normalizedPath(pathname) {
        const path = String(pathname || '/').replace(/\/{2,}/g, '/');
        return path === '/index.html' ? '/' : path.replace(/\/$/, '') || '/';
    }

    function navLinks() {
        return [...document.querySelectorAll('.public-workspace-nav a')];
    }

    function setActiveLink(predicate) {
        navLinks().forEach(link => {
            if (predicate(link)) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    }

    function setActiveByHash(hash) {
        const currentPath = normalizedPath(window.location.pathname);
        if (!HOME_PATHS.has(currentPath)) {
            setActiveLink(link => /browse rentals/i.test(link.textContent || ''));
            return;
        }

        const activeHash = Object.values(SECTION_LINKS).includes(hash) ? hash : '#top';
        setActiveLink(link => {
            const target = new URL(link.href, window.location.href);
            if (activeHash === '#top') return /home/i.test(link.textContent || '');
            return normalizedPath(target.pathname) === '/' && target.hash === activeHash;
        });
    }

    function visibleHomeSection() {
        const headerHeight = document.querySelector('.landing-header')?.getBoundingClientRect().height || 72;
        const threshold = headerHeight + 28;
        let hash = '#top';
        Object.entries(SECTION_LINKS).forEach(([id, sectionHash]) => {
            const section = document.getElementById(id);
            if (section && section.getBoundingClientRect().top <= threshold) hash = sectionHash;
        });
        return hash;
    }

    function updateFromScroll() {
        if (HOME_PATHS.has(normalizedPath(window.location.pathname))) setActiveByHash(visibleHomeSection());
    }

    function scrollToTarget(hash, behavior) {
        if (!hash || hash === '#top') {
            window.scrollTo({ top: 0, behavior });
            return;
        }
        document.querySelector(hash)?.scrollIntoView({ behavior, block: 'start' });
    }

    function handleNavigation(event) {
        const link = event.target.closest('.public-workspace-nav a[href]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = new URL(link.href, window.location.href);
        if (target.origin !== window.location.origin || normalizedPath(target.pathname) !== normalizedPath(window.location.pathname)) return;

        event.preventDefault();
        const hash = target.hash || '#top';
        const nextLocation = `${target.pathname}${target.search}${target.hash}`;
        const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (currentLocation !== nextLocation) window.history.pushState({}, '', nextLocation);
        setActiveByHash(hash);
        scrollToTarget(hash, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
    }

    function initialize() {
        document.addEventListener('click', handleNavigation);
        window.addEventListener('popstate', () => {
            setActiveByHash(window.location.hash || '#top');
            scrollToTarget(window.location.hash || '#top', 'auto');
        });

        if (HOME_PATHS.has(normalizedPath(window.location.pathname))) {
            let frame = 0;
            window.addEventListener('scroll', () => {
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(updateFromScroll);
            }, { passive: true });
            updateFromScroll();
        } else {
            setActiveByHash('');
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
}());
