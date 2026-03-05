"use client";

import { useEffect, useRef, useState } from "react";
import {
    Bot,
    CheckCircle2,
    Loader2,
    Send,
    Sparkles,
    X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageBubble } from "@/components/whatsapp/message-bubble";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    useConversation,
    useMessages,
    useSendText,
    useSendTemplate,
    useUpdateConversation,
    useSuggestReply,
    useSummarize,
    useTemplates,
} from "@/hooks/use-whatsapp";
import type { WAConversationStatus } from "@/types/whatsapp";

const statusLabels: Record<WAConversationStatus, string> = {
    open: "Aberta",
    resolved: "Resolvida",
    archived: "Arquivada",
};

interface ConversationPanelProps {
    conversationId: string;
}

export function ConversationPanel({ conversationId }: ConversationPanelProps) {
    const [text, setText] = useState("");
    const [showAI, setShowAI] = useState(false);
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { data: conv, isLoading: convLoading } = useConversation(conversationId);
    const { data: msgData, isLoading: msgsLoading } = useMessages(conversationId, { limit: 100 });
    const { data: ai } = useSuggestReply(showAI ? conversationId : null);
    const { data: summary } = useSummarize(showAI ? conversationId : null);
    const { data: templatesData } = useTemplates({ status: "approved" });
    const sendText = useSendText(conversationId);
    const sendTemplate = useSendTemplate(conversationId);
    const updateConv = useUpdateConversation();

    const messages = msgData?.items ?? [];
    const templates = templatesData?.items ?? [];

    // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    // Reset ao trocar de conversa
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on id change
    useEffect(() => {
        setText("");
        setShowAI(false);
    }, [conversationId]);

    const handleSend = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        sendText.mutate(
            { body_text: trimmed },
            {
                onSuccess: () => setText(""),
                onError: (err: Error) =>
                    toast.error("Erro ao enviar", { description: err.message }),
            }
        );
    };

    const handleStatusChange = (status: WAConversationStatus) => {
        updateConv.mutate(
            { id: conversationId, body: { status } },
            {
                onSuccess: () =>
                    toast.success(`Conversa marcada como ${statusLabels[status]}`),
                onError: () => toast.error("Erro ao atualizar status"),
            }
        );
    };

    if (convLoading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!conv) {
        return (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Conversa não encontrada.
            </div>
        );
    }

    const contactName =
        conv.contact?.display_name ||
        conv.contact?.phone_display ||
        conv.contact?.phone_e164 ||
        "Contato";

    return (
        <div className="flex h-full flex-col overflow-hidden">
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                        {contactName[0]?.toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{contactName}</p>
                        <p className="text-xs text-muted-foreground">
                            {conv.contact?.phone_display || conv.contact?.phone_e164}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAI(!showAI)}
                    >
                        <Sparkles className="mr-1.5 size-3.5" />
                        IA
                    </Button>
                    <Select
                        value={conv.status}
                        onValueChange={(v) =>
                            handleStatusChange(v as WAConversationStatus)
                        }
                    >
                        <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="open">Aberta</SelectItem>
                            <SelectItem value="resolved">Resolvida</SelectItem>
                            <SelectItem value="archived">Arquivada</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Mensagens */}
                <main
                    className="flex-1 overflow-y-auto px-4 py-4"
                    style={{
                        backgroundImage:
                            "radial-gradient(circle at 1px 1px, hsl(var(--muted)) 1px, transparent 0)",
                        backgroundSize: "24px 24px",
                    }}
                >
                    {msgsLoading ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="size-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-center">
                            <p className="text-sm text-muted-foreground">
                                Nenhuma mensagem ainda.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {messages.map((msg) => (
                                <MessageBubble key={msg.id} message={msg} />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </main>

                {/* Painel AI */}
                {showAI && (
                    <aside className="w-64 shrink-0 overflow-y-auto border-l bg-background p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bot className="size-4 text-violet-500" />
                                <span className="text-sm font-semibold">AI Copiloto</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-6"
                                onClick={() => setShowAI(false)}
                            >
                                <X className="size-3.5" />
                            </Button>
                        </div>

                        {!ai?.available && (
                            <p className="mt-3 text-xs text-muted-foreground">
                                Configure OPENAI_API_KEY no backend para habilitar o copiloto.
                            </p>
                        )}

                        {ai?.available && (
                            <>
                                <div className="mt-4 space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Sugestão de resposta
                                    </p>
                                    {ai.suggested_reply ? (
                                        <div className="rounded-md border bg-muted/50 p-3 text-xs">
                                            {ai.suggested_reply}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="mt-2 h-7 w-full text-xs"
                                                onClick={() =>
                                                    setText(ai.suggested_reply ?? "")
                                                }
                                            >
                                                Usar sugestão
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            Carregando...
                                        </p>
                                    )}
                                </div>
                                {summary?.summary && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            Resumo
                                        </p>
                                        <div className="rounded-md border bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                                            {summary.summary}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </aside>
                )}
            </div>

            {/* Input */}
            <footer className="shrink-0 border-t bg-background px-4 py-3">
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <Textarea
                            placeholder="Digite uma mensagem..."
                            className="max-h-32 min-h-[44px] resize-none"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                    </div>

                    {/* Template */}
                    <Dialog
                        open={templateDialogOpen}
                        onOpenChange={setTemplateDialogOpen}
                    >
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                title="Enviar template"
                            >
                                <CheckCircle2 className="size-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Enviar template</DialogTitle>
                            </DialogHeader>
                            {templates.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    Nenhum template aprovado.{" "}
                                    <Link
                                        href="/dashboard/whatsapp/templates"
                                        className="underline"
                                    >
                                        Gerenciar templates
                                    </Link>
                                </p>
                            ) : (
                                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                                    {templates.map((tpl) => (
                                        <button
                                            key={tpl.id}
                                            type="button"
                                            className="w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/60"
                                            onClick={() => {
                                                sendTemplate.mutate(
                                                    { template_id: tpl.id },
                                                    {
                                                        onSuccess: () => {
                                                            setTemplateDialogOpen(false);
                                                            toast.success("Template enviado!");
                                                        },
                                                        onError: () =>
                                                            toast.error("Erro ao enviar template"),
                                                    }
                                                );
                                            }}
                                        >
                                            <p className="font-medium">{tpl.name}</p>
                                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                                {tpl.body_text}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>

                    <Button
                        onClick={handleSend}
                        disabled={!text.trim() || sendText.isPending}
                        size="icon"
                    >
                        {sendText.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Send className="size-4" />
                        )}
                    </Button>
                </div>
            </footer>
        </div>
    );
}
