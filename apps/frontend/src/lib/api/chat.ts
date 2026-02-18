/**
 * Cliente da API de chat (POST /chat).
 * Usado pelo Playground para enviar mensagens ao agente CompletePay.
 */
import axios from "axios";

import { API_ENDPOINTS } from "@/lib/api-config";

export interface ChatRequest {
  message: string;
  user_id?: string;
  session_id?: string | null;
}

export interface ChatResponse {
  content: string;
}

/**
 * Envia uma mensagem ao agente e retorna a resposta.
 * @throws AxiosError em falha de rede ou 4xx/5xx
 */
export async function sendChatMessage(params: ChatRequest): Promise<ChatResponse> {
  const { data } = await axios.post<ChatResponse>(API_ENDPOINTS.chat(), {
    message: params.message.trim(),
    user_id: params.user_id ?? "playground",
    session_id: params.session_id ?? null,
  });
  return data;
}
