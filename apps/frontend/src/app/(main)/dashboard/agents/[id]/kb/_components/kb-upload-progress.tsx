"use client";

import { FileText } from "lucide-react";

import { Progress } from "@/components/ui/progress";

import type { UploadingFile } from "./kb-types";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / 1024).toFixed(0)}KB`;
}

interface KbUploadProgressProps {
  files: UploadingFile[];
}

export function KbUploadProgress({ files }: KbUploadProgressProps) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <p className="font-medium text-sm">Enviando {files.length} arquivo(s)...</p>
      {files.map((uf) => (
        <div key={uf.id} className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium text-muted-foreground uppercase">{uf.file.name.split(".").pop()}</span>
            <span className="truncate">{uf.file.name}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{formatSize(uf.file.size)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={uf.progress} className="h-2 flex-1" />
            <span className="shrink-0 text-muted-foreground text-xs">
              {uf.status === "uploading" ? "Enviando..." : "Processando chunks..."}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
