import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';
import { apiRequest } from './client';

// Sube un archivo de evidencia (imagen o documento) al servidor
export const uploadEvidencia = async (idAudProyecto, hallazgoUuid, evidenciaUuid, fileUri, tipo, nombre) => {
  const token = await SecureStore.getItemAsync('access_token');

  const mimeType =
    tipo === 'IMAGEN'
      ? 'image/jpeg'
      : tipo === 'DOCUMENTO'
      ? 'application/octet-stream'
      : 'application/octet-stream';

  const formData = new FormData();
  formData.append('file', { uri: fileUri, name: nombre, type: mimeType });
  formData.append('uuid', evidenciaUuid);
  formData.append('tipo', tipo);

  const res = await fetch(
    `${API_BASE_URL}/auditoria/${idAudProyecto}/hallazgos/${hallazgoUuid}/evidencia`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Error ${res.status}`);
  }
  return res.json();
};

// Elimina una evidencia
export const deleteEvidencia = (idAudProyecto, hallazgoUuid, evidenciaUuid) =>
  apiRequest(
    `/auditoria/${idAudProyecto}/hallazgos/${hallazgoUuid}/evidencia/${evidenciaUuid}`,
    { method: 'DELETE' }
  );
