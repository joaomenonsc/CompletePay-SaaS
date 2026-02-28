"use client";

import { useState } from "react";
import {
    Copy,
    Eye,
    Loader2,
    MoreHorizontal,
    Plus,
    Search,
    Send,
    Trash2,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { CampaignStatus, EmailCampaign } from "@/types/marketing";
import { useCampaigns, useDeleteCampaign, useDuplicateCampaign } from "@/hooks/use-marketing";

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
    CampaignStatus,
    { label: string; className: string }
> = {
    draft: {
        label: "Rascunho",
        className: "bg-muted text-muted-foreground",
    },
    scheduled: {
        label: "Agendada",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    },
    sending: {
        label: "Enviando",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    },
    sent: {
        label: "Enviada",
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    partial: {
        label: "Parcial",
        className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    },
    failed: {
        label: "Falhou",
        className: "bg-destructive/10 text-destructive",
    },
    cancelled: {
        label: "Cancelada",
        className: "bg-muted text-muted-foreground",
    },
};

// ── Page ────────────────────────────────────────────────────────────────────────

export default function CampanhasPage() {
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [search, setSearch] = useState("");

    const { data, isLoading } = useCampaigns({
        status: statusFilter === "all" ? undefined : statusFilter,
    });
    const deleteMutation = useDeleteCampaign();
    const duplicateMutation = useDuplicateCampaign();

    const campaigns: EmailCampaign[] = data?.items ?? [];

    // Client-side search filter
    const filtered = search
        ? campaigns.filter((c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.subject.toLowerCase().includes(search.toLowerCase())
        )
        : campaigns;

    return (
        <main className="space-y-6">
            {/* Header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Campanhas</h1>
                    <p className="text-sm text-muted-foreground">
                        Gerencie suas campanhas de email marketing.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/email-marketing/campanhas/nova">
                        <Plus className="mr-2 size-4" />
                        Nova campanha
                    </Link>
                </Button>
            </header>

            {/* Filters */}
            <Card>
                <CardHeader className="flex-row items-center gap-3 pb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectItem value="draft">Rascunho</SelectItem>
                            <SelectItem value="scheduled">Agendada</SelectItem>
                            <SelectItem value="sending">Enviando</SelectItem>
                            <SelectItem value="sent">Enviada</SelectItem>
                            <SelectItem value="cancelled">Cancelada</SelectItem>
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    {/* Loading state */}
                    {isLoading && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="size-8 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {/* Empty state */}
                    {!isLoading && filtered.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
                                <Send className="size-6 text-muted-foreground" />
                            </div>
                            <h3 className="mt-4 text-sm font-semibold">
                                {search ? "Nenhuma campanha encontrada para essa busca" : "Nenhuma campanha encontrada"}
                            </h3>
                            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                                Crie sua primeira campanha para começar a se comunicar com seus
                                pacientes por email.
                            </p>
                            <Button className="mt-4" size="sm" asChild>
                                <Link href="/dashboard/email-marketing/campanhas/nova">
                                    <Plus className="mr-2 size-4" />
                                    Nova campanha
                                </Link>
                            </Button>
                        </div>
                    )}

                    {/* Table */}
                    {!isLoading && filtered.length > 0 && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Destinatários</TableHead>
                                    <TableHead className="text-right">Enviados</TableHead>
                                    <TableHead className="text-right">Abertura</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="w-[40px]" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((c) => {
                                    const statusCfg = STATUS_CONFIG[c.status as CampaignStatus] ?? STATUS_CONFIG.draft;
                                    const openRate = c.total_recipients > 0
                                        ? `${Math.round((c.total_opened / c.total_recipients) * 100)}%`
                                        : "—";
                                    const dateStr = c.sent_at
                                        ? format(new Date(c.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                                        : c.scheduled_at
                                            ? format(new Date(c.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                                            : format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR });

                                    return (
                                        <TableRow key={c.id} className="cursor-pointer">
                                            <TableCell className="font-medium">
                                                <Link
                                                    href={`/dashboard/email-marketing/campanhas/${c.id}`}
                                                    className="hover:underline"
                                                >
                                                    {c.name}
                                                </Link>
                                                <div className="text-xs text-muted-foreground">{c.subject}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={statusCfg.className}>
                                                    {statusCfg.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">{c.total_recipients}</TableCell>
                                            <TableCell className="text-right">{c.total_sent}</TableCell>
                                            <TableCell className="text-right">{openRate}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {dateStr}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="size-8">
                                                            <MoreHorizontal className="size-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/dashboard/email-marketing/campanhas/${c.id}`}>
                                                                <Eye className="mr-2 size-4" />
                                                                Ver detalhes
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => duplicateMutation.mutate(c.id)}
                                                        >
                                                            <Copy className="mr-2 size-4" />
                                                            Duplicar
                                                        </DropdownMenuItem>
                                                        {(c.status === "draft" || c.status === "scheduled") && (
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={() => {
                                                                    if (confirm("Tem certeza que deseja excluir esta campanha?")) {
                                                                        deleteMutation.mutate(c.id);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="mr-2 size-4" />
                                                                Excluir
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
