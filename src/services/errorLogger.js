import Constants from 'expo-constants';
import { getDatabase } from '../database/database';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const MAX_LOGS = 500;
const MAX_AGE_DAYS = 30;

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function sanitize(str) {
  return (str ?? '').replace(/Bearer\s+[A-Za-z0-9\-_.]+/g, '[TOKEN]');
}

function _autoClean(db) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
    db.runSync(`DELETE FROM error_log WHERE timestamp < ? AND synced = 1`, [cutoff.toISOString()]);

    const row = db.getFirstSync(`SELECT COUNT(*) as cnt FROM error_log`);
    if (row?.cnt > MAX_LOGS) {
      db.runSync(
        `DELETE FROM error_log WHERE id IN (
           SELECT id FROM error_log ORDER BY timestamp ASC LIMIT ?
         )`,
        [row.cnt - MAX_LOGS]
      );
    }
  } catch (_) {}
}

export async function logError(screen, action, error, isOnline = false) {
  try {
    const db = getDatabase();
    db.runSync(
      `INSERT INTO error_log
         (uuid, timestamp, screen, action, error_message, error_stack, is_online, synced, app_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        generateUUID(),
        new Date().toISOString(),
        screen,
        action,
        sanitize(error?.message ?? String(error)),
        sanitize(error?.stack ?? null),
        isOnline ? 1 : 0,
        APP_VERSION,
      ]
    );
    _autoClean(db);
  } catch (_) {}
}

export async function getPendingLogs() {
  try {
    return getDatabase().getAllSync(
      `SELECT uuid, timestamp, screen, action, error_message, error_stack, is_online, app_version
       FROM error_log
       WHERE synced = 0
       ORDER BY timestamp ASC
       LIMIT 100`
    );
  } catch (_) {
    return [];
  }
}

export async function markAsSynced(uuids) {
  if (!uuids?.length) return;
  try {
    const placeholders = uuids.map(() => '?').join(',');
    getDatabase().runSync(
      `UPDATE error_log SET synced = 1 WHERE uuid IN (${placeholders})`,
      uuids
    );
  } catch (_) {}
}

export function isNetworkError(error) {
  return (
    error?.name === 'AbortError' ||
    Boolean(error?.message?.match(/network request failed|failed to fetch/i))
  );
}
