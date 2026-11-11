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

export function saveHallazgo(uuid, itemUuid, idHallazgoDef, hallazgoLibre, tipoLibre) {
  try {
    getDatabase().runSync(
      `INSERT OR IGNORE INTO aud_resultado_hallazgo
         (uuid, id_resultado_item_uuid, id_hallazgo_def, hallazgo_libre, tipo_libre, pending_sync)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [uuid, itemUuid, idHallazgoDef ?? null, hallazgoLibre ?? null, tipoLibre ?? null]
    );
  } catch (_) {}
}

export function updateHallazgo(uuid, hallazgoLibre, tipoLibre) {
  try {
    getDatabase().runSync(
      `UPDATE aud_resultado_hallazgo
       SET hallazgo_libre = ?, tipo_libre = ?, pending_sync = 1
       WHERE uuid = ?`,
      [hallazgoLibre ?? null, tipoLibre ?? null, uuid]
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

// Quita de la copia local un hallazgo que ya no existe en el servidor
// (p. ej. eliminado desde la web) junto con sus evidencias pendientes.
// SQLite local no tiene foreign_keys activo, así que se borran explícitamente.
// Devuelve las rutas de archivos locales que quedaron sin uso.
export function eliminarHallazgoLocal(uuid) {
  try {
    const db = getDatabase();
    const archivos = db
      .getAllSync(
        `SELECT file_local_path FROM aud_hallazgo_evidencia
         WHERE id_resultado_hallazgo_uuid = ? AND file_local_path IS NOT NULL`,
        [uuid]
      )
      .map((r) => r.file_local_path);
    db.runSync(`DELETE FROM aud_hallazgo_evidencia WHERE id_resultado_hallazgo_uuid = ?`, [uuid]);
    db.runSync(`DELETE FROM aud_resultado_hallazgo WHERE uuid = ?`, [uuid]);
    return archivos;
  } catch (_) {
    return [];
  }
}

// ── Reintentos de subida de evidencias ────────────────────────────────────────
export const MAX_INTENTOS_EVIDENCIA = 6;
const BACKOFF_BASE_MS = 60 * 1000;      // 1 min
const BACKOFF_MAX_MS = 30 * 60 * 1000;  // 30 min

// Registra un intento fallido: suma 1, guarda el error y calcula la espera
// creciente (1, 2, 4, 8, 16, 30 min) antes del próximo intento.
export function marcarEvidenciaFallida(uuid, mensaje) {
  try {
    const db = getDatabase();
    const row = db.getFirstSync(
      `SELECT intentos FROM aud_hallazgo_evidencia WHERE uuid = ?`,
      [uuid]
    );
    const intentos = (row?.intentos ?? 0) + 1;
    const espera = Math.min(BACKOFF_BASE_MS * 2 ** (intentos - 1), BACKOFF_MAX_MS);
    db.runSync(
      `UPDATE aud_hallazgo_evidencia
       SET intentos = ?, proximo_intento = ?, ultimo_error = ?, pending_sync = 1
       WHERE uuid = ?`,
      [intentos, new Date(Date.now() + espera).toISOString(), mensaje ?? null, uuid]
    );
  } catch (_) {}
}

// Marca una evidencia como imposible de recuperar (archivo local perdido o vacío).
// Queda pendiente y visible con el error, pero no se vuelve a intentar sola.
export function marcarEvidenciaIrrecuperable(uuid, mensaje) {
  try {
    getDatabase().runSync(
      `UPDATE aud_hallazgo_evidencia
       SET intentos = ?, proximo_intento = NULL, ultimo_error = ?, pending_sync = 1
       WHERE uuid = ?`,
      [MAX_INTENTOS_EVIDENCIA, mensaje ?? null, uuid]
    );
  } catch (_) {}
}

export function marcarEvidenciaSubida(uuid) {
  try {
    getDatabase().runSync(
      `UPDATE aud_hallazgo_evidencia
       SET pending_sync = 0, file_local_path = NULL, intentos = 0,
           proximo_intento = NULL, ultimo_error = NULL
       WHERE uuid = ?`,
      [uuid]
    );
  } catch (_) {}
}

export function descartarEvidencia(uuid) {
  try {
    getDatabase().runSync(`DELETE FROM aud_hallazgo_evidencia WHERE uuid = ?`, [uuid]);
  } catch (_) {}
}

// Evidencias de la auditoría que aún no están en el servidor (para mostrarlas
// como pendientes al recargar la pantalla).
export function getEvidenciasPendientes(idAudProyecto) {
  try {
    return getDatabase().getAllSync(
      `SELECT ev.uuid, ev.id_resultado_hallazgo_uuid, ev.tipo, ev.file_local_path,
              ev.descripcion, ev.intentos, ev.ultimo_error
       FROM aud_hallazgo_evidencia ev
       JOIN aud_resultado_hallazgo h ON h.uuid = ev.id_resultado_hallazgo_uuid
       JOIN aud_resultado_item i ON i.uuid = h.id_resultado_item_uuid
       WHERE i.id_aud_proyecto = ? AND ev.pending_sync = 1 AND ev.deleted_at IS NULL`,
      [idAudProyecto]
    );
  } catch (_) {
    return [];
  }
}

// Todas las rutas de archivo que la cola local todavía necesita (de cualquier auditoría).
export function getRutasEvidenciasEnCola() {
  try {
    return new Set(
      getDatabase()
        .getAllSync(`SELECT file_local_path FROM aud_hallazgo_evidencia WHERE file_local_path IS NOT NULL`)
        .map((r) => r.file_local_path)
    );
  } catch (_) {
    return null; // si no se pudo leer la cola, no se limpia nada
  }
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
