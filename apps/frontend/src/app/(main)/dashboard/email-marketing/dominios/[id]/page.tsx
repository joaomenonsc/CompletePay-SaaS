"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    Globe,
    Loader2,
    MoreHorizontal,
    Trash2,
    XCircle,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDomain, useUpdateDomain, useDeleteDomain, useVerifyDomain } from "@/hooks/use-marketing";
import type { DnsRecord, TlsMode } from "@/types/marketing";

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

// ── DNS record row ─────────────────────────────────────────────────────────────

function DnsRecordRow({ record }: { record: DnsRecord }) {
    const isVerified = record.status === "verified";
    return (
        <TableRow>
            <TableCell className="font-mono text-xs">{record.record_type}</TableCell>
            <TableCell className="font-mono text-xs max-w-[200px] truncate" title={record.name}>
                {record.name}
            </TableCell>
            <TableCell className="font-mono text-xs max-w-[300px] truncate" title={record.content}>
                {record.content}
            </TableCell>
            <TableCell className="text-xs">{record.ttl}</TableCell>
            <TableCell className="text-xs">{record.priority ?? "—"}</TableCell>
            <TableCell>
                <Badge variant={isVerified ? "default" : "outline"} className="gap-1">
                    {isVerified ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                    {isVerified ? "Verificado" : "Pendente"}
                </Badge>
            </TableCell>
        </TableRow>
    );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function DomainDetailPage() {
    const params = useParams();
    const router = useRouter();
    const domainId = params.id as string;

    const { data: domain, isLoading } = useDomain(domainId);
    const updateMutation = useUpdateDomain();
    const deleteMutation = useDeleteDomain();
    const verifyMutation = useVerifyDomain();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!domain) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <Globe className="size-10 text-muted-foreground" />
                <h2 className="mt-4 text-lg font-semibold">Domínio não encontrado</h2>
                <Button variant="outline" className="mt-4" asChild>
                    <Link href="/dashboard/email-marketing/dominios">Voltar</Link>
                </Button>
            </div>
        );
    }

    const st = statusConfig[domain.status] ?? statusConfig.pending;
    const rg = regionLabels[domain.region] ?? { label: domain.region, flag: "🌐" };

    // DNS records grouped
    const dkimRecords = (domain.dns_records ?? []).filter(
        (r) => r.name.includes("_domainkey")
    );
    const spfRecords = (domain.dns_records ?? []).filter(
        (r) => r.record_type === "MX" || (r.record_type === "TXT" && r.content.includes("spf"))
    );
    const mxRecords = (domain.dns_records ?? []).filter(
        (r) => r.record_type === "MX" && !r.name.includes("send")
    );

    const handleToggle = (key: "click_tracking" | "open_tracking", value: boolean) => {
        updateMutation.mutate({ id: domainId, body: { [key]: value } });
    };

    const handleTlsChange = (value: TlsMode) => {
        updateMutation.mutate({ id: domainId, body: { tls_mode: value } });
    };

    const handleDelete = () => {
        deleteMutation.mutate(domainId, {
            onSuccess: () => router.push("/dashboard/email-marketing/dominios"),
        });
    };

    return (
        <main className="space-y-6">
            {/* Back */}
            <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/email-marketing/dominios">
                    <ArrowLeft className="mr-2 size-4" />
                    Domínios
                </Link>
            </Button>

            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-xl border bg-muted/50">
                        <Globe className="size-7 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Domínio
                        </p>
                        <h1 className="text-2xl font-semibold">{domain.domain}</h1>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                            <MoreHorizontal className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {domain.status === "pending" && (
                            <DropdownMenuItem onClick={() => verifyMutation.mutate(domainId)}>
                                <CheckCircle2 className="mr-2 size-4" />
                                Verificar DNS
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                            <Trash2 className="mr-2 size-4" />
                            Remover domínio
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap gap-8 border-b pb-6 text-sm">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        CRIADO EM
                    </p>
                    <p className="mt-1">{timeAgo(domain.created_at)}</p>
                </div>
                <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        STATUS
                    </p>
                    <Badge variant={st.variant} className="mt-1 gap-1">
                        <st.icon className="size-3" />
                        {st.label}
                    </Badge>
                </div>
                <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        PROVEDOR
                    </p>
                    <p className="mt-1 flex items-center gap-1">
                        {domain.provider ? (
                            <>☁️ {domain.provider}</>
                        ) : (
                            <span className="text-muted-foreground">—</span>
                        )}
                    </p>
                </div>
                <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        REGIÃO
                    </p>
                    <p className="mt-1 flex items-center gap-1">
                        <span className="text-base leading-none">{rg.flag}</span>
                        {rg.label}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="records">
                <TabsList>
                    <TabsTrigger value="records">Registros</TabsTrigger>
                    <TabsTrigger value="configuration">Configuração</TabsTrigger>
                </TabsList>

                {/* Records tab */}
                <TabsContent value="records" className="space-y-8 pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Registros DNS</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            {/* Domain Verification (DKIM) */}
                            <div>
                                <h3 className="mb-1 text-sm font-semibold">Verificação do Domínio</h3>
                                <p className="mb-3 text-xs text-muted-foreground">
                                    <span className="font-medium">DKIM</span> — Assinatura de domínio para identificação de emails
                                </p>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[60px]">Tipo</TableHead>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Conteúdo</TableHead>
                                            <TableHead className="w-[60px]">TTL</TableHead>
                                            <TableHead className="w-[70px]">Prioridade</TableHead>
                                            <TableHead className="w-[100px]">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dkimRecords.map((r, i) => (
                                            <DnsRecordRow key={i} record={r} />
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Enable Sending (SPF) */}
                            <div>
                                <h3 className="mb-1 text-sm font-semibold">Habilitar Envio</h3>
                                <p className="mb-3 text-xs text-muted-foreground">
                                    <span className="font-medium">SPF</span> — Framework de política do remetente
                                </p>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[60px]">Tipo</TableHead>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Conteúdo</TableHead>
                                            <TableHead className="w-[60px]">TTL</TableHead>
                                            <TableHead className="w-[70px]">Prioridade</TableHead>
                                            <TableHead className="w-[100px]">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {spfRecords.map((r, i) => (
                                            <DnsRecordRow key={i} record={r} />
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Enable Receiving (MX) */}
                            {mxRecords.length > 0 && (
                                <div>
                                    <h3 className="mb-1 text-sm font-semibold">Habilitar Recebimento</h3>
                                    <p className="mb-3 text-xs text-muted-foreground">
                                        <span className="font-medium">MX</span> — Registros de troca de email
                                    </p>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[60px]">Tipo</TableHead>
                                                <TableHead>Nome</TableHead>
                                                <TableHead>Conteúdo</TableHead>
                                                <TableHead className="w-[60px]">TTL</TableHead>
                                                <TableHead className="w-[70px]">Prioridade</TableHead>
                                                <TableHead className="w-[100px]">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {mxRecords.map((r, i) => (
                                                <DnsRecordRow key={i} record={r} />
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Configuration tab */}
                <TabsContent value="configuration" className="pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Configuração</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            {/* Click Tracking */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold">Rastreamento de Cliques</h3>
                                <p className="text-sm text-muted-foreground">
                                    Para rastrear cliques, cada link no corpo do email HTML é modificado.
                                    Quando os destinatários abrem um link, são enviados ao servidor e
                                    imediatamente redirecionados para a URL de destino.
                                </p>
                                <Switch
                                    checked={domain.click_tracking}
                                    onCheckedChange={(v) => handleToggle("click_tracking", v)}
                                    disabled={updateMutation.isPending}
                                />
                            </div>

                            <hr />

                            {/* Open Tracking */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold">Rastreamento de Abertura</h3>
                                    <Badge variant="outline" className="text-xs">
                                        Não Recomendado
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Uma imagem GIF transparente de 1x1 pixel é inserida em cada email com
                                    uma referência única. O rastreamento de abertura pode produzir resultados
                                    imprecisos e diminuir a entregabilidade.
                                </p>
                                <Switch
                                    checked={domain.open_tracking}
                                    onCheckedChange={(v) => handleToggle("open_tracking", v)}
                                    disabled={updateMutation.isPending}
                                />
                            </div>

                            <hr />

                            {/* TLS */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold">TLS (Segurança da Camada de Transporte)</h3>
                                <p className="text-sm text-muted-foreground">
                                    &quot;Oportunista&quot; significa que sempre tenta estabelecer uma conexão segura
                                    com o servidor de email receptor. Se não conseguir, envia a mensagem
                                    sem criptografia. &quot;TLS Forçado&quot;, por outro lado, exige que a
                                    comunicação de email use TLS obrigatoriamente.
                                </p>
                                <Select
                                    value={domain.tls_mode}
                                    onValueChange={(v) => handleTlsChange(v as TlsMode)}
                                    disabled={updateMutation.isPending}
                                >
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="opportunistic">Oportunista</SelectItem>
                                        <SelectItem value="enforced">Forçado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </main>
    );
}
