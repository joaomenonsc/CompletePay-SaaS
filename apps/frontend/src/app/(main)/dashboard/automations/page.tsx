"use client";

import { useRouter } from "next/navigation";
import { Activity, Play, Plus, Workflow, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkflows, useExecutions } from "@/hooks/use-automations";
import type { WorkflowResponse, ExecutionResponse } from "@/types/automations";

const statusColors: Record<string, string> = {
    DRAFT: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    PUBLISHED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    DISABLED: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
    RUNNING: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    SUCCESS: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    FAILED: "bg-red-500/10 text-red-600 border-red-500/20",
};

function MetricCard({
    title,
    value,
    icon: Icon,
    loading,
}: {
    title: string;
    value: number | string;
    icon: React.ElementType;
    loading?: boolean;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-8 w-16" />
                ) : (
                    <div className="text-2xl font-bold">{value}</div>
                )}
            </CardContent>
        </Card>
    );
}

function ExecutionRow({ execution }: { execution: ExecutionResponse }) {
    const router = useRouter();
    return (
        <tr
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => router.push(`/dashboard/automations/executions/${execution.id}`)}
        >
            <td className="py-3 px-4 text-sm">{execution.workflow_id.slice(0, 8)}…</td>
            <td className="py-3 px-4">
                <Badge variant="outline" className={statusColors[execution.status] ?? ""}>
                    {execution.status}
                </Badge>
            </td>
            <td className="py-3 px-4 text-sm text-muted-foreground">{execution.trigger_type}</td>
            <td className="py-3 px-4 text-sm text-muted-foreground">
                {execution.duration_ms != null ? `${(execution.duration_ms / 1000).toFixed(1)}s` : "—"}
            </td>
            <td className="py-3 px-4 text-sm text-muted-foreground">
                {new Date(execution.started_at).toLocaleString("pt-BR")}
            </td>
        </tr>
    );
}

export default function AutomationsOverviewPage() {
    const router = useRouter();
    const { data: workflows, isLoading: wfLoading } = useWorkflows();
    const { data: executions, isLoading: exLoading } = useExecutions({ limit: 10 });

    const totalWf = workflows?.length ?? 0;
    const publishedWf = workflows?.filter((w: WorkflowResponse) => w.status === "PUBLISHED").length ?? 0;

    return (
        <div className="space-y-8 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Automações</h1>
                    <p className="text-muted-foreground mt-1">
                        Crie e gerencie workflows automatizados com editor visual.
                    </p>
                </div>
                <Button onClick={() => router.push("/dashboard/automations/workflows/novo")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Workflow
                </Button>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard title="Total de Workflows" value={totalWf} icon={Workflow} loading={wfLoading} />
                <MetricCard title="Workflows Ativos" value={publishedWf} icon={Zap} loading={wfLoading} />
                <MetricCard
                    title="Execuções (últimas)"
                    value={executions?.length ?? 0}
                    icon={Activity}
                    loading={exLoading}
                />
            </div>

            {/* Recent Executions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Play className="h-5 w-5" />
                        Execuções Recentes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {exLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : !executions?.length ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                            Nenhuma execução ainda. Execute um workflow para ver os resultados aqui.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Workflow</th>
                                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Trigger</th>
                                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Duração</th>
                                        <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Data</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {executions.map((ex: ExecutionResponse) => (
                                        <ExecutionRow key={ex.id} execution={ex} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
