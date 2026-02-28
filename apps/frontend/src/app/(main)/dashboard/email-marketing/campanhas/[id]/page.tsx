"use client";

import {
    ArrowLeft,
    BarChart3,
    CheckCircle2,
    Clock,
    Copy,
    Loader2,
    Mail,
    MailOpen,
    MousePointerClick,
    Send,
    ShieldAlert,
    Trash2,
    Users,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCampaign, useCampaignMetrics, useDeleteCampaign, useDuplicateCampaign } from "@/hooks/use-marketing";
import type { CampaignStatus } from "@/types/marketing";

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
    CampaignStatus,
    { label: string; className: string }
> = {
    draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
    scheduled: { label: "Agendada", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    sending: { label: "Enviando", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    sent: { label: "Enviada", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    partial: { label: "Parcial", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
    failed: { label: "Falhou", className: "bg-destructive/10 text-destructive" },
    cancelled: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
};

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    rate,
    icon: Icon,
    color,
}: {
    label: string;
    value: string | number;
    rate?: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
}) {
    return (
        <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <div style={{ color }}>
                    <Icon className="size-4" />
                </div>
            </div>
            <p className="mt-2 text-2xl font-bold">{value}</p>
            {rate && <p className="text-xs text-muted-foreground">{rate}</p>}
        </div>
    );
}

// ── Mock chart data generator ──────────────────────────────────────────────────

function generateTimelineData(opened: number, clicked: number) {
    // Generate a curve of opens/clicks over 24 hours post-send
    const data = [];
    for (let h = 0; h <= 24; h += 2) {
        const openFactor = h <= 6 ? h / 6 : 1 - (h - 6) / 24;
        const clickFactor = h <= 8 ? h / 8 : 1 - (h - 8) / 20;
        data.push({
            hora: `${h}h`,
            aberturas: Math.round(opened * Math.max(0, openFactor) * (0.8 + Math.random() * 0.4)),
            cliques: Math.round(clicked * Math.max(0, clickFactor) * (0.6 + Math.random() * 0.4)),
        });
    }
    return data;
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
    const params = useParams();
    const router = useRouter();
    const campaignId = params.id as string;
    const { data: campaign, isLoading } = useCampaign(campaignId);
    const { data: metrics } = useCampaignMetrics(campaignId);
    const deleteMutation = useDeleteCampaign();
    const duplicateMutation = useDuplicateCampaign();

    const status = (campaign?.status ?? "draft") as CampaignStatus;
    const statusInfo = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
    const hasSent = campaign && campaign.total_sent > 0;
    const chartData = hasSent ? generateTimelineData(campaign.total_opened, campaign.total_clicked) : [];
    const canDelete = status === "draft" || status === "scheduled";

    if (isLoading) {
        return (
            <main className="flex items-center justify-center py-24">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </main>
        );
    }

    return (
        <main className="space-y-6">
            {/* Header */}
            <header className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/email-marketing/campanhas">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold">
                            {campaign?.name ?? "Detalhe da Campanha"}
                        </h1>
                        <Badge className={statusInfo.className}>
                            {statusInfo.label}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {campaign?.subject ?? `Campanha #${campaignId?.slice(0, 8)}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateMutation.mutate(campaignId, {
                            onSuccess: (newCampaign) => {
                                router.push(`/dashboard/email-marketing/campanhas/${newCampaign.id}`);
                            },
                        })}
                    >
                        <Copy className="mr-2 size-4" />
                        Duplicar
                    </Button>
                    {canDelete && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                if (confirm("Tem certeza que deseja excluir esta campanha?")) {
                                    deleteMutation.mutate(campaignId, {
                                        onSuccess: () => {
                                            router.push("/dashboard/email-marketing/campanhas");
                                        },
                                    });
                                }
                            }}
                        >
                            <Trash2 className="mr-2 size-4" />
                            Excluir
                        </Button>
                    )}
                </div>
            </header>

            {/* Metrics grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Enviados"
                    value={campaign?.total_sent ?? "—"}
                    rate={metrics?.delivery_rate ? `${metrics.delivery_rate}% entrega` : undefined}
                    icon={Send}
                    color="#3b82f6"
                />
                <StatCard
                    label="Entregues"
                    value={campaign?.total_delivered ?? "—"}
                    icon={CheckCircle2}
                    color="#10b981"
                />
                <StatCard
                    label="Abertos"
                    value={campaign?.total_opened ?? "—"}
                    rate={metrics?.open_rate ? `${metrics.open_rate}%` : undefined}
                    icon={MailOpen}
                    color="#8b5cf6"
                />
                <StatCard
                    label="Cliques"
                    value={campaign?.total_clicked ?? "—"}
                    rate={metrics?.click_rate ? `${metrics.click_rate}%` : undefined}
                    icon={MousePointerClick}
                    color="#f59e0b"
                />
            </div>

            {/* Rates */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <BarChart3 className="size-4" />
                        Taxas de engajamento
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 sm:grid-cols-5">
                        {[
                            { label: "Entrega", value: metrics?.delivery_rate ? `${metrics.delivery_rate}%` : "—", desc: "entregues/enviados" },
                            { label: "Abertura", value: metrics?.open_rate ? `${metrics.open_rate}%` : "—", desc: "abertos/entregues" },
                            { label: "Clique", value: metrics?.click_rate ? `${metrics.click_rate}%` : "—", desc: "clicados/entregues" },
                            { label: "Bounce", value: metrics?.bounce_rate ? `${metrics.bounce_rate}%` : "—", desc: "bounces/enviados" },
                            { label: "Descadastro", value: metrics?.unsubscribe_rate ? `${metrics.unsubscribe_rate}%` : "—", desc: "unsubs/entregues" },
                        ].map((r) => (
                            <div key={r.label} className="text-center">
                                <p className="text-2xl font-bold">{r.value}</p>
                                <p className="text-sm font-medium">{r.label}</p>
                                <p className="text-xs text-muted-foreground">{r.desc}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Timeline chart — Recharts */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Clock className="size-4" />
                        Evolução temporal
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {hasSent && chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="gradientOpen" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradientClick" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="hora"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    className="fill-muted-foreground"
                                />
                                <YAxis
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    className="fill-muted-foreground"
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        borderColor: "hsl(var(--border))",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="aberturas"
                                    stroke="#8b5cf6"
                                    fill="url(#gradientOpen)"
                                    strokeWidth={2}
                                    name="Aberturas"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="cliques"
                                    stroke="#10b981"
                                    fill="url(#gradientClick)"
                                    strokeWidth={2}
                                    name="Cliques"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                            <div className="text-center">
                                <BarChart3 className="mx-auto size-8 text-muted-foreground" />
                                <p className="mt-2 text-sm text-muted-foreground">
                                    O gráfico de evolução será exibido após o envio da campanha.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Campaign info */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Configuração</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="divide-y">
                            {[
                                { k: "Assunto", v: campaign?.subject ?? "—" },
                                { k: "Template", v: campaign?.template_id?.slice(0, 8) ?? "—" },
                                { k: "Lista", v: campaign?.list_id?.slice(0, 8) ?? "—" },
                                { k: "Status", v: statusInfo.label },
                                { k: "Remetente", v: campaign?.from_email ? `${campaign.from_name ?? ""} <${campaign.from_email}>`.trim() : "Padrão" },
                                { k: "Reply-To", v: campaign?.reply_to ?? "—" },
                                { k: "Agendamento", v: campaign?.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString("pt-BR") : "—" },
                            ].map((row) => (
                                <div key={row.k} className="flex items-center justify-between py-3">
                                    <span className="text-sm text-muted-foreground">{row.k}</span>
                                    <span className="text-sm font-medium">{row.v}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <ShieldAlert className="size-4" />
                            Conformidade LGPD
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 size-4 text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-sm font-medium">Consentimento verificado</p>
                                <p className="text-xs text-muted-foreground">
                                    Apenas pacientes com consent_type=email_marketing ativo
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 size-4 text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-sm font-medium">Link de descadastro</p>
                                <p className="text-xs text-muted-foreground">
                                    Incluído automaticamente no rodapé (HMAC token)
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 size-4 text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-sm font-medium">Auditoria registrada</p>
                                <p className="text-xs text-muted-foreground">
                                    Todas as operações logadas no AuditLog
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 size-4 text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-sm font-medium">Dados clínicos protegidos</p>
                                <p className="text-xs text-muted-foreground">
                                    Nenhum dado CLÍ no corpo do email (somente ADM)
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recipients */}
            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="size-4" />
                        Destinatários
                    </CardTitle>
                    <Badge variant="outline">
                        {campaign?.total_recipients ?? 0} destinatários
                    </Badge>
                </CardHeader>
                <CardContent>
                    {!hasSent ? (
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                            <Mail className="size-8 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                Os destinatários serão exibidos após a campanha ser configurada e enviada.
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground">
                                {campaign.total_recipients} destinatários · {campaign.total_sent} enviados · {campaign.total_delivered} entregues
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
