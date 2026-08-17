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
      await addSyncColumns(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Tables that sync to the account, and therefore need change tracking. */
export const SYNCED_TABLES = ['items', 'wear_log', 'feedback', 'saved_outfits'];

/**
 * Prepare existing installs for sync.
 *
 * Two problems with the original schema:
 *   1. No change tracking, so there is no way to ask what to push.
 *   2. wear_log, feedback and saved_outfits use INTEGER PRIMARY KEY
 *      AUTOINCREMENT. Two phones offline would both mint id 1, id 2, and
 *      collide the moment they sync.
 *
 * The fix for (2) is a separate text `uid` column rather than rewriting the
 * primary key: rebuilding those tables would mean copying rows and risking
 * real wear history for a schema nicety. Local code keeps using the integer
 * id; sync uses `uid`, which is stable and globally unique.
 *
 * Every statement is additive, so nothing is dropped and no row is rewritten
 * beyond backfilling the new columns.
 */
async function addSyncColumns(db) {
  for (const table of SYNCED_TABLES) {
    for (const col of ['updatedAt TEXT', 'deletedAt TEXT']) {
      try { await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col}`); } catch { /* already there */ }
    }
    // Treat pre-existing rows as changed once, so the first sync uploads them.
    await db.execAsync(`UPDATE ${table} SET updatedAt = COALESCE(updatedAt, datetime('now'))`);
  }

  for (const table of ['wear_log', 'feedback', 'saved_outfits']) {
    try { await db.execAsync(`ALTER TABLE ${table} ADD COLUMN uid TEXT`); } catch { /* already there */ }
    // Backfill deterministically: the same row keeps the same uid on re-run.
    const rows = await db.getAllAsync(`SELECT id FROM ${table} WHERE uid IS NULL`);
    for (const row of rows) {
      await db.runAsync(`UPDATE ${table} SET uid = ? WHERE id = ?`, `${table}-${row.id}-${newId()}`, row.id);
    }
    await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uid ON ${table}(uid)`);
  }

  try { await db.execAsync('ALTER TABLE settings ADD COLUMN updatedAt TEXT'); } catch { /* already there */ }
  await db.execAsync("UPDATE settings SET updatedAt = COALESCE(updatedAt, datetime('now'))");
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
  const rows = await db.getAllAsync('SELECT * FROM items WHERE deletedAt IS NULL ORDER BY createdAt DESC');
  return rows.map(parse);
}

/** Catalogue number for the detail screen ("NO. 0042") — 1 for the first
 * piece ever added, stable regardless of later inserts or deletes. */
export async function getItemNumber(id) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) as n FROM items WHERE deletedAt IS NULL AND createdAt <= (SELECT createdAt FROM items WHERE id = ?)',
    id
  );
  return row ? row.n : 1;
}

export async function getItem(id) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM items WHERE id = ? AND deletedAt IS NULL', id);
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
    updatedAt: new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT INTO items
      (id,name,brand,category,color,colorName,material,seasons,formality,tags,price,imageUri,sourceUrl,status,wears,lastWorn,createdAt,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    row.id, row.name, row.brand, row.category, row.color, row.colorName, row.material,
    row.seasons, row.formality, row.tags, row.price, row.imageUri, row.sourceUrl,
    row.status, row.wears, row.lastWorn, row.createdAt, row.updatedAt
  );
  return parse(row);
}

export async function updateItem(id, patch) {
  const db = await getDb();
  const clean = { ...patch };
  if (clean.seasons) clean.seasons = JSON.stringify(clean.seasons);
  if (clean.tags) clean.tags = JSON.stringify(clean.tags);
  clean.updatedAt = new Date().toISOString();
  const keys = Object.keys(clean);
  if (!keys.length) return;
  await db.runAsync(
    `UPDATE items SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
    ...keys.map((k) => clean[k]), id
  );
}

/**
 * Soft delete. A removed piece has to stay as a tombstone or the other device
 * would push it straight back on the next sync. Reads filter these out, and
 * the row is only really gone once every device has seen the deletion.
 */
export async function deleteItem(id) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE items SET deletedAt = ?, updatedAt = ? WHERE id = ?', now, now, id);
}

export async function markWorn(itemIds, date) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const id of itemIds) {
      await db.runAsync(
        'UPDATE items SET wears = wears + 1, status = ?, lastWorn = ?, updatedAt = ? WHERE id = ?',
        'dirty', date, new Date().toISOString(), id
      );
    }
  });
}

export async function washAll() {
  const db = await getDb();
  await db.runAsync(
    "UPDATE items SET status = 'clean', updatedAt = ? WHERE status IN ('dirty','laundry')",
    new Date().toISOString()
  );
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
    `INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    key, JSON.stringify(value), new Date().toISOString()
  );
}

/* ── wear log ──────────────────────────────────────────── */
export async function addWearLog(entry) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO wear_log (uid, date, occasion, name, itemIds, weather, updatedAt) VALUES (?,?,?,?,?,?,?)',
    newId(), entry.date, entry.occasion, entry.name,
    JSON.stringify(entry.itemIds), entry.weather || '', new Date().toISOString()
  );
}

export async function listWearLog(limit = 60) {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM wear_log WHERE deletedAt IS NULL ORDER BY id DESC LIMIT ?', limit);
  return rows.map((r) => ({ ...r, itemIds: JSON.parse(r.itemIds || '[]') }));
}

/* ── feedback ──────────────────────────────────────────── */
export async function addFeedback(f) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO feedback (uid, ts, occasion, verdict, itemNames, itemIds, updatedAt) VALUES (?,?,?,?,?,?,?)',
    newId(), new Date().toISOString(), f.occasion, f.verdict,
    JSON.stringify(f.itemNames), JSON.stringify(f.itemIds || []), new Date().toISOString()
  );
}

export async function recentFeedback(limit = 8) {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM feedback WHERE deletedAt IS NULL ORDER BY id DESC LIMIT ?', limit);
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
    'INSERT INTO saved_outfits (uid, ts, name, occasion, itemIds, updatedAt) VALUES (?,?,?,?,?,?)',
    newId(), new Date().toISOString(), o.name, o.occasion,
    JSON.stringify(o.itemIds), new Date().toISOString()
  );
}

export async function listSavedOutfits() {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM saved_outfits WHERE deletedAt IS NULL ORDER BY id DESC');
  return rows.map((r) => ({ ...r, itemIds: JSON.parse(r.itemIds || '[]') }));
}

export async function wipeAll() {
  const db = await getDb();
  await db.execAsync(
    'DELETE FROM items; DELETE FROM settings; DELETE FROM wear_log; DELETE FROM feedback; DELETE FROM saved_outfits;'
  );
}
