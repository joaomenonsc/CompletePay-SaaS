"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GraphError } from "./builder-utils";

interface ValidationPanelProps {
    errors: GraphError[];
    onClose: () => void;
    onNodeFocus?: (nodeId: string) => void;
}

export default function ValidationPanel({ errors, onClose, onNodeFocus }: ValidationPanelProps) {
    if (errors.length === 0) {
        return (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
                <div className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Workflow válido!</span>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4">
            <div className="bg-card border border-red-500/20 rounded-xl shadow-xl max-h-48 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-semibold text-red-600">
                            {errors.length} {errors.length === 1 ? "erro" : "erros"}
                        </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
                <div className="overflow-y-auto px-4 py-2 space-y-1">
                    {errors.map((err, i) => (
                        <div
                            key={i}
                            className={`text-xs py-1.5 ${err.nodeId ? "cursor-pointer hover:text-red-600" : ""
                                }`}
                            onClick={() => err.nodeId && onNodeFocus?.(err.nodeId)}
                        >
                            <span className="text-red-500">•</span>{" "}
                            {err.message}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
