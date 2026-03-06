"use client";

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type DragEvent,
} from "react";
import {
    AlertCircle,
    Bot,
    CheckCircle2,
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
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";
import { EmojiStyle } from "emoji-picker-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    useConversation,
    useDeleteMessage,
    useEditMessage,
    useInfiniteMessages,
    useSendMedia,
    useSendText,
    useSendTemplate,
    useUpdateConversation,
    useSuggestReply,
    useSummarize,
    useTemplates,
} from "@/hooks/use-whatsapp";
import type { WAConversationStatus } from "@/types/whatsapp";
import {
    getContactDisplayName,
    getContactInitial,
    getContactPhotoUrl,
    getContactPhone,
} from "@/lib/whatsapp-contact";
import {
    abandonWhatsAppUxMetric,
    beginWhatsAppUxMetric,
    completeWhatsAppUxMetric,
} from "@/lib/whatsapp-ux-metrics";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const statusLabels: Record<WAConversationStatus, string> = {
    open: "Aberta",
    resolved: "Resolvida",
    archived: "Arquivada",
};

type AttachmentKind = "image" | "video" | "audio" | "document";
type AttachmentUploadStatus = "queued" | "uploading" | "sent" | "failed";

type AttachmentItem = {
    id: string;
    file: File;
    kind: AttachmentKind;
    previewUrl: string | null;
    uploadStatus: AttachmentUploadStatus;
    errorMessage?: string;
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
    return { id, file, kind, previewUrl, uploadStatus: "queued" };
}

interface ConversationPanelProps {
    conversationId: string;
}

const MESSAGE_PAGE_SIZE = 50;
const MESSAGE_ESTIMATED_HEIGHT = 110;
const VIRTUAL_OVERSCAN_PX = 600;
const LOAD_MORE_THRESHOLD_PX = 180;

function VirtualMessageRow({
    messageId,
    onMeasure,
    children,
}: {
    messageId: string;
    onMeasure: (messageId: string, height: number) => void;
    children: React.ReactNode;
}) {
    const rowRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        const node = rowRef.current;
        if (!node) return;

        const measure = () => {
            onMeasure(messageId, node.offsetHeight);
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, [messageId, onMeasure]);

    return (
        <div ref={rowRef} className="pb-2 last:pb-0">
            {children}
        </div>
    );
}

function MessageBubbleSkeleton({ outbound = false }: { outbound?: boolean }) {
    return (
        <div className={`flex ${outbound ? "justify-end" : "justify-start"} pb-2`}>
            <div className={`max-w-[75%] rounded-3xl px-4 py-3 shadow-sm ${
                outbound ? "bg-emerald-50" : "bg-white"
            }`}>
                <Skeleton className="h-4 w-40 rounded-full" />
                <Skeleton className="mt-2 h-4 w-28 rounded-full" />
                <div className="mt-3 flex justify-end">
                    <Skeleton className="h-3 w-10 rounded-full" />
                </div>
            </div>
        </div>
    );
}

function ConversationPanelSkeleton() {
    return (
        <div className="flex h-full flex-col overflow-hidden">
            <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32 rounded-full" />
                        <Skeleton className="h-3 w-24 rounded-full" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-20 rounded-md" />
                    <Skeleton className="h-8 w-36 rounded-md" />
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 overflow-hidden px-4 py-4">
                    <div
                        className="h-full overflow-hidden"
                        style={{
                            backgroundImage:
                                "radial-gradient(circle at 1px 1px, hsl(var(--muted)) 1px, transparent 0)",
                            backgroundSize: "24px 24px",
                        }}
                    >
                        <div className="space-y-1">
                            <MessageBubbleSkeleton />
                            <MessageBubbleSkeleton outbound />
                            <MessageBubbleSkeleton />
                            <MessageBubbleSkeleton outbound />
                        </div>
                    </div>
                </main>
            </div>

            <footer className="shrink-0 border-t bg-background px-4 py-3">
                <div className="flex items-end gap-2">
                    <Skeleton className="h-14 flex-1 rounded-2xl" />
                    <Skeleton className="size-12 rounded-xl" />
                    <Skeleton className="size-12 rounded-xl" />
                    <Skeleton className="size-12 rounded-xl" />
                    <Skeleton className="size-12 rounded-xl" />
                </div>
            </footer>
        </div>
    );
}

function MessagesLoadingState() {
    return (
        <div className="space-y-1">
            <div className="mb-4 flex justify-center">
                <div className="rounded-full border bg-background/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
                    Carregando mensagens...
                </div>
            </div>
            <MessageBubbleSkeleton />
            <MessageBubbleSkeleton outbound />
            <MessageBubbleSkeleton />
            <MessageBubbleSkeleton outbound />
            <MessageBubbleSkeleton />
        </div>
    );
}

export function ConversationPanel({ conversationId }: ConversationPanelProps) {
    const [text, setText] = useState("");
    const [showAI, setShowAI] = useState(false);
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [isDraggingFiles, setIsDraggingFiles] = useState(false);
    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [isSendingAttachments, setIsSendingAttachments] = useState(false);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [measurementVersion, setMeasurementVersion] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollViewportRef = useRef<HTMLDivElement>(null);
    const dragDepthRef = useRef(0);
    const attachmentsRef = useRef<AttachmentItem[]>([]);
    const isSendingRef = useRef(false);
    const rowHeightsRef = useRef<Map<string, number>>(new Map());
    const pendingPrependAdjustmentRef = useRef<{
        previousHeight: number;
        previousTop: number;
        previousCount: number;
    } | null>(null);
    const shouldStickToBottomRef = useRef(true);
    const initialScrollDoneRef = useRef(false);
    const conversationTtiMetricRef = useRef<string | null>(null);
    const firstMessageMetricRef = useRef<string | null>(null);

    const { data: conv, isLoading: convLoading } = useConversation(conversationId, {
        refetchIntervalMs: 5000,
    });
    const {
        data: msgData,
        isLoading: msgsLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteMessages(conversationId, {
        pageSize: MESSAGE_PAGE_SIZE,
        refetchIntervalMs: 2500,
    });
    const { data: ai } = useSuggestReply(showAI ? conversationId : null);
    const { data: summary } = useSummarize(showAI ? conversationId : null);
    const { data: templatesData } = useTemplates({ status: "approved" });
    const sendText = useSendText(conversationId);
    const sendMedia = useSendMedia(conversationId);
    const sendTemplate = useSendTemplate(conversationId);
    const editMessage = useEditMessage(conversationId);
    const deleteMessage = useDeleteMessage(conversationId);
    const updateConv = useUpdateConversation();

    const messages = msgData?.items ?? [];
    const totalMessages = msgData?.total ?? messages.length;
    const templates = templatesData?.items ?? [];
    const readyAttachments = attachments.filter(
        (item) => item.uploadStatus === "queued" || item.uploadStatus === "failed"
    );
    const queueCount = readyAttachments.length;
    const uploadingCount = attachments.filter((item) => item.uploadStatus === "uploading").length;
    const failedCount = attachments.filter((item) => item.uploadStatus === "failed").length;
    const showAttachmentQueue = queueCount > 0;

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

    // Reset ao trocar de conversa
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on id change
    useEffect(() => {
        abandonWhatsAppUxMetric(conversationTtiMetricRef.current);
        abandonWhatsAppUxMetric(firstMessageMetricRef.current);
        conversationTtiMetricRef.current = beginWhatsAppUxMetric("conversation_tti", {
            conversation_id: conversationId,
        });
        firstMessageMetricRef.current = beginWhatsAppUxMetric("conversation_first_message", {
            conversation_id: conversationId,
        });
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
        rowHeightsRef.current.clear();
        setMeasurementVersion(0);
        setScrollTop(0);
        initialScrollDoneRef.current = false;
        shouldStickToBottomRef.current = true;
        pendingPrependAdjustmentRef.current = null;
    }, [conversationId]);

    useEffect(() => {
        if (!conversationTtiMetricRef.current || convLoading) return;
        completeWhatsAppUxMetric(conversationTtiMetricRef.current, {
            conversation_id: conversationId,
            result: conv ? "ready" : "not_found",
        });
        conversationTtiMetricRef.current = null;
    }, [conv, convLoading, conversationId]);

    useEffect(() => {
        if (!firstMessageMetricRef.current || msgsLoading) return;
        if (messages.length > 0) {
            completeWhatsAppUxMetric(firstMessageMetricRef.current, {
                conversation_id: conversationId,
                total_messages: totalMessages,
                result: "message_visible",
            });
            firstMessageMetricRef.current = null;
            return;
        }
        completeWhatsAppUxMetric(firstMessageMetricRef.current, {
            conversation_id: conversationId,
            total_messages: totalMessages,
            result: "empty_conversation",
        });
        firstMessageMetricRef.current = null;
    }, [conversationId, messages.length, msgsLoading, totalMessages]);

    const handleMeasureRow = useCallback((messageId: string, height: number) => {
        const normalizedHeight = Math.max(height, 1);
        const current = rowHeightsRef.current.get(messageId);
        if (current === normalizedHeight) return;
        rowHeightsRef.current.set(messageId, normalizedHeight);
        setMeasurementVersion((value) => value + 1);
    }, []);

    const virtualMetrics = useMemo(() => {
        const topBoundary = Math.max(scrollTop - VIRTUAL_OVERSCAN_PX, 0);
        const bottomBoundary = scrollTop + viewportHeight + VIRTUAL_OVERSCAN_PX;
        const offsets: number[] = new Array(messages.length);
        const sizes: number[] = new Array(messages.length);
        let runningOffset = 0;
        let startIndex = 0;
        let endIndex = messages.length - 1;
        let foundStart = false;

        for (let index = 0; index < messages.length; index += 1) {
            offsets[index] = runningOffset;
            const size = rowHeightsRef.current.get(messages[index].id) ?? MESSAGE_ESTIMATED_HEIGHT;
            sizes[index] = size;
            const itemBottom = runningOffset + size;
            if (!foundStart && itemBottom >= topBoundary) {
                startIndex = index;
                foundStart = true;
            }
            if (foundStart && runningOffset <= bottomBoundary) {
                endIndex = index;
            }
            runningOffset = itemBottom;
        }

        if (!foundStart) {
            startIndex = Math.max(messages.length - 1, 0);
            endIndex = Math.max(messages.length - 1, 0);
        }

        const visibleItems = messages.slice(startIndex, endIndex + 1);
        const topSpacerHeight = offsets[startIndex] ?? 0;
        const renderedHeight = visibleItems.reduce((sum, item) => (
            sum + (rowHeightsRef.current.get(item.id) ?? MESSAGE_ESTIMATED_HEIGHT)
        ), 0);
        const bottomSpacerHeight = Math.max(runningOffset - topSpacerHeight - renderedHeight, 0);

        return {
            visibleItems,
            topSpacerHeight,
            bottomSpacerHeight,
            totalHeight: runningOffset,
        };
    }, [measurementVersion, messages, scrollTop, viewportHeight]);

    const loadOlderMessages = useCallback(async () => {
        if (!hasNextPage || isFetchingNextPage) return;
        const viewport = scrollViewportRef.current;
        if (viewport) {
            pendingPrependAdjustmentRef.current = {
                previousHeight: viewport.scrollHeight,
                previousTop: viewport.scrollTop,
                previousCount: messages.length,
            };
        }
        await fetchNextPage();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage, messages.length]);

    const handleMessagesScroll = useCallback(() => {
        const viewport = scrollViewportRef.current;
        if (!viewport) return;
        const nextTop = viewport.scrollTop;
        const distanceToBottom = viewport.scrollHeight - viewport.clientHeight - nextTop;
        shouldStickToBottomRef.current = distanceToBottom < 140;
        setScrollTop(nextTop);

        if (nextTop <= LOAD_MORE_THRESHOLD_PX) {
            void loadOlderMessages();
        }
    }, [loadOlderMessages]);

    useLayoutEffect(() => {
        const viewport = scrollViewportRef.current;
        if (!viewport) return;

        const syncViewportSize = () => {
            setViewportHeight(viewport.clientHeight);
            setScrollTop(viewport.scrollTop);
        };

        syncViewportSize();
        const observer = new ResizeObserver(syncViewportSize);
        observer.observe(viewport);
        return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
        const viewport = scrollViewportRef.current;
        if (!viewport || messages.length === 0) return;

        const pendingAdjustment = pendingPrependAdjustmentRef.current;
        if (
            pendingAdjustment
            && messages.length > pendingAdjustment.previousCount
        ) {
            const delta = viewport.scrollHeight - pendingAdjustment.previousHeight;
            viewport.scrollTop = pendingAdjustment.previousTop + delta;
            setScrollTop(viewport.scrollTop);
            pendingPrependAdjustmentRef.current = null;
            return;
        }

        if (!initialScrollDoneRef.current) {
            viewport.scrollTop = viewport.scrollHeight;
            setScrollTop(viewport.scrollTop);
            initialScrollDoneRef.current = true;
            return;
        }

        if (shouldStickToBottomRef.current) {
            viewport.scrollTop = viewport.scrollHeight;
            setScrollTop(viewport.scrollTop);
        }
    }, [conversationId, messages.length, measurementVersion]);

    const handleSendText = () => {
        if (
            isSendingRef.current
            || sendText.isPending
        ) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        isSendingRef.current = true;
        setText("");
        const uxActionId = beginWhatsAppUxMetric("action_feedback", {
            action: "send_text",
            conversation_id: conversationId,
        });
        sendText.mutate(
            { body_text: trimmed, __uxActionId: uxActionId },
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
            sendMedia.isPending
            || isSendingAttachments
            || queueCount === 0
        ) return;

        setIsSendingAttachments(true);
        const pending = [...readyAttachments];
        const pendingIds = new Set(pending.map((item) => item.id));
        const trimmedCaption = text.trim();
        let failError: Error | null = null;

        try {
            setAttachments((prev) => prev.map((item) => (
                pendingIds.has(item.id)
                    ? { ...item, uploadStatus: "uploading" as const, errorMessage: undefined }
                    : item
            )));

            // Dispara todos os envios juntos para exibir placeholders pendentes
            // imediatamente, reduzindo a percepção de latência.
            const uploadPromises = pending.map((item, index) => {
                const caption = index === 0 && trimmedCaption ? trimmedCaption : undefined;
                const uxActionId = beginWhatsAppUxMetric("action_feedback", {
                    action: "send_media",
                    conversation_id: conversationId,
                    filename: item.file.name,
                    mime_type: item.file.type || undefined,
                });
                return sendMedia.mutateAsync({ file: item.file, caption, __uxActionId: uxActionId })
                    .then((result) => {
                        setAttachments((prev) => prev.map((current) => (
                            current.id === item.id
                                ? { ...current, uploadStatus: "sent" as const, errorMessage: undefined }
                                : current
                        )));
                        return result;
                    })
                    .catch((error: unknown) => {
                        const parsedError = error instanceof Error
                            ? error
                            : new Error("Falha ao enviar arquivo");
                        setAttachments((prev) => prev.map((current) => (
                            current.id === item.id
                                ? {
                                    ...current,
                                    uploadStatus: "failed" as const,
                                    errorMessage: parsedError.message,
                                }
                                : current
                        )));
                        throw parsedError;
                    });
            });
            const settled = await Promise.allSettled(uploadPromises);
            const sentCount = settled.filter((result) => result.status === "fulfilled").length;
            const hasFailures = sentCount !== settled.length;

            if (hasFailures) {
                const firstFailed = settled.find((result) => result.status === "rejected");
                failError = firstFailed?.status === "rejected"
                    ? (firstFailed.reason instanceof Error
                        ? firstFailed.reason
                        : new Error("Falha ao enviar arquivo"))
                    : null;
            }

            if (trimmedCaption && sentCount > 0) setText("");

            if (sentCount > 0) {
                setAttachments((prev) => {
                    const kept: AttachmentItem[] = [];
                    for (const item of prev) {
                        if (item.uploadStatus === "sent") {
                            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                            continue;
                        }
                        kept.push(item);
                    }
                    return kept;
                });
            }

            if (sentCount > 0 && !hasFailures) {
                toast.success(sentCount > 1 ? "Arquivos enviados!" : "Arquivo enviado!");
            } else if (sentCount > 0 && hasFailures && failError) {
                toast.error("Envio parcial de anexos", {
                    description: failError.message,
                });
            } else if (hasFailures && failError) {
                toast.error("Erro ao enviar arquivo", {
                    description: failError.message,
                });
            }
        } finally {
            setIsSendingAttachments(false);
        }
    };

    const handleSend = () => {
        if (queueCount > 0) {
            void handleSendAttachments();
            return;
        }
        handleSendText();
    };

    const handleStatusChange = (status: WAConversationStatus) => {
        const uxActionId = beginWhatsAppUxMetric("action_feedback", {
            action: "update_conversation_status",
            conversation_id: conversationId,
            next_status: status,
        });
        updateConv.mutate(
            { id: conversationId, body: { status, __uxActionId: uxActionId } },
            {
                onSuccess: () =>
                    toast.success(`Conversa marcada como ${statusLabels[status]}`),
                onError: () => toast.error("Erro ao atualizar status"),
            }
        );
    };

    const handleEditMessage = async (messageId: string, nextText: string) => {
        const uxActionId = beginWhatsAppUxMetric("action_feedback", {
            action: "edit_message",
            conversation_id: conversationId,
            message_id: messageId,
        });
        await editMessage.mutateAsync({
            messageId,
            body: { body_text: nextText, __uxActionId: uxActionId },
        });
    };

    const handleDeleteMessage = async (messageId: string) => {
        const uxActionId = beginWhatsAppUxMetric("action_feedback", {
            action: "delete_message",
            conversation_id: conversationId,
            message_id: messageId,
        });
        await deleteMessage.mutateAsync({ messageId, __uxActionId: uxActionId });
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

    if (convLoading) return <ConversationPanelSkeleton />;

    if (!conv) {
        return (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Conversa não encontrada.
            </div>
        );
    }

    const contactName = getContactDisplayName(conv.contact);
    const contactPhone = getContactPhone(conv.contact);
    const contactInitial = getContactInitial(conv.contact);
    const contactPhotoUrl = getContactPhotoUrl(conv.contact);

    return (
        <div
            className="relative flex h-full flex-col overflow-hidden"
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
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-3">
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
                    ref={scrollViewportRef}
                    onScroll={handleMessagesScroll}
                    className="flex-1 overflow-y-auto px-4 py-4"
                    style={{
                        backgroundImage:
                            "radial-gradient(circle at 1px 1px, hsl(var(--muted)) 1px, transparent 0)",
                        backgroundSize: "24px 24px",
                    }}
                >
                    {msgsLoading && messages.length === 0 ? (
                        <MessagesLoadingState />
                    ) : messages.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-center">
                            <p className="text-sm text-muted-foreground">
                                Nenhuma mensagem ainda.
                            </p>
                        </div>
                    ) : (
                        <div>
                            {(hasNextPage || isFetchingNextPage) && (
                                <div className="mb-2 flex justify-center">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-muted-foreground"
                                        onClick={() => void loadOlderMessages()}
                                        disabled={isFetchingNextPage}
                                    >
                                        {isFetchingNextPage ? (
                                            <>
                                                <Loader2 className="mr-1 size-3 animate-spin" />
                                                Carregando mensagens antigas...
                                            </>
                                        ) : (
                                            `Carregar mais (${messages.length}/${totalMessages})`
                                        )}
                                    </Button>
                                </div>
                            )}

                            <div style={{ height: virtualMetrics.topSpacerHeight }} />
                            {virtualMetrics.visibleItems.map((msg) => (
                                <VirtualMessageRow
                                    key={msg.id}
                                    messageId={msg.id}
                                    onMeasure={handleMeasureRow}
                                >
                                    <MessageBubble
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
                                </VirtualMessageRow>
                            ))}
                            <div style={{ height: virtualMetrics.bottomSpacerHeight }} />
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
                                        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                                            <Skeleton className="h-3 w-full rounded-full" />
                                            <Skeleton className="h-3 w-5/6 rounded-full" />
                                            <Skeleton className="h-7 w-full rounded-md" />
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Resumo
                                    </p>
                                    {summary?.summary ? (
                                        <div className="rounded-md border bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                                            {summary.summary}
                                        </div>
                                    ) : (
                                        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                                            <Skeleton className="h-3 w-full rounded-full" />
                                            <Skeleton className="h-3 w-[92%] rounded-full" />
                                            <Skeleton className="h-3 w-4/5 rounded-full" />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </aside>
                )}
            </div>

            {/* Input */}
            <footer className="shrink-0 border-t bg-background px-4 py-3">
                {showAttachmentQueue && (
                    <div className="mb-3 rounded-xl border bg-muted/30 p-2">
                        <div className="mb-2 flex items-center justify-between px-1">
                            <p className="text-xs font-medium text-muted-foreground">
                                {queueCount} arquivo(s) na fila
                                {uploadingCount > 0 && ` • ${uploadingCount} enviando`}
                                {failedCount > 0 && ` • ${failedCount} com falha`}
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
                            {readyAttachments.map((item) => (
                                <div
                                    key={item.id}
                                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-background"
                                    title={item.uploadStatus === "failed" ? item.errorMessage : undefined}
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
                                    <div className="absolute bottom-1 left-1 rounded-md bg-black/65 px-1 py-0.5 text-[10px] font-medium text-white">
                                        {item.uploadStatus === "uploading" && (
                                            <span className="inline-flex items-center gap-1">
                                                <Loader2 className="size-3 animate-spin" />
                                                Enviando
                                            </span>
                                        )}
                                        {item.uploadStatus === "queued" && (
                                            <span>Na fila</span>
                                        )}
                                        {item.uploadStatus === "sent" && (
                                            <span className="inline-flex items-center gap-1">
                                                <CheckCircle2 className="size-3" />
                                                Enviado
                                            </span>
                                        )}
                                        {item.uploadStatus === "failed" && (
                                            <span className="inline-flex items-center gap-1">
                                                <AlertCircle className="size-3" />
                                                Falhou
                                            </span>
                                        )}
                                    </div>
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

                    <Button
                        variant="outline"
                        size="icon"
                        title="Anexar arquivo"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip className="size-4" />
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
                                                    {
                                                        template_id: tpl.id,
                                                        __uxActionId: beginWhatsAppUxMetric("action_feedback", {
                                                            action: "send_template",
                                                            conversation_id: conversationId,
                                                            template_id: tpl.id,
                                                        }),
                                                    },
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
                            (!text.trim() && queueCount === 0)
                            || sendText.isPending
                        }
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
