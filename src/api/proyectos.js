import { apiRequest } from './client';

export const getProyectos = () => apiRequest('/proyectos');

export const getAudProyecto = (idProyecto) =>
  apiRequest(`/proyectos/${idProyecto}/auditoria`);

// Resumen liviano (~1 KB) para el detalle del proyecto: auditoría en proceso,
// proyecto, máquinas y acompañante en una sola petición.
//   404 con JSON  → no hay auditoría EN_PROCESO para el proyecto
//   404 sin JSON  → servidor sin este endpoint (usar el flujo anterior)
export const getResumenProyecto = (idProyecto) =>
  apiRequest(`/proyectos/${idProyecto}/resumen`);
