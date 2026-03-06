"use client";

import { use, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
    ArrowLeft,
    Bot,
    CheckCircle2,
    ChevronDown,
    FileText,
    ImageIcon,
    Loader2,
    Music2,
    Paperclip,
    Smile,
    Send,
    Sparkles,
    Video,
    X,
} from "lucide-react";
import Link from "next/link";
import type { EmojiClickData } from "emoji-picker-react";
import { EmojiStyle } from "emoji-picker-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageBubble } from "@/components/whatsapp/message-bubble";
import {
    useConversation,
    useDeleteMessage,
    useEditMessage,
    useMessages,
    useSendMedia,
    useSendText,
    useSendTemplate,
    useUpdateConversation,
    useSuggestReply,
    useSummarize,
    useTemplates,
} from "@/hooks/use-whatsapp";
import { useInboxWebSocket } from "@/hooks/use-inbox-ws";
import type { WAConversationStatus } from "@/types/whatsapp";
import {
    getContactDisplayName,
    getContactInitial,
    getContactPhotoUrl,
    getContactPhone,
} from "@/lib/whatsapp-contact";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const statusLabels: Record<WAConversationStatus, string> = {
    open: "Aberta",
    resolved: "Resolvida",
    archived: "Arquivada",
};

type AttachmentKind = "image" | "video" | "audio" | "document";

type AttachmentItem = {
    id: string;
    file: File;
    kind: AttachmentKind;
    previewUrl: string | null;
};

function getAttachmentKind(file: File): AttachmentKind {
    const mime = (file.type || "").toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "document";
}

function formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildAttachment(file: File): AttachmentItem {
    const kind = getAttachmentKind(file);
    const previewUrl = kind === "image" ? URL.createObjectURL(file) : null;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return { id, file, kind, previewUrl };
}

export default function ConversationPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const [text, setText] = useState("");
    const [showAI, setShowAI] = useState(false);
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [isDraggingFiles, setIsDraggingFiles] = useState(false);
    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [isSendingAttachments, setIsSendingAttachments] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragDepthRef = useRef(0);
    const attachmentsRef = useRef<AttachmentItem[]>([]);
    const isSendingRef = useRef(false);

    const { data: conv, isLoading: convLoading } = useConversation(id, {
        refetchIntervalMs: 5000,
    });
    const { data: msgData, isLoading: msgsLoading } = useMessages(id, {
        limit: 100,
        refetchIntervalMs: 2500,
    });
    const { data: ai } = useSuggestReply(showAI ? id : null);
    const { data: summary } = useSummarize(showAI ? id : null);
    const { data: templatesData } = useTemplates({ status: "approved" });
    const sendText = useSendText(id);
    const sendMedia = useSendMedia(id);
    const sendTemplate = useSendTemplate(id);
    const editMessage = useEditMessage(id);
    const deleteMessage = useDeleteMessage(id);
    const updateConv = useUpdateConversation();

    const messages = msgData?.items ?? [];
    const templates = templatesData?.items ?? [];

    // Tempo real também na rota direta /inbox/[id]
    useInboxWebSocket({
        accountId: conv?.account_id ?? null,
    });

    // Auto-scroll para o final
    // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    useEffect(() => {
        attachmentsRef.current = attachments;
    }, [attachments]);

    useEffect(() => {
        return () => {
            for (const item of attachmentsRef.current) {
                if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            }
        };
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: reset states on conversation change
    useEffect(() => {
        setText("");
        setShowAI(false);
        setIsDraggingFiles(false);
        setAttachments((prev) => {
            for (const item of prev) {
                if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            }
            return [];
        });
        dragDepthRef.current = 0;
        isSendingRef.current = false;
    }, [id]);

    const handleSendText = () => {
        if (
            isSendingRef.current
            || sendText.isPending
            || sendMedia.isPending
            || isSendingAttachments
        ) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        isSendingRef.current = true;
        setText("");
        sendText.mutate(
            { body_text: trimmed },
            {
                onError: (err: Error) => {
                    setText(trimmed);
                    toast.error("Erro ao enviar", { description: err.message });
                },
                onSettled: () => {
                    isSendingRef.current = false;
                },
            }
        );
    };

    const enqueueFiles = (files: File[]) => {
        if (!files.length) return;
        const nextItems = files.map(buildAttachment);
        setAttachments((prev) => [...prev, ...nextItems]);
    };

    const removeAttachment = (attachmentId: string) => {
        if (isSendingAttachments) return;
        setAttachments((prev) => {
            const removed = prev.find((item) => item.id === attachmentId);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return prev.filter((item) => item.id !== attachmentId);
        });
    };

    const clearAttachments = () => {
        if (isSendingAttachments) return;
        setAttachments((prev) => {
            for (const item of prev) {
                if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            }
            return [];
        });
    };

    const handleSendAttachments = async () => {
        if (
            isSendingRef.current
            || sendMedia.isPending
            || sendText.isPending
            || isSendingAttachments
            || attachments.length === 0
        ) return;

        isSendingRef.current = true;
        setIsSendingAttachments(true);
        const pending = [...attachments];
        const trimmedCaption = text.trim();
        let captionUsed = false;
        let sentCount = 0;
        let failError: Error | null = null;

        try {
            for (const item of pending) {
                const caption = !captionUsed && trimmedCaption ? trimmedCaption : undefined;
                try {
                    await sendMedia.mutateAsync({ file: item.file, caption });
                    sentCount += 1;
                    if (caption) captionUsed = true;
                } catch (error) {
                    failError = error instanceof Error
                        ? error
                        : new Error("Falha ao enviar arquivo");
                    break;
                }
            }

            if (captionUsed) setText("");

            setAttachments((prev) => {
                const sentIds = new Set(pending.slice(0, sentCount).map((item) => item.id));
                const remaining = prev.filter((item) => !sentIds.has(item.id));
                for (const item of prev) {
                    if (sentIds.has(item.id) && item.previewUrl) {
                        URL.revokeObjectURL(item.previewUrl);
                    }
                }
                return remaining;
            });

            if (sentCount > 0 && !failError) {
                toast.success(sentCount > 1 ? "Arquivos enviados!" : "Arquivo enviado!");
            } else if (sentCount > 0 && failError) {
                toast.error("Envio parcial de anexos", {
                    description: failError.message,
                });
            } else if (failError) {
                toast.error("Erro ao enviar arquivo", {
                    description: failError.message,
                });
            }
        } finally {
            setIsSendingAttachments(false);
            isSendingRef.current = false;
        }
    };

    const handleSend = () => {
        if (attachments.length > 0) {
            void handleSendAttachments();
            return;
        }
        handleSendText();
    };

    const handleStatusChange = (status: WAConversationStatus) => {
        updateConv.mutate(
            { id, body: { status } },
            {
                onSuccess: () => toast.success(`Conversa marcada como ${statusLabels[status]}`),
                onError: () => toast.error("Erro ao atualizar status"),
            }
        );
    };

    const handleEditMessage = async (messageId: string, nextText: string) => {
        await editMessage.mutateAsync({
            messageId,
            body: { body_text: nextText },
        });
    };

    const handleDeleteMessage = async (messageId: string) => {
        await deleteMessage.mutateAsync({ messageId });
    };

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        const emoji = emojiData.emoji || "";
        if (!emoji) return;

        const textarea = textareaRef.current;
        const start = textarea?.selectionStart ?? text.length;
        const end = textarea?.selectionEnd ?? text.length;
        const nextText = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
        setText(nextText);

        requestAnimationFrame(() => {
            const input = textareaRef.current;
            if (!input) return;
            const cursorPos = start + emoji.length;
            input.focus();
            input.setSelectionRange(cursorPos, cursorPos);
        });
    };

    const hasFilesInDrag = (event: DragEvent<HTMLElement>) =>
        Array.from(event.dataTransfer?.types || []).includes("Files");

    const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        enqueueFiles(files);
        event.currentTarget.value = "";
    };

    const handleDragEnter = (event: DragEvent<HTMLElement>) => {
        if (!hasFilesInDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        dragDepthRef.current += 1;
        setIsDraggingFiles(true);
    };

    const handleDragLeave = (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
            setIsDraggingFiles(false);
        }
    };

    const handleDragOver = (event: DragEvent<HTMLElement>) => {
        if (!hasFilesInDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepthRef.current = 0;
        setIsDraggingFiles(false);
        const files = Array.from(event.dataTransfer.files || []);
        enqueueFiles(files);
    };

    if (convLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!conv) {
        return (
            <div className="flex h-96 flex-col items-center justify-center gap-4">
                <p className="text-sm text-muted-foreground">
                    Conversa não encontrada.
                </p>
                <Button variant="outline" asChild>
                    <Link href="/dashboard/whatsapp/inbox">
                        <ArrowLeft className="mr-2 size-4" />
                        Voltar
                    </Link>
                </Button>
            </div>
        );
    }

    const contactName = getContactDisplayName(conv.contact);
    const contactPhone = getContactPhone(conv.contact);
    const contactInitial = getContactInitial(conv.contact);
    const contactPhotoUrl = getContactPhotoUrl(conv.contact);

    return (
        <div
            className="relative flex h-[calc(100vh-100px)] flex-col"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {isDraggingFiles && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/80">
                    <div className="rounded-xl border border-dashed bg-background px-6 py-4 text-center shadow-sm">
                        <p className="text-sm font-medium">Solte os arquivos aqui</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Suporte para imagens, PDF, vídeos, áudios e outros formatos
                        </p>
                    </div>
                </div>
            )}
            {/* Header da conversa */}
            <header className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard/whatsapp/inbox">
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Button>
                    <Avatar className="size-9 bg-green-100 text-green-700">
                        <AvatarImage src={contactPhotoUrl ?? undefined} alt={contactName} />
                        <AvatarFallback className="bg-green-100 font-semibold text-green-700">
                            {contactInitial}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-sm font-semibold">{contactName}</p>
                        <p className="text-xs text-muted-foreground">
                            {contactPhone}
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
                        <SelectTrigger className="w-36 h-8">
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
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Nenhuma mensagem ainda.
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Envie uma mensagem para iniciar a conversa.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {messages.map((msg) => (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    onEditMessage={async (message, nextText) => {
                                        try {
                                            await handleEditMessage(message.id, nextText);
                                            toast.success("Mensagem editada.");
                                        } catch (err) {
                                            const detail = typeof err === "object" && err !== null
                                                ? (err as { response?: { data?: { detail?: string } } })
                                                    .response?.data?.detail
                                                : undefined;
                                            const description = detail
                                                || (err instanceof Error ? err.message : undefined);
                                            toast.error("Erro ao editar mensagem", {
                                                description,
                                            });
                                            throw err;
                                        }
                                    }}
                                    onDeleteMessage={async (message) => {
                                        try {
                                            await handleDeleteMessage(message.id);
                                            toast.success("Mensagem apagada.");
                                        } catch (err) {
                                            const detail = typeof err === "object" && err !== null
                                                ? (err as { response?: { data?: { detail?: string } } })
                                                    .response?.data?.detail
                                                : undefined;
                                            const description = detail
                                                || (err instanceof Error ? err.message : undefined);
                                            toast.error("Erro ao apagar mensagem", {
                                                description,
                                            });
                                            throw err;
                                        }
                                    }}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </main>

                {/* Painel lateral AI */}
                {showAI && (
                    <aside className="w-72 shrink-0 overflow-y-auto border-l bg-background p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bot className="size-4 text-violet-500" />
                                <span className="text-sm font-semibold">
                                    AI Copiloto
                                </span>
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
                                Configure OPENAI_API_KEY no backend para habilitar o
                                copiloto de IA.
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
                                                    setText(
                                                        ai.suggested_reply ?? ""
                                                    )
                                                }
                                            >
                                                Usar sugestão
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            Carregando sugestão...
                                        </p>
                                    )}
                                </div>
                                {summary?.summary && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            Resumo da conversa
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

            {/* Input de mensagem */}
            <footer className="border-t bg-background px-4 py-3">
                {attachments.length > 0 && (
                    <div className="mb-3 rounded-xl border bg-muted/30 p-2">
                        <div className="mb-2 flex items-center justify-between px-1">
                            <p className="text-xs font-medium text-muted-foreground">
                                {attachments.length} arquivo(s) na fila
                            </p>
                            <button
                                type="button"
                                className="text-xs text-muted-foreground underline disabled:opacity-50"
                                onClick={clearAttachments}
                                disabled={isSendingAttachments}
                            >
                                Limpar
                            </button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {attachments.map((item) => (
                                <div
                                    key={item.id}
                                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-background"
                                >
                                    {item.kind === "image" && item.previewUrl ? (
                                        // biome-ignore lint/performance/noImgElement: preview local de blob no composer
                                        <img
                                            src={item.previewUrl}
                                            alt={item.file.name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full flex-col items-center justify-center gap-1 px-1 text-center">
                                            {item.kind === "video" ? (
                                                <Video className="size-4 text-muted-foreground" />
                                            ) : item.kind === "audio" ? (
                                                <Music2 className="size-4 text-muted-foreground" />
                                            ) : item.kind === "image" ? (
                                                <ImageIcon className="size-4 text-muted-foreground" />
                                            ) : (
                                                <FileText className="size-4 text-muted-foreground" />
                                            )}
                                            <p className="line-clamp-1 w-full text-[10px] text-muted-foreground">
                                                {item.file.name}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {formatFileSize(item.file.size)}
                                            </p>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white disabled:opacity-50"
                                        onClick={() => removeAttachment(item.id)}
                                        disabled={isSendingAttachments}
                                        aria-label={`Remover ${item.file.name}`}
                                    >
                                        <X className="size-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-end gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        multiple
                        onChange={handleFileInputChange}
                    />
                    <div className="flex-1">
                        <Textarea
                            ref={textareaRef}
                            placeholder="Digite uma mensagem..."
                            className="min-h-[44px] max-h-32 resize-none"
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

                    <Button
                        variant="outline"
                        size="icon"
                        title="Anexar arquivo"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sendMedia.isPending || isSendingAttachments}
                    >
                        {sendMedia.isPending || isSendingAttachments ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Paperclip className="size-4" />
                        )}
                    </Button>

                    <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                title="Inserir emoji"
                            >
                                <Smile className="size-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            side="top"
                            align="end"
                            className="w-auto border-none bg-transparent p-0 shadow-none"
                        >
                            <EmojiPicker
                                onEmojiClick={handleEmojiClick}
                                emojiStyle={EmojiStyle.APPLE}
                                searchPlaceholder="Buscar emoji"
                                width={320}
                                height={380}
                                previewConfig={{ showPreview: false }}
                            />
                        </PopoverContent>
                    </Popover>

                    {/* Botão de template */}
                    <Dialog
                        open={templateDialogOpen}
                        onOpenChange={setTemplateDialogOpen}
                    >
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon" title="Enviar template">
                                <CheckCircle2 className="size-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Enviar template</DialogTitle>
                            </DialogHeader>
                            {templates.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    Nenhum template aprovado disponível.{" "}
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
                        disabled={
                            (!text.trim() && attachments.length === 0)
                            || sendText.isPending
                            || sendMedia.isPending
                            || isSendingAttachments
                        }
                        size="icon"
                    >
                        {sendText.isPending || sendMedia.isPending || isSendingAttachments ? (
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
