/**
 * Tiny in-memory TTL cache. Good enough for a single-process Node server
 * proxying free financial APIs — keeps us under every provider's rate cap.
 */
class TTLCache {
  constructor(defaultTtlMs = 15 * 60 * 1000) {
    this.store = new Map();
    this.defaultTtl = defaultTtlMs;
  }
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) { this.store.delete(key); return null; }
    return entry.value;
  }
  set(key, value, ttlMs) {
    this.store.set(key, { value, expires: Date.now() + (ttlMs ?? this.defaultTtl) });
  }
  async wrap(key, ttlMs, producer) {
    const cached = this.get(key);
    if (cached !== null) return cached;
    const value = await producer();
    this.set(key, value, ttlMs);
    return value;
  }
}

module.exports = { TTLCache };
