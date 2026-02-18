"use client";

import { AlertCircle, CheckCircle2, WifiOff } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type ApiHealthStatus, useApiHealth } from "@/hooks/use-api-health";

const statusConfig: Record<ApiHealthStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  ok: {
    label: "API online",
    icon: CheckCircle2,
    className: "text-emerald-500",
  },
  degraded: {
    label: "API degradada",
    icon: AlertCircle,
    className: "text-amber-500",
  },
  error: {
    label: "API indisponível",
    icon: WifiOff,
    className: "text-destructive",
  },
};

export function ApiStatusIndicator() {
  const { status, services, isLoading, lastChecked } = useApiHealth();
  const config = statusConfig[status];
  const Icon = config.icon;

  const details =
    services && Object.keys(services).length > 0
      ? Object.entries(services)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ")
      : null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1.5 text-muted-foreground" role="img" aria-label={config.label}>
            {isLoading ? (
              <span className="size-2 animate-pulse rounded-full bg-muted-foreground/50" />
            ) : (
              <Icon className={`size-4 ${config.className}`} aria-hidden />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-left">
          <p className="font-medium">{config.label}</p>
          {details && <p className="text-muted-foreground text-xs">{details}</p>}
          {lastChecked && (
            <p className="mt-1 text-muted-foreground text-xs">
              Última verificação: {lastChecked.toLocaleTimeString("pt-BR")}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
