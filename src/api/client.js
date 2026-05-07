import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

const TIMEOUT_MS = 10000;

const getToken = (key) => SecureStore.getItemAsync(key);
const setToken = (key, val) => SecureStore.setItemAsync(key, val);

const fetchWithTimeout = (url, options) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
};

const refreshAccessToken = async () => {
  const refreshToken = await getToken('refresh_token');
  const res = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${refreshToken}` },
  });
  if (!res.ok) throw new Error('SESSION_EXPIRED');
  const data = await res.json();
  await setToken('access_token', data.access_token);
  return data.access_token;
};

export const apiRequest = async (endpoint, options = {}) => {
  let accessToken = await getToken('access_token');

  const makeRequest = (token) =>
    fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

  let res = await makeRequest(accessToken);

  if (res.status === 401) {
    accessToken = await refreshAccessToken();
    res = await makeRequest(accessToken);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Error ${res.status}`);
  }

  return res.json();
};
