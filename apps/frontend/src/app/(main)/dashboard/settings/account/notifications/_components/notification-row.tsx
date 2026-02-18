"use client";

import { ReactNode } from "react";

import { Field, FieldContent, FieldTitle } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface NotificationRowProps {
  title: string;
  description?: string;
  control: ReactNode;
  className?: string;
}

export function NotificationRow({
  title,
  description,
  control,
  className,
}: NotificationRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center @md/field-group:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <FieldTitle>{title}</FieldTitle>
        {description && (
          <FieldContent>
            <p className="text-muted-foreground text-sm">{description}</p>
          </FieldContent>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
