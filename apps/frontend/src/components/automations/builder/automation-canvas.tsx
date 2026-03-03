"use client";

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import {
    ReactFlow,
    type Node as RFNode,
    type Edge as RFEdge,
    type Connection,
    useNodesState,
    useEdgesState,
    addEdge,
    Controls,
    Background,
    BackgroundVariant,
    MiniMap,
    Panel,
    useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CheckSquare, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import NodeCard from "./node-card";
import NodePalette from "./node-palette";
import PropertiesPanel from "./properties-panel";
import ValidationPanel from "./validation-panel";
import { createNode, createEdge, validateGraph, type GraphError } from "./builder-utils";
import type { NodeType, WorkflowDefinition, WorkflowNode, WorkflowEdge } from "@/types/automations";
import { useWorkflow } from "@/hooks/use-automations";

const nodeTypes = {
    ManualTrigger: NodeCard,
    WebhookTrigger: NodeCard,
    HttpRequest: NodeCard,
    SendEmail: NodeCard,
    CreateCRMTask: NodeCard,
    IfCondition: NodeCard,
    Delay: NodeCard,
    SetVariable: NodeCard,
    Transform: NodeCard,
    CodeScript: NodeCard,
    FilterItems: NodeCard,
    SortItems: NodeCard,
    RemoveDuplicates: NodeCard,
    SplitBatches: NodeCard,
    MergeData: NodeCard,
    DateTimeFormat: NodeCard,
    RenameKeys: NodeCard,
};

interface AutomationCanvasProps {
    workflowId: string;
    onDefinitionChange?: (definition: WorkflowDefinition) => void;
}

export default function AutomationCanvas({ workflowId, onDefinitionChange }: AutomationCanvasProps) {
    const reactFlowRef = useRef<HTMLDivElement>(null);
    const { data: workflow } = useWorkflow(workflowId);

    const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<GraphError[] | null>(null);

    // Load existing definition from the workflow version
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (!workflow || initialized) return;

        // Sempre tenta carregar versões — inclusive draft v0
        import("@/lib/api/automations").then(({ fetchWorkflowVersions }) => {
            fetchWorkflowVersions(workflowId).then((versions) => {
                if (versions.length > 0) {
                    // Prioriza draft (v0), senão usa a mais recente
                    const draft = versions.find((v) => v.version_number === 0);
                    const target = draft ?? versions[versions.length - 1];
                    const def = target?.definition_json;
                    if (def?.nodes?.length) {
                        setNodes(
                            def.nodes.map((n: WorkflowNode) => ({
                                id: n.id,
                                type: n.type,
                                position: n.position,
                                data: { ...n.data, category: n.category },
                            }))
                        );
                    }
                    if (def?.edges?.length) {
                        setEdges(
                            def.edges.map((e: WorkflowEdge) => ({
                                ...e,
                                type: "default",
                            }))
                        );
                    }
                }
                setInitialized(true);
            }).catch(() => setInitialized(true));
        });
    }, [workflow, initialized, workflowId, setNodes, setEdges]);

    // Sync definition changes to parent
    useEffect(() => {
        if (!initialized) return;
        const def: WorkflowDefinition = {
            schemaVersion: "1.0",
            meta: { name: workflow?.name ?? "" },
            viewport: { x: 0, y: 0, zoom: 1 },
            nodes: nodes.map((n) => ({
                id: n.id,
                type: n.type as NodeType,
                category: (n.data as Record<string, unknown>).category as WorkflowNode["category"] ?? "utils",
                position: n.position,
                data: n.data as WorkflowNode["data"],
            })),
            edges: edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle ?? undefined,
                targetHandle: e.targetHandle ?? undefined,
                label: typeof e.label === "string" ? e.label : undefined,
            })),
        };
        onDefinitionChange?.(def);
    }, [nodes, edges, initialized, onDefinitionChange, workflow?.name]);

    const selectedNode = useMemo(
        () =>
            selectedNodeId
                ? nodes.find((n) => n.id === selectedNodeId)
                : null,
        [selectedNodeId, nodes]
    );

    // ── Handlers ────────────────────────────────────────────

    const onConnect = useCallback(
        (params: Connection) => {
            setEdges((eds) =>
                addEdge({ ...params, type: "default" }, eds)
            );
        },
        [setEdges]
    );

    const onNodeClick = useCallback((_: React.MouseEvent, node: RFNode) => {
        setSelectedNodeId(node.id);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    const handleNodeAdd = useCallback(
        (type: NodeType) => {
            const newNode = createNode(type, {
                x: 250 + Math.random() * 200,
                y: 150 + nodes.length * 100,
            });
            setNodes((nds) => [
                ...nds,
                {
                    ...newNode,
                    type: newNode.type,
                    data: { ...newNode.data, category: newNode.category },
                },
            ]);
        },
        [nodes.length, setNodes]
    );

    const handleDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            const type = event.dataTransfer.getData("application/reactflow-type") as NodeType;
            if (!type) return;

            const rect = reactFlowRef.current?.getBoundingClientRect();
            if (!rect) return;

            const newNode = createNode(type, {
                x: event.clientX - rect.left - 90,
                y: event.clientY - rect.top - 30,
            });
            setNodes((nds) => [
                ...nds,
                {
                    ...newNode,
                    type: newNode.type,
                    data: { ...newNode.data, category: newNode.category },
                },
            ]);
        },
        [setNodes]
    );

    const handleDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const handleDeleteSelected = useCallback(() => {
        if (!selectedNodeId) return;
        setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
        setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
        setSelectedNodeId(null);
    }, [selectedNodeId, setNodes, setEdges]);

    const handleConfigChange = useCallback(
        (nodeId: string, config: Record<string, unknown>) => {
            setNodes((nds) =>
                nds.map((n) =>
                    n.id === nodeId
                        ? {
                            ...n,
                            data: {
                                ...(n.data as Record<string, unknown>),
                                config,
                            },
                        }
                        : n
                )
            );
        },
        [setNodes]
    );

    const handleValidate = useCallback(() => {
        const wfNodes: WorkflowNode[] = nodes.map((n) => ({
            id: n.id,
            type: n.type as NodeType,
            category: ((n.data as Record<string, unknown>).category ?? "utils") as WorkflowNode["category"],
            position: n.position,
            data: n.data as WorkflowNode["data"],
        }));
        const wfEdges: WorkflowEdge[] = edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
        }));
        setValidationErrors(validateGraph(wfNodes, wfEdges));
        // Auto-hide after 4s if no errors
        setTimeout(() => setValidationErrors(null), 4000);
    }, [nodes, edges]);

    const handleNodeFocus = useCallback(
        (nodeId: string) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (node) {
                setSelectedNodeId(nodeId);
            }
        },
        [nodes]
    );

    return (
        <div className="flex h-full rounded-lg overflow-hidden">
            {/* Node Palette */}
            <NodePalette onNodeAdd={handleNodeAdd} />

            {/* Canvas */}
            <div className="flex-1 relative" ref={reactFlowRef}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    nodeTypes={nodeTypes}
                    fitView
                    deleteKeyCode="Delete"
                    className="bg-background"
                    proOptions={{ hideAttribution: true }}
                >
                    <Controls position="bottom-right" className="!bg-card !border !shadow-lg !rounded-lg" />
                    <MiniMap
                        position="top-right"
                        className="!bg-card !border !shadow-lg !rounded-lg"
                        maskColor="hsl(var(--muted) / 0.3)"
                        nodeColor={() => "hsl(var(--primary))"}
                    />
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--muted-foreground) / 0.15)" />

                    {/* Toolbar */}
                    <Panel position="top-left" className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleValidate}
                            className="gap-1.5 shadow"
                        >
                            <CheckSquare className="h-3.5 w-3.5" />
                            Validar
                        </Button>
                        {selectedNodeId && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDeleteSelected}
                                className="gap-1.5 shadow text-destructive hover:text-destructive"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remover
                            </Button>
                        )}
                    </Panel>
                </ReactFlow>

                {/* Validation overlay */}
                {validationErrors !== null && (
                    <ValidationPanel
                        errors={validationErrors}
                        onClose={() => setValidationErrors(null)}
                        onNodeFocus={handleNodeFocus}
                    />
                )}
            </div>

            {/* Properties Panel */}
            {selectedNode && (
                <PropertiesPanel
                    node={
                        {
                            id: selectedNode.id,
                            type: selectedNode.type as NodeType,
                            category: ((selectedNode.data as Record<string, unknown>).category ?? "utils") as WorkflowNode["category"],
                            position: selectedNode.position,
                            data: selectedNode.data as WorkflowNode["data"],
                        }
                    }
                    onConfigChange={handleConfigChange}
                    onClose={() => setSelectedNodeId(null)}
                />
            )}
        </div>
    );
}
