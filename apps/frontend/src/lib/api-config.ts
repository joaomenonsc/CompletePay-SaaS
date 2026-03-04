/**
 * URL base da API do backend (CompletePay Agent).
 * Em desenvolvimento: backend em http://localhost:8000
 * Defina NEXT_PUBLIC_API_URL no .env.local para sobrescrever.
 */
export const API_BASE_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

export const API_ENDPOINTS = {
  health: () => `${API_BASE_URL}/health`,
  chat: () => `${API_BASE_URL}/chat`,
  wsChat: () => {
    const base = API_BASE_URL.replace(/^http/, "ws");
    return `${base}/ws/chat`;
  },
  auth: {
    login: () => `${API_BASE_URL}/auth/login`,
    register: () => `${API_BASE_URL}/auth/register`,
    confirmEmail: () => `${API_BASE_URL}/auth/confirm-email`,
    resendConfirmation: () => `${API_BASE_URL}/auth/resend-confirmation`,
    me: () => `${API_BASE_URL}/auth/me`,
    meAvatar: () => `${API_BASE_URL}/auth/me/avatar`,
    mePassword: () => `${API_BASE_URL}/auth/me/password`,
    meSessions: () => `${API_BASE_URL}/auth/me/sessions`,
    meSessionRevoke: (id: string) => `${API_BASE_URL}/auth/me/sessions/${id}`,
    meSessionsRevokeAll: () => `${API_BASE_URL}/auth/me/sessions/revoke-all`,
    forgotPassword: () => `${API_BASE_URL}/auth/forgot-password`,
    resetPassword: () => `${API_BASE_URL}/auth/reset-password`,
  },
  agents: () => `${API_BASE_URL}/agents`,
  agent: (id: string) => `${API_BASE_URL}/agents/${id}`,
  organizations: () => `${API_BASE_URL}/organizations`,
  organization: (id: string) => `${API_BASE_URL}/organizations/${id}`,
  organizationAvatar: (id: string) => `${API_BASE_URL}/organizations/${id}/avatar`,
} as const;
