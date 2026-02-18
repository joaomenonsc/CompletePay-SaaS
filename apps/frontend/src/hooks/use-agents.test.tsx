import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAgent, useAgents, useCreateAgent, useDeleteAgent, useUpdateAgentMutation } from "./use-agents";

vi.mock("@/lib/api/agents", () => ({
  fetchAgents: vi.fn(),
  fetchAgent: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}));

vi.mock("@/store/organization-store", () => {
  const state = { currentOrganizationId: "test-org-id" as string | null };
  const useOrganizationStore = (selector: (s: typeof state) => string | null) => selector(state);
  useOrganizationStore.getState = () => state;
  return { useOrganizationStore };
});

const { fetchAgents, fetchAgent, createAgent, deleteAgent, updateAgent } = await import("@/lib/api/agents");

const mockFetchAgents = vi.mocked(fetchAgents);
const mockFetchAgent = vi.mocked(fetchAgent);
const mockCreateAgent = vi.mocked(createAgent);
const mockDeleteAgent = vi.mocked(deleteAgent);
const mockUpdateAgent = vi.mocked(updateAgent);

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useAgents", () => {
  it("retorna lista de agentes apos fetch", async () => {
    const agents = [
      {
        id: "1",
        name: "Agent 1",
        model: "gpt-4",
        systemInstructions: "Help",
        status: "ativo" as const,
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
      },
    ];
    mockFetchAgents.mockResolvedValueOnce(agents);

    const { result } = renderHook(() => useAgents(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(agents);
    expect(mockFetchAgents).toHaveBeenCalledTimes(1);
  });
});

describe("useAgent", () => {
  it("nao faz fetch quando id e null", () => {
    const { result } = renderHook(() => useAgent(null), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetchAgent).not.toHaveBeenCalled();
  });

  it("busca agente quando id e fornecido", async () => {
    const agent = {
      id: "1",
      name: "Test",
      model: "gpt-4",
      systemInstructions: "Help",
      status: "rascunho" as const,
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    };
    mockFetchAgent.mockResolvedValueOnce(agent);

    const { result } = renderHook(() => useAgent("1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(agent);
    expect(mockFetchAgent).toHaveBeenCalledWith("1");
  });
});

describe("useCreateAgent", () => {
  it("chama createAgent na mutacao", async () => {
    const newAgent = {
      id: "new-1",
      name: "New",
      model: "gpt-4",
      systemInstructions: "Hi",
      status: "rascunho" as const,
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    };
    mockCreateAgent.mockResolvedValueOnce(newAgent);

    const { result } = renderHook(() => useCreateAgent(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: "New",
      model: "gpt-4",
      system_instructions: "Hi",
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mockCreateAgent).toHaveBeenCalledWith({
      name: "New",
      model: "gpt-4",
      system_instructions: "Hi",
    });
    expect(result.current.data).toEqual(newAgent);
  });
});

describe("useDeleteAgent", () => {
  it("chama deleteAgent na mutacao", async () => {
    mockDeleteAgent.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteAgent(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("agent-123");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mockDeleteAgent).toHaveBeenCalledWith("agent-123");
  });
});

describe("useUpdateAgentMutation", () => {
  it("chama updateAgent com id e body", async () => {
    const updated = {
      id: "1",
      name: "Updated",
      model: "gpt-4",
      systemInstructions: "Help",
      status: "ativo" as const,
      createdAt: "2025-01-01",
      updatedAt: "2025-01-02",
    };
    mockUpdateAgent.mockResolvedValueOnce(updated);

    const { result } = renderHook(() => useUpdateAgentMutation(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: "1",
      body: { name: "Updated", status: "ativo" },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mockUpdateAgent).toHaveBeenCalledWith("1", {
      name: "Updated",
      status: "ativo",
    });
    expect(result.current.data).toEqual(updated);
  });
});
