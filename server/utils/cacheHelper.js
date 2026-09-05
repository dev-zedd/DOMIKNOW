/**
 * cacheHelper.js
 * Lightweight in-memory TTL cache for the DOMIKNOW server.
 *
 * Design goals:
 *  - Zero extra npm dependencies (plain Map + setTimeout)
 *  - Per-user cache isolation via key namespacing
 *  - Automatic expiry using TTL timers
 *  - Namespace-level invalidation so write operations can bust
 *    only the relevant slice of cache (e.g. all keys for a landlord's
 *    properties) without clearing everything.
 *
 * Usage:
 *   const cache = require('./cacheHelper');
 *
 *   // Store a value
 *   cache.set('ns:userId:key', data, ttlSeconds);
 *
 *   // Retrieve (returns undefined on miss or expiry)
 *   const hit = cache.get('ns:userId:key');
 *
 *   // Invalidate all keys whose cache key starts with a prefix
 *   cache.invalidatePrefix('ns:userId');
 *
 *   // Build a standard landlord cache key
 *   cache.landlordKey(userId, 'properties');
 */

class TTLCache {
    constructor() {
        /** @type {Map<string, { value: any, expiresAt: number, timer: NodeJS.Timeout }>} */
        this._store = new Map();
    }

    /**
     * Store a value under `key` for `ttl` seconds (default 60 s).
     * Re-setting an existing key resets its timer.
     */
    set(key, value, ttl = 60) {
        // Clear any existing timer for this key
        const existing = this._store.get(key);
        if (existing) clearTimeout(existing.timer);

        const timer = setTimeout(() => this._store.delete(key), ttl * 1000);
        // Allow the process to exit even if the timer is still pending
        if (timer.unref) timer.unref();

        this._store.set(key, {
            value,
            expiresAt: Date.now() + ttl * 1000,
            timer
        });
    }

    /**
     * Return the cached value, or `undefined` on a miss / expired entry.
     */
    get(key) {
        const entry = this._store.get(key);
        if (!entry) return undefined;

        // Guard against race conditions where the timer hasn't fired yet
        if (Date.now() > entry.expiresAt) {
            clearTimeout(entry.timer);
            this._store.delete(key);
            return undefined;
        }

        return entry.value;
    }

    /**
     * Explicitly delete a single key.
     */
    del(key) {
        const entry = this._store.get(key);
        if (entry) {
            clearTimeout(entry.timer);
            this._store.delete(key);
        }
    }

    /**
     * Delete all keys whose string representation starts with `prefix`.
     * Use this for namespace-level invalidation.
     *
     * Example: cache.invalidatePrefix('properties:abc-123') removes every
     * key that was stored under that user's property namespace.
     */
    invalidatePrefix(prefix) {
        for (const key of this._store.keys()) {
            if (key.startsWith(prefix)) {
                this.del(key);
            }
        }
    }

    /** How many entries are currently alive. Useful for health-check logging. */
    get size() {
        return this._store.size;
    }

    /** Flush the entire cache. Handy in tests. */
    flush() {
        for (const entry of this._store.values()) clearTimeout(entry.timer);
        this._store.clear();
    }

    // ─── Key-building helpers ──────────────────────────────────────────────────

    /**
     * Build a namespaced cache key for a landlord-scoped resource.
     *
     * @param {string} userId    - The landlord's user ID
     * @param {string} namespace - Logical section name, e.g. "properties"
     * @param {string} [suffix]  - Optional sub-key, e.g. a record ID
     * @returns {string}
     *
     * Examples:
     *   landlordKey('u1', 'properties')          → "landlord:u1:properties"
     *   landlordKey('u1', 'properties', 'p-99')  → "landlord:u1:properties:p-99"
     */
    landlordKey(userId, namespace, suffix) {
        const base = `landlord:${userId}:${namespace}`;
        return suffix ? `${base}:${suffix}` : base;
    }

    /**
     * Invalidate all cached data for a specific landlord namespace.
     *
     * @param {string} userId
     * @param {string} namespace - e.g. "properties", "applications", "leases"
     */
    invalidateLandlord(userId, namespace) {
        this.invalidatePrefix(`landlord:${userId}:${namespace}`);
    }

    /**
     * Invalidate ALL cached data for a landlord (use after broad mutations).
     *
     * @param {string} userId
     */
    invalidateAllLandlord(userId) {
        this.invalidatePrefix(`landlord:${userId}`);
    }
}

// Export a single shared instance so the entire process uses one cache.
module.exports = new TTLCache();
