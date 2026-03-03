"use client";

import { NODE_REGISTRY, type NodeMeta } from "./builder-utils";
import type { NodeType, NodeCategory } from "@/types/automations";

const CATEGORIES: { key: NodeCategory; label: string }[] = [
    { key: "trigger", label: "Triggers" },
    { key: "action", label: "Ações" },
    { key: "logic", label: "Lógica" },
    { key: "utils", label: "Utilitários" },
    { key: "transform", label: "Transformação" },
];

interface NodePaletteProps {
    onNodeAdd: (type: NodeType) => void;
}

export default function NodePalette({ onNodeAdd }: NodePaletteProps) {
    const grouped = CATEGORIES.map((cat) => ({
        ...cat,
        nodes: NODE_REGISTRY.filter((n) => n.category === cat.key),
    }));

    const handleDragStart = (e: React.DragEvent, meta: NodeMeta) => {
        e.dataTransfer.setData("application/reactflow-type", meta.type);
        e.dataTransfer.effectAllowed = "move";
    };

    return (
        <div className="w-60 border-r bg-muted/30 overflow-y-auto flex flex-col">
            <div className="p-3 border-b">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    Nodes
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
                {grouped.map((group) => (
                    <div key={group.key}>
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider px-2 mb-1.5">
                            {group.label}
                        </p>
                        <div className="space-y-1">
                            {group.nodes.map((meta) => {
                                const Icon = meta.icon;
                                return (
                                    <div
                                        key={meta.type}
                                        className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-grab
                                            hover:bg-muted transition-colors text-sm select-none"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, meta)}
                                        onClick={() => onNodeAdd(meta.type)}
                                    >
                                        <div className={`rounded-md p-1 ${meta.color} text-white flex-shrink-0`}>
                                            <Icon className="h-3.5 w-3.5" />
                                        </div>
                                        <span className="truncate text-xs font-medium">{meta.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
