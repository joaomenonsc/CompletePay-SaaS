"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    createWorkflow,
    deleteWorkflow,
    disableWorkflow,
    executeWorkflow,
    fetchExecution,
    fetchExecutions,
    fetchExecutionSteps,
    fetchWorkflow,
    fetchWorkflowVersions,
    fetchWorkflows,
    publishWorkflow,
    updateWorkflow,
} from "@/lib/api/automations";
import type {
    ExecutionListParams,
    ManualExecuteInput,
    PublishInput,
    WorkflowCreateInput,
    WorkflowListParams,
    WorkflowUpdateInput,
} from "@/types/automations";
import { useAuthStore } from "@/store/auth-store";
import { useOrganizationStore } from "@/store/organization-store";

// ── Query keys ─────────────────────────────────────────────────────────────────

const WF_KEY = ["automations-workflows"] as const;
const EXEC_KEY = ["automations-executions"] as const;

/** Queries só disparam se houver token JWT e organização selecionada. */
function useReady(): boolean {
    const token = useAuthStore((s) => s.token);
    const orgId = useOrganizationStore((s) => s.currentOrganizationId);
    return !!token && !!orgId;
}

// ── Workflows ──────────────────────────────────────────────────────────────────

export function useWorkflows(params?: WorkflowListParams) {
    const ready = useReady();
    return useQuery({
        queryKey: [...WF_KEY, params ?? {}],
        queryFn: () => fetchWorkflows(params),
        enabled: ready,
    });
}

export function useWorkflow(id: string | null) {
    const ready = useReady();
    return useQuery({
        queryKey: [...WF_KEY, id],
        queryFn: () => fetchWorkflow(id!),
        enabled: ready && !!id,
    });
}

export function useCreateWorkflow() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: WorkflowCreateInput) => createWorkflow(body),
        onSuccess: () => qc.invalidateQueries({ queryKey: WF_KEY }),
    });
}

export function useUpdateWorkflow() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: WorkflowUpdateInput }) =>
            updateWorkflow(id, body),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: WF_KEY });
            qc.invalidateQueries({ queryKey: [...WF_KEY, id] });
        },
    });
}

export function useDeleteWorkflow() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteWorkflow(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: WF_KEY }),
    });
}

// ── Publish / Disable ──────────────────────────────────────────────────────────

export function usePublishWorkflow() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: PublishInput }) =>
            publishWorkflow(id, body),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: WF_KEY });
            qc.invalidateQueries({ queryKey: [...WF_KEY, id] });
        },
    });
}

export function useDisableWorkflow() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => disableWorkflow(id),
        onSuccess: (_, id) => {
            qc.invalidateQueries({ queryKey: WF_KEY });
            qc.invalidateQueries({ queryKey: [...WF_KEY, id] });
        },
    });
}

// ── Execute ────────────────────────────────────────────────────────────────────

export function useExecuteWorkflow() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: ManualExecuteInput }) =>
            executeWorkflow(id, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: EXEC_KEY });
            qc.invalidateQueries({ queryKey: WF_KEY });
        },
    });
}

// ── Executions ─────────────────────────────────────────────────────────────────

export function useExecutions(params?: ExecutionListParams) {
    const ready = useReady();
    return useQuery({
        queryKey: [...EXEC_KEY, params ?? {}],
        queryFn: () => fetchExecutions(params),
        enabled: ready,
    });
}

export function useExecution(id: string | null) {
    const ready = useReady();
    return useQuery({
        queryKey: [...EXEC_KEY, id],
        queryFn: () => fetchExecution(id!),
        enabled: ready && !!id,
        // Polling enquanto execução está RUNNING
        refetchInterval: (query) =>
            query.state.data?.status === "RUNNING" ? 2000 : false,
    });
}

export function useExecutionSteps(executionId: string | null) {
    const ready = useReady();
    return useQuery({
        queryKey: [...EXEC_KEY, executionId, "steps"],
        queryFn: () => fetchExecutionSteps(executionId!),
        enabled: ready && !!executionId,
    });
}

// ── Versions ───────────────────────────────────────────────────────────────────

export function useWorkflowVersions(workflowId: string | null) {
    const ready = useReady();
    return useQuery({
        queryKey: [...WF_KEY, workflowId, "versions"],
        queryFn: () => fetchWorkflowVersions(workflowId!),
        enabled: ready && !!workflowId,
    });
}
