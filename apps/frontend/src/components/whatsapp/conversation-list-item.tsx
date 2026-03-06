import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getContactDisplayName, getContactInitial, getContactPhotoUrl } from "@/lib/whatsapp-contact";
import type { WAConversation } from "@/types/whatsapp";

const statusColor: Record<string, string> = {
  open: "bg-emerald-500",
  resolved: "bg-slate-400",
  archived: "bg-slate-300",
};

export function ConversationListItem({
  conversation,
  isActive,
  onClick,
  onHover,
}: {
  conversation: WAConversation;
  isActive?: boolean;
  onClick: () => void;
  onHover?: () => void;
}) {
  const name = getContactDisplayName(conversation.contact);
  const initial = getContactInitial(conversation.contact);
  const photoUrl = getContactPhotoUrl(conversation.contact);
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
      onMouseEnter={onHover}
      onFocus={onHover}
      onMouseDown={onHover}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/60",
        isActive && "bg-muted",
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <Avatar className="size-10 bg-green-100 text-green-700">
          <AvatarImage src={photoUrl ?? undefined} alt={name} />
          <AvatarFallback className="bg-green-100 font-semibold text-green-700">{initial}</AvatarFallback>
        </Avatar>
        {/* Status dot */}
        <span
          className={cn(
            "absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background",
            statusColor[conversation.status] ?? "bg-slate-400",
          )}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {timeAgo && <span className="text-[10px] text-muted-foreground">{timeAgo}</span>}
            {!isActive && (conversation.unread_count ?? 0) > 0 && (
              <Badge className="h-4 min-w-4 rounded-full px-1 text-[10px] leading-none">
                {conversation.unread_count}
              </Badge>
            )}
          </div>
        </div>
        {preview && <p className="mt-0.5 truncate text-xs text-muted-foreground">{preview}</p>}
      </div>
    </button>
  );
}
