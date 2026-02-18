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
    me: () => `${API_BASE_URL}/auth/me`,
  },
  agents: () => `${API_BASE_URL}/agents`,
  agent: (id: string) => `${API_BASE_URL}/agents/${id}`,
  organizations: () => `${API_BASE_URL}/organizations`,
} as const;
