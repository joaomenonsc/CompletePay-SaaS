"use client";

import { useState } from "react";
import {
    Plus,
    Loader2,
    Send,
    Pause,
    PlayCircle,
    BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CampaignProgressBar } from "@/components/whatsapp/campaign-progress-bar";
import {
    useCampaigns,
    useCreateCampaign,
    useStartCampaign,
    usePauseCampaign,
    useCampaignProgress,
    useAccounts,
    useTemplates,
    usePreviewRecipients,
} from "@/hooks/use-whatsapp";
import type { WACampaignCreate, WACampaignStatus } from "@/types/whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<
    WACampaignStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
    draft: { label: "Rascunho", variant: "secondary" },
    scheduled: { label: "Agendada", variant: "outline" },
    running: { label: "Rodando", variant: "default" },
    paused: { label: "Pausada", variant: "outline" },
    completed: { label: "Concluída", variant: "default" },
    failed: { label: "Falhou", variant: "destructive" },
};

function CampaignProgressSection({ campaignId, status }: { campaignId: string; status: WACampaignStatus }) {
    const { data: progress } = useCampaignProgress(
        campaignId,
        status === "running" || status === "paused" || status === "completed"
    );
    if (!progress) return null;
    return <CampaignProgressBar progress={progress} className="mt-4" />;
}

export default function WhatsAppCampanhasPage() {
    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState<WACampaignCreate>({
        account_id: "",
        name: "",
        template_id: "",
        messages_per_minute: 30,
    });

    const { data: campaignsData, isLoading } = useCampaigns();
    const { data: accountsData } = useAccounts();
    const { data: templatesData } = useTemplates({ status: "approved" });
    const { data: preview } = usePreviewRecipients();
    const createCampaign = useCreateCampaign();
    const startCampaign = useStartCampaign();
    const pauseCampaign = usePauseCampaign();

    const campaigns = campaignsData?.items ?? [];
    const accounts = accountsData?.items ?? [];
    const templates = templatesData?.items ?? [];

    const handleCreate = () => {
        if (!form.account_id || !form.name || !form.template_id) {
            toast.error("Conta, nome e template são obrigatórios.");
            return;
        }
        createCampaign.mutate(form, {
            onSuccess: () => {
                toast.success("Campanha criada!");
                setCreateOpen(false);
                setForm({ account_id: "", name: "", template_id: "", messages_per_minute: 30 });
            },
            onError: () => toast.error("Erro ao criar campanha"),
        });
    };

    return (
        <main className="space-y-6">
            {/* Header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Campanhas WhatsApp</h1>
                    <p className="text-sm text-muted-foreground">
                        Envie mensagens em escala para seus contatos.
                    </p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 size-4" />
                            Nova campanha
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Nova campanha</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label>Nome *</Label>
                                <Input
                                    placeholder="ex: Promoção Julho"
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm({ ...form, name: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Conta WhatsApp *</Label>
                                <Select
                                    value={form.account_id}
                                    onValueChange={(v) =>
                                        setForm({ ...form, account_id: v })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione uma conta..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((acc) => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                {acc.display_name} ({acc.phone_number})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {accounts.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        <Link
                                            href="/dashboard/whatsapp/configuracoes"
                                            className="underline"
                                        >
                                            Adicione uma conta
                                        </Link>{" "}
                                        primeiro.
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label>Template *</Label>
                                <Select
                                    value={form.template_id}
                                    onValueChange={(v) =>
                                        setForm({ ...form, template_id: v })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione template aprovado..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map((tpl) => (
                                            <SelectItem key={tpl.id} value={tpl.id}>
                                                {tpl.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {templates.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Nenhum template aprovado.{" "}
                                        <Link
                                            href="/dashboard/whatsapp/templates"
                                            className="underline"
                                        >
                                            Aprovar templates
                                        </Link>
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label>Mensagens por minuto</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={form.messages_per_minute}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            messages_per_minute: Number(e.target.value),
                                        })
                                    }
                                />
                            </div>
                            {/* Preview */}
                            {preview && (
                                <div className="rounded-md border bg-muted/50 p-3 text-xs">
                                    <span className="font-medium">
                                        {preview.total.toLocaleString()}
                                    </span>{" "}
                                    contatos elegíveis •{" "}
                                    <span className="text-muted-foreground">
                                        {preview.opted_out_excluded} opt-outs excluídos
                                    </span>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                onClick={handleCreate}
                                disabled={createCampaign.isPending}
                            >
                                {createCampaign.isPending ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                    <Send className="mr-2 size-4" />
                                )}
                                Criar campanha
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            {/* Lista de campanhas */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
            ) : campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                    <Send className="mb-3 size-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium">Nenhuma campanha</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Crie campanhas para enviar mensagens em escala para seus contatos.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {campaigns.map((camp) => (
                        <Card key={camp.id}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <CardTitle className="text-base">{camp.name}</CardTitle>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {camp.total_recipients?.toLocaleString() ?? 0} destinatários
                                            {camp.started_at
                                                ? ` · Iniciada ${format(new Date(camp.started_at), "dd/MM/yy HH:mm", { locale: ptBR })}`
                                                : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={
                                                statusConfig[camp.status]?.variant ?? "outline"
                                            }
                                        >
                                            {statusConfig[camp.status]?.label ?? camp.status}
                                        </Badge>
                                        {camp.status === "draft" && (
                                            <Button
                                                size="sm"
                                                disabled={startCampaign.isPending}
                                                onClick={() =>
                                                    startCampaign.mutate(camp.id, {
                                                        onSuccess: () =>
                                                            toast.success("Campanha iniciada!"),
                                                        onError: (e) =>
                                                            toast.error(
                                                                `Erro: ${(e as Error).message}`
                                                            ),
                                                    })
                                                }
                                            >
                                                <PlayCircle className="mr-1.5 size-3.5" />
                                                Iniciar
                                            </Button>
                                        )}
                                        {camp.status === "running" && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={pauseCampaign.isPending}
                                                onClick={() =>
                                                    pauseCampaign.mutate(camp.id, {
                                                        onSuccess: () =>
                                                            toast.success("Campanha pausada"),
                                                        onError: () =>
                                                            toast.error("Erro ao pausar"),
                                                    })
                                                }
                                            >
                                                <Pause className="mr-1.5 size-3.5" />
                                                Pausar
                                            </Button>
                                        )}
                                        {camp.status === "paused" && (
                                            <Button
                                                size="sm"
                                                disabled={startCampaign.isPending}
                                                onClick={() =>
                                                    startCampaign.mutate(camp.id, {
                                                        onSuccess: () =>
                                                            toast.success("Campanha retomada!"),
                                                        onError: () =>
                                                            toast.error("Erro ao retomar"),
                                                    })
                                                }
                                            >
                                                <PlayCircle className="mr-1.5 size-3.5" />
                                                Retomar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <CampaignProgressSection
                                    campaignId={camp.id}
                                    status={camp.status}
                                />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </main>
    );
}
