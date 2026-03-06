"use client";

import {
    MessageCircle,
    MessageSquare,
    CheckCircle2,
    Users,
    AlertTriangle,
    Loader2,
    Plus,
    ArrowRight,
    Send,
    FileText,
    Settings,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useMetrics, useConversations } from "@/hooks/use-whatsapp";
import type { WAConversation } from "@/types/whatsapp";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    getContactDisplayName,
    getContactInitial,
    getContactPhotoUrl,
} from "@/lib/whatsapp-contact";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type MetricPeriod = "1d" | "7d" | "30d" | "90d";

function MetricCard({
    title,
    value,
    subtitle,
    icon: Icon,
    color,
    isLoading,
}: {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    isLoading?: boolean;
}) {
    return (
        <Card className="relative overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                            {title}
                        </p>
                        <p className="text-3xl font-bold tracking-tight">
                            {isLoading ? "..." : value}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {subtitle}
                        </p>
                    </div>
                    <div
                        className="flex size-12 items-center justify-center rounded-xl"
                        style={{
                            backgroundColor: `${color}15`,
                            color,
                        }}
                    >
                        <Icon className="size-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

const statusConfig: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
    open: { label: "Aberta", variant: "default" },
    resolved: { label: "Resolvida", variant: "secondary" },
    archived: { label: "Arquivada", variant: "outline" },
};

export default function WhatsAppDashboard() {
    const [period, setPeriod] = useState<MetricPeriod>("7d");
    const { data: metrics, isLoading: metricsLoading } = useMetrics(period, {
        refetchIntervalMs: 60_000,
    });
    const { data: convData, isLoading: convLoading } = useConversations({
        status: "open",
        limit: 5,
        refetchIntervalMs: 30_000,
    });
    const recentConversations: WAConversation[] = convData?.items ?? [];

    return (
        <main className="space-y-6">
            {/* Header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">WhatsApp</h1>
                    <p className="text-sm text-muted-foreground">
                        Gerencie conversas, campanhas e automações via WhatsApp.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select
                        value={period}
                        onValueChange={(v) => setPeriod(v as MetricPeriod)}
                    >
                        <SelectTrigger className="w-28">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1d">Hoje</SelectItem>
                            <SelectItem value="7d">7 dias</SelectItem>
                            <SelectItem value="30d">30 dias</SelectItem>
                            <SelectItem value="90d">90 dias</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button asChild>
                        <Link href="/dashboard/whatsapp/inbox">
                            <MessageCircle className="mr-2 size-4" />
                            Abrir inbox
                        </Link>
                    </Button>
                </div>
            </header>

            {/* Metrics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Conversas abertas"
                    value={metrics?.open_conversations?.toLocaleString() ?? "0"}
                    subtitle="em qualquer conta"
                    icon={MessageSquare}
                    color="#25D366"
                    isLoading={metricsLoading}
                />
                <MetricCard
                    title="Resolvidas"
                    value={metrics?.resolved_conversations?.toLocaleString() ?? "0"}
                    subtitle={`no período ${period}`}
                    icon={CheckCircle2}
                    color="#10b981"
                    isLoading={metricsLoading}
                />
                <MetricCard
                    title="Novos contatos"
                    value={metrics?.new_contacts?.toLocaleString() ?? "0"}
                    subtitle={`no período ${period}`}
                    icon={Users}
                    color="#3b82f6"
                    isLoading={metricsLoading}
                />
                <MetricCard
                    title="SLA em atraso"
                    value={metrics?.sla_breached_count?.toLocaleString() ?? "0"}
                    subtitle="conversas sem resposta"
                    icon={AlertTriangle}
                    color="#ef4444"
                    isLoading={metricsLoading}
                />
            </div>

            {/* Mensagens */}
            <div className="grid gap-4 sm:grid-cols-2">
                <MetricCard
                    title="Mensagens enviadas"
                    value={metrics?.messages_sent?.toLocaleString() ?? "0"}
                    subtitle={`no período ${period}`}
                    icon={Send}
                    color="#8b5cf6"
                    isLoading={metricsLoading}
                />
                <MetricCard
                    title="Mensagens recebidas"
                    value={metrics?.messages_received?.toLocaleString() ?? "0"}
                    subtitle={`no período ${period}`}
                    icon={MessageCircle}
                    color="#f59e0b"
                    isLoading={metricsLoading}
                />
            </div>

            {/* Quick actions + Recent conversations */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Quick actions */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-base">Ações rápidas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button
                            variant="outline"
                            className="w-full justify-start"
                            asChild
                        >
                            <Link href="/dashboard/whatsapp/inbox">
                                <MessageCircle className="mr-2 size-4" />
                                Ver inbox
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start"
                            asChild
                        >
                            <Link href="/dashboard/whatsapp/templates">
                                <FileText className="mr-2 size-4" />
                                Gerenciar templates
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start"
                            asChild
                        >
                            <Link href="/dashboard/whatsapp/campanhas">
                                <Send className="mr-2 size-4" />
                                Nova campanha
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start"
                            asChild
                        >
                            <Link href="/dashboard/whatsapp/configuracoes">
                                <Settings className="mr-2 size-4" />
                                Configurações
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                {/* Recent conversations */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="text-base">
                            Conversas abertas recentes
                        </CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/whatsapp/inbox">
                                Ver todas
                                <ArrowRight className="ml-1 size-3.5" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {convLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : recentConversations.length > 0 ? (
                            <div className="divide-y">
                                {recentConversations.map((conv) => {
                                    const name = getContactDisplayName(conv.contact);
                                    const initial = getContactInitial(conv.contact);
                                    const photoUrl = getContactPhotoUrl(conv.contact);
                                    const timeAgo = conv.last_message_at
                                        ? formatDistanceToNow(
                                            new Date(conv.last_message_at),
                                            {
                                                addSuffix: true,
                                                locale: ptBR,
                                            }
                                        )
                                        : null;
                                    return (
                                        <Link
                                            key={conv.id}
                                            href={`/dashboard/whatsapp/inbox/${conv.id}`}
                                            className="-mx-2 flex items-center justify-between rounded px-2 py-3 transition-colors hover:bg-muted/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar className="size-8 bg-green-100 text-green-700">
                                                    <AvatarImage src={photoUrl ?? undefined} alt={name} />
                                                    <AvatarFallback className="bg-green-100 font-semibold text-green-700 text-sm">
                                                        {initial}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium">{name}</p>
                                                    {conv.last_message_preview && (
                                                        <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                                                            {conv.last_message_preview}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {timeAgo && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {timeAgo}
                                                    </span>
                                                )}
                                                <Badge
                                                    variant={
                                                        statusConfig[conv.status]?.variant ?? "outline"
                                                    }
                                                    className="text-xs"
                                                >
                                                    {statusConfig[conv.status]?.label ?? conv.status}
                                                </Badge>
                                                {(conv.unread_count ?? 0) > 0 && (
                                                    <Badge className="h-5 min-w-5 rounded-full px-1.5 text-xs">
                                                        {conv.unread_count}
                                                    </Badge>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
                                    <MessageCircle className="size-6 text-muted-foreground" />
                                </div>
                                <h3 className="mt-4 text-sm font-semibold">
                                    Nenhuma conversa aberta
                                </h3>
                                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                                    As conversas iniciadas pelos seus pacientes aparecerão aqui.
                                </p>
                                <Button className="mt-4" size="sm" asChild>
                                    <Link href="/dashboard/whatsapp/configuracoes">
                                        <Plus className="mr-2 size-4" />
                                        Configurar conta
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
