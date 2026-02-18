"use client";

import { useCallback, useRef } from "react";

import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.txt,.md,.csv";
const MAX_FILE_SIZE_MB = 10;
const MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface KbDropZoneProps {
  dragging: boolean;
  onDraggingChange: (d: boolean) => void;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function KbDropZone({ dragging, onDraggingChange, onFiles, disabled }: KbDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndEmit = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const valid: File[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        if (f.size <= MAX_BYTES) valid.push(f);
      }
      if (valid.length) onFiles(valid);
    },
    [onFiles],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onDraggingChange(false);
      validateAndEmit(e.dataTransfer.files);
    },
    [onDraggingChange, validateAndEmit],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onDraggingChange(true);
    },
    [onDraggingChange],
  );

  const onDragLeave = useCallback(() => {
    onDraggingChange(false);
  }, [onDraggingChange]);

  const onClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      validateAndEmit(e.target.files ?? null);
      e.target.value = "";
    },
    [validateAndEmit],
  );

  return (
    <section
      aria-label="Enviar arquivos"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 transition-colors",
        dragging && !disabled ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/30",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} multiple className="sr-only" onChange={onInputChange} />
      <div className="flex size-14 items-center justify-center rounded-lg bg-muted">
        <Upload className="size-7 text-muted-foreground" />
      </div>
      <Button variant="outline" size="sm" className="mt-3" type="button" onClick={onClick} disabled={disabled}>
        Upload
      </Button>
      <p className="mt-3 text-center text-muted-foreground text-sm">Arraste arquivos aqui ou clique para selecionar</p>
      <p className="mt-1 text-center text-muted-foreground text-xs">Formatos aceitos: PDF, TXT, MD, CSV</p>
      <p className="text-center text-muted-foreground text-xs">Tamanho máximo: {MAX_FILE_SIZE_MB}MB por arquivo</p>
    </section>
  );
}
