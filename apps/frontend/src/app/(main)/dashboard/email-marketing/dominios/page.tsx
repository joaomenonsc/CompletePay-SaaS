"use client";

import { useState } from "react";
import {
    Globe,
    Loader2,
    MoreHorizontal,
    Plus,
    Search,
    Trash2,
    CheckCircle2,
    Clock,
    XCircle,
    Download,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useDomains, useCreateDomain, useDeleteDomain, useVerifyDomain } from "@/hooks/use-marketing";
import type { EmailDomain } from "@/types/marketing";

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }> = {
    pending: { label: "Pendente", variant: "outline", icon: Clock },
    verified: { label: "Verificado", variant: "default", icon: CheckCircle2 },
    failed: { label: "Falhou", variant: "destructive", icon: XCircle },
};

const regionLabels: Record<string, { label: string; flag: string }> = {
    "sa-east-1": { label: "São Paulo (sa-east-1)", flag: "🇧🇷" },
    "us-east-1": { label: "Virgínia (us-east-1)", flag: "🇺🇸" },
    "us-west-2": { label: "Oregon (us-west-2)", flag: "🇺🇸" },
    "eu-west-1": { label: "Irlanda (eu-west-1)", flag: "🇪🇺" },
    "ap-southeast-1": { label: "Singapura (ap-southeast-1)", flag: "🇸🇬" },
};

function timeAgo(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "hoje";
    if (diffDays === 1) return "ontem";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atrás`;
    return `${Math.floor(diffDays / 30)} meses atrás`;
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function DominiosPage() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [regionFilter, setRegionFilter] = useState("all");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newDomain, setNewDomain] = useState("");
    const [newRegion, setNewRegion] = useState("sa-east-1");

    const { data, isLoading } = useDomains({
        limit: 40,
        status: statusFilter !== "all" ? statusFilter : undefined,
        region: regionFilter !== "all" ? regionFilter : undefined,
        q: search || undefined,
    });
    const createMutation = useCreateDomain();
    const deleteMutation = useDeleteDomain();
    const verifyMutation = useVerifyDomain();

    const domains = data?.items ?? [];

    const handleCreate = () => {
        if (!newDomain) return;
        createMutation.mutate(
            { domain: newDomain, region: newRegion },
            {
                onSuccess: () => {
                    setDialogOpen(false);
                    setNewDomain("");
                    setNewRegion("sa-east-1");
                },
            }
        );
    };

    return (
        <main className="space-y-6">
            {/* Header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Domínios</h1>
                    <p className="text-sm text-muted-foreground">
                        Gerencie seus domínios de envio de email.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 size-4" />
                                Adicionar domínio
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Adicionar domínio</DialogTitle>
                                <DialogDescription>
                                    Insira o domínio que deseja usar para envio de emails.
                                    Você precisará configurar os registros DNS.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label>Domínio *</Label>
                                    <Input
                                        value={newDomain}
                                        onChange={(e) => setNewDomain(e.target.value)}
                                        placeholder="exemplo.com.br"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Região</Label>
                                    <Select value={newRegion} onValueChange={setNewRegion}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(regionLabels).map(([key, { label, flag }]) => (
                                                <SelectItem key={key} value={key}>
                                                    {flag} {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleCreate}
                                    disabled={!newDomain || createMutation.isPending}
                                >
                                    {createMutation.isPending ? (
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                    ) : (
                                        <Plus className="mr-2 size-4" />
                                    )}
                                    Adicionar domínio
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="verified">Verificado</SelectItem>
                        <SelectItem value="failed">Falhou</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Todas as regiões" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as regiões</SelectItem>
                        {Object.entries(regionLabels).map(([key, { label, flag }]) => (
                            <SelectItem key={key} value={key}>
                                {flag} {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
            ) : domains.length > 0 ? (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12" />
                                <TableHead>Domínio</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Região</TableHead>
                                <TableHead>Criado em</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {domains.map((d: EmailDomain) => {
                                const st = statusConfig[d.status] ?? statusConfig.pending;
                                const rg = regionLabels[d.region] ?? { label: d.region, flag: "🌐" };
                                return (
                                    <TableRow key={d.id} className="group">
                                        <TableCell>
                                            <Checkbox />
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                href={`/dashboard/email-marketing/dominios/${d.id}`}
                                                className="flex items-center gap-2 font-medium hover:underline"
                                            >
                                                <Globe className="size-4 text-emerald-600" />
                                                {d.domain}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={st.variant} className="gap-1">
                                                <st.icon className="size-3" />
                                                {st.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="flex items-center gap-1.5">
                                                <span className="text-base leading-none">{rg.flag}</span>
                                                {rg.label}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {timeAgo(d.created_at)}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 opacity-0 group-hover:opacity-100"
                                                    >
                                                        <MoreHorizontal className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/email-marketing/dominios/${d.id}`}>
                                                            Ver detalhes
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {d.status === "pending" && (
                                                        <DropdownMenuItem
                                                            onClick={() => verifyMutation.mutate(d.id)}
                                                        >
                                                            <CheckCircle2 className="mr-2 size-4" />
                                                            Verificar DNS
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => deleteMutation.mutate(d.id)}
                                                    >
                                                        <Trash2 className="mr-2 size-4" />
                                                        Remover
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    <div className="border-t px-4 py-3 text-xs text-muted-foreground">
                        Página 1 – 1 de {data?.total ?? 0} domínios – {data?.limit ?? 40} itens
                    </div>
                </Card>
            ) : (
                <Card>
                    <CardContent className="py-16">
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
                                <Globe className="size-6 text-muted-foreground" />
                            </div>
                            <h3 className="mt-4 text-sm font-semibold">
                                Nenhum domínio cadastrado
                            </h3>
                            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                                Adicione um domínio para poder enviar emails autenticados com
                                DKIM, SPF e DMARC. Isso melhora a entregabilidade.
                            </p>
                            <Button size="sm" className="mt-4" onClick={() => setDialogOpen(true)}>
                                <Plus className="mr-2 size-4" />
                                Adicionar domínio
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </main>
    );
}
