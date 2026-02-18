import { afterEach, describe, expect, it } from "vitest";

import { useAuthStore } from "./auth-store";

describe("auth-store", () => {
  afterEach(() => {
    useAuthStore.getState().clearToken();
  });

  it("inicia com token null e nao autenticado", () => {
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it("setToken atualiza token e isAuthenticated retorna true", () => {
    useAuthStore.getState().setToken("jwt-token-123");
    expect(useAuthStore.getState().token).toBe("jwt-token-123");
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });

  it("clearToken zera token e isAuthenticated retorna false", () => {
    useAuthStore.getState().setToken("jwt-token-123");
    useAuthStore.getState().clearToken();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it("setToken define cookie no document", () => {
    useAuthStore.getState().setToken("my-jwt");
    expect(document.cookie).toContain("completepay-token");
    expect(document.cookie).toContain(encodeURIComponent("my-jwt"));
  });

  it("clearToken remove cookie", () => {
    useAuthStore.getState().setToken("my-jwt");
    useAuthStore.getState().clearToken();
    expect(document.cookie).not.toContain("completepay-token=");
  });
});
