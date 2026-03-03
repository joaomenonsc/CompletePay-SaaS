/**
 * Builder utilities — funções puras para manipulação do grafo.
 */
import type { NodeType, NodeCategory, WorkflowNode, WorkflowEdge } from "@/types/automations";
import {
    Zap, Globe, Mail, ClipboardList, GitBranch,
    Clock, Variable, Shuffle, MousePointerClick, Webhook,
    Code, Filter, ArrowUpDown, CopyMinus, Split,
    Merge, CalendarClock, Replace,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Node Registry ──────────────────────────────────────────────────────────────

export interface NodeMeta {
    type: NodeType;
    label: string;
    category: NodeCategory;
    description: string;
    icon: LucideIcon;
    color: string; // tailwind classe de cor
    defaultConfig: Record<string, unknown>;
}

export const NODE_REGISTRY: NodeMeta[] = [
    // Triggers
    {
        type: "ManualTrigger", label: "Manual Trigger", category: "trigger",
        description: "Dispara via botão ou API", icon: MousePointerClick,
        color: "bg-purple-500", defaultConfig: {},
    },
    {
        type: "WebhookTrigger", label: "Webhook Trigger", category: "trigger",
        description: "Dispara por chamada HTTP", icon: Webhook,
        color: "bg-purple-500", defaultConfig: { path_slug: "" },
    },
    // Actions
    {
        type: "HttpRequest", label: "HTTP Request", category: "action",
        description: "Faz requisição a sistemas externos", icon: Globe,
        color: "bg-blue-500",
        defaultConfig: { method: "GET", url: "", headers: {}, body_template: {} },
    },
    {
        type: "SendEmail", label: "Enviar Email", category: "action",
        description: "Envia email via serviço integrado", icon: Mail,
        color: "bg-emerald-500",
        defaultConfig: { to: "", subject: "", body: "" },
    },
    {
        type: "CreateCRMTask", label: "Criar Nota CRM", category: "action",
        description: "Cria nota ou tarefa no CRM", icon: ClipboardList,
        color: "bg-orange-500",
        defaultConfig: { resource_type: "note", patient_id: "", content: "" },
    },
    // Logic
    {
        type: "IfCondition", label: "Condição", category: "logic",
        description: "Ramifica baseado em condição", icon: GitBranch,
        color: "bg-amber-500",
        defaultConfig: { left: "", operator: "eq", right: "", true_next_node_id: "", false_next_node_id: "" },
    },
    {
        type: "Delay", label: "Delay", category: "logic",
        description: "Pausa a execução (máx 55s no MVP)", icon: Clock,
        color: "bg-rose-500",
        defaultConfig: { duration: 5, unit: "seconds" },
    },
    // Utils
    {
        type: "SetVariable", label: "Set Variable", category: "utils",
        description: "Define uma variável no contexto", icon: Variable,
        color: "bg-cyan-500",
        defaultConfig: { key: "", value: "" },
    },
    {
        type: "Transform", label: "Transform", category: "utils",
        description: "Transforma dados com mapeamento", icon: Shuffle,
        color: "bg-teal-500",
        defaultConfig: { mapping: {} },
    },
    // Data Transformation
    {
        type: "CodeScript", label: "Código", category: "transform",
        description: "Executa expressão customizada", icon: Code,
        color: "bg-violet-600",
        defaultConfig: { code: "result = data" },
    },
    {
        type: "FilterItems", label: "Filtrar", category: "transform",
        description: "Filtra itens por condição", icon: Filter,
        color: "bg-indigo-500",
        defaultConfig: { field: "", operator: "eq", value: "", source: "items" },
    },
    {
        type: "SortItems", label: "Classificar", category: "transform",
        description: "Ordena lista por campo", icon: ArrowUpDown,
        color: "bg-sky-500",
        defaultConfig: { field: "", order: "asc", source: "items" },
    },
    {
        type: "RemoveDuplicates", label: "Remover Duplicadas", category: "transform",
        description: "Remove itens duplicados", icon: CopyMinus,
        color: "bg-pink-500",
        defaultConfig: { field: "", source: "items" },
    },
    {
        type: "SplitBatches", label: "Dividir em Lotes", category: "transform",
        description: "Divide lista em lotes menores", icon: Split,
        color: "bg-lime-600",
        defaultConfig: { batch_size: 10, source: "items" },
    },
    {
        type: "MergeData", label: "Juntar Dados", category: "transform",
        description: "Combina duas listas ou objetos", icon: Merge,
        color: "bg-fuchsia-500",
        defaultConfig: { source_a: "items_a", source_b: "items_b", mode: "append" },
    },
    {
        type: "DateTimeFormat", label: "Data & Hora", category: "transform",
        description: "Formata, parseia ou calcula datas", icon: CalendarClock,
        color: "bg-yellow-600",
        defaultConfig: { action: "format", input_field: "", input_format: "%Y-%m-%dT%H:%M:%S", output_format: "%d/%m/%Y %H:%M" },
    },
    {
        type: "RenameKeys", label: "Renomear Chaves", category: "transform",
        description: "Renomeia campos de objetos", icon: Replace,
        color: "bg-stone-500",
        defaultConfig: { mappings: {}, source: "items" },
    },
];

export function getNodeMeta(type: string): NodeMeta | undefined {
    return NODE_REGISTRY.find((m) => m.type === type);
}

// ── Fábricas ───────────────────────────────────────────────────────────────────

let _counter = 0;

export function createNode(
    type: NodeType,
    position: { x: number; y: number }
): WorkflowNode {
    const meta = getNodeMeta(type);
    _counter++;
    return {
        id: `node-${type.toLowerCase()}-${Date.now()}-${_counter}`,
        type,
        category: meta?.category ?? "utils",
        position,
        data: {
            label: meta?.label ?? type,
            config: { ...(meta?.defaultConfig ?? {}) },
        },
    };
}

export function createEdge(
    source: string,
    target: string,
    sourceHandle = "output",
    targetHandle = "input",
    label?: string,
): WorkflowEdge {
    return {
        id: `edge-${source}-${target}-${Date.now()}`,
        source,
        target,
        sourceHandle,
        targetHandle,
        label,
    };
}

// ── Validação de grafo (frontend) ──────────────────────────────────────────────

export interface GraphError {
    nodeId?: string;
    message: string;
}

export function validateGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]): GraphError[] {
    const errors: GraphError[] = [];

    if (nodes.length === 0) {
        errors.push({ message: "O workflow precisa ter pelo menos um node." });
        return errors;
    }

    const hasTrigger = nodes.some((n) => n.type === "ManualTrigger" || n.type === "WebhookTrigger");
    if (!hasTrigger) {
        errors.push({ message: "O workflow precisa de pelo menos um Trigger." });
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
        if (!nodeIds.has(e.source)) {
            errors.push({ message: `Edge referencia source inexistente: ${e.source}` });
        }
        if (!nodeIds.has(e.target)) {
            errors.push({ message: `Edge referencia target inexistente: ${e.target}` });
        }
    }

    // Ciclos
    if (hasCycle(nodes, edges)) {
        errors.push({ message: "Ciclos não são suportados no workflow." });
    }

    // Validação por tipo
    for (const node of nodes) {
        const config = node.data.config;
        if (node.type === "HttpRequest" && !config.url) {
            errors.push({ nodeId: node.id, message: `${node.data.label}: campo 'url' obrigatório.` });
        }
        if (node.type === "SendEmail") {
            if (!config.to) errors.push({ nodeId: node.id, message: `${node.data.label}: campo 'to' obrigatório.` });
            if (!config.subject) errors.push({ nodeId: node.id, message: `${node.data.label}: campo 'subject' obrigatório.` });
        }
        if (node.type === "SetVariable" && !config.key) {
            errors.push({ nodeId: node.id, message: `${node.data.label}: campo 'key' obrigatório.` });
        }
        if (node.type === "IfCondition" && !config.operator) {
            errors.push({ nodeId: node.id, message: `${node.data.label}: operador obrigatório.` });
        }
        if (node.type === "Delay") {
            const duration = Number(config.duration ?? 0);
            const unit = String(config.unit ?? "seconds");
            const totalSec = unit === "minutes" ? duration * 60 : duration;
            if (totalSec > 55) {
                errors.push({ nodeId: node.id, message: `${node.data.label}: máx 55s no MVP (configurado: ${totalSec}s).` });
            }
        }
        if (node.type === "CodeScript" && !config.code) {
            errors.push({ nodeId: node.id, message: `${node.data.label}: campo 'code' obrigatório.` });
        }
        if (node.type === "FilterItems" && !config.field) {
            errors.push({ nodeId: node.id, message: `${node.data.label}: campo 'field' obrigatório.` });
        }
        if (node.type === "SortItems" && !config.field) {
            errors.push({ nodeId: node.id, message: `${node.data.label}: campo 'field' obrigatório.` });
        }
        if (node.type === "DateTimeFormat" && !config.input_field && config.action !== "now") {
            errors.push({ nodeId: node.id, message: `${node.data.label}: campo 'input_field' obrigatório.` });
        }
        if (node.type === "RenameKeys" && (!config.mappings || Object.keys(config.mappings as object).length === 0)) {
            errors.push({ nodeId: node.id, message: `${node.data.label}: mapeamento 'mappings' obrigatório.` });
        }
    }

    return errors;
}

function hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
    const inDeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of nodes) {
        inDeg.set(n.id, 0);
        adj.set(n.id, []);
    }
    for (const e of edges) {
        if (inDeg.has(e.source) && inDeg.has(e.target)) {
            adj.get(e.source)!.push(e.target);
            inDeg.set(e.target, (inDeg.get(e.target)! + 1));
        }
    }
    const queue = [...inDeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
    let visited = 0;
    while (queue.length) {
        const curr = queue.shift()!;
        visited++;
        for (const nb of adj.get(curr) ?? []) {
            inDeg.set(nb, inDeg.get(nb)! - 1);
            if (inDeg.get(nb) === 0) queue.push(nb);
        }
    }
    return visited !== nodes.length;
}

export function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const inDeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const n of nodes) {
        inDeg.set(n.id, 0);
        adj.set(n.id, []);
    }
    for (const e of edges) {
        if (adj.has(e.source) && inDeg.has(e.target)) {
            adj.get(e.source)!.push(e.target);
            inDeg.set(e.target, (inDeg.get(e.target)! + 1));
        }
    }
    const queue = [...inDeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
    const result: WorkflowNode[] = [];
    while (queue.length) {
        const curr = queue.shift()!;
        result.push(nodeMap.get(curr)!);
        for (const nb of adj.get(curr) ?? []) {
            inDeg.set(nb, inDeg.get(nb)! - 1);
            if (inDeg.get(nb) === 0) queue.push(nb);
        }
    }
    return result;
}
