import Constants from 'expo-constants';

// Versión de la app (la de app.json → "version"). El servidor la usa desde la v1.6.0:
// - para saber qué versión tiene cada auditor (web: Usuarios → "App celular")
// - para permitir tipos de hallazgo configurables (sin el header, una app vieja
//   no puede cambiar el tipo de un libre fuera de MANTENIMIENTO/NORMA)
// Solo el número (1.6.0): el servidor no reconoce el prefijo "v" y trataría la app como vieja.
export const limpiarVersion = (v) => String(v ?? '').trim().replace(/^v/i, '') || '0.0.0';
export const APP_VERSION = limpiarVersion(Constants.expoConfig?.version);

// Debe ir en TODAS las peticiones a /api/v1
export const APP_VERSION_HEADER = { 'X-App-Version': APP_VERSION };
