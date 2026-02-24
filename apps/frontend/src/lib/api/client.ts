/**
 * Cliente Axios que envia o JWT e X-Organization-Id quando o usuario esta logado.
 * Usado por agents e outras chamadas autenticadas.
 */
import axios from "axios";

import { API_BASE_URL } from "@/lib/api-config";
import { useAuthStore } from "@/store/auth-store";
import { useOrganizationStore } from "@/store/organization-store";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const orgId = useOrganizationStore.getState().currentOrganizationId;
  if (orgId) config.headers["X-Organization-Id"] = orgId.toLowerCase();
  // FormData precisa de multipart/form-data com boundary; nao usar application/json
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

export default client;
