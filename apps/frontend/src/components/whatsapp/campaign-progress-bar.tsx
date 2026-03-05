import type { WACampaignProgress } from "@/types/whatsapp";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function CampaignProgressBar({
    progress,
    className,
}: {
    progress: WACampaignProgress;
    className?: string;
}) {
    const percent = Math.min(100, progress.completion_percent ?? 0);

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{percent.toFixed(0)}% concluído</span>
                <span className="text-muted-foreground">
                    {progress.sent_count.toLocaleString()} /{" "}
                    {progress.total_recipients.toLocaleString()}
                </span>
            </div>
            <Progress value={percent} className="h-2" />
            <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="text-emerald-600">
                    ✓ {progress.delivered_count.toLocaleString()} entregues
                </span>
                <span className="text-blue-500">
                    👁 {progress.read_count.toLocaleString()} lidos
                </span>
                <span className="text-destructive">
                    ✗ {progress.failed_count.toLocaleString()} falhou
                </span>
                <span>
                    ⌛ {progress.pending_count.toLocaleString()} pendentes
                </span>
            </div>
        </div>
    );
}
