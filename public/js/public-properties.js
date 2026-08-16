(function () {
    'use strict';

    const SINILOAN_CENTER = Object.freeze({ lat: 14.42143, lng: 121.44583 });
    const LSPU_CAMPUS = Object.freeze({ lat: 14.41338, lng: 121.44850 });
    const SEARCH_RADIUS_KM = 5;
    const TARGET_ACCURACY_METERS = 150;
    const MAXIMUM_USABLE_ACCURACY_METERS = 500;
    const DEVICE_SERVICE_REGION_RADIUS_KM = 150;
    const LOCATION_TIMEOUT_MS = 20000;
    const FALLBACK_IMAGE = '../../images/domiknow-public-hero-v2.jpg';

    let map;
    let properties = [];
    let filteredProperties = [];
    let selectedPropertyId = null;
    let propertyMarkers = [];
    let searchMarker = null;
    let searchAccuracyCircle = null;
    let searchRadiusCircle = null;
    let searchOrigin = null;
    let manualLocationMode = false;
    let geolocationWatchId = null;
    let geolocationTimerId = null;
    let lastSharedLocationTimestamp = 0;

    document.addEventListener('DOMContentLoaded', initialize);
    document.addEventListener('domiknow:location-ready', event => applySharedDeviceLocation(event.detail));
    document.addEventListener('domiknow:location-error', event => {
        if (!map || searchOrigin) return;
        setFeedback(event.detail?.message || 'Device location is unavailable. You can choose a point on the map.', 'warning');
    });

    function initialize() {
        initializeMap();
        bindControls();
        applySharedDeviceLocation(window.DomiknowLocation?.read());
        loadProperties();
    }

    function applySharedDeviceLocation(location) {
        if (!map || !location) return;
        const lat = Number(location.lat);
        const lng = Number(location.lng);
        const accuracy = Number(location.accuracy);
        const timestamp = Number(location.timestamp || Date.now());
        if (![lat, lng, accuracy].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
        if (timestamp === lastSharedLocationTimestamp) return;
        lastSharedLocationTimestamp = timestamp;

        if (!isWithinDeviceServiceRegion(lat, lng)) {
            window.DomiknowLocation?.clear();
            setFeedback('The browser returned a location outside DOMIKNOW’s Siniloan service region. The map was not moved. Turn off VPN/location spoofing, enable GPS, or choose a point on the map.', 'error');
            return;
        }

        if (accuracy > MAXIMUM_USABLE_ACCURACY_METERS) {
            setFeedback(`Location permission was granted, but the ${formatAccuracy(accuracy)} reading is too broad. Turn on precise location or choose a point on the map.`, 'warning');
            return;
        }
        setSearchOrigin(lat, lng, {
            title: 'Your device location',
            method: 'device',
            accuracy
        });
    }

    function initializeMap() {
        map = L.map('publicPropertiesMap', {
            zoomControl: true,
            scrollWheelZoom: false
        }).setView([SINILOAN_CENTER.lat, SINILOAN_CENTER.lng], 14);
        DomiknowMap.addBasemap(map);
        map.on('click', event => {
            if (!manualLocationMode) return;
            setManualLocation(event.latlng.lat, event.latlng.lng);
        });
    }

    function bindControls() {
        ['propertySearch', 'propertyTypeFilter', 'propertyPriceFilter', 'propertyBarangayFilter']
            .forEach(id => document.getElementById(id)?.addEventListener(id === 'propertySearch' ? 'input' : 'change', applyFilters));
        document.getElementById('propertySort')?.addEventListener('change', renderResults);
        document.getElementById('resetPropertyFilters')?.addEventListener('click', resetFilters);
        document.getElementById('useDeviceLocation')?.addEventListener('click', useDeviceLocation);
        document.getElementById('chooseMapLocation')?.addEventListener('click', enableManualLocationMode);
        document.getElementById('searchNearLspu')?.addEventListener('click', () => setSearchOrigin(LSPU_CAMPUS.lat, LSPU_CAMPUS.lng, {
            title: 'LSPU Siniloan Campus',
            method: 'landmark'
        }));
        document.getElementById('clearLocationSearch')?.addEventListener('click', () => clearLocationSearch());
        document.querySelectorAll('[data-discovery-view]').forEach(button => {
            button.addEventListener('click', () => setDiscoveryView(button.dataset.discoveryView));
        });
    }

    async function loadProperties() {
        try {
            const response = await fetch('/api/properties');
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Unable to load rentals');
            const source = result.data?.properties || result.data || [];
            properties = Array.isArray(source) ? source : [];
            selectedPropertyId = properties[0]?.id || null;
            applyFilters();
        } catch (error) {
            console.error('Public property discovery failed:', error);
            renderMessage('We could not load rentals right now.', 'Check the server connection and try again.');
            document.getElementById('propertyResultCount').textContent = 'Rentals unavailable';
            const mapCount = document.getElementById('mapResultCount');
            if (mapCount) mapCount.textContent = 'Map results unavailable';
        }
    }

    function applyFilters() {
        const query = normalizedValue('propertySearch');
        const type = normalizedValue('propertyTypeFilter');
        const barangay = normalizedValue('propertyBarangayFilter');
        const maximumRent = Number(document.getElementById('propertyPriceFilter')?.value || 0);

        filteredProperties = properties.filter(property => {
            const searchable = [property.property_name, property.address, property.barangay]
                .filter(Boolean).join(' ').toLowerCase();
            const matchesQuery = !query || searchable.includes(query);
            const matchesType = !type || String(property.property_type || '').toLowerCase() === type;
            const matchesBarangay = !barangay || String(property.barangay || '').toLowerCase() === barangay;
            const rent = Number(property.min_monthly_rent ?? property.monthly_rent);
            const matchesRent = !maximumRent || (Number.isFinite(rent) && rent <= maximumRent);
            const matchesLocation = !searchOrigin || (validCoordinates(property) && distanceKm(searchOrigin.lat, searchOrigin.lng, Number(property.latitude), Number(property.longitude)) <= SEARCH_RADIUS_KM);
            return matchesQuery && matchesType && matchesBarangay && matchesRent && matchesLocation;
        });

        if (!filteredProperties.some(property => String(property.id) === String(selectedPropertyId))) {
            selectedPropertyId = filteredProperties[0]?.id || null;
        }
        updateFilterState();
        renderResults();
        renderMarkers();
    }

    function renderResults() {
        const container = document.getElementById('propertyResults');
        const count = document.getElementById('propertyResultCount');
        if (!container || !count) return;

        const sorted = sortProperties([...filteredProperties]);
        count.textContent = `${sorted.length} ${sorted.length === 1 ? 'rental' : 'rentals'} found`;
        container.replaceChildren();

        if (!sorted.length) {
            renderMessage('No rentals match these filters.', 'Clear a filter or choose a different search location.');
            return;
        }

        sorted.forEach(property => container.appendChild(createPropertyCard(property)));
    }

    function createPropertyCard(property) {
        const card = document.createElement('article');
        card.className = 'public-listing-card';
        card.dataset.propertyId = property.id;
        if (String(property.id) === String(selectedPropertyId)) {
            card.classList.add('is-selected');
            card.setAttribute('aria-current', 'true');
        }

        const selectButton = document.createElement('button');
        selectButton.type = 'button';
        selectButton.className = 'public-listing-card__select';
        selectButton.setAttribute('aria-label', `Select ${property.property_name || 'rental property'} and show it on the map`);
        selectButton.addEventListener('click', () => {
            selectProperty(property.id, true);
            if (window.matchMedia('(max-width: 820px)').matches) setDiscoveryView('map');
        });

        const media = document.createElement('div');
        media.className = 'public-listing-card__media';
        const image = document.createElement('img');
        image.className = 'public-listing-card__image';
        image.src = propertyImage(property);
        image.alt = property.property_name ? `${property.property_name} rental property` : 'Rental property';
        image.loading = 'lazy';
        image.addEventListener('error', () => { image.src = FALLBACK_IMAGE; }, { once: true });
        const status = document.createElement('span');
        status.className = `public-listing-card__status ${isAvailable(property) ? 'is-available' : 'is-unavailable'}`;
        status.textContent = availabilityLabel(property);
        media.append(image, status);

        const content = document.createElement('div');
        content.className = 'public-listing-card__content';

        const cardEyebrow = document.createElement('p');
        cardEyebrow.className = 'public-listing-card__eyebrow';
        cardEyebrow.textContent = `Approved ${formatType(property.property_type)}`;

        const top = document.createElement('div');
        top.className = 'public-listing-card__top';
        const title = document.createElement('h3');
        title.id = `property-card-title-${property.id}`;
        title.textContent = property.property_name || 'Rental property';
        card.setAttribute('aria-labelledby', title.id);
        top.appendChild(title);

        const address = document.createElement('p');
        address.className = 'public-listing-card__address';
        const addressText = document.createElement('span');
        addressText.textContent = propertyAddress(property);
        if (window.domiknowIcon) address.insertAdjacentHTML('beforeend', window.domiknowIcon('pin'));
        address.appendChild(addressText);

        const facts = document.createElement('div');
        facts.className = 'public-listing-card__facts';
        facts.append(
            factPill(availabilityLabel(property)),
            factPill(formatCapacity(property.max_occupants))
        );
        if (searchOrigin && validCoordinates(property)) {
            facts.append(factPill(`${distanceKm(searchOrigin.lat, searchOrigin.lng, Number(property.latitude), Number(property.longitude)).toFixed(1)} km away`));
        }

        const footer = document.createElement('div');
        footer.className = 'public-listing-card__footer';
        const priceBox = document.createElement('div');
        priceBox.className = 'public-listing-card__price';
        const priceLabel = document.createElement('small');
        priceLabel.textContent = 'Starting at';
        const price = document.createElement('strong');
        price.innerHTML = `${formatRentRange(property)} <span>/ month</span>`;
        priceBox.append(priceLabel, price);
        const actions = document.createElement('div');
        actions.className = 'public-listing-card__actions';
        const link = document.createElement('a');
        link.href = `property-details.html?id=${encodeURIComponent(property.id)}`;
        link.className = 'btn btn-primary';
        link.textContent = 'View details';
        actions.appendChild(link);
        footer.append(priceBox, actions);

        content.append(cardEyebrow, top, address, facts, footer);
        card.append(selectButton, media, content);
        return card;
    }

    function createMapPropertyPopup(property) {
        const popup = document.createElement('article');
        popup.className = 'map-property-card';

        const header = document.createElement('div');
        header.className = 'map-property-card__header';
        const icon = document.createElement('span');
        icon.className = 'map-property-card__icon';
        if (window.domiknowIcon) icon.insertAdjacentHTML('beforeend', window.domiknowIcon('building'));
        const heading = document.createElement('div');
        heading.className = 'map-property-card__heading';
        const eyebrow = document.createElement('span');
        eyebrow.className = 'map-property-card__eyebrow';
        eyebrow.textContent = 'Selected rental';
        const title = document.createElement('h3');
        title.textContent = property.property_name || 'Rental property';
        heading.append(eyebrow, title);
        header.append(icon, heading);

        const facts = document.createElement('div');
        facts.className = 'map-property-card__facts';
        facts.append(factPill(availabilityLabel(property)));
        if (searchOrigin && validCoordinates(property)) {
            facts.append(factPill(`${distanceKm(searchOrigin.lat, searchOrigin.lng, Number(property.latitude), Number(property.longitude)).toFixed(1)} km away`));
        } else if (property.max_occupants !== null && property.max_occupants !== undefined && property.max_occupants !== '') {
            facts.append(factPill(formatCapacity(property.max_occupants)));
        } else {
            facts.append(factPill(formatType(property.property_type)));
        }

        const footer = document.createElement('div');
        footer.className = 'map-property-card__footer';
        const priceRow = document.createElement('div');
        priceRow.className = 'map-property-card__price-row';
        const priceLabel = document.createElement('span');
        priceLabel.textContent = 'Starting at';
        const priceBox = document.createElement('div');
        priceBox.className = 'map-property-card__price';
        const price = document.createElement('strong');
        price.textContent = formatRentRange(property);
        const priceSuffix = document.createElement('span');
        priceSuffix.textContent = '/ month';
        priceBox.append(price, priceSuffix);
        priceRow.append(priceLabel, priceBox);
        const link = document.createElement('a');
        link.className = 'map-property-card__action';
        link.href = `property-details.html?id=${encodeURIComponent(property.id)}`;
        link.textContent = 'View details';
        if (window.domiknowIcon) link.insertAdjacentHTML('beforeend', window.domiknowIcon('arrow'));
        footer.append(priceRow, link);

        popup.append(header, facts, footer);
        return popup;
    }

    function renderMessage(title, detail) {
        const container = document.getElementById('propertyResults');
        if (!container) return;
        container.replaceChildren();
        const state = document.createElement('div');
        state.className = 'public-results-state';
        const heading = document.createElement('strong');
        heading.textContent = title;
        const text = document.createElement('span');
        text.textContent = detail;
        state.append(heading, text);
        container.appendChild(state);
    }

    function renderMarkers() {
        propertyMarkers.forEach(marker => map.removeLayer(marker));
        propertyMarkers = [];

        filteredProperties.forEach(property => {
            if (!validCoordinates(property)) return;
            const selected = String(property.id) === String(selectedPropertyId);
            const marker = L.marker([Number(property.latitude), Number(property.longitude)], {
                icon: DomiknowMap.priceIcon(`${formatCurrency(property.min_monthly_rent ?? property.monthly_rent)}/mo`, {
                    selected,
                    unavailable: !isAvailable(property)
                }),
                keyboard: true,
                title: property.property_name || 'Rental property',
                alt: `${property.property_name || 'Rental property'} map marker`
            }).addTo(map);
            marker.domiknowPropertyId = String(property.id);
            const popupWidth = Math.min(410, Math.max(280, window.innerWidth - 56));
            marker.bindPopup(createMapPropertyPopup(property), {
                className: 'map-property-popup-shell',
                minWidth: popupWidth,
                maxWidth: popupWidth,
                autoPanPadding: [24, 24]
            });
            marker.on('click', () => {
                selectProperty(property.id, false);
            });
            propertyMarkers.push(marker);
        });

        const mappedCount = propertyMarkers.length;
        const mapCount = document.getElementById('mapResultCount');
        if (mapCount) {
            mapCount.textContent = mappedCount
                ? `${mappedCount} ${mappedCount === 1 ? 'rental' : 'rentals'} on map`
                : 'No mapped rentals';
        }
    }

    function selectProperty(propertyId, panMap) {
        selectedPropertyId = propertyId;
        updateSelectedCardState();
        renderMarkers();
        const property = properties.find(item => String(item.id) === String(propertyId));
        if (panMap && validCoordinates(property)) {
            map.flyTo([Number(property.latitude), Number(property.longitude)], Math.max(map.getZoom(), 16), { duration: 0.5 });
        }
        propertyMarkers.find(marker => marker.domiknowPropertyId === String(propertyId))?.openPopup();
        document.querySelector(`[data-property-id="${CSS.escape(String(propertyId))}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function updateSelectedCardState() {
        document.querySelectorAll('.public-listing-card').forEach(card => {
            const selected = String(card.dataset.propertyId) === String(selectedPropertyId);
            card.classList.toggle('is-selected', selected);
            if (selected) card.setAttribute('aria-current', 'true');
            else card.removeAttribute('aria-current');
        });
    }

    function setSearchOrigin(lat, lng, options = {}) {
        if (options.method === 'device' && !isWithinDeviceServiceRegion(lat, lng)) {
            window.DomiknowLocation?.clear();
            setFeedback('The browser returned a location outside DOMIKNOW’s Siniloan service region. The map was not moved. Turn off VPN/location spoofing, enable GPS, or choose a point on the map.', 'error');
            return false;
        }
        stopGeolocation();
        manualLocationMode = false;
        updateManualMode();
        searchOrigin = { lat, lng, accuracy: options.accuracy || null, method: options.method || 'manual' };
        clearSearchLayers();

        searchMarker = L.marker([lat, lng], {
            icon: DomiknowMap.pinIcon({ kind: 'search' }),
            draggable: options.method === 'manual',
            keyboard: true,
            title: options.title || 'Rental search point'
        }).addTo(map);
        searchMarker.bindPopup(DomiknowMap.popupContent({
            eyebrow: 'Rental search',
            title: options.title || 'Chosen location',
            meta: `Showing rentals within ${SEARCH_RADIUS_KM} km`
        })).openPopup();
        if (options.method === 'manual') {
            searchMarker.on('dragend', event => {
                const point = event.target.getLatLng();
                setSearchOrigin(point.lat, point.lng, { title: 'Adjusted search point', method: 'manual' });
            });
        }

        if (Number.isFinite(options.accuracy)) {
            searchAccuracyCircle = L.circle([lat, lng], {
                radius: options.accuracy,
                color: '#0355f3',
                weight: 1.5,
                opacity: 0.8,
                fillColor: '#0355f3',
                fillOpacity: 0.09,
                dashArray: '4 5',
                interactive: false
            }).addTo(map);
        }
        searchRadiusCircle = L.circle([lat, lng], {
            radius: SEARCH_RADIUS_KM * 1000,
            color: '#042458',
            weight: 1,
            opacity: 0.46,
            fillColor: '#0355f3',
            fillOpacity: 0.035,
            dashArray: '7 7',
            interactive: false
        }).addTo(map);

        document.getElementById('clearLocationSearch').hidden = false;
        setFeedback(
            options.accuracy
                ? `${options.title || 'Device location'} accepted at ${formatAccuracy(options.accuracy)} accuracy.`
                : `${options.title || 'Location'} selected. Results are limited to ${SEARCH_RADIUS_KM} km.`,
            'success'
        );
        applyFilters();
        map.fitBounds(searchRadiusCircle.getBounds(), { padding: [34, 34], maxZoom: 15 });
        return true;
    }

    function enableManualLocationMode() {
        stopGeolocation();
        manualLocationMode = true;
        updateManualMode();
        setFeedback('Click the map to place an exact search point. You can drag the pin afterward.', 'info');
        setDiscoveryView('map');
    }

    function setManualLocation(lat, lng) {
        setSearchOrigin(lat, lng, { title: 'Chosen search point', method: 'manual' });
    }

    function useDeviceLocation() {
        stopGeolocation();
        manualLocationMode = false;
        updateManualMode();

        if (!navigator.geolocation) {
            setFeedback('Device location is not supported. Use “Set location on map” instead.', 'error');
            return;
        }
        if (!window.isSecureContext) {
            setFeedback('Device location requires HTTPS. Use the secure site or set the location on the map.', 'error');
            return;
        }

        const button = document.getElementById('useDeviceLocation');
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        setFeedback('Waiting for a precise GPS or Wi-Fi reading…', 'loading');
        let bestPosition = null;
        let finished = false;

        const finish = (position, timedOut) => {
            if (finished) return;
            const accuracy = Number(position?.coords?.accuracy);
            if (!Number.isFinite(accuracy) || accuracy > MAXIMUM_USABLE_ACCURACY_METERS) {
                if (!timedOut) return;
                finished = true;
                stopGeolocation();
                resetLocationButton();
                setFeedback(`The device reading was only ${formatAccuracy(accuracy)}. DOMIKNOW did not move the map. Turn on precise location/GPS or set the point manually.`, 'warning');
                return;
            }
            finished = true;
            stopGeolocation();
            resetLocationButton();
            setSearchOrigin(position.coords.latitude, position.coords.longitude, {
                title: 'Your device location',
                method: 'device',
                accuracy
            });
        };

        const fail = error => {
            if (finished) return;
            if (bestPosition) {
                finish(bestPosition, true);
                return;
            }
            finished = true;
            stopGeolocation();
            resetLocationButton();
            const message = error.code === 1
                ? 'Location permission is blocked. Allow precise location for this site or set the point manually.'
                : error.code === 3
                    ? 'A precise reading was not available in time. Turn on GPS/Wi-Fi or set the point manually.'
                    : 'Device location is unavailable. Set the search point manually on the map.';
            setFeedback(message, 'error');
        };

        geolocationWatchId = navigator.geolocation.watchPosition(position => {
            const accuracy = Number(position.coords.accuracy);
            const bestAccuracy = Number(bestPosition?.coords?.accuracy);
            if (!bestPosition || (Number.isFinite(accuracy) && (!Number.isFinite(bestAccuracy) || accuracy < bestAccuracy))) {
                bestPosition = position;
            }
            setFeedback(`Improving location accuracy… current reading ${formatAccuracy(accuracy)}.`, 'loading');
            if (accuracy <= TARGET_ACCURACY_METERS) finish(position, false);
        }, fail, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: LOCATION_TIMEOUT_MS
        });

        geolocationTimerId = window.setTimeout(() => {
            if (bestPosition) finish(bestPosition, true);
            else fail({ code: 3 });
        }, LOCATION_TIMEOUT_MS);
    }

    function clearLocationSearch(feedbackMessage = 'Location filter cleared. Showing rentals across Siniloan.') {
        stopGeolocation();
        searchOrigin = null;
        manualLocationMode = false;
        updateManualMode();
        clearSearchLayers();
        document.getElementById('clearLocationSearch').hidden = true;
        document.getElementById('propertySort').value = 'recommended';
        setFeedback(feedbackMessage, 'info');
        map.setView([SINILOAN_CENTER.lat, SINILOAN_CENTER.lng], 14);
        applyFilters();
    }

    function clearSearchLayers() {
        [searchMarker, searchAccuracyCircle, searchRadiusCircle].forEach(layer => {
            if (layer && map.hasLayer(layer)) map.removeLayer(layer);
        });
        searchMarker = null;
        searchAccuracyCircle = null;
        searchRadiusCircle = null;
    }

    function stopGeolocation() {
        if (geolocationWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(geolocationWatchId);
        if (geolocationTimerId !== null) window.clearTimeout(geolocationTimerId);
        geolocationWatchId = null;
        geolocationTimerId = null;
    }

    function resetLocationButton() {
        const button = document.getElementById('useDeviceLocation');
        button.disabled = false;
        button.setAttribute('aria-busy', 'false');
    }

    function updateManualMode() {
        const hint = document.getElementById('manualLocationHint');
        const button = document.getElementById('chooseMapLocation');
        hint.hidden = !manualLocationMode;
        button.setAttribute('aria-pressed', String(manualLocationMode));
        map.getContainer().classList.toggle('is-choosing-location', manualLocationMode);
    }

    function resetFilters() {
        document.getElementById('propertySearch').value = '';
        document.getElementById('propertyTypeFilter').value = '';
        document.getElementById('propertyPriceFilter').value = '';
        document.getElementById('propertyBarangayFilter').value = '';
        clearLocationSearch('All filters cleared. Showing rentals across Siniloan.');
    }

    function setDiscoveryView(view) {
        const workspace = document.querySelector('.discovery-workspace');
        workspace.dataset.activeView = view;
        document.querySelectorAll('[data-discovery-view]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.discoveryView === view));
        });
        if (view === 'map') window.setTimeout(() => map.invalidateSize(), 50);
    }

    function setFeedback(message, state) {
        const feedback = document.getElementById('locationFeedback');
        feedback.textContent = message;
        feedback.dataset.state = state;
    }

    function sortProperties(items) {
        const sort = document.getElementById('propertySort')?.value;
        if (sort === 'price_asc') return items.sort((a, b) => safeNumber(a.min_monthly_rent ?? a.monthly_rent) - safeNumber(b.min_monthly_rent ?? b.monthly_rent));
        if (sort === 'price_desc') return items.sort((a, b) => safeNumber(b.min_monthly_rent ?? b.monthly_rent) - safeNumber(a.min_monthly_rent ?? a.monthly_rent));
        if (sort === 'distance' && searchOrigin) {
            return items.sort((a, b) => distanceTo(a) - distanceTo(b));
        }
        return items.sort((a, b) => Number(isAvailable(b)) - Number(isAvailable(a)));
    }

    function distanceTo(property) {
        return validCoordinates(property)
            ? distanceKm(searchOrigin.lat, searchOrigin.lng, Number(property.latitude), Number(property.longitude))
            : Number.POSITIVE_INFINITY;
    }

    function validCoordinates(property) {
        if (property?.latitude === null || property?.latitude === undefined || property?.latitude === ''
            || property?.longitude === null || property?.longitude === undefined || property?.longitude === '') return false;
        const lat = Number(property?.latitude);
        const lng = Number(property?.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    }

    function distanceKm(lat1, lng1, lat2, lng2) {
        if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
        const earthRadiusKm = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function isWithinDeviceServiceRegion(lat, lng) {
        const latitude = Number(lat);
        const longitude = Number(lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
        return distanceKm(latitude, longitude, SINILOAN_CENTER.lat, SINILOAN_CENTER.lng) <= DEVICE_SERVICE_REGION_RADIUS_KM;
    }

    function normalizedValue(id) {
        return String(document.getElementById(id)?.value || '').trim().toLowerCase();
    }

    function updateFilterState() {
        const filterIds = ['propertySearch', 'propertyTypeFilter', 'propertyPriceFilter', 'propertyBarangayFilter'];
        const activeCount = filterIds.reduce((count, id) => count + Number(Boolean(document.getElementById(id)?.value)), 0)
            + Number(Boolean(searchOrigin));
        const resetButton = document.getElementById('resetPropertyFilters');
        if (resetButton) {
            resetButton.disabled = activeCount === 0;
            resetButton.textContent = activeCount ? `Clear all (${activeCount})` : 'Clear all';
        }

        const sort = document.getElementById('propertySort');
        const nearestOption = sort?.querySelector('option[value="distance"]');
        if (nearestOption) nearestOption.disabled = !searchOrigin;
        if (!searchOrigin && sort?.value === 'distance') sort.value = 'recommended';
    }

    function propertyImage(property) {
        if (property?.main_image_url) return property.main_image_url;
        if (Array.isArray(property?.images) && property.images.length) {
            return property.images.find(image => image.is_main)?.image_url || property.images[0]?.image_url || FALLBACK_IMAGE;
        }
        return FALLBACK_IMAGE;
    }

    function propertyAddress(property) {
        return [property?.address, property?.barangay && `Brgy. ${property.barangay}`, property?.municipality || 'Siniloan']
            .filter(Boolean).join(' · ');
    }

    function isAvailable(property) {
        const totalSpaces = Number(property?.total_space_count);
        const availableSpaces = Number(property?.available_space_count);
        if (Number.isFinite(totalSpaces) && totalSpaces > 0) {
            return Number.isFinite(availableSpaces) && availableSpaces > 0;
        }
        const value = String(property?.availability_status || property?.status || 'available').toLowerCase();
        return !['unavailable', 'occupied', 'inactive', 'rejected'].includes(value);
    }

    function availabilityLabel(property) {
        const totalSpaces = Number(property?.total_space_count);
        const availableSpaces = Number(property?.available_space_count);
        if (Number.isFinite(totalSpaces) && totalSpaces > 0 && Number.isFinite(availableSpaces)) {
            return availableSpaces > 0
                ? `${availableSpaces} ${availableSpaces === 1 ? 'vacancy' : 'vacancies'}`
                : 'No vacancies';
        }
        return isAvailable(property) ? 'Available' : 'Unavailable';
    }

    function formatType(value) {
        return String(value || 'Rental').replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
    }

    function formatCurrency(value) {
        if (value === null || value === undefined || value === '') return 'Price on request';
        const amount = Number(value);
        return Number.isFinite(amount) ? `₱${amount.toLocaleString('en-PH')}` : 'Price on request';
    }

    function formatRentRange(property) {
        const minimum = Number(property?.min_monthly_rent ?? property?.monthly_rent);
        const maximum = Number(property?.max_monthly_rent ?? property?.monthly_rent);
        if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return 'Price on request';
        if (minimum === maximum) return formatCurrency(minimum);
        return `${formatCurrency(minimum)}–${formatCurrency(maximum)}`;
    }

    function formatAccuracy(value) {
        const accuracy = Number(value);
        if (!Number.isFinite(accuracy)) return 'unknown accuracy';
        return accuracy >= 1000 ? `±${(accuracy / 1000).toFixed(1)} km` : `±${Math.max(5, Math.round(accuracy / 5) * 5)} m`;
    }

    function formatCapacity(value) {
        if (value === null || value === undefined || value === '') return 'Capacity not listed';
        const capacity = Number(value);
        return Number.isFinite(capacity) ? `${capacity} max` : 'Capacity not listed';
    }

    function safeNumber(value, fallback = 0) {
        if (value === null || value === undefined || value === '') return fallback;
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function factPill(label) {
        const element = document.createElement('span');
        element.textContent = label;
        return element;
    }
})();
