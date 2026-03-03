"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, XCircle, MinusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useExecution, useExecutionSteps } from "@/hooks/use-automations";
import type { ExecutionStepResponse } from "@/types/automations";

const statusIcons: Record<string, React.ElementType> = {
    SUCCESS: CheckCircle2,
    FAILED: XCircle,
    RUNNING: Clock,
    SKIPPED: MinusCircle,
};

const statusColors: Record<string, string> = {
    RUNNING: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    SUCCESS: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    FAILED: "bg-red-500/10 text-red-600 border-red-500/20",
    SKIPPED: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

function StepItem({ step, index }: { step: ExecutionStepResponse; index: number }) {
    const Icon = statusIcons[step.status] ?? Clock;

    return (
        <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-4 w-full p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                <span className="text-sm font-mono text-muted-foreground w-6">#{index + 1}</span>
                <Icon
                    className={`h-5 w-5 ${step.status === "SUCCESS"
                            ? "text-emerald-600"
                            : step.status === "FAILED"
                                ? "text-red-600"
                                : step.status === "RUNNING"
                                    ? "text-blue-500 animate-spin"
                                    : "text-zinc-400"
                        }`}
                />
                <div className="flex-1">
                    <div className="font-medium text-sm">{step.node_type}</div>
                    <div className="text-xs text-muted-foreground">Node: {step.node_id.slice(0, 8)}…</div>
                </div>
                <Badge variant="outline" className={statusColors[step.status] ?? ""}>
                    {step.status}
                </Badge>
                {step.duration_ms != null && (
                    <span className="text-xs text-muted-foreground">{step.duration_ms}ms</span>
                )}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-14 pb-4 space-y-3">
                {step.error_message && (
                    <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
                        <p className="text-sm text-red-600 font-mono">{step.error_message}</p>
                    </div>
                )}
                {step.input_json && (
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1 uppercase">Input</p>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40 font-mono">
                            {JSON.stringify(step.input_json, null, 2)}
                        </pre>
                    </div>
                )}
                {step.output_json && (
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1 uppercase">Output</p>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40 font-mono">
                            {JSON.stringify(step.output_json, null, 2)}
                        </pre>
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}

export default function ExecutionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const executionId = params?.id as string;

    const { data: execution, isLoading } = useExecution(executionId ?? null);
    const { data: steps } = useExecutionSteps(executionId ?? null);

    if (isLoading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-24" />
                <Skeleton className="h-48" />
            </div>
        );
    }

    if (!execution) {
        return (
            <div className="p-6">
                <p className="text-muted-foreground">Execução não encontrada.</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">Execução</h1>
                        <Badge variant="outline" className={statusColors[execution.status] ?? ""}>
                            {execution.status}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Trigger: {execution.trigger_type} • {new Date(execution.started_at).toLocaleString("pt-BR")}
                        {execution.duration_ms != null && ` • ${(execution.duration_ms / 1000).toFixed(1)}s`}
                    </p>
                </div>
            </div>

            {/* Error Summary */}
            {execution.error_summary && (
                <Card className="border-red-500/20">
                    <CardContent className="py-4">
                        <p className="text-sm text-red-600 font-mono">{execution.error_summary}</p>
                    </CardContent>
                </Card>
            )}

            {/* Steps */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Steps ({steps?.length ?? 0})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {!steps?.length ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            Nenhum step registrado.
                        </p>
                    ) : (
                        steps.map((step: ExecutionStepResponse, i: number) => (
                            <StepItem key={step.id} step={step} index={i} />
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
