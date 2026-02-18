"use client";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({ title, children, className }: SettingsSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
        {title}
      </h3>
      <Separator />
      <div>{children}</div>
    </section>
  );
}
