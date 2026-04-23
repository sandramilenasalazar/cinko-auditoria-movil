import { apiRequest } from './client';

// Carga estructura completa: nivel1 > nivel2 > resultado_item + hallazgos + hallazgos_def
export const getAuditoriaItems = (idAudProyecto) =>
  apiRequest(`/auditoria/${idAudProyecto}/items`);

// Crea o actualiza un resultado_item (upsert por uuid)
export const upsertResultadoItem = (idAudProyecto, uuid, body) =>
  apiRequest(`/auditoria/${idAudProyecto}/items/${uuid}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

// Agrega un hallazgo a un resultado_item
export const addHallazgo = (idAudProyecto, itemUuid, body) =>
  apiRequest(`/auditoria/${idAudProyecto}/items/${itemUuid}/hallazgos`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

// Elimina un hallazgo
export const deleteHallazgo = (idAudProyecto, itemUuid, hallazgoUuid) =>
  apiRequest(
    `/auditoria/${idAudProyecto}/items/${itemUuid}/hallazgos/${hallazgoUuid}`,
    { method: 'DELETE' }
  );
