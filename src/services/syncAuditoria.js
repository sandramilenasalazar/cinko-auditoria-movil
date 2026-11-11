import { getDatabase } from '../database/database';
import { upsertResultadoItem, addHallazgo, deleteHallazgo, upsertAcompanante } from '../api/auditoria';
import { uploadEvidencia, deleteEvidencia } from '../api/evidencia';
import { logError } from './errorLogger';
import {
  getPendingCount,
  MAX_INTENTOS_EVIDENCIA,
  marcarEvidenciaFallida,
  marcarEvidenciaIrrecuperable,
  marcarEvidenciaSubida,
  descartarEvidencia,
  eliminarHallazgoLocal,
} from './offlineStore';
import { verificarArchivoLocal, borrarCopiaPersistente } from './evidenciaFiles';

const TIPOS_LIBRE = ['MANTENIMIENTO', 'NORMA'];

// Evita dos sincronizaciones al mismo tiempo (reconexión + temporizador).
let syncEnCurso = null;

// Hallazgos que el servidor rechazó con 409 ("uuid ya existe en otro ítem").
// Es un error de datos: reintentar no lo arregla, así que no se reenvían en
// esta sesión (se vuelve a intentar al reabrir la app y queda en el log).
const hallazgosConflicto = new Set();

export function syncPendingData(idAudProyecto) {
  if (!syncEnCurso) {
    syncEnCurso = doSync(idAudProyecto).finally(() => { syncEnCurso = null; });
  }
  return syncEnCurso;
}

async function doSync(idAudProyecto) {
  const db = getDatabase();
  const evidenciasFallidas = [];
  const hallazgosEliminados = [];

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
    `SELECT h.uuid, h.id_resultado_item_uuid, h.id_hallazgo_def, h.hallazgo_libre, h.tipo_libre
     FROM aud_resultado_hallazgo h
     JOIN aud_resultado_item i ON i.uuid = h.id_resultado_item_uuid
     WHERE i.id_aud_proyecto = ? AND h.pending_sync = 1 AND h.deleted_at IS NULL`,
    [idAudProyecto]
  );
  for (const h of hallazgos) {
    if (hallazgosConflicto.has(h.uuid)) continue;
    const esLibre = h.id_hallazgo_def == null;
    // Un libre nunca se envía sin tipo: queda pendiente hasta que el usuario lo elija.
    if (esLibre && !TIPOS_LIBRE.includes(h.tipo_libre)) {
      logError('sync', 'addHallazgo', new Error(`hallazgo libre ${h.uuid} sin tipo_libre; no se envía`), true);
      continue;
    }
    try {
      const body = {
        uuid: h.uuid,
        id_hallazgo_def: h.id_hallazgo_def,
        hallazgo_libre: h.hallazgo_libre,
        tipo_libre: esLibre ? h.tipo_libre : null,
      };
      if (__DEV__) console.log('[sync addHallazgo]', JSON.stringify(body));
      // 201 (creado) o 200 (ya existía / actualizado): ambos son éxito
      await addHallazgo(idAudProyecto, h.id_resultado_item_uuid, body);
      db.runSync(
        `UPDATE aud_resultado_hallazgo SET pending_sync = 0 WHERE uuid = ?`,
        [h.uuid]
      );
    } catch (e) {
      if (e?.status === 404) {
        // Eliminado en el servidor (p. ej. desde la web): se quita de la copia local
        const archivos = eliminarHallazgoLocal(h.uuid);
        for (const a of archivos) await borrarCopiaPersistente(a);
        hallazgosEliminados.push(h.uuid);
      } else if (e?.status === 409) {
        hallazgosConflicto.add(h.uuid);
      }
      logError('sync', 'addHallazgo', e, true);
    }
  }

  // 3. Evidencias nuevas (con espera creciente entre intentos)
  const ahora = new Date().toISOString();
  const evidencias = db.getAllSync(
    `SELECT ev.uuid, ev.id_resultado_hallazgo_uuid, ev.tipo, ev.file_local_path, ev.descripcion
     FROM aud_hallazgo_evidencia ev
     JOIN aud_resultado_hallazgo h ON h.uuid = ev.id_resultado_hallazgo_uuid
     JOIN aud_resultado_item i ON i.uuid = h.id_resultado_item_uuid
     WHERE i.id_aud_proyecto = ? AND ev.pending_sync = 1 AND ev.deleted_at IS NULL
       AND h.pending_sync = 0
       AND COALESCE(ev.intentos, 0) < ?
       AND (ev.proximo_intento IS NULL OR ev.proximo_intento <= ?)`,
    [idAudProyecto, MAX_INTENTOS_EVIDENCIA, ahora]
  );
  for (const ev of evidencias) {
    // Antes de subir: el archivo local debe existir, pesar > 0 y estar completo.
    const check = await verificarArchivoLocal(ev.file_local_path, { tipo: ev.tipo, reintentos: 1 });
    if (!check.ok) {
      marcarEvidenciaIrrecuperable(ev.uuid, check.motivo);
      evidenciasFallidas.push({ uuid: ev.uuid, mensaje: check.motivo, definitivo: true });
      logError('sync', 'uploadEvidencia', new Error(`archivo local inválido: ${check.motivo}`), true);
      continue;
    }

    try {
      await uploadEvidencia(
        idAudProyecto,
        ev.id_resultado_hallazgo_uuid,
        ev.uuid,
        ev.file_local_path,
        ev.tipo,
        ev.descripcion
      );
      // 2xx o 409 (ya estaba en el servidor) → enviada
      marcarEvidenciaSubida(ev.uuid);
      await borrarCopiaPersistente(ev.file_local_path);
    } catch (e) {
      if (e?.kind === 'not_found') {
        // El hallazgo ya no existe en el servidor: no tiene sentido reintentar.
        descartarEvidencia(ev.uuid);
        await borrarCopiaPersistente(ev.file_local_path);
        logError('sync', 'uploadEvidencia', e, true);
        continue;
      }
      if (e?.kind === 'forbidden') {
        // 403: el hallazgo es de otro proyecto. Reintentar no sirve: se muestra el error
        // y la foto queda en el celular para que el usuario decida eliminarla.
        marcarEvidenciaIrrecuperable(ev.uuid, e.message);
        evidenciasFallidas.push({ uuid: ev.uuid, mensaje: e.message, definitivo: true });
        logError('sync', 'uploadEvidencia', e, true);
        continue;
      }
      if (e?.kind === 'auth') {
        // Sesión vencida y no se pudo renovar: se reintenta tras volver a iniciar sesión.
        logError('sync', 'uploadEvidencia', e, true);
        break;
      }
      // 400 (vacía/incompleta), red caída o error del servidor:
      // queda pendiente, con el archivo local intacto, y se reintenta más tarde.
      marcarEvidenciaFallida(ev.uuid, e?.message);
      const row = db.getFirstSync(`SELECT intentos FROM aud_hallazgo_evidencia WHERE uuid = ?`, [ev.uuid]);
      evidenciasFallidas.push({
        uuid: ev.uuid,
        mensaje: e?.message,
        definitivo: (row?.intentos ?? 0) >= MAX_INTENTOS_EVIDENCIA,
      });
      if (e?.kind !== 'network') logError('sync', 'uploadEvidencia', e, true);
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

  // 6. Acompañante pendiente
  const acomp = db.getFirstSync(
    `SELECT nombre_acompanante, firma_base64
     FROM aud_acompanante
     WHERE id_aud_proyecto = ? AND pending_sync = 1`,
    [idAudProyecto]
  );
  if (acomp) {
    try {
      await upsertAcompanante(idAudProyecto, {
        nombre_acompanante: acomp.nombre_acompanante,
        firma_acompanante: acomp.firma_base64,
      });
      db.runSync(
        `UPDATE aud_acompanante SET pending_sync = 0 WHERE id_aud_proyecto = ?`,
        [idAudProyecto]
      );
    } catch (e) {
      logError('sync', 'upsertAcompanante', e, true);
    }
  }

  return { pendientes: getPendingCount(idAudProyecto), evidenciasFallidas, hallazgosEliminados };
}
