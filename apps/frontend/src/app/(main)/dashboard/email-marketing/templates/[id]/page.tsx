"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
    ArrowLeft,
    Eye,
    Loader2,
    Save,
    Send,
    Variable,
    ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useTemplate, useCreateTemplate, useUpdateTemplate } from "@/hooks/use-marketing";
import type { TemplateCategory } from "@/types/marketing";
import { EmailEditor } from "@/components/email-marketing/email-editor";
import { useEmailBuilderStore } from "@/stores/email-builder-store";
import { generateHtmlFromBlocks } from "@/components/email-marketing/builder/utils";

// ── Merge variables ────────────────────────────────────────────────────────────

const MERGE_VARIABLES = [
    { key: "nome_paciente", label: "Nome do Paciente", example: "Maria Silva" },
    { key: "nome_social", label: "Nome Social", example: "Mari" },
    { key: "nome_clinica", label: "Nome da Clínica", example: "Clínica Saúde Plena" },
    { key: "nome_profissional", label: "Nome do Profissional", example: "Dr. João" },
    { key: "telefone_clinica", label: "Telefone da Clínica", example: "(11) 3456-7890" },
    { key: "link_agendamento", label: "Link de Agendamento", example: "https://..." },
    { key: "link_descadastro", label: "Link de Descadastro", example: "https://..." },
];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TemplateEditorPage() {
    const params = useParams();
    const router = useRouter();
    const templateId = params.id as string;
    const isNew = templateId === "novo";

    // Real API hooks
    const { data: existingTemplate, isLoading } = useTemplate(isNew ? null : templateId);
    const createMutation = useCreateTemplate();
    const updateMutation = useUpdateTemplate();

    const [templateName, setTemplateName] = useState("");
    const [subject, setSubject] = useState("");
    const [category, setCategory] = useState<string>("boas-vindas");

    // Initialize from API data
    const [initialized, setInitialized] = useState(false);
    if (existingTemplate && !initialized) {
        setTemplateName(existingTemplate.name);
        setSubject(existingTemplate.subject_template ?? "");
        setCategory(existingTemplate.category ?? "boas-vindas");
        setInitialized(true);
    }

    // Builder JSON content: prefer blocks_json, fallback to html_content
    const editorContent = existingTemplate?.blocks_json || existingTemplate?.html_content || "";

    // Insert variable into selected text block
    const { blocks, selectedBlockId, updateBlockContent } = useEmailBuilderStore();
    const insertVariable = useCallback(
        (varKey: string) => {
            if (!selectedBlockId) return;
            const block = blocks.find((b) => b.id === selectedBlockId);
            if (!block) return;
            const content = block.content as any;
            if ("text" in content) {
                updateBlockContent(selectedBlockId, {
                    text: (content.text || "") + `{{${varKey}}}`,
                });
            }
        },
        [selectedBlockId, blocks, updateBlockContent]
    );

    // Save handler — reads blocks directly from the store at save time
    const handleSave = useCallback(async () => {
        if (!templateName.trim()) {
            toast.error("Preencha o nome do template antes de salvar.");
            return;
        }

        // Generate HTML and JSON from current blocks in the store
        const currentBlocks = useEmailBuilderStore.getState().blocks;
        const html = generateHtmlFromBlocks(currentBlocks);
        const json = JSON.stringify(currentBlocks);

        if (isNew) {
            createMutation.mutate(
                {
                    name: templateName.trim(),
                    subject_template: subject,
                    html_content: html,
                    blocks_json: json,
                    category,
                    variables: MERGE_VARIABLES.filter((v) => html.includes(`{{${v.key}}}`)).map((v) => v.key),
                },
                {
                    onSuccess: (created) => {
                        toast.success("Template criado com sucesso!");
                        router.push(`/dashboard/email-marketing/templates/${created.id}`);
                    },
                    onError: (err: any) => {
                        toast.error(err?.response?.data?.detail || "Erro ao criar template.");
                    },
                }
            );
        } else {
            updateMutation.mutate(
                {
                    id: templateId,
                    body: {
                        name: templateName.trim(),
                        subject_template: subject,
                        html_content: html,
                        blocks_json: json,
                        category,
                        variables: MERGE_VARIABLES.filter((v) => html.includes(`{{${v.key}}}`)).map((v) => v.key),
                    },
                },
                {
                    onSuccess: () => {
                        toast.success("Template salvo com sucesso!");
                    },
                    onError: (err: any) => {
                        toast.error(err?.response?.data?.detail || "Erro ao salvar template.");
                    },
                }
            );
        }
    }, [templateName, subject, category, isNew, templateId, createMutation, updateMutation, router]);

    const isSaving = createMutation.isPending || updateMutation.isPending;

    if (isLoading) {
        return (
            <main className="flex items-center justify-center py-24">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </main>
        );
    }

    return (
        <main className="flex h-[calc(100vh-80px)] flex-col">
            {/* Top bar */}
            <header className="flex items-center justify-between border-b px-4 py-2.5">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard/email-marketing/templates">
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Button>
                    <div>
                        <Input
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="Nome do template..."
                            className="h-7 border-none bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
                        />
                        <p className="text-xs text-muted-foreground">
                            {isNew ? "Novo template" : "Editando template"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Subject */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="max-w-[200px]">
                                <span className="truncate text-xs">
                                    {subject || "Definir assunto..."}
                                </span>
                                <ChevronDown className="ml-1 size-3" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" align="end">
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Assunto do email</Label>
                                    <Input
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder="Ex: Novidades da {{nome_clinica}}"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Categoria</Label>
                                    <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="boas-vindas">Boas-vindas</SelectItem>
                                            <SelectItem value="reengajamento">Reengajamento</SelectItem>
                                            <SelectItem value="check-up">Check-up</SelectItem>
                                            <SelectItem value="comunicado">Comunicado</SelectItem>
                                            <SelectItem value="nps">Pesquisa NPS</SelectItem>
                                            <SelectItem value="newsletter">Newsletter</SelectItem>
                                            <SelectItem value="custom">Personalizado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Separator orientation="vertical" className="h-6" />

                    {/* Merge variables */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Variable className="mr-1.5 size-3.5" />
                                Variáveis
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                            <p className="mb-2 px-2 text-[10px] text-muted-foreground">
                                Selecione um bloco de texto e clique na variável para inserir
                            </p>
                            <div className="space-y-0.5">
                                {MERGE_VARIABLES.map((v) => (
                                    <button
                                        key={v.key}
                                        type="button"
                                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent"
                                        onClick={() => insertVariable(v.key)}
                                    >
                                        <span>{v.label}</span>
                                        <Badge variant="outline" className="text-[10px] font-mono">
                                            {`{{${v.key}}}`}
                                        </Badge>
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Separator orientation="vertical" className="h-6" />

                    <Button variant="outline" size="sm">
                        <Eye className="mr-1.5 size-3.5" />
                        Preview
                    </Button>
                    <Button variant="outline" size="sm">
                        <Send className="mr-1.5 size-3.5" />
                        Enviar teste
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving || !templateName}>
                        {isSaving ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                            <Save className="mr-1.5 size-3.5" />
                        )}
                        {isSaving ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
            </header>

            {/* Email Builder */}
            <div className="flex-1 overflow-hidden">
                <EmailEditor
                    content={editorContent}
                    className="h-full rounded-none border-0 shadow-none"
                />
            </div>
        </main>
    );
}
