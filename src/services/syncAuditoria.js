import { getDatabase } from '../database/database';
import { upsertResultadoItem, addHallazgo, deleteHallazgo } from '../api/auditoria';
import { uploadEvidencia, deleteEvidencia } from '../api/evidencia';
import { logError } from './errorLogger';
import { getPendingCount } from './offlineStore';

export async function syncPendingData(idAudProyecto) {
  const db = getDatabase();

  // 1. Items pendientes
  const items = db.getAllSync(
    `SELECT uuid, id_nivel2, conforme, observaciones, estado
     FROM aud_resultado_item
     WHERE id_aud_proyecto = ? AND pending_sync = 1 AND deleted_at IS NULL`,
    [idAudProyecto]
  );
  for (const item of items) {
    try {
      await upsertResultadoItem(idAudProyecto, item.uuid, {
        uuid: item.uuid,
        id_aud_proyecto: idAudProyecto,
        id_nivel2: item.id_nivel2,
        conforme: item.conforme,
        observaciones: item.observaciones,
        estado: item.estado,
      });
      db.runSync(
        `UPDATE aud_resultado_item SET pending_sync = 0 WHERE uuid = ?`,
        [item.uuid]
      );
    } catch (e) {
      logError('sync', 'upsertResultadoItem', e, true);
    }
  }

  // 2. Hallazgos nuevos
  const hallazgos = db.getAllSync(
    `SELECT h.uuid, h.id_resultado_item_uuid, h.id_hallazgo_def, h.hallazgo_libre
     FROM aud_resultado_hallazgo h
     JOIN aud_resultado_item i ON i.uuid = h.id_resultado_item_uuid
     WHERE i.id_aud_proyecto = ? AND h.pending_sync = 1 AND h.deleted_at IS NULL`,
    [idAudProyecto]
  );
  for (const h of hallazgos) {
    try {
      await addHallazgo(idAudProyecto, h.id_resultado_item_uuid, {
        uuid: h.uuid,
        id_hallazgo_def: h.id_hallazgo_def,
        hallazgo_libre: h.hallazgo_libre,
      });
      db.runSync(
        `UPDATE aud_resultado_hallazgo SET pending_sync = 0 WHERE uuid = ?`,
        [h.uuid]
      );
    } catch (e) {
      logError('sync', 'addHallazgo', e, true);
    }
  }

  // 3. Evidencias nuevas
  const evidencias = db.getAllSync(
    `SELECT ev.uuid, ev.id_resultado_hallazgo_uuid, ev.tipo, ev.file_local_path, ev.descripcion
     FROM aud_hallazgo_evidencia ev
     JOIN aud_resultado_hallazgo h ON h.uuid = ev.id_resultado_hallazgo_uuid
     JOIN aud_resultado_item i ON i.uuid = h.id_resultado_item_uuid
     WHERE i.id_aud_proyecto = ? AND ev.pending_sync = 1 AND ev.deleted_at IS NULL`,
    [idAudProyecto]
  );
  for (const ev of evidencias) {
    try {
      await uploadEvidencia(
        idAudProyecto,
        ev.id_resultado_hallazgo_uuid,
        ev.uuid,
        ev.file_local_path,
        ev.tipo,
        ev.descripcion
      );
      db.runSync(
        `UPDATE aud_hallazgo_evidencia SET pending_sync = 0, file_local_path = NULL WHERE uuid = ?`,
        [ev.uuid]
      );
    } catch (e) {
      logError('sync', 'uploadEvidencia', e, true);
    }
  }

  // 4. Eliminaciones de evidencias
  const evDeletes = db.getAllSync(
    `SELECT ev.uuid, ev.id_resultado_hallazgo_uuid
     FROM aud_hallazgo_evidencia ev
     JOIN aud_resultado_hallazgo h ON h.uuid = ev.id_resultado_hallazgo_uuid
     JOIN aud_resultado_item i ON i.uuid = h.id_resultado_item_uuid
     WHERE i.id_aud_proyecto = ? AND ev.pending_sync = 1 AND ev.deleted_at IS NOT NULL`,
    [idAudProyecto]
  );
  for (const ev of evDeletes) {
    try {
      await deleteEvidencia(idAudProyecto, ev.id_resultado_hallazgo_uuid, ev.uuid);
      db.runSync(`DELETE FROM aud_hallazgo_evidencia WHERE uuid = ?`, [ev.uuid]);
    } catch (e) {
      logError('sync', 'deleteEvidencia', e, true);
    }
  }

  // 5. Eliminaciones de hallazgos
  const hallazgoDeletes = db.getAllSync(
    `SELECT h.uuid, h.id_resultado_item_uuid
     FROM aud_resultado_hallazgo h
     JOIN aud_resultado_item i ON i.uuid = h.id_resultado_item_uuid
     WHERE i.id_aud_proyecto = ? AND h.pending_sync = 1 AND h.deleted_at IS NOT NULL`,
    [idAudProyecto]
  );
  for (const h of hallazgoDeletes) {
    try {
      await deleteHallazgo(idAudProyecto, h.id_resultado_item_uuid, h.uuid);
      db.runSync(`DELETE FROM aud_resultado_hallazgo WHERE uuid = ?`, [h.uuid]);
    } catch (e) {
      logError('sync', 'deleteHallazgo', e, true);
    }
  }

  return getPendingCount(idAudProyecto);
}
