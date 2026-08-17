import { getDb, getSetting, setSetting } from '../db';
import { supabase } from './supabase';

/**
 * Wardrobe sync.
 *
 * Model: last write wins, per row, using `updatedAt`. Deletes travel as
 * tombstones rather than absences, because an absent row is indistinguishable
 * from a row the other device has not seen yet — treat it as a delete and you
 * erase new work; treat it as new and you resurrect deleted work.
 *
 * Clocks: `updatedAt` comes from whichever device made the change, so two
 * phones with badly skewed clocks could resolve a conflict the "wrong" way.
 * For one person with a couple of devices that is an acceptable trade against
 * the complexity of server-assigned versions. The sync cursor itself is taken
 * from the server so it never drifts.
 */

// local column -> remote column. Everything else is dropped rather than
// guessed at, so an added local column can never break a push.
const TABLES = {
  items: {
    remote: 'items',
    localKey: 'id',
    fields: {
      id: 'id',
      name: 'name',
      brand: 'brand',
      category: 'category',
      color: 'color',
      colorName: 'color_name',
      material: 'material',
      seasons: 'seasons',
      formality: 'formality',
      tags: 'tags',
      price: 'price',
      imageUri: 'image_uri',
      sourceUrl: 'source_url',
      status: 'status',
      wears: 'wears',
      lastWorn: 'last_worn',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    },
    json: ['seasons', 'tags'],
  },
  wear_log: {
    remote: 'wear_log',
    localKey: 'uid',
    fields: {
      uid: 'id',
      date: 'date',
      occasion: 'occasion',
      name: 'name',
      itemIds: 'item_ids',
      weather: 'weather',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    },
    json: ['itemIds'],
  },
  feedback: {
    remote: 'feedback',
    localKey: 'uid',
    fields: {
      uid: 'id',
      ts: 'ts',
      occasion: 'occasion',
      verdict: 'verdict',
      itemNames: 'item_names',
      itemIds: 'item_ids',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    },
    json: ['itemNames', 'itemIds'],
  },
  saved_outfits: {
    remote: 'saved_outfits',
    localKey: 'uid',
    fields: {
      uid: 'id',
      ts: 'ts',
      name: 'name',
      occasion: 'occasion',
      itemIds: 'item_ids',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    },
    json: ['itemIds'],
  },
};

const EPOCH = '1970-01-01T00:00:00.000Z';

/**
 * Timestamps are compared as strings by SQLite, but Postgres renders a
 * timestamptz as "2026-08-17T20:00:00.123456+00:00" while JavaScript writes
 * "2026-08-17T20:00:00.123Z". Those are the same instant and compare unequal,
 * which would corrupt both conflict resolution and the sync cursor. Every
 * timestamp crossing the boundary is normalised to one canonical form.
 */
const isoField = (name) => name.endsWith('At');
const normIso = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const toRemote = (row, spec, userId) => {
  const out = { user_id: userId };
  for (const [local, remote] of Object.entries(spec.fields)) {
    let v = row[local];
    if (spec.json.includes(local)) {
      try { v = JSON.parse(v || '[]'); } catch { v = []; }
    } else if (isoField(local)) {
      v = normIso(v);
    }
    out[remote] = v ?? null;
  }
  return out;
};

const toLocal = (row, spec) => {
  const out = {};
  for (const [local, remote] of Object.entries(spec.fields)) {
    let v = row[remote];
    if (spec.json.includes(local)) v = JSON.stringify(v ?? []);
    else if (isoField(local)) v = normIso(v);
    out[local] = v ?? null;
  }
  return out;
};

/**
 * Server time, so the sync cursor never drifts with a wrong device clock.
 * Falls back to device time if the helper is not installed — a slightly skewed
 * cursor is far better than refusing to sync at all.
 */
async function serverNow() {
  try {
    const { data, error } = await supabase.rpc('now_iso');
    if (!error && data) return data;
  } catch { /* fall through */ }
  return new Date().toISOString();
}

async function pushTable(db, name, spec, userId, since) {
  const rows = await db.getAllAsync(
    `SELECT * FROM ${name} WHERE updatedAt > ? AND ${spec.localKey} IS NOT NULL`,
    since,
  );
  if (!rows.length) return 0;
  const payload = rows.map((r) => toRemote(r, spec, userId));
  const { error } = await supabase.from(spec.remote).upsert(payload, { onConflict: 'user_id,id' });
  if (error) throw new Error(`push ${name}: ${error.message}`);
  return rows.length;
}

async function pullTable(db, name, spec, since) {
  const { data, error } = await supabase
    .from(spec.remote)
    .select('*')
    .gt('updated_at', since);
  if (error) throw new Error(`pull ${name}: ${error.message}`);
  if (!data?.length) return 0;

  const cols = Object.keys(spec.fields);
  const placeholders = cols.map(() => '?').join(',');
  // Only overwrite when the incoming row is genuinely newer, so a pull can
  // never discard an edit made locally since the last sync.
  const setters = cols
    .filter((c) => c !== spec.localKey)
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');

  await db.withTransactionAsync(async () => {
    for (const remote of data) {
      const row = toLocal(remote, spec);
      await db.runAsync(
        `INSERT INTO ${name} (${cols.join(',')}) VALUES (${placeholders})
         ON CONFLICT(${spec.localKey}) DO UPDATE SET ${setters}
         WHERE excluded.updatedAt > ${name}.updatedAt`,
        ...cols.map((c) => row[c]),
      );
    }
  });
  return data.length;
}

async function syncSettings(userId, since) {
  const db = await getDb();
  const local = await db.getAllAsync('SELECT key, value, updatedAt FROM settings WHERE updatedAt > ?', since);
  if (local.length) {
    const payload = local.map((r) => ({
      user_id: userId,
      key: r.key,
      // Stored as a JSON string locally; the column is jsonb.
      value: (() => { try { return JSON.parse(r.value); } catch { return null; } })(),
      updated_at: normIso(r.updatedAt),
    }));
    const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id,key' });
    if (error) throw new Error(`push settings: ${error.message}`);
  }

  const { data, error } = await supabase.from('user_settings').select('*').gt('updated_at', since);
  if (error) throw new Error(`pull settings: ${error.message}`);
  for (const r of data ?? []) {
    await db.runAsync(
      `INSERT INTO settings (key, value, updatedAt) VALUES (?,?,?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
       WHERE excluded.updatedAt > settings.updatedAt`,
      r.key, JSON.stringify(r.value), normIso(r.updated_at),
    );
  }
  return (data ?? []).length + local.length;
}

let inFlight = null;

/**
 * Run a full sync. Concurrent calls share one run rather than racing, since
 * both app-foreground and post-save triggers can fire together.
 *
 * `uploadOnly` skips the pull entirely — used for the very first sync of an
 * existing wardrobe, so a bug cannot delete anything before the data is safe
 * on the server.
 */
export async function syncNow({ uploadOnly = false } = {}) {
  if (!supabase) return { skipped: 'not-configured' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { skipped: 'signed-out' };
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const userId = session.user.id;
    const db = await getDb();
    const since = (await getSetting('lastSyncAt', null)) || EPOCH;
    const stamp = await serverNow();
    let pushed = 0;
    let pulled = 0;

    try {
      for (const [name, spec] of Object.entries(TABLES)) {
        pushed += await pushTable(db, name, spec, userId, since);
      }
      if (!uploadOnly) {
        for (const [name, spec] of Object.entries(TABLES)) {
          pulled += await pullTable(db, name, spec, since);
        }
      }
      pushed += await syncSettings(userId, since);

      // Only advance the cursor once everything succeeded. A partial sync
      // re-runs from the same point rather than skipping the rows it missed.
      await setSetting('lastSyncAt', stamp);
      return { pushed, pulled, at: stamp };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Has this install ever completed a sync? Drives the upload-only first run. */
export async function hasSyncedBefore() {
  return !!(await getSetting('lastSyncAt', null));
}
