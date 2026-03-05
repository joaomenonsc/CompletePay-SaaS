"use client";

import { useState } from "react";
import {
    Plus,
    Loader2,
    FileText,
    Send,
    Trash2,
    CheckCircle2,
    Clock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TemplateStatusBadge } from "@/components/whatsapp/template-status-badge";
import {
    useTemplates,
    useCreateTemplate,
    useSubmitTemplate,
    useApproveTemplate,
    useDeleteTemplate,
} from "@/hooks/use-whatsapp";
import type { WATemplateCreate } from "@/types/whatsapp";

export default function WhatsAppTemplatesPage() {
    const [createOpen, setCreateOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState("all");
    const [form, setForm] = useState<WATemplateCreate>({
        name: "",
        category: "MARKETING",
        language: "pt_BR",
        body_text: "",
    });

    const { data, isLoading } = useTemplates(
        statusFilter === "all" ? undefined : { status: statusFilter }
    );
    const createTemplate = useCreateTemplate();
    const submitTemplate = useSubmitTemplate();
    const approveTemplate = useApproveTemplate();
    const deleteTemplate = useDeleteTemplate();

    const templates = data?.items ?? [];

    const handleCreate = () => {
        if (!form.name || !form.body_text) {
            toast.error("Nome e corpo são obrigatórios.");
            return;
        }
        createTemplate.mutate(form, {
            onSuccess: () => {
                toast.success("Template criado!");
                setCreateOpen(false);
                setForm({ name: "", category: "MARKETING", language: "pt_BR", body_text: "" });
            },
            onError: () => toast.error("Erro ao criar template"),
        });
    };

    return (
        <main className="space-y-6">
            {/* Header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Templates WhatsApp</h1>
                    <p className="text-sm text-muted-foreground">
                        Gerencie templates de mensagem para clientes.
                    </p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 size-4" />
                            Novo template
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Criar template</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-1">
                                    <Label>Nome *</Label>
                                    <Input
                                        placeholder="ex: boas_vindas"
                                        value={form.name}
                                        onChange={(e) =>
                                            setForm({ ...form, name: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Categoria</Label>
                                    <Select
                                        value={form.category}
                                        onValueChange={(v) =>
                                            setForm({ ...form, category: v })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MARKETING">Marketing</SelectItem>
                                            <SelectItem value="UTILITY">Utilitário</SelectItem>
                                            <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Idioma</Label>
                                    <Select
                                        value={form.language}
                                        onValueChange={(v) =>
                                            setForm({ ...form, language: v })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pt_BR">Português (BR)</SelectItem>
                                            <SelectItem value="en_US">English (US)</SelectItem>
                                            <SelectItem value="es_ES">Español</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label>Corpo da mensagem *</Label>
                                <Textarea
                                    placeholder="Olá {{1}}, temos uma novidade para você..."
                                    className="min-h-[100px]"
                                    value={form.body_text}
                                    onChange={(e) =>
                                        setForm({ ...form, body_text: e.target.value })
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    Use {"{{"} n {"}}"}  (ex: {"{{1}}"}) para variáveis.
                                </p>
                            </div>
                            <div className="space-y-1">
                                <Label>Rodapé (opcional)</Label>
                                <Input
                                    placeholder="Sua clínica"
                                    value={form.footer_text ?? ""}
                                    onChange={(e) =>
                                        setForm({ ...form, footer_text: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                onClick={handleCreate}
                                disabled={createTemplate.isPending}
                            >
                                {createTemplate.isPending ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                    <FileText className="mr-2 size-4" />
                                )}
                                Criar template
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            {/* Filtro de status */}
            <div className="flex items-center gap-2">
                {["all", "draft", "pending_review", "approved", "rejected"].map(
                    (s) => (
                        <Button
                            key={s}
                            variant={statusFilter === s ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter(s)}
                        >
                            {{
                                all: "Todos",
                                draft: "Rascunhos",
                                pending_review: "Em revisão",
                                approved: "Aprovados",
                                rejected: "Rejeitados",
                            }[s]}
                        </Button>
                    )
                )}
            </div>

            {/* Lista */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
            ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                    <FileText className="mb-3 size-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium">Nenhum template</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Crie templates para usar em conversas e campanhas.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map((tpl) => (
                        <Card key={tpl.id} className="relative">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">{tpl.name}</p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                {tpl.category}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                {tpl.language}
                                            </Badge>
                                        </div>
                                    </div>
                                    <TemplateStatusBadge status={tpl.status} />
                                </div>
                                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                                    {tpl.body_text}
                                </p>
                                {tpl.rejected_reason && (
                                    <p className="mt-2 text-xs text-destructive">
                                        Motivo: {tpl.rejected_reason}
                                    </p>
                                )}
                                {/* Ações */}
                                <div className="mt-4 flex gap-2">
                                    {tpl.status === "draft" && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs"
                                            disabled={submitTemplate.isPending}
                                            onClick={() =>
                                                submitTemplate.mutate(tpl.id, {
                                                    onSuccess: () =>
                                                        toast.success("Submetido para revisão!"),
                                                    onError: () =>
                                                        toast.error("Erro ao submeter"),
                                                })
                                            }
                                        >
                                            <Send className="mr-1 size-3" />
                                            Submeter
                                        </Button>
                                    )}
                                    {tpl.status === "pending_review" && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs"
                                            disabled={approveTemplate.isPending}
                                            onClick={() =>
                                                approveTemplate.mutate(tpl.id, {
                                                    onSuccess: () =>
                                                        toast.success("Template aprovado!"),
                                                    onError: () =>
                                                        toast.error("Erro ao aprovar"),
                                                })
                                            }
                                        >
                                            <CheckCircle2 className="mr-1 size-3" />
                                            Aprovar
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="ml-auto h-7 text-xs text-destructive hover:text-destructive"
                                        disabled={deleteTemplate.isPending}
                                        onClick={() =>
                                            deleteTemplate.mutate(tpl.id, {
                                                onSuccess: () =>
                                                    toast.success("Template removido"),
                                                onError: () =>
                                                    toast.error("Erro ao remover"),
                                            })
                                        }
                                    >
                                        <Trash2 className="size-3" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </main>
    );
}
