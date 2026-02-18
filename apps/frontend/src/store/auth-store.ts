"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const AUTH_COOKIE_NAME = "completepay-token";
const AUTH_COOKIE_MAX_AGE_DAYS = 1; // 24h alinhado ao JWT do backend

function setAuthCookie(token: string) {
  if (typeof document === "undefined") return;
  const maxAge = AUTH_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not used for broad compatibility
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearAuthCookie() {
  if (typeof document === "undefined") return;
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not used for broad compatibility
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
}

export interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,

      setToken: (token) => {
        setAuthCookie(token);
        set({ token });
      },

      clearToken: () => {
        clearAuthCookie();
        set({ token: null });
      },

      isAuthenticated: () => !!get().token,
    }),
    {
      name: "completepay-auth",
      partialize: (s) => ({ token: s.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthCookie(state.token);
      },
    },
  ),
);

/** Nome do cookie usado pelo middleware para checagem de auth. */
export const AUTH_COOKIE_NAME_EXPORT = AUTH_COOKIE_NAME;
