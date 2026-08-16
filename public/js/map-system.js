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
        const basemapGroup = L.layerGroup([layer]).addTo(map);

        const container = map.getContainer();
        container.classList.add('domiknow-map');
        container.dataset.mapTheme = activeTheme;

        const observer = new MutationObserver(() => {
            const nextTheme = currentTheme();
            if (nextTheme === activeTheme) return;

            const nextLayer = createThemeLayer(nextTheme);
            if (map.hasLayer(basemapGroup)) {
                nextLayer.once('load', () => {
                    basemapGroup.removeLayer(layer);
                    layer = nextLayer;
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

        map.once('unload', () => observer.disconnect());
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

        return L.divIcon({
            className: 'domiknow-price-marker-wrapper',
            html: `<span class="domiknow-price-marker domiknow-price-marker--${state}">${escapeHtml(priceLabel)}</span>`,
            iconSize: [104, 38],
            iconAnchor: [52, 38]
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

    window.DomiknowMap = Object.freeze({
        addBasemap,
        addLayerControl,
        escapeHtml,
        pinIcon,
        popupContent,
        priceIcon,
        satelliteLayer
    });
})();
