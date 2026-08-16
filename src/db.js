import * as SQLite from 'expo-sqlite';

let dbPromise = null;

/** Single shared connection, opened lazily. */
export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('threadline.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          brand TEXT,
          category TEXT NOT NULL,
          color TEXT,
          colorName TEXT,
          material TEXT,
          seasons TEXT,
          formality INTEGER DEFAULT 3,
          tags TEXT,
          price REAL DEFAULT 0,
          imageUri TEXT,
          sourceUrl TEXT,
          status TEXT DEFAULT 'clean',
          wears INTEGER DEFAULT 0,
          lastWorn TEXT,
          createdAt TEXT
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
        CREATE TABLE IF NOT EXISTS wear_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          occasion TEXT,
          name TEXT,
          itemIds TEXT,
          weather TEXT
        );
        CREATE TABLE IF NOT EXISTS feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts TEXT,
          occasion TEXT,
          verdict TEXT,
          itemNames TEXT
        );
        CREATE TABLE IF NOT EXISTS saved_outfits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts TEXT,
          name TEXT,
          occasion TEXT,
          itemIds TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
        CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
      `);
      // Added after the original feedback table shipped — lets the profile
      // screen show the actual reacted-to photo instead of just its name.
      try { await db.execAsync('ALTER TABLE feedback ADD COLUMN itemIds TEXT'); } catch { /* already there */ }
      return db;
    })();
  }
  return dbPromise;
}

const parse = (row) => ({
  ...row,
  seasons: JSON.parse(row.seasons || '[]'),
  tags: JSON.parse(row.tags || '[]'),
});

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ── items ─────────────────────────────────────────────── */
export async function listItems() {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM items ORDER BY createdAt DESC');
  return rows.map(parse);
}

/** Catalogue number for the detail screen ("NO. 0042") — 1 for the first
 * piece ever added, stable regardless of later inserts or deletes. */
export async function getItemNumber(id) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) as n FROM items WHERE createdAt <= (SELECT createdAt FROM items WHERE id = ?)',
    id
  );
  return row ? row.n : 1;
}

export async function getItem(id) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM items WHERE id = ?', id);
  return row ? parse(row) : null;
}

export async function insertItem(item) {
  const db = await getDb();
  const row = {
    id: item.id || newId(),
    name: item.name,
    brand: item.brand || '',
    category: item.category,
    color: item.color || '#8A8A8A',
    colorName: item.colorName || '',
    material: item.material || '',
    seasons: JSON.stringify(item.seasons || []),
    formality: item.formality ?? 3,
    tags: JSON.stringify(item.tags || []),
    price: item.price || 0,
    imageUri: item.imageUri || null,
    sourceUrl: item.sourceUrl || null,
    status: item.status || 'clean',
    wears: item.wears || 0,
    lastWorn: item.lastWorn || null,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT INTO items
      (id,name,brand,category,color,colorName,material,seasons,formality,tags,price,imageUri,sourceUrl,status,wears,lastWorn,createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    row.id, row.name, row.brand, row.category, row.color, row.colorName, row.material,
    row.seasons, row.formality, row.tags, row.price, row.imageUri, row.sourceUrl,
    row.status, row.wears, row.lastWorn, row.createdAt
  );
  return parse(row);
}

export async function updateItem(id, patch) {
  const db = await getDb();
  const clean = { ...patch };
  if (clean.seasons) clean.seasons = JSON.stringify(clean.seasons);
  if (clean.tags) clean.tags = JSON.stringify(clean.tags);
  const keys = Object.keys(clean);
  if (!keys.length) return;
  await db.runAsync(
    `UPDATE items SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
    ...keys.map((k) => clean[k]), id
  );
}

export async function deleteItem(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM items WHERE id = ?', id);
}

export async function markWorn(itemIds, date) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const id of itemIds) {
      await db.runAsync(
        'UPDATE items SET wears = wears + 1, status = ?, lastWorn = ? WHERE id = ?',
        'dirty', date, id
      );
    }
  });
}

export async function washAll() {
  const db = await getDb();
  await db.runAsync("UPDATE items SET status = 'clean' WHERE status IN ('dirty','laundry')");
}

/* ── settings ──────────────────────────────────────────── */
export async function getSetting(key, fallback = null) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}

export async function setSetting(key, value) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, JSON.stringify(value)
  );
}

/* ── wear log ──────────────────────────────────────────── */
export async function addWearLog(entry) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO wear_log (date, occasion, name, itemIds, weather) VALUES (?,?,?,?,?)',
    entry.date, entry.occasion, entry.name, JSON.stringify(entry.itemIds), entry.weather || ''
  );
}

export async function listWearLog(limit = 60) {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM wear_log ORDER BY id DESC LIMIT ?', limit);
  return rows.map((r) => ({ ...r, itemIds: JSON.parse(r.itemIds || '[]') }));
}

/* ── feedback ──────────────────────────────────────────── */
export async function addFeedback(f) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO feedback (ts, occasion, verdict, itemNames, itemIds) VALUES (?,?,?,?,?)',
    new Date().toISOString(), f.occasion, f.verdict, JSON.stringify(f.itemNames), JSON.stringify(f.itemIds || [])
  );
}

export async function recentFeedback(limit = 8) {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM feedback ORDER BY id DESC LIMIT ?', limit);
  return rows.map((r) => ({
    ...r,
    itemNames: JSON.parse(r.itemNames || '[]'),
    itemIds: JSON.parse(r.itemIds || '[]'),
  }));
}

/* ── saved outfits ─────────────────────────────────────── */
export async function saveOutfit(o) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO saved_outfits (ts, name, occasion, itemIds) VALUES (?,?,?,?)',
    new Date().toISOString(), o.name, o.occasion, JSON.stringify(o.itemIds)
  );
}

export async function listSavedOutfits() {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM saved_outfits ORDER BY id DESC');
  return rows.map((r) => ({ ...r, itemIds: JSON.parse(r.itemIds || '[]') }));
}

export async function wipeAll() {
  const db = await getDb();
  await db.execAsync(
    'DELETE FROM items; DELETE FROM settings; DELETE FROM wear_log; DELETE FROM feedback; DELETE FROM saved_outfits;'
  );
}
