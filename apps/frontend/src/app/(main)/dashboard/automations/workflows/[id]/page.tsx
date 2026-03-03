"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
    ArrowLeft,
    Check,
    Code2,
    History,
    Pause,
    Play,
    Save,
    Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    useWorkflow,
    useUpdateWorkflow,
    usePublishWorkflow,
    useDisableWorkflow,
    useExecuteWorkflow,
    useExecutions,
    useWorkflowVersions,
} from "@/hooks/use-automations";
import type { ExecutionResponse, WorkflowVersionResponse, WorkflowDefinition } from "@/types/automations";
import AutomationCanvas from "@/components/automations/builder/automation-canvas";

const statusColors: Record<string, string> = {
    DRAFT: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    PUBLISHED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    DISABLED: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const execStatusColors: Record<string, string> = {
    RUNNING: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    SUCCESS: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    FAILED: "bg-red-500/10 text-red-600 border-red-500/20",
    SKIPPED: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

export default function WorkflowDetailPage() {
    const params = useParams();
    const router = useRouter();
    const workflowId = params?.id as string;

    const { data: workflow, isLoading, isFetching } = useWorkflow(workflowId ?? null);
    const updateWorkflow = useUpdateWorkflow();
    const publishWorkflow = usePublishWorkflow();
    const disableWorkflow = useDisableWorkflow();
    const executeWorkflow = useExecuteWorkflow();
    const { data: executions } = useExecutions({ workflow_id: workflowId, limit: 20 });
    const { data: versions } = useWorkflowVersions(workflowId ?? null);

    const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
    const [executePayload, setExecutePayload] = useState("{}");
    const [showExecuteDialog, setShowExecuteDialog] = useState(false);

    if (isLoading && !workflow) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-[600px]" />
            </div>
        );
    }

    if (!workflow) {
        return (
            <div className="p-6">
                <p className="text-muted-foreground">Workflow não encontrado.</p>
            </div>
        );
    }

    const handleSaveDraft = () => {
        if (!definition) return;
        updateWorkflow.mutate({ id: workflowId, body: { definition } });
    };

    const handlePublish = () => {
        if (!definition) return;
        publishWorkflow.mutate({ id: workflowId, body: { definition } });
    };

    const handleDisable = () => {
        disableWorkflow.mutate(workflowId);
    };

    const handleExecute = () => {
        let payload = {};
        try {
            payload = JSON.parse(executePayload);
        } catch {
            // fallback to empty
        }
        executeWorkflow.mutate(
            { id: workflowId, body: { payload } },
            {
                onSuccess: (ex) => {
                    setShowExecuteDialog(false);
                    router.push(`/dashboard/automations/executions/${ex.id}`);
                },
            }
        );
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push("/dashboard/automations/workflows")}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">{workflow.name}</h1>
                        <Badge variant="outline" className={statusColors[workflow.status] ?? ""}>
                            {workflow.status}
                        </Badge>
                    </div>
                    {workflow.description && (
                        <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {workflow.status === "PUBLISHED" && (
                        <>
                            <Dialog open={showExecuteDialog} onOpenChange={setShowExecuteDialog}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="gap-2">
                                        <Play className="h-4 w-4" />
                                        Executar
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Executar Workflow</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Payload (JSON)</Label>
                                            <Textarea
                                                value={executePayload}
                                                onChange={(e) => setExecutePayload(e.target.value)}
                                                rows={6}
                                                placeholder='{"email": "test@example.com"}'
                                                className="font-mono text-sm"
                                            />
                                        </div>
                                        <Button
                                            className="w-full"
                                            onClick={handleExecute}
                                            disabled={executeWorkflow.isPending}
                                        >
                                            {executeWorkflow.isPending ? "Executando..." : "▶ Executar"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                            <Button variant="outline" onClick={handleDisable} className="gap-2">
                                <Pause className="h-4 w-4" />
                                Desativar
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="builder">
                <TabsList>
                    <TabsTrigger value="builder" className="gap-2">
                        <Code2 className="h-4 w-4" />
                        Builder
                    </TabsTrigger>
                    <TabsTrigger value="executions" className="gap-2">
                        <Play className="h-4 w-4" />
                        Execuções
                    </TabsTrigger>
                    <TabsTrigger value="versions" className="gap-2">
                        <History className="h-4 w-4" />
                        Versões
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-2">
                        <Settings className="h-4 w-4" />
                        Configurações
                    </TabsTrigger>
                </TabsList>

                {/* Builder Tab */}
                <TabsContent value="builder" className="mt-4">
                    <div className="rounded-lg border bg-background" style={{ height: "calc(100vh - 320px)" }}>
                        <AutomationCanvas
                            workflowId={workflowId}
                            onDefinitionChange={setDefinition}
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button
                            variant="outline"
                            onClick={handleSaveDraft}
                            disabled={!definition || updateWorkflow.isPending}
                            className="gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {updateWorkflow.isPending ? "Salvando..." : "Salvar Rascunho"}
                        </Button>
                        <Button
                            onClick={handlePublish}
                            disabled={!definition || publishWorkflow.isPending}
                            className="gap-2"
                        >
                            <Check className="h-4 w-4" />
                            {publishWorkflow.isPending ? "Publicando..." : "Publicar"}
                        </Button>
                    </div>
                </TabsContent>

                {/* Executions Tab */}
                <TabsContent value="executions" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Histórico de Execuções</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!executions?.length ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">
                                    Nenhuma execução encontrada.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground uppercase">ID</th>
                                                <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                                <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Trigger</th>
                                                <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Duração</th>
                                                <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Data</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {executions.map((ex: ExecutionResponse) => (
                                                <tr
                                                    key={ex.id}
                                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => router.push(`/dashboard/automations/executions/${ex.id}`)}
                                                >
                                                    <td className="py-3 px-4 text-sm font-mono">{ex.id.slice(0, 8)}…</td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant="outline" className={execStatusColors[ex.status] ?? ""}>
                                                            {ex.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm">{ex.trigger_type}</td>
                                                    <td className="py-3 px-4 text-sm">
                                                        {ex.duration_ms != null ? `${(ex.duration_ms / 1000).toFixed(1)}s` : "—"}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-muted-foreground">
                                                        {new Date(ex.started_at).toLocaleString("pt-BR")}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Versions Tab */}
                <TabsContent value="versions" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Versões Publicadas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!versions?.length ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">
                                    Nenhuma versão publicada.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {versions.map((v: WorkflowVersionResponse) => (
                                        <div
                                            key={v.id}
                                            className="flex items-center justify-between p-4 rounded-lg border"
                                        >
                                            <div>
                                                <div className="font-medium">Versão {v.version_number}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    Publicada em {v.published_at ? new Date(v.published_at).toLocaleString("pt-BR") : "—"}
                                                </div>
                                            </div>
                                            <Badge variant="outline">
                                                {v.id === workflow.current_version_id ? "Atual" : `v${v.version_number}`}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Configurações</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium">ID do Workflow</Label>
                                <p className="text-sm font-mono text-muted-foreground mt-1">{workflow.id}</p>
                            </div>
                            <div>
                                <Label className="text-sm font-medium">Organização</Label>
                                <p className="text-sm font-mono text-muted-foreground mt-1">{workflow.organization_id}</p>
                            </div>
                            <div>
                                <Label className="text-sm font-medium">Criado por</Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {workflow.created_by ?? "—"} em {new Date(workflow.created_at).toLocaleString("pt-BR")}
                                </p>
                            </div>
                            {workflow.status === "PUBLISHED" && (
                                <div>
                                    <Label className="text-sm font-medium">Webhook URL</Label>
                                    <p className="text-sm font-mono text-muted-foreground mt-1 break-all">
                                        POST /api/v1/automations/webhooks/&lt;slug&gt;
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        O secret do webhook é exibido apenas na criação (verifique os logs do servidor).
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
