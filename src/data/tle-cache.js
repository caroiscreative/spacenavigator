
const DB_NAME    = 'SpaceNavigatorTLEs';
const DB_VERSION = 1;
const STORE_NAME = 'tle_groups';

export const TTL = {
  active:  6  * 60 * 60 * 1000,   //  6 hours
  debris:  24 * 60 * 60 * 1000,   // 24 hours
  default: 6  * 60 * 60 * 1000,   //  6 hours (fallback)
};

export function openTLECache() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'group' });
      }
    };

    req.onsuccess  = (e) => resolve(new TLECache(e.target.result));
    req.onerror    = ()  => reject(new Error('[TLECache] Failed to open IndexedDB: ' + req.error));
  });
}

class TLECache {
  constructor(db) {
    this._db = db;
  }

  get(group) {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(group);

      req.onsuccess = () => {
        const row = req.result;
        if (!row) { resolve(null); return; }

        const ttl     = TTL[group] ?? TTL.default;
        const age     = Date.now() - row.timestamp;
        const expired = age > ttl;

        if (expired) {
          console.debug(`[TLECache] ${group} cache expired (age ${(age/3600000).toFixed(1)}h)`);
          resolve(null);
        } else {
          console.debug(`[TLECache] ${group} cache hit — ${row.tles.length} sats, age ${(age/60000).toFixed(0)}min`);
          resolve(row.tles);
        }
      };

      req.onerror = () => reject(new Error('[TLECache] get failed: ' + req.error));
    });
  }

  set(group, tles) {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put({ group, tles, timestamp: Date.now() });

      req.onsuccess = () => {
        console.debug(`[TLECache] stored ${tles.length} sats for group '${group}'`);
        resolve();
      };
      req.onerror   = () => reject(new Error('[TLECache] set failed: ' + req.error));
    });
  }

  clear() {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(new Error('[TLECache] clear failed: ' + req.error));
    });
  }
}
