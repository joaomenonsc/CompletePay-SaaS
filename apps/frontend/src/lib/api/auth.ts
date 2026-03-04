/**
 * Cliente da API de autenticacao (login/register) e dados do usuario logado.
 */
import axios from "axios";

import apiClient from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api-config";

export interface LoginBody {
  email: string;
  password: string;
}

export interface RegisterBody {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterResponse {
  message: string;
  email: string;
}

export async function login(body: LoginBody): Promise<TokenResponse> {
  const { data } = await axios.post<TokenResponse>(API_ENDPOINTS.auth.login(), body);
  return data;
}

export async function register(body: RegisterBody): Promise<RegisterResponse> {
  const { data } = await axios.post<RegisterResponse>(API_ENDPOINTS.auth.register(), body);
  return data;
}

/** Confirma o email com o token recebido por email. Retorna JWT (login automático). */
export async function confirmEmail(token: string): Promise<TokenResponse> {
  const { data } = await axios.post<TokenResponse>(API_ENDPOINTS.auth.confirmEmail(), {
    token: token.trim(),
  });
  return data;
}

/** Reenvia o email de confirmação para o endereço informado. */
export async function resendConfirmation(email: string): Promise<{ message: string }> {
  const { data } = await axios.post<{ message: string }>(
    API_ENDPOINTS.auth.resendConfirmation(),
    { email: email.trim().toLowerCase() }
  );
  return data;
}

export interface MeResponse {
  user_id: string;
  role: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

/** Usuario logado (requer token). Usa o cliente autenticado. */
export async function getMe(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>(API_ENDPOINTS.auth.me());
  return data;
}

export interface UpdateMeBody {
  name: string;
}

/** Atualiza o perfil do usuario logado (ex.: nome). Retorna os dados atuais. */
export async function updateMe(body: UpdateMeBody): Promise<MeResponse> {
  const { data } = await apiClient.patch<MeResponse>(API_ENDPOINTS.auth.me(), body);
  return data;
}

/** Envia uma foto para o avatar do usuario. Aceita JPEG, PNG, GIF ou WebP ate 5MB. */
export async function uploadAvatar(file: File): Promise<MeResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<MeResponse>(API_ENDPOINTS.auth.meAvatar(), formData);
  return data;
}

export interface ChangePasswordBody {
  current_password: string;
  new_password: string;
}

/** Altera a senha do usuario logado. Exige a senha atual. */
export async function changePassword(body: ChangePasswordBody): Promise<{ message: string }> {
  const { data } = await apiClient.put<{ message: string }>(
    API_ENDPOINTS.auth.mePassword(),
    body
  );
  return data;
}

export interface SessionItem {
  id: string;
  jti: string;
  device_info: string;
  ip_address: string;
  created_at: string;
  current?: boolean;
}

/** Lista as sessoes ativas do usuario. */
export async function getMySessions(): Promise<{ sessions: SessionItem[] }> {
  const { data } = await apiClient.get<{ sessions: SessionItem[] }>(
    API_ENDPOINTS.auth.meSessions()
  );
  return data;
}

/** Encerra uma sessao especifica. */
export async function revokeSession(sessionId: string): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>(
    API_ENDPOINTS.auth.meSessionRevoke(sessionId)
  );
  return data;
}

/** Encerra todas as sessoes. O token atual sera invalidado. */
export async function revokeAllSessions(): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(
    API_ENDPOINTS.auth.meSessionsRevokeAll()
  );
  return data;
}

/** Solicita redefinicao de senha. Envia email com link. */
export async function forgotPassword(email: string): Promise<{ message: string }> {
  const { data } = await axios.post<{ message: string }>(
    API_ENDPOINTS.auth.forgotPassword(),
    { email: email.trim().toLowerCase() }
  );
  return data;
}

/** Redefine a senha usando o token recebido por email. */
export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const { data } = await axios.post<{ message: string }>(
    API_ENDPOINTS.auth.resetPassword(),
    { token: token.trim(), new_password: newPassword }
  );
  return data;
}
