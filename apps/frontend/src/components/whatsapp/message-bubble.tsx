"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/api/client";
import type { WAMessage } from "@/types/whatsapp";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Check,
    CheckCheck,
    Clock,
    AlertCircle,
    FileText,
    ImageIcon,
    Loader2,
    Music2,
    Pencil,
    Trash2,
    Video,
    X,
} from "lucide-react";

const statusIcon: Record<string, React.ReactNode> = {
    pending: <Clock className="size-3 text-muted-foreground" />,
    sent: <Check className="size-3 text-muted-foreground" />,
    delivered: <CheckCheck className="size-3 text-muted-foreground" />,
    read: <CheckCheck className="size-3 text-blue-500" />,
    failed: <AlertCircle className="size-3 text-destructive" />,
};

function isProxyMediaUrl(url: string): boolean {
    return (
        url.startsWith("/api/v1/whatsapp/messages/")
        && url.endsWith("/media")
    );
}

interface MessageBubbleProps {
    message: WAMessage;
    onEditMessage?: (message: WAMessage, newText: string) => Promise<void> | void;
    onDeleteMessage?: (message: WAMessage) => Promise<void> | void;
}

const DELETED_PLACEHOLDER = "Você apagou esta mensagem.";
const DELETED_MARKERS = [
    "você apagou esta mensagem",
    "voce apagou esta mensagem",
    "mensagem apagada",
];

function MediaPlaceholder({
    isOutbound,
    isImage,
    isAudio,
    isVideo,
    isDocument,
    mediaFilename,
    isLoading,
}: {
    isOutbound: boolean;
    isImage: boolean;
    isAudio: boolean;
    isVideo: boolean;
    isDocument: boolean;
    mediaFilename?: string;
    isLoading: boolean;
}) {
    const Icon = isImage
        ? ImageIcon
        : isVideo
            ? Video
            : isAudio
                ? Music2
                : isDocument
                    ? FileText
                    : FileText;

    return (
        <div
            className={cn(
                "mb-2 flex min-h-24 w-[220px] max-w-full items-center gap-3 rounded-xl border px-3 py-3",
                isOutbound
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-border bg-background/70 text-foreground"
            )}
        >
            <div
                className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    isOutbound ? "bg-white/15" : "bg-muted"
                )}
            >
                {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <Icon className="size-4" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                    {mediaFilename || (
                        isImage
                            ? "Imagem"
                            : isVideo
                                ? "Video"
                                : isAudio
                                    ? "Audio"
                                    : "Arquivo"
                    )}
                </p>
                <p
                    className={cn(
                        "mt-1 text-[11px]",
                        isOutbound ? "text-green-100" : "text-muted-foreground"
                    )}
                >
                    {isLoading ? "Carregando midia..." : "Midia sera carregada ao entrar na area visivel"}
                </p>
            </div>
        </div>
    );
}

export function MessageBubble({
    message,
    onEditMessage,
    onDeleteMessage,
}: MessageBubbleProps) {
    const bubbleRef = useRef<HTMLDivElement | null>(null);
    const isOutbound = message.direction === "outbound";
    const time = message.created_at
        ? format(new Date(message.created_at), "HH:mm", { locale: ptBR })
        : "";
    const messageType = (message.message_type || "").toLowerCase();
    const mediaType = (message.media_type || "").toLowerCase();
    const mediaUrl = message.media_url?.trim() || null;
    const bodyText = message.body_text?.trim() || "";
    const isImage = messageType === "image" || mediaType.startsWith("image/");
    const isAudio = messageType === "audio" || mediaType.startsWith("audio/");
    const isVideo = messageType === "video" || mediaType.startsWith("video/");
    const isDocument = messageType === "document";
    const senderParts = [
        message.sender_name?.trim() || "",
        message.sender_phone?.trim() || "",
    ].filter(Boolean);
    const senderLabel = (!isOutbound && message.is_group_message)
        ? Array.from(new Set(senderParts)).join(" • ")
        : "";
    const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [shouldLoadMedia, setShouldLoadMedia] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingText, setEditingText] = useState(bodyText);
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingMessage, setDeletingMessage] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const isDeletedMessage = (() => {
        const normalized = bodyText.toLocaleLowerCase("pt-BR");
        if (normalized === DELETED_PLACEHOLDER.toLocaleLowerCase("pt-BR")) return true;
        return DELETED_MARKERS.some((marker) => normalized.includes(marker));
    })();
    const canRenderMedia = !isDeletedMessage;

    const canEdit = useMemo(() => {
        if (!onEditMessage) return false;
        if (!isOutbound) return false;
        if ((message.message_type || "").toLowerCase() !== "text") return false;
        if (isDeletedMessage) return false;
        if (mediaUrl) return false;
        if (message.status === "failed") return false;
        if ((message.external_message_id || "").startsWith("pending:")) return false;
        if (!message.created_at) return false;
        const createdAtMs = new Date(message.created_at).getTime();
        if (!Number.isFinite(createdAtMs)) return false;
        return Date.now() - createdAtMs <= 15 * 60 * 1000;
    }, [
        isOutbound,
        mediaUrl,
        message.created_at,
        message.external_message_id,
        message.message_type,
        message.status,
        onEditMessage,
        isDeletedMessage,
    ]);

    const canDelete = useMemo(() => {
        if (!onDeleteMessage) return false;
        if (!isOutbound) return false;
        if (isDeletedMessage) return false;
        if (message.status === "failed") return false;
        if ((message.external_message_id || "").startsWith("pending:")) return false;
        return true;
    }, [
        isDeletedMessage,
        isOutbound,
        message.external_message_id,
        message.status,
        onDeleteMessage,
    ]);

    useEffect(() => {
        if (!mediaUrl || !canRenderMedia) {
            setShouldLoadMedia(false);
            return;
        }
        setShouldLoadMedia(mediaUrl.startsWith("blob:"));
    }, [canRenderMedia, mediaUrl]);

    useEffect(() => {
        if (!mediaUrl || !canRenderMedia || shouldLoadMedia) return;
        const node = bubbleRef.current;
        if (!node || typeof IntersectionObserver === "undefined") {
            setShouldLoadMedia(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const safeEntries = Array.isArray(entries) ? entries : [];
                const isVisible = safeEntries.some((entry) => entry.isIntersecting);
                if (!isVisible) return;
                setShouldLoadMedia(true);
                observer.disconnect();
            },
            {
                root: null,
                rootMargin: "700px 0px",
                threshold: 0.01,
            }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [canRenderMedia, mediaUrl, shouldLoadMedia]);

    useEffect(() => {
        if (!mediaUrl) {
            setResolvedMediaUrl(null);
            setLoadingMedia(false);
            return;
        }

        if (!shouldLoadMedia) {
            setResolvedMediaUrl(null);
            setLoadingMedia(false);
            return;
        }

        if (!isProxyMediaUrl(mediaUrl)) {
            setResolvedMediaUrl(mediaUrl);
            setLoadingMedia(false);
            return;
        }

        let active = true;
        let objectUrl: string | null = null;
        setResolvedMediaUrl(null);
        setLoadingMedia(true);

        apiClient
            .get<Blob>(mediaUrl, { responseType: "blob" })
            .then(({ data }) => {
                if (!active) return;
                objectUrl = URL.createObjectURL(data);
                setResolvedMediaUrl(objectUrl);
            })
            .catch(() => {
                if (!active) return;
                setResolvedMediaUrl(null);
            })
            .finally(() => {
                if (!active) return;
                setLoadingMedia(false);
            });

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [mediaUrl, shouldLoadMedia]);

    useEffect(() => {
        if (!isEditing) {
            setEditingText(bodyText);
        }
    }, [bodyText, isEditing]);

    const handleSaveEdit = async () => {
        if (!onEditMessage || savingEdit || deletingMessage) return;
        const trimmed = editingText.trim();
        if (!trimmed || trimmed === bodyText) {
            setIsEditing(false);
            setEditingText(bodyText);
            return;
        }
        setSavingEdit(true);
        try {
            await onEditMessage(message, trimmed);
            setIsEditing(false);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDelete = async () => {
        if (!onDeleteMessage || deletingMessage || savingEdit) return;
        setDeleteDialogOpen(false);
        setDeletingMessage(true);
        try {
            await onDeleteMessage(message);
            setIsEditing(false);
        } catch {
            // O componente pai já mostra o toast de erro.
        } finally {
            setDeletingMessage(false);
        }
    };

    return (
        <div
            ref={bubbleRef}
            className={cn(
                "flex",
                isOutbound ? "justify-end" : "justify-start"
            )}
        >
            <div
                className={cn(
                    "relative max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                    isOutbound
                        ? "rounded-tr-sm bg-green-500 text-white"
                        : "rounded-tl-sm bg-muted text-foreground"
                )}
            >
                {/* Corpo da mensagem */}
                {senderLabel && (
                    <p className="mb-1 text-[11px] font-semibold text-emerald-700">
                        {senderLabel}
                    </p>
                )}

                {(canEdit || canDelete) && !isEditing && (
                    <div className="mb-1 flex justify-end">
                        <div className="flex items-center gap-1">
                            {canEdit && (
                                <button
                                    type="button"
                                    className={cn(
                                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors",
                                        isOutbound
                                            ? "text-green-100 hover:bg-white/10"
                                            : "text-muted-foreground hover:bg-black/5"
                                    )}
                                    onClick={() => setIsEditing(true)}
                                    disabled={deletingMessage}
                                >
                                    <Pencil className="size-3" />
                                    Editar
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    type="button"
                                    className={cn(
                                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors disabled:opacity-50",
                                        isOutbound
                                            ? "text-green-100 hover:bg-white/10"
                                            : "text-muted-foreground hover:bg-black/5"
                                    )}
                                    onClick={() => setDeleteDialogOpen(true)}
                                    disabled={deletingMessage || savingEdit}
                                >
                                    <Trash2 className="size-3" />
                                    {deletingMessage ? "Apagando..." : "Apagar"}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {canRenderMedia && resolvedMediaUrl && isImage && (
                    <a href={resolvedMediaUrl} target="_blank" rel="noreferrer" className="mb-2 block">
                        {/* biome-ignore lint/performance/noImgElement: URL remota dinâmica do provider; next/image exigiria allowlist global de domínios */}
                        <img
                            src={resolvedMediaUrl}
                            alt={message.media_filename || "Imagem recebida"}
                            loading="lazy"
                            decoding="async"
                            className="max-h-72 w-auto max-w-full rounded-lg object-cover"
                        />
                    </a>
                )}

                {canRenderMedia && resolvedMediaUrl && isAudio && (
                    <>
                        {/* biome-ignore lint/a11y/useMediaCaption: mídia inbound não fornece trilha de legenda */}
                        <audio
                            controls
                            preload="none"
                            src={resolvedMediaUrl}
                            className="mb-2 h-10 w-[260px] max-w-full"
                        />
                    </>
                )}

                {canRenderMedia && resolvedMediaUrl && isVideo && (
                    <>
                        {/* biome-ignore lint/a11y/useMediaCaption: mídia inbound não fornece trilha de legenda */}
                        <video
                            controls
                            preload="none"
                            src={resolvedMediaUrl}
                            className="mb-2 max-h-80 w-[300px] max-w-full rounded-lg"
                        />
                    </>
                )}

                {canRenderMedia && resolvedMediaUrl && isDocument && (
                    <a
                        href={resolvedMediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={message.media_filename || "arquivo"}
                        className={cn(
                            "mb-2 inline-block rounded-md border px-2 py-1 text-xs underline",
                            isOutbound
                                ? "border-white/40 text-white"
                                : "border-border text-foreground"
                        )}
                    >
                        Abrir arquivo
                    </a>
                )}

                {canRenderMedia && mediaUrl && !resolvedMediaUrl && (
                    <MediaPlaceholder
                        isOutbound={isOutbound}
                        isImage={isImage}
                        isAudio={isAudio}
                        isVideo={isVideo}
                        isDocument={isDocument}
                        mediaFilename={message.media_filename}
                        isLoading={loadingMedia}
                    />
                )}

                {isEditing ? (
                    <div className="space-y-2">
                        <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    void handleSaveEdit();
                                }
                            }}
                            className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-xs text-foreground"
                            rows={3}
                            disabled={savingEdit || deletingMessage}
                        />
                        <div className="flex justify-end gap-1">
                            <button
                                type="button"
                                className="inline-flex items-center rounded-md border px-2 py-1 text-[10px] disabled:opacity-50"
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditingText(bodyText);
                                }}
                                disabled={savingEdit || deletingMessage}
                            >
                                <X className="size-3" />
                            </button>
                            <button
                                type="button"
                                className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] text-white disabled:opacity-50"
                                onClick={() => void handleSaveEdit()}
                                disabled={savingEdit || deletingMessage || !editingText.trim()}
                            >
                                {savingEdit ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </div>
                ) : bodyText ? (
                    <p className={cn(
                        "whitespace-pre-wrap break-words",
                        isDeletedMessage && "italic opacity-80",
                    )}
                    >
                        {bodyText}
                    </p>
                ) : (
                    !resolvedMediaUrl && !loadingMedia && (
                        <p className="text-muted-foreground italic">
                            [{message.message_type}]
                        </p>
                    )
                )}

                {/* Timestamp + status */}
                <div
                    className={cn(
                        "mt-1 flex items-center justify-end gap-1 text-[10px]",
                        isOutbound ? "text-green-100" : "text-muted-foreground"
                    )}
                >
                    <span>{time}</span>
                    {isOutbound && statusIcon[message.status]}
                </div>

                {/* Erro */}
                {message.status === "failed" && message.error_message && (
                    <p className="mt-1 text-[10px] text-red-200">
                        {message.error_message}
                    </p>
                )}
            </div>

            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                }}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apagar mensagem?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação remove a mensagem para todos no WhatsApp, quando suportado pelo provider.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingMessage}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={deletingMessage}
                            onClick={(event) => {
                                event.preventDefault();
                                void handleDelete();
                            }}
                        >
                            {deletingMessage ? "Apagando..." : "Apagar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
