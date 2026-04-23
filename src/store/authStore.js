import { create } from 'zustand';
import { login as apiLogin, logout as apiLogout, getStoredAccessToken } from '../api/auth';

export const useAuthStore = create((set) => ({
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    const token = await getStoredAccessToken();
    set({ isAuthenticated: !!token, isLoading: false });
  },

  login: async (username, password) => {
    await apiLogin(username, password);
    set({ isAuthenticated: true });
  },

  logout: async () => {
    await apiLogout();
    set({ isAuthenticated: false });
  },
}));
