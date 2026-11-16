import Constants from 'expo-constants';

// Versión de la app (la de app.json → "version"). El servidor la usa desde la v1.6.0:
// - para saber qué versión tiene cada auditor (web: Usuarios → "App celular")
// - para permitir tipos de hallazgo configurables (sin el header, una app vieja
//   no puede cambiar el tipo de un libre fuera de MANTENIMIENTO/NORMA)
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

// Debe ir en TODAS las peticiones a /api/v1
export const APP_VERSION_HEADER = { 'X-App-Version': APP_VERSION };
