import { cn } from "@/lib/utils";
import type { WAMessage } from "@/types/whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";

const statusIcon: Record<string, React.ReactNode> = {
    pending: <Clock className="size-3 text-muted-foreground" />,
    sent: <Check className="size-3 text-muted-foreground" />,
    delivered: <CheckCheck className="size-3 text-muted-foreground" />,
    read: <CheckCheck className="size-3 text-blue-500" />,
    failed: <AlertCircle className="size-3 text-destructive" />,
};

export function MessageBubble({ message }: { message: WAMessage }) {
    const isOutbound = message.direction === "outbound";
    const time = message.created_at
        ? format(new Date(message.created_at), "HH:mm", { locale: ptBR })
        : "";

    return (
        <div
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
                {message.message_type === "text" || message.body_text ? (
                    <p className="whitespace-pre-wrap break-words">
                        {message.body_text}
                    </p>
                ) : (
                    <p className="italic text-muted-foreground">
                        [{message.message_type}]
                    </p>
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
        </div>
    );
}
