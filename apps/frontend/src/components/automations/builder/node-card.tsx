"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getNodeMeta } from "./builder-utils";

interface AutomationNodeData {
    label: string;
    config: Record<string, unknown>;
    [key: string]: unknown;
}

function NodeCard({ data, type, selected }: NodeProps) {
    const nodeData = data as unknown as AutomationNodeData;
    const meta = getNodeMeta(type ?? "");
    const Icon = meta?.icon;

    const isTrigger = meta?.category === "trigger";
    const isCondition = type === "IfCondition";

    return (
        <div
            className={`
                relative min-w-[180px] rounded-xl border-2 bg-card shadow-lg
                transition-all duration-200
                ${selected
                    ? "border-primary ring-2 ring-primary/20 scale-[1.02]"
                    : "border-border hover:border-primary/40 hover:shadow-xl"}
            `}
        >
            {/* Input handle (not for triggers) */}
            {!isTrigger && (
                <Handle
                    type="target"
                    position={Position.Top}
                    id="input"
                    className="!w-3 !h-3 !bg-primary !border-2 !border-background !-top-1.5"
                />
            )}

            {/* Header bar */}
            <div className={`h-1.5 w-full rounded-t-[10px] ${meta?.color ?? "bg-zinc-500"}`} />

            {/* Content */}
            <div className="p-3 flex items-center gap-2.5">
                <div className={`rounded-lg p-1.5 ${meta?.color ?? "bg-zinc-500"} text-white flex-shrink-0`}>
                    {Icon && <Icon className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{nodeData.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                        {meta?.description ?? type}
                    </div>
                </div>
            </div>

            {/* Output handle */}
            {isCondition ? (
                <>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="true"
                        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background !-bottom-1.5"
                        style={{ left: "30%" }}
                    />
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="false"
                        className="!w-3 !h-3 !bg-red-500 !border-2 !border-background !-bottom-1.5"
                        style={{ left: "70%" }}
                    />
                    <div className="flex justify-between px-6 -mb-1 text-[9px] text-muted-foreground">
                        <span className="text-emerald-600">True</span>
                        <span className="text-red-600">False</span>
                    </div>
                </>
            ) : (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="output"
                    className="!w-3 !h-3 !bg-primary !border-2 !border-background !-bottom-1.5"
                />
            )}
        </div>
    );
}

export default memo(NodeCard);
