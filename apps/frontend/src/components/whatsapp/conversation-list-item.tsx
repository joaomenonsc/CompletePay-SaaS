import type { WAConversation } from "@/types/whatsapp";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusColor: Record<string, string> = {
    open: "bg-emerald-500",
    resolved: "bg-slate-400",
    archived: "bg-slate-300",
};

export function ConversationListItem({
    conversation,
    isActive,
    onClick,
}: {
    conversation: WAConversation;
    isActive?: boolean;
    onClick: () => void;
}) {
    const phone =
        conversation.contact?.phone_display ||
        conversation.contact?.phone_e164 ||
        "–";
    const name = conversation.contact?.display_name || phone;
    const preview = conversation.last_message_preview;
    const timeAgo = conversation.last_message_at
        ? formatDistanceToNow(new Date(conversation.last_message_at), {
            addSuffix: true,
            locale: ptBR,
        })
        : null;

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/60",
                isActive && "bg-muted"
            )}
        >
            {/* Avatar */}
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                <span className="text-sm font-semibold">
                    {name[0]?.toUpperCase() ?? "?"}
                </span>
                {/* Status dot */}
                <span
                    className={cn(
                        "absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background",
                        statusColor[conversation.status] ?? "bg-slate-400"
                    )}
                />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                        {timeAgo && (
                            <span className="text-[10px] text-muted-foreground">
                                {timeAgo}
                            </span>
                        )}
                        {(conversation.unread_count ?? 0) > 0 && (
                            <Badge className="h-4 min-w-4 rounded-full px-1 text-[10px] leading-none">
                                {conversation.unread_count}
                            </Badge>
                        )}
                    </div>
                </div>
                {preview && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {preview}
                    </p>
                )}
            </div>
        </button>
    );
}
