// Stockage local (IndexedDB) partagé entre la page et le service worker.
const DB_NAME = 'classeur-wa';
const DB_VERSION = 1;
const STORE = 'items';
const URL_RE = /https?:\/\/[^\s<>"]+/i;

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { _dbPromise = null; reject(req.error); };
  });
  return _dbPromise;
}

async function dbPut(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function dbAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function extractUrl(text) {
  const m = (text || '').match(URL_RE);
  return m ? m[0].replace(/[).,;!?»]+$/, '') : '';
}

function kindOf(item) {
  const types = (item.files || []).map((f) => f.type || '');
  if (types.some((t) => t.startsWith('image/'))) return 'image';
  if (types.some((t) => t.startsWith('video/'))) return 'video';
  if (types.some((t) => t.startsWith('audio/'))) return 'audio';
  if (types.length) return 'doc';
  if (item.url) return 'lien';
  return 'texte';
}

// Construit un élément à partir de ce que reçoit le partage Android.
function makeItem({ title = '', text = '', url = '', files = [] } = {}) {
  title = String(title || '').trim();
  text = String(text || '').trim();
  url = String(url || '').trim();
  // On n'accepte que des liens http(s) comme lien cliquable.
  if (url && !/^https?:\/\//i.test(url)) {
    text = [text, url].filter(Boolean).join('\n');
    url = '';
  }
  if (!url) url = extractUrl(text);
  const now = Date.now();
  const item = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title,
    text,
    url,
    files: files.map((f) => ({
      name: f.name || 'fichier',
      type: f.type || 'application/octet-stream',
      size: f.size || 0,
      blob: f,
    })),
    tags: [],
    note: '',
    pinned: false,
  };
  item.kind = kindOf(item);
  return item;
}
