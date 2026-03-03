/**
 * Cliente da API de Automações.
 * Usa o mesmo apiClient (JWT + X-Organization-Id).
 */

import apiClient from "@/lib/api/client";
import type {
    ExecutionListParams,
    ExecutionResponse,
    ExecutionStepResponse,
    ManualExecuteInput,
    PublishInput,
    WorkflowCreateInput,
    WorkflowListParams,
    WorkflowResponse,
    WorkflowUpdateInput,
    WorkflowVersionResponse,
} from "@/types/automations";

const BASE = "/api/v1/automations";

// ── Workflows ──────────────────────────────────────────────────────────────────

export async function fetchWorkflows(
    params?: WorkflowListParams
): Promise<WorkflowResponse[]> {
    const { data } = await apiClient.get(`${BASE}/workflows`, { params });
    return data;
}

export async function fetchWorkflow(id: string): Promise<WorkflowResponse> {
    const { data } = await apiClient.get(`${BASE}/workflows/${id}`);
    return data;
}

export async function createWorkflow(
    body: WorkflowCreateInput
): Promise<WorkflowResponse> {
    const { data } = await apiClient.post(`${BASE}/workflows`, body);
    return data;
}

export async function updateWorkflow(
    id: string,
    body: WorkflowUpdateInput
): Promise<WorkflowResponse> {
    const { data } = await apiClient.put(`${BASE}/workflows/${id}`, body);
    return data;
}

export async function deleteWorkflow(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/workflows/${id}`);
}

// ── Publish / Disable ──────────────────────────────────────────────────────────

export async function publishWorkflow(
    id: string,
    body: PublishInput
): Promise<WorkflowVersionResponse> {
    const { data } = await apiClient.post(`${BASE}/workflows/${id}/publish`, body);
    return data;
}

export async function disableWorkflow(
    id: string
): Promise<WorkflowResponse> {
    const { data } = await apiClient.post(`${BASE}/workflows/${id}/disable`);
    return data;
}

// ── Execute ────────────────────────────────────────────────────────────────────

export async function executeWorkflow(
    id: string,
    body: ManualExecuteInput
): Promise<ExecutionResponse> {
    const { data } = await apiClient.post(`${BASE}/workflows/${id}/execute`, body);
    return data;
}

// ── Executions ─────────────────────────────────────────────────────────────────

export async function fetchExecutions(
    params?: ExecutionListParams
): Promise<ExecutionResponse[]> {
    const { data } = await apiClient.get(`${BASE}/executions`, { params });
    return data;
}

export async function fetchExecution(id: string): Promise<ExecutionResponse> {
    const { data } = await apiClient.get(`${BASE}/executions/${id}`);
    return data;
}

export async function fetchExecutionSteps(
    executionId: string
): Promise<ExecutionStepResponse[]> {
    const { data } = await apiClient.get(`${BASE}/executions/${executionId}/steps`);
    return data;
}

// ── Versions ───────────────────────────────────────────────────────────────────

export async function fetchWorkflowVersions(
    workflowId: string
): Promise<WorkflowVersionResponse[]> {
    const { data } = await apiClient.get(`${BASE}/workflows/${workflowId}/versions`);
    return data;
}
