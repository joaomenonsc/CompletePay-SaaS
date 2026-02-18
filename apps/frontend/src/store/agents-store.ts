"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Agent, AgentStatus } from "@/types/agent";

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

interface AgentsState {
  agents: Agent[];
  addAgent: (agent: Omit<Agent, "id" | "createdAt" | "updatedAt">) => Agent;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  toggleStatus: (id: string) => void;
  duplicateAgent: (id: string) => Agent | null;
  getAgent: (id: string) => Agent | undefined;
  setStatus: (id: string, status: AgentStatus) => void;
}

export const useAgentsStore = create<AgentsState>()(
  persist(
    (set, get) => ({
      agents: [],

      addAgent: (data) => {
        const now = new Date().toISOString();
        const agent: Agent = {
          ...data,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ agents: [...s.agents, agent] }));
        return agent;
      },

      updateAgent: (id, patch) => {
        const now = new Date().toISOString();
        set((s) => ({
          agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: now } : a)),
        }));
      },

      removeAgent: (id) => {
        set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }));
      },

      toggleStatus: (id) => {
        set((s) => ({
          agents: s.agents.map((a) => {
            if (a.id !== id) return a;
            const next: AgentStatus = a.status === "ativo" ? "pausado" : "ativo";
            return { ...a, status: next, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      setStatus: (id, status) => {
        set((s) => ({
          agents: s.agents.map((a) => (a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a)),
        }));
      },

      duplicateAgent: (id) => {
        const agent = get().agents.find((a) => a.id === id);
        if (!agent) return null;
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = agent;
        const copy = get().addAgent({
          ...rest,
          name: `${agent.name}-copia`,
          status: "rascunho",
        });
        return copy;
      },

      getAgent: (id) => get().agents.find((a) => a.id === id),
    }),
    { name: "agents-store" },
  ),
);
