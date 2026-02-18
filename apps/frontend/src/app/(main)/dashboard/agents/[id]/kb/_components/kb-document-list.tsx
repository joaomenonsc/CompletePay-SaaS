"use client";

import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import type { KbDocument } from "./kb-types";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function docIcon(_type: KbDocument["type"]) {
  return <FileText className="size-5 shrink-0 text-muted-foreground" />;
}

interface KbDocumentListProps {
  documents: KbDocument[];
  onPreview: (doc: KbDocument) => void;
  onRemove: (doc: KbDocument) => void;
  onCancel?: (doc: KbDocument) => void;
}

export function KbDocumentList({ documents, onPreview, onRemove, onCancel }: KbDocumentListProps) {
  if (documents.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">Documentos ({documents.length})</h3>
      <div className="space-y-1 rounded-lg border">
        {documents.map((doc) => (
          <div key={doc.id} className="flex flex-col gap-2 border-b p-4 last:border-b-0">
            <div className="flex items-start gap-3">
              {docIcon(doc.type)}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-muted-foreground text-sm uppercase">{doc.type}</p>
                <p className="truncate font-medium">{doc.name}</p>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {formatSize(doc.sizeBytes)}
                  {" · "}
                  {doc.chunks != null ? `${doc.chunks} chunks` : "-- chunks"}
                  {" · "}
                  Enviado em {doc.uploadedAt}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    Status:{" "}
                    {doc.status === "pronto" ? (
                      <span className="text-green-600">[*] Pronto</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        [~] Processando...
                        {doc.processingPercent != null && (
                          <span className="tabular-nums">{doc.processingPercent}%</span>
                        )}
                      </span>
                    )}
                  </span>
                  {doc.status === "processando" && doc.processingPercent != null && (
                    <Progress value={doc.processingPercent} className="h-1.5 w-24" />
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onPreview(doc)}>
                  Preview
                </Button>
                {doc.status === "pronto" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive text-xs hover:text-destructive"
                    onClick={() => onRemove(doc)}
                  >
                    Remover
                  </Button>
                ) : (
                  onCancel && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onCancel(doc)}>
                      Cancelar
                    </Button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
