import { apiRequest } from './client';

export const sendErrorLogs = (logs) =>
  apiRequest('/error-logs', { method: 'POST', body: JSON.stringify({ logs }) });
