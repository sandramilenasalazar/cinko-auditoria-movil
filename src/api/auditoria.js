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

// Guarda o sobreescribe acompañante + firma
export const upsertAcompanante = (idAudProyecto, body) =>
  apiRequest(`/auditoria/${idAudProyecto}/acompanante`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

// Consulta el acompañante existente (404 si aún no hay)
export const getAcompanante = (idAudProyecto) =>
  apiRequest(`/auditoria/${idAudProyecto}/acompanante`);

// Carga datos del paquete: proyecto y máquinas asociadas
export const getAuditoriaPaquete = (idAudProyecto) =>
  apiRequest(`/auditoria/${idAudProyecto}/paquete`);
