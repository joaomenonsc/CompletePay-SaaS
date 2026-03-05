import type { WATemplate } from "@/types/whatsapp";
import type { WATemplateStatus } from "@/types/whatsapp";
import { Badge } from "@/components/ui/badge";

const statusConfig: Record<
    WATemplateStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
    draft: { label: "Rascunho", variant: "secondary" },
    pending_review: { label: "Em revisão", variant: "outline" },
    approved: { label: "Aprovado", variant: "default" },
    rejected: { label: "Rejeitado", variant: "destructive" },
};

export function TemplateStatusBadge({
    status,
}: {
    status: WATemplateStatus;
}) {
    const config = statusConfig[status] ?? {
        label: status,
        variant: "outline" as const,
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
}
