import { getDatabase } from '../database/database';

const now = () => new Date().toISOString();

export function saveResultadoItem(uuid, idAudProyecto, idNivel2, conforme, observaciones, estado) {
  try {
    getDatabase().runSync(
      `INSERT OR REPLACE INTO aud_resultado_item
         (uuid, id_aud_proyecto, id_nivel2, conforme, observaciones, estado, updated_at, pending_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [uuid, idAudProyecto, idNivel2, conforme ?? null, observaciones ?? '', estado ?? 'SIN_AUDITAR', now()]
    );
  } catch (_) {}
}

export function saveResultadoItemRef(uuid, idAudProyecto, idNivel2, conforme, observaciones, estado) {
  try {
    getDatabase().runSync(
      `INSERT OR IGNORE INTO aud_resultado_item
         (uuid, id_aud_proyecto, id_nivel2, conforme, observaciones, estado, pending_sync)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [uuid, idAudProyecto, idNivel2, conforme ?? null, observaciones ?? '', estado ?? 'SIN_AUDITAR']
    );
  } catch (_) {}
}

export function saveHallazgo(uuid, itemUuid, idHallazgoDef, hallazgoLibre) {
  try {
    getDatabase().runSync(
      `INSERT OR IGNORE INTO aud_resultado_hallazgo
         (uuid, id_resultado_item_uuid, id_hallazgo_def, hallazgo_libre, pending_sync)
       VALUES (?, ?, ?, ?, 1)`,
      [uuid, itemUuid, idHallazgoDef ?? null, hallazgoLibre ?? null]
    );
  } catch (_) {}
}

export function saveHallazgoRef(uuid, itemUuid) {
  try {
    getDatabase().runSync(
      `INSERT OR IGNORE INTO aud_resultado_hallazgo
         (uuid, id_resultado_item_uuid, pending_sync)
       VALUES (?, ?, 0)`,
      [uuid, itemUuid]
    );
  } catch (_) {}
}

export function deleteHallazgoOffline(uuid, itemUuid, idAudProyecto, idNivel2) {
  try {
    const db = getDatabase();
    const existing = db.getFirstSync(
      `SELECT pending_sync, deleted_at FROM aud_resultado_hallazgo WHERE uuid = ?`,
      [uuid]
    );
    if (existing) {
      if (existing.pending_sync === 1 && existing.deleted_at === null) {
        db.runSync(`DELETE FROM aud_resultado_hallazgo WHERE uuid = ?`, [uuid]);
      } else {
        db.runSync(
          `UPDATE aud_resultado_hallazgo SET deleted_at = ?, pending_sync = 1 WHERE uuid = ?`,
          [now(), uuid]
        );
      }
    } else {
      // Solo existe en el servidor → insertar tombstone con refs de FK
      db.runSync(
        `INSERT OR IGNORE INTO aud_resultado_item
           (uuid, id_aud_proyecto, id_nivel2, estado, pending_sync)
         VALUES (?, ?, ?, 'SIN_AUDITAR', 0)`,
        [itemUuid, idAudProyecto, idNivel2]
      );
      db.runSync(
        `INSERT INTO aud_resultado_hallazgo
           (uuid, id_resultado_item_uuid, deleted_at, pending_sync)
         VALUES (?, ?, ?, 1)`,
        [uuid, itemUuid, now()]
      );
    }
  } catch (_) {}
}

export function saveEvidencia(uuid, hallazgoUuid, tipo, fileLocalPath, nombre) {
  try {
    getDatabase().runSync(
      `INSERT OR IGNORE INTO aud_hallazgo_evidencia
         (uuid, id_resultado_hallazgo_uuid, tipo, file_local_path, descripcion, pending_sync)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [uuid, hallazgoUuid, tipo ?? 'IMAGEN', fileLocalPath ?? null, nombre ?? null]
    );
  } catch (_) {}
}

export function deleteEvidenciaOffline(uuid, hallazgoUuid, itemUuid, idAudProyecto, idNivel2) {
  try {
    const db = getDatabase();
    const existing = db.getFirstSync(
      `SELECT pending_sync, deleted_at FROM aud_hallazgo_evidencia WHERE uuid = ?`,
      [uuid]
    );
    if (existing) {
      if (existing.pending_sync === 1 && existing.deleted_at === null) {
        db.runSync(`DELETE FROM aud_hallazgo_evidencia WHERE uuid = ?`, [uuid]);
      } else {
        db.runSync(
          `UPDATE aud_hallazgo_evidencia SET deleted_at = ?, pending_sync = 1 WHERE uuid = ?`,
          [now(), uuid]
        );
      }
    } else {
      // Solo existe en el servidor → insertar tombstone con refs de FK
      db.runSync(
        `INSERT OR IGNORE INTO aud_resultado_item
           (uuid, id_aud_proyecto, id_nivel2, estado, pending_sync)
         VALUES (?, ?, ?, 'SIN_AUDITAR', 0)`,
        [itemUuid, idAudProyecto, idNivel2]
      );
      db.runSync(
        `INSERT OR IGNORE INTO aud_resultado_hallazgo
           (uuid, id_resultado_item_uuid, pending_sync)
         VALUES (?, ?, 0)`,
        [hallazgoUuid, itemUuid]
      );
      db.runSync(
        `INSERT INTO aud_hallazgo_evidencia
           (uuid, id_resultado_hallazgo_uuid, deleted_at, pending_sync)
         VALUES (?, ?, ?, 1)`,
        [uuid, hallazgoUuid, now()]
      );
    }
  } catch (_) {}
}

export function saveAcompanante(idAudProyecto, nombre, firmaBase64) {
  try {
    getDatabase().runSync(
      `INSERT OR REPLACE INTO aud_acompanante
         (id_aud_proyecto, nombre_acompanante, firma_base64, pending_sync)
       VALUES (?, ?, ?, 1)`,
      [idAudProyecto, nombre, firmaBase64]
    );
  } catch (_) {}
}

export function getPendingCount(idAudProyecto) {
  try {
    const row = getDatabase().getFirstSync(
      `SELECT (
        SELECT COUNT(*) FROM aud_resultado_item
        WHERE id_aud_proyecto = ? AND pending_sync = 1
      ) + (
        SELECT COUNT(*) FROM aud_resultado_hallazgo
        WHERE pending_sync = 1
          AND id_resultado_item_uuid IN (
            SELECT uuid FROM aud_resultado_item WHERE id_aud_proyecto = ?
          )
      ) + (
        SELECT COUNT(*) FROM aud_hallazgo_evidencia
        WHERE pending_sync = 1
          AND id_resultado_hallazgo_uuid IN (
            SELECT uuid FROM aud_resultado_hallazgo
            WHERE id_resultado_item_uuid IN (
              SELECT uuid FROM aud_resultado_item WHERE id_aud_proyecto = ?
            )
          )
      ) + (
        SELECT COUNT(*) FROM aud_acompanante
        WHERE id_aud_proyecto = ? AND pending_sync = 1
      ) AS total`,
      [idAudProyecto, idAudProyecto, idAudProyecto, idAudProyecto]
    );
    return row?.total ?? 0;
  } catch (_) {
    return 0;
  }
}
