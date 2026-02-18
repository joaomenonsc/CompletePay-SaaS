export type AgentStatus = "ativo" | "rascunho" | "pausado";

export interface Agent {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  status: AgentStatus;
  model: string;
  systemInstructions: string;
  category?: string;
  templateId?: string;
  /** Número de conversas (para exibição no card) */
  conversationsCount?: number;
  /** Taxa de resolução 0-100 (para exibição no card) */
  resolutionRate?: number | null;
  /** CSAT 0-5 (para exibição no card) */
  csat?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
}
