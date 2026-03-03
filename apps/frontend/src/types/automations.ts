export type WorkflowStatus = "DRAFT" | "PUBLISHED" | "DISABLED"
export type ExecutionStatus = "RUNNING" | "SUCCESS" | "FAILED" | "CANCELED"
export type TriggerType = "manual" | "webhook" | "system"
export type NodeCategory = "trigger" | "action" | "logic" | "utils" | "transform"

export type NodeType =
    | "ManualTrigger" | "WebhookTrigger"
    | "HttpRequest" | "SendEmail" | "CreateCRMTask"
    | "IfCondition" | "Delay"
    | "SetVariable" | "Transform"
    | "CodeScript" | "FilterItems" | "SortItems" | "RemoveDuplicates"
    | "SplitBatches" | "MergeData" | "DateTimeFormat" | "RenameKeys"

export interface NodePosition { x: number; y: number }

export interface WorkflowNode {
    id: string
    type: NodeType
    category: NodeCategory
    position: NodePosition
    data: { label: string; config: Record<string, unknown> }
}

export interface WorkflowEdge {
    id: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
    label?: string
}

export interface WorkflowViewport { x: number; y: number; zoom: number }

export interface WorkflowDefinition {
    schemaVersion: "1.0"
    meta: { name: string; description?: string; tags?: string[]; createdAt?: string; updatedAt?: string }
    viewport: WorkflowViewport
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
}

export interface WorkflowResponse {
    id: string
    organization_id: string
    name: string
    description: string | null
    status: WorkflowStatus
    current_version_id: string | null
    created_by: string | null
    updated_by: string | null
    created_at: string
    updated_at: string
}

export interface WorkflowVersionResponse {
    id: string
    workflow_id: string
    version_number: number
    definition_json: WorkflowDefinition
    published_at: string | null
    created_at: string
}

export interface ExecutionResponse {
    id: string
    workflow_id: string
    version_id: string | null
    status: ExecutionStatus
    trigger_type: TriggerType
    started_at: string
    finished_at: string | null
    duration_ms: number | null
    initiated_by: string | null
    error_summary: string | null
}

export interface ExecutionStepResponse {
    id: string
    execution_id: string
    node_id: string
    node_type: string
    status: string
    started_at: string
    finished_at: string | null
    duration_ms: number | null
    input_json: Record<string, unknown> | null
    output_json: Record<string, unknown> | null
    error_message: string | null
}

export interface WorkflowCreateInput { name: string; description?: string; definition?: WorkflowDefinition }
export interface WorkflowUpdateInput { name?: string; description?: string; definition?: WorkflowDefinition }
export interface PublishInput { definition: WorkflowDefinition }
export interface ManualExecuteInput { payload?: Record<string, unknown> }
export interface WorkflowListParams { status?: WorkflowStatus; limit?: number; offset?: number }
export interface ExecutionListParams { workflow_id?: string; status?: ExecutionStatus; limit?: number; offset?: number }
