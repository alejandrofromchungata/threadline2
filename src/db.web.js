const KEY = 'threadline.db';

const empty = () => ({
  items: [],
  settings: {},
  wear_log: [],
  feedback: [],
  saved_outfits: [],
  nextId: 1,
});

let store = null;

function load() {
  if (store) return store;
  try {
    store = JSON.parse(localStorage.getItem(KEY)) || empty();
  } catch {
    store = empty();
  }
  if (!store.nextId) store.nextId = 1;
  return store;
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function getDb() {
  load();
  return Promise.resolve(store);
}

const parse = (row) => ({
  ...row,
  seasons: typeof row.seasons === 'string' ? JSON.parse(row.seasons || '[]') : row.seasons || [],
  tags: typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : row.tags || [],
});

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function listItems() {
  const db = await getDb();
  return [...db.items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(parse);
}

export async function getItem(id) {
  const db = await getDb();
  const row = db.items.find((i) => i.id === id);
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
    seasons: item.seasons || [],
    formality: item.formality ?? 3,
    tags: item.tags || [],
    price: item.price || 0,
    imageUri: item.imageUri || null,
    sourceUrl: item.sourceUrl || null,
    status: item.status || 'clean',
    wears: item.wears || 0,
    lastWorn: item.lastWorn || null,
    createdAt: new Date().toISOString(),
  };
  db.items.push(row);
  save();
  return parse(row);
}

export async function updateItem(id, patch) {
  const db = await getDb();
  const idx = db.items.findIndex((i) => i.id === id);
  if (idx < 0) return;
  db.items[idx] = { ...db.items[idx], ...patch };
  save();
}

export async function deleteItem(id) {
  const db = await getDb();
  db.items = db.items.filter((i) => i.id !== id);
  save();
}

export async function markWorn(itemIds, date) {
  const db = await getDb();
  for (const id of itemIds) {
    const item = db.items.find((i) => i.id === id);
    if (item) {
      item.wears = (item.wears || 0) + 1;
      item.status = 'dirty';
      item.lastWorn = date;
    }
  }
  save();
}

export async function washAll() {
  const db = await getDb();
  for (const item of db.items) {
    if (item.status === 'dirty' || item.status === 'laundry') item.status = 'clean';
  }
  save();
}

export async function getSetting(key, fallback = null) {
  const db = await getDb();
  return key in db.settings ? db.settings[key] : fallback;
}

export async function setSetting(key, value) {
  const db = await getDb();
  db.settings[key] = value;
  save();
}

export async function addWearLog(entry) {
  const db = await getDb();
  db.wear_log.unshift({
    id: db.nextId++,
    date: entry.date,
    occasion: entry.occasion,
    name: entry.name,
    itemIds: entry.itemIds,
    weather: entry.weather || '',
  });
  save();
}

export async function listWearLog(limit = 60) {
  const db = await getDb();
  return db.wear_log.slice(0, limit).map((r) => ({ ...r, itemIds: r.itemIds || [] }));
}

export async function addFeedback(f) {
  const db = await getDb();
  db.feedback.unshift({
    id: db.nextId++,
    ts: new Date().toISOString(),
    occasion: f.occasion,
    verdict: f.verdict,
    itemNames: f.itemNames,
  });
  save();
}

export async function recentFeedback(limit = 8) {
  const db = await getDb();
  return db.feedback.slice(0, limit).map((r) => ({ ...r, itemNames: r.itemNames || [] }));
}

export async function saveOutfit(o) {
  const db = await getDb();
  db.saved_outfits.unshift({
    id: db.nextId++,
    ts: new Date().toISOString(),
    name: o.name,
    occasion: o.occasion,
    itemIds: o.itemIds,
  });
  save();
}

export async function listSavedOutfits() {
  const db = await getDb();
  return db.saved_outfits.map((r) => ({ ...r, itemIds: r.itemIds || [] }));
}

export async function wipeAll() {
  store = empty();
  save();
}
