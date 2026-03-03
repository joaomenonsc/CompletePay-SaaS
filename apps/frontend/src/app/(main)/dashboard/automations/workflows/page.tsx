"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useWorkflows, useDeleteWorkflow } from "@/hooks/use-automations";
import type { WorkflowResponse, WorkflowStatus } from "@/types/automations";
import { useState } from "react";

const statusColors: Record<string, string> = {
    DRAFT: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    PUBLISHED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    DISABLED: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const statusLabels: Record<string, string> = {
    DRAFT: "Rascunho",
    PUBLISHED: "Publicado",
    DISABLED: "Desativado",
};

export default function WorkflowsListPage() {
    const router = useRouter();
    const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "ALL">("ALL");
    const { data: workflows, isLoading } = useWorkflows(
        statusFilter !== "ALL" ? { status: statusFilter } : undefined
    );
    const deleteWorkflow = useDeleteWorkflow();

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Gerencie seus workflows de automação.
                    </p>
                </div>
                <Button onClick={() => router.push("/dashboard/automations/workflows/novo")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Workflow
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as WorkflowStatus | "ALL")}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos</SelectItem>
                        <SelectItem value="DRAFT">Rascunho</SelectItem>
                        <SelectItem value="PUBLISHED">Publicado</SelectItem>
                        <SelectItem value="DISABLED">Desativado</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                </div>
            ) : !workflows?.length ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">Nenhum workflow encontrado</h3>
                        <p className="text-sm text-muted-foreground mt-1 mb-4">
                            Crie seu primeiro workflow de automação.
                        </p>
                        <Button onClick={() => router.push("/dashboard/automations/workflows/novo")}>
                            <Plus className="mr-2 h-4 w-4" />
                            Criar Workflow
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Nome</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Atualizado</th>
                                <th className="py-3 px-4 text-right text-xs font-medium text-muted-foreground uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {workflows.map((wf: WorkflowResponse) => (
                                <tr
                                    key={wf.id}
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => router.push(`/dashboard/automations/workflows/${wf.id}`)}
                                >
                                    <td className="py-3 px-4">
                                        <div>
                                            <div className="font-medium">{wf.name}</div>
                                            {wf.description && (
                                                <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-sm">
                                                    {wf.description}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <Badge variant="outline" className={statusColors[wf.status] ?? ""}>
                                            {statusLabels[wf.status] ?? wf.status}
                                        </Badge>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-muted-foreground">
                                        {new Date(wf.updated_at).toLocaleString("pt-BR")}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger
                                                asChild
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/dashboard/automations/workflows/${wf.id}`);
                                                    }}
                                                >
                                                    Abrir
                                                </DropdownMenuItem>
                                                {wf.status === "DRAFT" && (
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteWorkflow.mutate(wf.id);
                                                        }}
                                                    >
                                                        Excluir
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
