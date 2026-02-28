"use client";

import { useState } from "react";
import {
    FileText,
    Heart,
    Loader2,
    Mail,
    Megaphone,
    Plus,
    Search,
    Sparkles,
    Star,
    Stethoscope,
    Trash2,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTemplates, useDeleteTemplate } from "@/hooks/use-marketing";
import type { EmailTemplate } from "@/types/marketing";

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
    string,
    { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
    "boas-vindas": { label: "Boas-vindas", icon: Sparkles, color: "text-blue-600" },
    reengajamento: { label: "Reengajamento", icon: Heart, color: "text-rose-600" },
    "check-up": { label: "Check-up", icon: Stethoscope, color: "text-emerald-600" },
    comunicado: { label: "Comunicado", icon: Megaphone, color: "text-amber-600" },
    nps: { label: "Pesquisa NPS", icon: Star, color: "text-violet-600" },
    newsletter: { label: "Newsletter", icon: Mail, color: "text-sky-600" },
    custom: { label: "Personalizado", icon: FileText, color: "text-muted-foreground" },
    geral: { label: "Geral", icon: FileText, color: "text-muted-foreground" },
};

// ── Starter templates (local, as reference for new users) ──────────────────────

const STARTER_TEMPLATES = [
    {
        id: "starter-boas-vindas",
        name: "Boas-vindas ao paciente",
        category: "boas-vindas",
        description: "Dê as boas-vindas ao novo paciente com informações sobre a clínica.",
    },
    {
        id: "starter-reengajamento",
        name: "Reengajamento de inativos",
        category: "reengajamento",
        description: "Reconecte-se com pacientes que não visitam a clínica há mais de 6 meses.",
    },
    {
        id: "starter-checkup",
        name: "Lembrete de check-up",
        category: "check-up",
        description: "Lembre seus pacientes da importância de check-ups periódicos.",
    },
    {
        id: "starter-comunicado",
        name: "Comunicado geral",
        category: "comunicado",
        description: "Informe sobre novos serviços, profissionais ou mudanças.",
    },
    {
        id: "starter-nps",
        name: "Pesquisa de satisfação",
        category: "nps",
        description: "Envie pesquisa NPS pós-atendimento.",
    },
    {
        id: "starter-newsletter",
        name: "Newsletter de saúde",
        category: "newsletter",
        description: "Dicas de saúde, conteúdo educacional e novidades.",
    },
];

// ── Page ────────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
    const [search, setSearch] = useState("");
    const { data, isLoading } = useTemplates({ limit: 100 });
    const deleteMutation = useDeleteTemplate();

    const templates = data?.items ?? [];
    const filteredTemplates = templates.filter((t: EmailTemplate) =>
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    const filteredStarters = STARTER_TEMPLATES.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <main className="space-y-6">
            {/* Header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Templates</h1>
                    <p className="text-sm text-muted-foreground">
                        Biblioteca de templates de email para suas campanhas.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/email-marketing/templates/novo">
                        <Plus className="mr-2 size-4" />
                        Novo template
                    </Link>
                </Button>
            </header>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Buscar templates..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Custom templates from API */}
            <div>
                <h2 className="mb-3 text-base font-semibold">Meus templates</h2>
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredTemplates.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredTemplates.map((template: EmailTemplate) => {
                            const config = CATEGORY_CONFIG[template.category] ?? CATEGORY_CONFIG.geral;
                            const IconComp = config.icon;
                            return (
                                <Card
                                    key={template.id}
                                    className="group cursor-pointer transition-shadow hover:shadow-md"
                                >
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between">
                                            <div
                                                className={`flex size-10 items-center justify-center rounded-lg bg-muted ${config.color}`}
                                            >
                                                <IconComp className="size-5" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs">
                                                    {config.label}
                                                </Badge>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <button
                                                            type="button"
                                                            className="rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta ação não pode ser desfeita. O template &quot;{template.name}&quot; será removido permanentemente.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => deleteMutation.mutate(template.id)}
                                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                            >
                                                                Excluir
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>

                                        <h3 className="mt-3 text-sm font-semibold group-hover:text-primary transition-colors">
                                            {template.name}
                                        </h3>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {template.subject_template || "Sem assunto definido"}
                                        </p>
                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                            Atualizado em {new Date(template.updated_at).toLocaleDateString("pt-BR")}
                                        </p>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-4 w-full"
                                            asChild
                                        >
                                            <Link href={`/dashboard/email-marketing/templates/${template.id}`}>
                                                Editar template
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
                            <FileText className="size-6 text-muted-foreground" />
                        </div>
                        <h3 className="mt-4 text-sm font-semibold">
                            Nenhum template personalizado
                        </h3>
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                            Crie templates customizados ou use um dos templates iniciais como base.
                        </p>
                        <Button className="mt-4" size="sm" asChild>
                            <Link href="/dashboard/email-marketing/templates/novo">
                                <Plus className="mr-2 size-4" />
                                Criar template
                            </Link>
                        </Button>
                    </div>
                )}
            </div>

            {/* Starter templates */}
            <div>
                <h2 className="mb-3 text-base font-semibold">Templates iniciais</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                    Use um desses templates como ponto de partida para sua campanha.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredStarters.map((template) => {
                        const config = CATEGORY_CONFIG[template.category] ?? CATEGORY_CONFIG.geral;
                        const IconComp = config.icon;
                        return (
                            <Card
                                key={template.id}
                                className="group cursor-pointer transition-shadow hover:shadow-md"
                            >
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div
                                            className={`flex size-10 items-center justify-center rounded-lg bg-muted ${config.color}`}
                                        >
                                            <IconComp className="size-5" />
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {config.label}
                                        </Badge>
                                    </div>
                                    <h3 className="mt-3 text-sm font-semibold group-hover:text-primary transition-colors">
                                        {template.name}
                                    </h3>
                                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                                        {template.description}
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4 w-full"
                                        asChild
                                    >
                                        <Link href={`/dashboard/email-marketing/templates/${template.id}`}>
                                            Usar template
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}
