"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
    ArrowLeft,
    Eye,
    Loader2,
    Save,
    Send,
    Variable,
    ChevronDown,
    Monitor,
    Smartphone,
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useTemplate, useCreateTemplate, useUpdateTemplate, useSendTestEmail } from "@/hooks/use-marketing";
import type { TemplateCategory } from "@/types/marketing";
import { EmailEditor } from "@/components/email-marketing/email-editor";
import { useEmailBuilderStore } from "@/stores/email-builder-store";
import { generateHtmlFromBlocks, generateEmailHtml } from "@/components/email-marketing/builder/utils";

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

    // Send test email
    const [testDialogOpen, setTestDialogOpen] = useState(false);
    const [testEmail, setTestEmail] = useState("");
    const sendTestMutation = useSendTestEmail();

    // Preview
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState("");
    const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

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
    const insertVariable = useCallback(
        (varKey: string) => {
            const { selectedBlockId: selId, blocks: currentBlocks, updateBlockContent: update } =
                useEmailBuilderStore.getState();
            if (!selId) {
                toast.error("Selecione um bloco de texto antes de inserir uma variável.");
                return;
            }
            const block = currentBlocks.find((b) => b.id === selId);
            if (!block) {
                toast.error("Bloco não encontrado.");
                return;
            }
            const content = block.content as any;
            if (!("text" in content)) {
                toast.error("Variáveis só podem ser inseridas em blocos de texto, título ou subtítulo.");
                return;
            }
            update(selId, {
                text: (content.text || "") + `{{${varKey}}}`,
            });
            toast.success(`Variável {{${varKey}}} inserida!`);
        },
        []
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

    const handleSendTest = useCallback(() => {
        if (!testEmail.trim()) {
            toast.error("Informe o email de destino.");
            return;
        }

        const currentBlocks = useEmailBuilderStore.getState().blocks;
        const html = generateEmailHtml(currentBlocks);

        if (!html || html.trim() === "") {
            toast.error("O template está vazio. Adicione conteúdo antes de enviar.");
            return;
        }

        sendTestMutation.mutate(
            {
                to_email: testEmail.trim(),
                subject: subject || `[TESTE] ${templateName || "Template sem nome"}`,
                html_content: html,
            },
            {
                onSuccess: () => {
                    toast.success(`Email de teste enviado para ${testEmail.trim()}!`);
                    setTestDialogOpen(false);
                    setTestEmail("");
                },
                onError: (err: any) => {
                    toast.error(
                        err?.response?.data?.detail || "Erro ao enviar email de teste."
                    );
                },
            }
        );
    }, [testEmail, subject, templateName, sendTestMutation]);

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

                    <Button variant="outline" size="sm" onClick={() => {
                        const currentBlocks = useEmailBuilderStore.getState().blocks;
                        if (currentBlocks.length === 0) {
                            toast.error("Adicione blocos ao template antes de visualizar.");
                            return;
                        }
                        setPreviewHtml(generateEmailHtml(currentBlocks));
                        setPreviewOpen(true);
                    }}>
                        <Eye className="mr-1.5 size-3.5" />
                        Preview
                    </Button>

                    {/* Preview Dialog */}
                    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                        <DialogContent className="sm:max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
                            <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <DialogTitle>Preview do email</DialogTitle>
                                        <DialogDescription>
                                            Visualização de como o email será entregue ao destinatário.
                                        </DialogDescription>
                                    </div>
                                    <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDevice("desktop")}
                                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${previewDevice === "desktop"
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                                }`}
                                        >
                                            <Monitor className="size-3.5" />
                                            Desktop
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDevice("mobile")}
                                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${previewDevice === "mobile"
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                                }`}
                                        >
                                            <Smartphone className="size-3.5" />
                                            Mobile
                                        </button>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="flex-1 overflow-auto bg-muted/30 flex items-start justify-center p-6">
                                <div
                                    className="bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300"
                                    style={{
                                        width: previewDevice === "mobile" ? 375 : 680,
                                        maxWidth: "100%",
                                    }}
                                >
                                    <iframe
                                        srcDoc={previewHtml}
                                        title="Email Preview"
                                        sandbox="allow-same-origin"
                                        className="w-full border-0"
                                        style={{ minHeight: 500, height: "100%" }}
                                        onLoad={(e) => {
                                            const iframe = e.target as HTMLIFrameElement;
                                            if (iframe.contentDocument?.body) {
                                                iframe.style.height = iframe.contentDocument.body.scrollHeight + 20 + "px";
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Send className="mr-1.5 size-3.5" />
                                Enviar teste
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Enviar email de teste</DialogTitle>
                                <DialogDescription>
                                    O conteúdo atual do template será enviado para o email informado.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 py-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="test-email">Email de destino</Label>
                                    <Input
                                        id="test-email"
                                        type="email"
                                        placeholder="seuemail@exemplo.com"
                                        value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSendTest();
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Assunto: <span className="font-medium">{subject || `[TESTE] ${templateName || "Template sem nome"}`}</span>
                                </p>
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setTestDialogOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSendTest}
                                    disabled={sendTestMutation.isPending || !testEmail.trim()}
                                >
                                    {sendTestMutation.isPending ? (
                                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                                    ) : (
                                        <Send className="mr-1.5 size-3.5" />
                                    )}
                                    {sendTestMutation.isPending ? "Enviando..." : "Enviar"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
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
