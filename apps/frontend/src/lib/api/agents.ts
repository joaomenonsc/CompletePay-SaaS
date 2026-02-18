/**
 * Cliente da API de agentes (CRUD).
 * Requer autenticacao (Bearer token enviado pelo client).
 */

import apiClient from "@/lib/api/client";
import type { Agent } from "@/types/agent";

export type AgentCreateBody = {
  name: string;
  description?: string;
  image_url?: string | null;
  status?: "ativo" | "rascunho" | "pausado";
  model: string;
  system_instructions: string;
  category?: string;
  template_id?: string;
};

export type AgentUpdateBody = Partial<AgentCreateBody>;

/** Resposta da API usa camelCase para createdAt/updatedAt */
interface AgentApiResponse {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  status: string;
  model: string;
  system_instructions: string;
  category?: string | null;
  template_id?: string | null;
  createdAt: string;
  updatedAt: string;
}

function toAgent(r: AgentApiResponse): Agent {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    imageUrl: r.image_url ?? undefined,
    status: r.status as Agent["status"],
    model: r.model,
    systemInstructions: r.system_instructions,
    category: r.category ?? undefined,
    templateId: r.template_id ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function fetchAgents(): Promise<Agent[]> {
  const { data } = await apiClient.get<AgentApiResponse[]>("/agents");
  return (data ?? []).map(toAgent);
}

export async function fetchAgent(id: string): Promise<Agent | null> {
  const { data } = await apiClient.get<AgentApiResponse>(`/agents/${id}`);
  return data ? toAgent(data) : null;
}

export async function createAgent(body: AgentCreateBody): Promise<Agent> {
  const { data } = await apiClient.post<AgentApiResponse>("/agents", body);
  return toAgent(data);
}

export async function updateAgent(id: string, body: AgentUpdateBody): Promise<Agent> {
  const { data } = await apiClient.put<AgentApiResponse>(`/agents/${id}`, body);
  return toAgent(data);
}

export async function deleteAgent(id: string): Promise<void> {
  await apiClient.delete(`/agents/${id}`);
}
