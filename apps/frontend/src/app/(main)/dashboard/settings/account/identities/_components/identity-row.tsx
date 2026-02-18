"use client";

import { type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IdentityRowProps {
  icon: LucideIcon;
  name: string;
  dateText?: string;
  connected: boolean;
  onSignIn?: () => void;
  onDisconnect?: () => void;
}

export function IdentityRow({
  icon: Icon,
  name,
  dateText,
  connected,
  onSignIn,
  onDisconnect,
}: IdentityRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-md border p-4",
        "gap-y-2"
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{name}</p>
        {dateText && (
          <p className="text-muted-foreground text-sm">{dateText}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {connected ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDisconnect}
          >
            Desconectar
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={onSignIn}>
            Entrar
          </Button>
        )}
      </div>
    </div>
  );
}
