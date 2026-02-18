"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type AgentCreateBody,
  type AgentUpdateBody,
  createAgent,
  deleteAgent,
  fetchAgent,
  fetchAgents,
  updateAgent,
} from "@/lib/api/agents";
import type { Agent } from "@/types/agent";
import { useOrganizationStore } from "@/store/organization-store";

const AGENTS_QUERY_KEY = ["agents"] as const;
const AGENTS_QUERY_KEY_WITH_ORG = (orgId: string | null) => ["agents", orgId] as const;
const AGENT_QUERY_KEY = (id: string) => ["agents", id] as const;

export function useAgents() {
  const currentOrganizationId = useOrganizationStore((s) => s.currentOrganizationId);
  return useQuery({
    queryKey: AGENTS_QUERY_KEY_WITH_ORG(currentOrganizationId),
    queryFn: fetchAgents,
    enabled: !!currentOrganizationId,
  });
}

export function useAgent(id: string | null) {
  return useQuery({
    queryKey: AGENT_QUERY_KEY(id ?? ""),
    queryFn: () => fetchAgent(id ?? ""),
    enabled: !!id,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AgentCreateBody) => createAgent(body),
    onSuccess: (data: Agent) => {
      const orgId = useOrganizationStore.getState().currentOrganizationId;
      queryClient.setQueryData(AGENTS_QUERY_KEY_WITH_ORG(orgId), (old: Agent[] | undefined) =>
        old ? [...old, data] : [data],
      );
    },
  });
}

export function useUpdateAgent(agentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AgentUpdateBody) => updateAgent(agentId, body),
    onSuccess: (data: Agent) => {
      queryClient.setQueryData(AGENT_QUERY_KEY(data.id), data);
      const orgId = useOrganizationStore.getState().currentOrganizationId;
      queryClient.setQueryData(AGENTS_QUERY_KEY_WITH_ORG(orgId), (old: Agent[] | undefined) =>
        old ? old.map((a) => (a.id === data.id ? data : a)) : [data],
      );
    },
  });
}

/** Atualiza qualquer agente por id (útil em lista/cards). */
export function useUpdateAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AgentUpdateBody }) => updateAgent(id, body),
    onSuccess: (data: Agent) => {
      queryClient.setQueryData(AGENT_QUERY_KEY(data.id), data);
      const orgId = useOrganizationStore.getState().currentOrganizationId;
      queryClient.setQueryData(AGENTS_QUERY_KEY_WITH_ORG(orgId), (old: Agent[] | undefined) =>
        old ? old.map((a) => (a.id === data.id ? data : a)) : [data],
      );
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => deleteAgent(agentId),
    onSuccess: (_, agentId) => {
      queryClient.removeQueries({ queryKey: AGENT_QUERY_KEY(agentId) });
      const orgId = useOrganizationStore.getState().currentOrganizationId;
      queryClient.setQueryData(AGENTS_QUERY_KEY_WITH_ORG(orgId), (old: Agent[] | undefined) =>
        old ? old.filter((a) => a.id !== agentId) : [],
      );
    },
  });
}
