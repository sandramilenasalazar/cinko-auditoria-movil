import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

const getToken = (key) => SecureStore.getItemAsync(key);
const setToken = (key, val) => SecureStore.setItemAsync(key, val);

const refreshAccessToken = async () => {
  const refreshToken = await getToken('refresh_token');
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
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
    fetch(`${API_BASE_URL}${endpoint}`, {
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
