/**
 * Cliente da API de autenticacao (login/register).
 */
import axios from "axios";

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

export async function login(body: LoginBody): Promise<TokenResponse> {
  const { data } = await axios.post<TokenResponse>(API_ENDPOINTS.auth.login(), body);
  return data;
}

export async function register(body: RegisterBody): Promise<TokenResponse> {
  const { data } = await axios.post<TokenResponse>(API_ENDPOINTS.auth.register(), body);
  return data;
}
