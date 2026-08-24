(function () {
    'use strict';

    const CARTO_TILES = {
        light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    };

    const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
    const ESRI_ATTRIBUTION = 'Tiles &copy; Esri';

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function escapeHtml(value) {
        const node = document.createElement('div');
        node.textContent = String(value ?? '');
        return node.innerHTML;
    }

    function addBasemap(map, options = {}) {
        if (!map || typeof window.L === 'undefined') return null;

        let activeTheme = currentTheme();
        const createThemeLayer = (theme) => L.tileLayer(CARTO_TILES[theme], {
            attribution: ATTRIBUTION,
            maxZoom: options.maxZoom || 20,
            maxNativeZoom: options.maxNativeZoom || 20,
            subdomains: 'abcd',
            detectRetina: true,
            updateWhenIdle: true
        });
        let layer = createThemeLayer(activeTheme);
        const basemapGroup = L.layerGroup([layer]);

        const container = map.getContainer();
        container.classList.add('domiknow-map');
        container.dataset.mapTheme = activeTheme;
        let loadingTimeout;
        const setMapLoading = (loading) => {
            window.clearTimeout(loadingTimeout);
            container.classList.toggle('is-map-loading', loading);
            if (loading) {
                container.setAttribute('aria-busy', 'true');
                loadingTimeout = window.setTimeout(() => setMapLoading(false), 8000);
            } else {
                container.removeAttribute('aria-busy');
            }
        };
        setMapLoading(true);
        layer.once('load', () => setMapLoading(false));
        basemapGroup.addTo(map);

        const observer = new MutationObserver(() => {
            const nextTheme = currentTheme();
            if (nextTheme === activeTheme) return;

            const nextLayer = createThemeLayer(nextTheme);
            if (map.hasLayer(basemapGroup)) {
                setMapLoading(true);
                nextLayer.once('load', () => {
                    basemapGroup.removeLayer(layer);
                    layer = nextLayer;
                    setMapLoading(false);
                });
                basemapGroup.addLayer(nextLayer);
            } else {
                basemapGroup.clearLayers();
                basemapGroup.addLayer(nextLayer);
                layer = nextLayer;
            }
            activeTheme = nextTheme;
            container.dataset.mapTheme = nextTheme;
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        map.once('unload', () => {
            observer.disconnect();
            window.clearTimeout(loadingTimeout);
        });
        return basemapGroup;
    }

    function satelliteLayer(options = {}) {
        if (typeof window.L === 'undefined') return null;
        const imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: ESRI_ATTRIBUTION,
            maxZoom: options.maxZoom || 19,
            detectRetina: true,
            updateWhenIdle: true
        });
        const labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            attribution: ESRI_ATTRIBUTION,
            maxZoom: options.maxZoom || 19,
            detectRetina: true,
            updateWhenIdle: true
        });
        return L.layerGroup([imagery, labels]);
    }

    function addLayerControl(map, basemap, options = {}) {
        if (!map || !basemap || typeof window.L === 'undefined') return null;
        const baseMaps = { 'DomiKnow map': basemap };
        if (options.satellite !== false) baseMaps['Satellite + labels'] = satelliteLayer(options);
        return L.control.layers(baseMaps, null, {
            position: options.position || 'topright',
            collapsed: options.collapsed !== false
        }).addTo(map);
    }

    function priceIcon(priceLabel, options = {}) {
        const state = options.unavailable
            ? 'unavailable'
            : options.selected
                ? 'selected'
                : 'available';

        const labelLength = String(priceLabel || '').length;
        const markerWidth = Math.min(176, Math.max(76, 28 + (labelLength * 7.2)));

        return L.divIcon({
            className: 'domiknow-price-marker-wrapper',
            html: `<span class="domiknow-price-marker domiknow-price-marker--${state}">${escapeHtml(priceLabel)}</span>`,
            iconSize: [markerWidth, 38],
            iconAnchor: [markerWidth / 2, 38],
            popupAnchor: [0, -38]
        });
    }

    function pinIcon(options = {}) {
        const kind = options.kind === 'search' ? 'search' : 'property';
        const selectedClass = options.selected ? ' domiknow-map-pin--selected' : '';
        const icon = kind === 'search'
            ? '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path>'
            : '<path d="M4 10.5 12 4l8 6.5V20H4Z"></path><path d="M9 20v-6h6v6"></path>';

        return L.divIcon({
            className: 'domiknow-map-pin-wrapper',
            html: `<span class="domiknow-map-pin domiknow-map-pin--${kind}${selectedClass}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg></span>`,
            iconSize: [44, 44],
            iconAnchor: kind === 'search' ? [22, 22] : [19, 39],
            popupAnchor: kind === 'search' ? [0, -24] : [0, -37]
        });
    }

    function popupContent(options = {}) {
        const eyebrow = options.eyebrow
            ? `<span class="domiknow-map-popup__eyebrow">${escapeHtml(options.eyebrow)}</span>`
            : '';
        const title = `<strong class="domiknow-map-popup__title">${escapeHtml(options.title || 'Location')}</strong>`;
        const meta = options.meta
            ? `<span class="domiknow-map-popup__meta">${escapeHtml(options.meta)}</span>`
            : '';
        return `${eyebrow}${title}${meta}`;
    }

    function propertyPopupContent(options = {}) {
        const facts = Array.isArray(options.facts)
            ? options.facts.filter(value => value !== null && value !== undefined && String(value).trim()).slice(0, 4)
            : [];
        const action = options.actionHref
            ? `<a class="map-property-card__action" href="${escapeHtml(options.actionHref)}">${escapeHtml(options.actionLabel || 'View details')}<span aria-hidden="true">&rarr;</span></a>`
            : '';
        const price = options.price
            ? `<div class="map-property-card__price-row"><span>${escapeHtml(options.priceLabel || 'Starting at')}</span><span class="map-property-card__price"><strong>${escapeHtml(options.price)}</strong>${options.priceSuffix === false ? '' : `<span>${escapeHtml(options.priceSuffix || '/ month')}</span>`}</span></div>`
            : '';

        return `<article class="map-property-card">
            <header class="map-property-card__header">
                <span class="map-property-card__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16"/><path d="M17 9h2a2 2 0 0 1 2 2v10M8 7h2M8 11h2M8 15h2M13 7h1M13 11h1M13 15h1M3 21h19"/></svg></span>
                <span class="map-property-card__heading"><span class="map-property-card__eyebrow">${escapeHtml(options.eyebrow || 'Property location')}</span><h3>${escapeHtml(options.title || 'Rental property')}</h3></span>
            </header>
            ${facts.length ? `<div class="map-property-card__facts">${facts.map(fact => `<span>${escapeHtml(fact)}</span>`).join('')}</div>` : ''}
            ${(price || action) ? `<footer class="map-property-card__footer">${price}${action}</footer>` : ''}
        </article>`;
    }

    function popupOptions(options = {}) {
        const viewportWidth = Math.max(280, window.innerWidth || 320);
        const width = Math.min(options.maxWidth || 410, Math.max(options.minWidth || 280, viewportWidth - 56));
        return {
            className: options.className || 'map-property-popup-shell',
            minWidth: width,
            maxWidth: width,
            maxHeight: Math.max(220, (window.innerHeight || 640) - 80),
            autoPan: options.autoPan !== false,
            keepInView: true,
            autoPanPadding: options.autoPanPadding || [24, 24]
        };
    }

    function bindPopup(marker, content, options = {}) {
        if (!marker?.bindPopup) return marker;
        return marker.bindPopup(content, popupOptions(options));
    }

    function observeContainer(map, container) {
        const element = typeof container === 'string' ? document.querySelector(container) : container;
        if (!map || !element) return function () {};

        let frame = 0;
        const refresh = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => map.invalidateSize({ animate: false, pan: false }));
        };
        requestAnimationFrame(() => requestAnimationFrame(refresh));
        const timers = [120, 360, 900].map(delay => window.setTimeout(refresh, delay));
        const observer = 'ResizeObserver' in window ? new ResizeObserver(refresh) : null;
        observer?.observe(element);
        map.once('unload', () => {
            cancelAnimationFrame(frame);
            timers.forEach(window.clearTimeout);
            observer?.disconnect();
        });
        return refresh;
    }

    window.DomiknowMap = Object.freeze({
        addBasemap,
        addLayerControl,
        bindPopup,
        escapeHtml,
        observeContainer,
        pinIcon,
        popupContent,
        popupOptions,
        priceIcon,
        propertyPopupContent,
        satelliteLayer
    });
})();
