"use client";

import { Progress } from "@/components/ui/progress";

interface KbUsageHeaderProps {
  usedMB?: number;
  limitMB?: number;
}

export function KbUsageHeader({ usedMB = 12, limitMB = 50 }: KbUsageHeaderProps) {
  const pct = Math.round((usedMB / limitMB) * 100);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="font-semibold text-lg">Knowledge Base</h2>
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-xs sm:flex-none">
        <span className="shrink-0 text-muted-foreground text-sm">
          Usado: {usedMB}MB / {limitMB}MB
        </span>
        <Progress value={pct} className="h-2 flex-1" />
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}
