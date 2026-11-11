import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';
import { apiRequest, refreshAccessToken } from './client';

const UPLOAD_TIMEOUT_MS = 30000;

// Error de subida con la causa clasificada, para que quien llama decida
// si reintenta, descarta o renueva sesión.
//   kind: 'network' | 'rejected' (400) | 'auth' (401 sin poder renovar)
//         | 'forbidden' (403: hallazgo de otro proyecto) | 'not_found' (404) | 'server' (otros)
export class UploadError extends Error {
  constructor(message, kind, status = null) {
    super(message);
    this.name = 'UploadError';
    this.kind = kind;
    this.status = status;
  }
}

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
};

const extOf = (s) => {
  const m = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(s ?? '');
  return m ? m[1].toLowerCase() : '';
};

// Nombre y MIME que se envían en el multipart. El servidor decide el nombre
// final (p. ej. convierte .png a <uuid>.jpg); la app nunca arma esa URL.
const fileMeta = (fileUri, nombre, tipo) => {
  const ext = extOf(nombre) || extOf(fileUri) || (tipo === 'IMAGEN' ? 'jpg' : '');
  const baseName = nombre || (fileUri ?? '').split('/').pop() || 'archivo';
  const name = extOf(baseName) ? baseName : `${baseName}.${ext}`;
  const type = MIME_BY_EXT[ext] ?? (tipo === 'IMAGEN' ? 'image/jpeg' : 'application/octet-stream');
  return { name, type };
};

// URL para ver una evidencia ya subida, usando la que devuelve el servidor
// o, si no viene, el endpoint de descarga por uuid.
export const evidenciaServerUrl = (resp, evidenciaUuid) =>
  resp?.url ?? resp?.uri ?? `${API_BASE_URL}/evidencias/${evidenciaUuid}`;

const postEvidencia = async (url, buildForm, token) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: buildForm(),
      signal: controller.signal,
    });
  } catch (e) {
    // Sin red, timeout o conexión cortada a mitad de la subida
    throw new UploadError('No se pudo conectar con el servidor', 'network');
  } finally {
    clearTimeout(timeoutId);
  }
};

// Sube un archivo de evidencia (imagen o documento) al servidor.
// Devuelve el JSON del servidor, o { duplicado: true } si ya existía (409).
// Lanza UploadError en cualquier otro caso.
export const uploadEvidencia = async (idAudProyecto, hallazgoUuid, evidenciaUuid, fileUri, tipo, nombre) => {
  const url = `${API_BASE_URL}/auditoria/${idAudProyecto}/hallazgos/${hallazgoUuid}/evidencia`;
  const { name, type } = fileMeta(fileUri, nombre, tipo);

  // El FormData se arma de nuevo en cada intento: no se reutiliza un body ya enviado.
  const buildForm = () => {
    const formData = new FormData();
    formData.append('file', { uri: fileUri, name, type });
    formData.append('uuid', evidenciaUuid);
    formData.append('tipo', tipo);
    return formData;
  };

  let token = await SecureStore.getItemAsync('access_token');
  let res = await postEvidencia(url, buildForm, token);

  if (res.status === 401) {
    try {
      token = await refreshAccessToken();
    } catch (_) {
      throw new UploadError('La sesión expiró. Vuelva a iniciar sesión.', 'auth', 401);
    }
    res = await postEvidencia(url, buildForm, token);
  }

  if (res.status === 409) return { duplicado: true };

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.error || body.message || `Error ${res.status}`;
    const kind =
      res.status === 400 ? 'rejected'
      : res.status === 401 ? 'auth'
      : res.status === 403 ? 'forbidden'
      : res.status === 404 ? 'not_found'
      : 'server';
    throw new UploadError(msg, kind, res.status);
  }

  return res.json().catch(() => ({}));
};

// Elimina una evidencia
export const deleteEvidencia = (idAudProyecto, hallazgoUuid, evidenciaUuid) =>
  apiRequest(
    `/auditoria/${idAudProyecto}/hallazgos/${hallazgoUuid}/evidencia/${evidenciaUuid}`,
    { method: 'DELETE' }
  );
