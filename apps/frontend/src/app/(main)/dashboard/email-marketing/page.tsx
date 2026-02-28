"use client";

import {
    BarChart3,
    Loader2,
    Mail,
    MousePointerClick,
    Send,
    TrendingUp,
    Users,
    AlertTriangle,
    Plus,
    ArrowRight,
    FileText,
    Clock,
    CheckCircle2,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOverviewMetrics, useCampaigns } from "@/hooks/use-marketing";

// ── Status badge helper ────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Rascunho", variant: "secondary" },
    scheduled: { label: "Agendada", variant: "outline" },
    sending: { label: "Enviando", variant: "default" },
    sent: { label: "Enviada", variant: "default" },
    partial: { label: "Parcial", variant: "destructive" },
    failed: { label: "Falhou", variant: "destructive" },
    cancelled: { label: "Cancelada", variant: "secondary" },
};

// ── Metric card ────────────────────────────────────────────────────────────────

function MetricCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    color,
}: {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    trend?: string;
    color: string;
}) {
    return (
        <Card className="relative overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className="text-3xl font-bold tracking-tight">{value}</p>
                        <p className="text-xs text-muted-foreground">{subtitle}</p>
                    </div>
                    <div
                        className="flex size-12 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${color}15`, color }}
                    >
                        <Icon className="size-6" />
                    </div>
                </div>
                {trend && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-emerald-600">
                        <TrendingUp className="size-3" />
                        <span>{trend}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function EmailMarketingDashboard() {
    const { data: metrics, isLoading: metricsLoading } = useOverviewMetrics();
    const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns({ limit: 5 });
    const recentCampaigns = campaignsData?.items ?? metrics?.recent_campaigns ?? [];

    return (
        <main className="space-y-6">
            {/* Header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Email Marketing</h1>
                    <p className="text-sm text-muted-foreground">
                        Crie campanhas, gerencie templates e acompanhe métricas de engajamento.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/email-marketing/campanhas/nova">
                        <Plus className="mr-2 size-4" />
                        Nova campanha
                    </Link>
                </Button>
            </header>

            {/* Metrics grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Total enviados"
                    value={metricsLoading ? "..." : (metrics?.total_sent?.toLocaleString() ?? "0")}
                    subtitle={metrics?.total_sent ? `${metrics.total_campaigns} campanhas` : "Nenhuma campanha enviada"}
                    icon={Send}
                    color="#3b82f6"
                />
                <MetricCard
                    title="Taxa de abertura"
                    value={metricsLoading ? "..." : `${metrics?.avg_open_rate?.toFixed(1) ?? "0"}%`}
                    subtitle="Média geral"
                    icon={Mail}
                    color="#10b981"
                />
                <MetricCard
                    title="Taxa de clique"
                    value={metricsLoading ? "..." : `${metrics?.avg_click_rate?.toFixed(1) ?? "0"}%`}
                    subtitle="Média geral"
                    icon={MousePointerClick}
                    color="#8b5cf6"
                />
                <MetricCard
                    title="Taxa de bounce"
                    value={metricsLoading ? "..." : `${metrics?.avg_bounce_rate?.toFixed(1) ?? "0"}%`}
                    subtitle="Média geral"
                    icon={AlertTriangle}
                    color="#f59e0b"
                />
            </div>

            {/* Quick actions + recent campaigns */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Quick actions */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-base">Ações rápidas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/dashboard/email-marketing/campanhas/nova">
                                <Send className="mr-2 size-4" />
                                Criar campanha
                            </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/dashboard/email-marketing/templates">
                                <FileText className="mr-2 size-4" />
                                Gerenciar templates
                            </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/dashboard/email-marketing/listas">
                                <Users className="mr-2 size-4" />
                                Gerenciar listas
                            </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/dashboard/email-marketing/campanhas">
                                <BarChart3 className="mr-2 size-4" />
                                Ver todas as campanhas
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                {/* Recent campaigns */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="text-base">Campanhas recentes</CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/email-marketing/campanhas">
                                Ver todas
                                <ArrowRight className="ml-1 size-3.5" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {campaignsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : recentCampaigns.length > 0 ? (
                            <div className="divide-y">
                                {recentCampaigns.map((c) => (
                                    <Link
                                        key={c.id}
                                        href={`/dashboard/email-marketing/campanhas/${c.id}`}
                                        className="flex items-center justify-between py-3 transition-colors hover:bg-muted/50 -mx-2 px-2 rounded"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">{c.name}</p>
                                            <p className="text-xs text-muted-foreground">{c.subject}</p>
                                        </div>
                                        <Badge variant={statusConfig[c.status]?.variant ?? "outline"}>
                                            {statusConfig[c.status]?.label ?? c.status}
                                        </Badge>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
                                    <Mail className="size-6 text-muted-foreground" />
                                </div>
                                <h3 className="mt-4 text-sm font-semibold">
                                    Nenhuma campanha ainda
                                </h3>
                                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                                    Crie sua primeira campanha de email marketing para se comunicar
                                    com seus pacientes de forma segmentada e eficiente.
                                </p>
                                <Button className="mt-4" size="sm" asChild>
                                    <Link href="/dashboard/email-marketing/campanhas/nova">
                                        <Plus className="mr-2 size-4" />
                                        Criar primeira campanha
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Getting started steps */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Primeiros passos</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="flex items-start gap-3 rounded-lg border p-4">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                                <span className="text-sm font-bold">1</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium">Crie um template</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Escolha um template pronto ou crie o seu com o editor visual.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border p-4">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                                <span className="text-sm font-bold">2</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium">Defina sua audiência</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Segmente pacientes por status, cidade, convênio ou outros critérios.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border p-4">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600">
                                <span className="text-sm font-bold">3</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium">Envie e acompanhe</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Envie a campanha e monitore aberturas, cliques e conversões em tempo real.
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
