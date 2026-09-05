/**
 * landlord-cache.js
 * Comprehensive client-side caching module for DOMIKNOW Landlord workspace.
 *
 * Features:
 *  - Per-user cache isolation (scoped to current token/user session)
 *  - Session-scoped persistence via sessionStorage with in-memory Map fallback
 *  - Domain-specific TTL configurations
 *  - Fine-grained and prefix-level cache invalidations
 *  - Convenient fetchWithCache wrapper
 *  - Safe automatic cache purging on logout / session expiry
 */

(function (global) {
    'use strict';

    // Domain default TTLs in milliseconds
    const DOMAIN_TTLS = {
        properties: 120 * 1000,    // 2 minutes
        units: 120 * 1000,         // 2 minutes
        applications: 90 * 1000,   // 1.5 minutes
        leases: 120 * 1000,        // 2 minutes
        billings: 60 * 1000,       // 1 minute
        payments: 60 * 1000,       // 1 minute
        maintenance: 60 * 1000,    // 1 minute
        disputes: 90 * 1000,       // 1.5 minutes
        feedback: 120 * 1000,      // 2 minutes
        ratings: 120 * 1000,       // 2 minutes
        reports: 90 * 1000,        // 1.5 minutes
        tenantReports: 90 * 1000   // 1.5 minutes
    };

    const DEFAULT_TTL = 90 * 1000;
    const STORAGE_PREFIX = 'domiknow_ll_cache_';

    class LandlordClientCache {
        constructor() {
            /** @type {Map<string, { value: any, expiresAt: number, cachedAt: number }>} */
            this._memoryFallback = new Map();
            this._hasSessionStorage = this._testSessionStorage();
            this._initAuthObserver();
        }

        /**
         * Test if sessionStorage is available and functional
         */
        _testSessionStorage() {
            try {
                if (typeof window === 'undefined' || !window.sessionStorage) return false;
                const testKey = '__domiknow_test__';
                window.sessionStorage.setItem(testKey, '1');
                window.sessionStorage.removeItem(testKey);
                return true;
            } catch (e) {
                return false;
            }
        }

        /**
         * Compute unique user token signature for safe namespace isolation
         */
        _getUserScope() {
            try {
                if (typeof window === 'undefined' || !window.localStorage) return 'anon';
                const token = window.localStorage.getItem('domiknow_token');
                if (!token) return 'anon';
                // Use a short deterministic slice of token for session key scoping
                let hash = 0;
                for (let i = 0; i < token.length; i++) {
                    hash = ((hash << 5) - hash) + token.charCodeAt(i);
                    hash |= 0;
                }
                return `u_${Math.abs(hash).toString(36)}`;
            } catch (e) {
                return 'anon';
            }
        }

        /**
         * Build namespaced storage key: domiknow_ll_cache_<scope>:<domain>:<subkey>
         */
        _buildKey(domain, subkey = 'list') {
            const scope = this._getUserScope();
            return `${STORAGE_PREFIX}${scope}:${domain}:${String(subkey)}`;
        }

        /**
         * Store an entry in cache
         * @param {string} domain - Domain name (e.g., 'properties', 'billings', 'leases')
         * @param {string} [subkey='list'] - Subkey (e.g., record ID or status filter)
         * @param {any} data - Data to cache
         * @param {number} [customTtlMs] - Optional custom TTL in milliseconds
         */
        set(domain, subkey = 'list', data, customTtlMs) {
            if (data === undefined) return;
            const ttl = Number(customTtlMs) || DOMAIN_TTLS[domain] || DEFAULT_TTL;
            const now = Date.now();
            const record = {
                value: data,
                cachedAt: now,
                expiresAt: now + ttl
            };

            const key = this._buildKey(domain, subkey);

            if (this._hasSessionStorage) {
                try {
                    window.sessionStorage.setItem(key, JSON.stringify(record));
                    return;
                } catch (err) {
                    // If sessionStorage quota is exceeded, fall back to memory
                    this._hasSessionStorage = false;
                }
            }

            this._memoryFallback.set(key, record);
        }

        /**
         * Retrieve an entry from cache
         * @param {string} domain
         * @param {string} [subkey='list']
         * @returns {any|null} Cached value or null if expired/missing
         */
        get(domain, subkey = 'list') {
            const key = this._buildKey(domain, subkey);
            let record = null;

            if (this._hasSessionStorage) {
                try {
                    const raw = window.sessionStorage.getItem(key);
                    if (raw) record = JSON.parse(raw);
                } catch (err) {
                    record = null;
                }
            }

            if (!record) {
                record = this._memoryFallback.get(key) || null;
            }

            if (!record) return null;

            if (Date.now() > record.expiresAt) {
                this.invalidate(domain, subkey);
                return null;
            }

            return record.value;
        }

        /**
         * Invalidate a specific subkey or all keys under a domain
         * @param {string} domain - Domain name
         * @param {string} [subkey] - If omitted, invalidates all keys in the domain
         */
        invalidate(domain, subkey) {
            const scope = this._getUserScope();
            const prefix = subkey !== undefined
                ? this._buildKey(domain, subkey)
                : `${STORAGE_PREFIX}${scope}:${domain}:`;

            if (this._hasSessionStorage) {
                try {
                    if (subkey !== undefined) {
                        window.sessionStorage.removeItem(prefix);
                    } else {
                        const toRemove = [];
                        for (let i = 0; i < window.sessionStorage.length; i++) {
                            const k = window.sessionStorage.key(i);
                            if (k && k.startsWith(prefix)) {
                                toRemove.push(k);
                            }
                        }
                        toRemove.forEach(k => window.sessionStorage.removeItem(k));
                    }
                } catch (err) { /* ignore */ }
            }

            // Also clear memory fallback
            if (subkey !== undefined) {
                this._memoryFallback.delete(prefix);
            } else {
                for (const k of this._memoryFallback.keys()) {
                    if (k.startsWith(prefix)) {
                        this._memoryFallback.delete(k);
                    }
                }
            }

            this._dispatchInvalidationEvent(domain, subkey);
        }

        /**
         * Invalidate multiple domains at once
         * @param {...string} domains
         */
        invalidateMultiple(...domains) {
            domains.flat().forEach(d => this.invalidate(d));
        }

        /**
         * Invalidate ALL cached landlord items for the current user
         */
        invalidateAll() {
            const scope = this._getUserScope();
            const prefix = `${STORAGE_PREFIX}${scope}:`;

            if (this._hasSessionStorage) {
                try {
                    const toRemove = [];
                    for (let i = 0; i < window.sessionStorage.length; i++) {
                        const k = window.sessionStorage.key(i);
                        if (k && k.startsWith(prefix)) {
                            toRemove.push(k);
                        }
                    }
                    toRemove.forEach(k => window.sessionStorage.removeItem(k));
                } catch (err) { /* ignore */ }
            }

            for (const k of this._memoryFallback.keys()) {
                if (k.startsWith(prefix)) {
                    this._memoryFallback.delete(k);
                }
            }
        }

        /**
         * High-level fetch wrapper with automatic cache handling
         * @param {string} url - API Endpoint
         * @param {RequestInit} [fetchOptions] - Fetch options (headers, method, etc.)
         * @param {object} cacheConfig - Cache configuration
         * @param {string} cacheConfig.domain - Target domain (e.g. 'properties')
         * @param {string} [cacheConfig.subkey='list'] - Subkey for cache
         * @param {number} [cacheConfig.ttlMs] - Custom TTL in milliseconds
         * @param {boolean} [cacheConfig.forceRefresh=false] - If true, bypasses cache
         * @returns {Promise<any>}
         */
        async fetchWithCache(url, fetchOptions = {}, cacheConfig = {}) {
            const { domain, subkey = 'list', ttlMs, forceRefresh = false } = cacheConfig;

            if (!domain) {
                const res = await fetch(url, fetchOptions);
                if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                return res.json();
            }

            if (!forceRefresh) {
                const cached = this.get(domain, subkey);
                if (cached !== null) {
                    return cached;
                }
            }

            const response = await fetch(url, fetchOptions);
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const result = await response.json();
            // Most endpoints return { success: true, data: [...] }
            const payload = result && typeof result === 'object' && ('data' in result)
                ? result.data
                : result;

            this.set(domain, subkey, payload, ttlMs);
            return payload;
        }

        /**
         * Attach listener for logout / storage cleanup
         */
        _initAuthObserver() {
            if (typeof window === 'undefined') return;

            document.addEventListener('click', (e) => {
                const btn = e.target.closest('#logoutBtn, [data-action="logout"]');
                if (btn) {
                    this.invalidateAll();
                }
            });

            window.addEventListener('domiknow:auth-logout', () => {
                this.invalidateAll();
            });
        }

        _dispatchInvalidationEvent(domain, subkey) {
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                try {
                    window.dispatchEvent(new CustomEvent('domiknow:landlord-cache-invalidated', {
                        detail: { domain, subkey }
                    }));
                } catch (e) { /* skip */ }
            }
        }
    }

    const instance = new LandlordClientCache();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = instance;
    }
    if (global) {
        global.landlordCache = instance;
        global.DomiknowLandlordCache = LandlordClientCache;
    }
})(typeof window !== 'undefined' ? window : global);
