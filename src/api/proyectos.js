import { apiRequest } from './client';

export const getProyectos = () => apiRequest('/proyectos');

export const getAudProyecto = (idProyecto) =>
  apiRequest(`/proyectos/${idProyecto}/auditoria`);
