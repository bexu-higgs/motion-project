// IndexedDB кэші: алғашқы іске қосуда жасалған текстуралар мен дыбыстарды сақтайды,
// келесі жолы ойын әлдеқайда тез жүктеледі. Қате болса — үнсіз генерацияға қайтамыз.
export const CACHE_VER = 'v5';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      if (!window.indexedDB) return res(null);
      const rq = indexedDB.open('ottyaral', 1);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore('kv'); } catch (e) { /* */ } };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
      setTimeout(() => res(null), 3000);
    } catch (e) { res(null); }
  });
  return dbp;
}

export async function cacheGet(key) {
  const db = await open();
  if (!db) return null;
  return new Promise((res) => {
    try {
      const tx = db.transaction('kv', 'readonly');
      const rq = tx.objectStore('kv').get(CACHE_VER + ':' + key);
      rq.onsuccess = () => res(rq.result ?? null);
      rq.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}

export async function cacheSet(key, value) {
  const db = await open();
  if (!db) return false;
  return new Promise((res) => {
    try {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, CACHE_VER + ':' + key);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
      tx.onabort = () => res(false);
    } catch (e) { res(false); }
  });
}

// Ескі нұсқадағы жазбаларды тазалау
export async function cachePrune() {
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction('kv', 'readwrite');
    const st = tx.objectStore('kv');
    const rq = st.openCursor();
    rq.onsuccess = () => {
      const c = rq.result;
      if (!c) return;
      if (typeof c.key === 'string' && !c.key.startsWith(CACHE_VER + ':')) c.delete();
      c.continue();
    };
  } catch (e) { /* */ }
}
