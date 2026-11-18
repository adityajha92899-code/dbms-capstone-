import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';
import { connect as connectSocket, disconnect as disconnectSocket } from '../lib/socket';

/**
 * Auth store persisted in localStorage.
 * Trade-off: Refresh token stays in an HttpOnly server-side cookie, while
 * user metadata and short-lived accessToken are persisted in localStorage
 * for seamless page reloads and immediate API/Socket hydration.
 */
const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      role: null,
      isLoading: false,

      setAccessToken: (accessToken) => set({ accessToken }),

      clearAuth: () => {
        disconnectSocket();
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          role: null,
          isLoading: false,
        });
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/api/v1/auth/login', { email, password });
          const { accessToken, user } = res.data;
          set({
            user,
            accessToken,
            isAuthenticated: true,
            role: user.role,
            isLoading: false,
          });
          connectSocket(accessToken);
          return user;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          if (get().accessToken) {
            await api.post('/api/v1/auth/logout');
          }
        } catch (_err) {
          // Proceed with local state cleanup even if network call fails
        } finally {
          get().clearAuth();
        }
      },

      hydrate: async () => {
        const token = get().accessToken;
        if (!token) return;
        set({ isLoading: true });
        try {
          const res = await api.get('/api/v1/auth/me');
          const { user } = res.data;
          set({
            user,
            isAuthenticated: true,
            role: user.role,
            isLoading: false,
          });
          connectSocket(get().accessToken);
        } catch (_err) {
          get().clearAuth();
        }
      },
    }),
    {
      name: 'fleetflow-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        role: state.role,
      }),
    }
  )
);

export default useAuthStore;
