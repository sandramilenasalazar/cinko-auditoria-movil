import { apiRequest } from './client';

// Catálogo de tipos de hallazgo configurables desde la web.
// 200 {"tipos": [{ codigo, nombre, icono, color, orden_informe,
//                  permite_predefinidos, permite_libre, activo }, ...]}
// Incluye los inactivos (para mostrar hallazgos viejos). 404 = servidor sin catálogo.
export const getTiposHallazgo = () => apiRequest('/tipos-hallazgo');
