"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useParams } from "next/navigation";

import { toast } from "sonner";

import { useAgent } from "@/hooks/use-agents";

import { KbDocumentList } from "./_components/kb-document-list";
import { KbDropZone } from "./_components/kb-drop-zone";
import { KbEmptyState } from "./_components/kb-empty-state";
import { KbHealthCard } from "./_components/kb-health-card";
import type { KbDocument, UploadingFile } from "./_components/kb-types";
import { KbUploadProgress } from "./_components/kb-upload-progress";
import { KbUsageHeader } from "./_components/kb-usage-header";

const ACCEPT = ".pdf,.txt,.md,.csv";
const MAX_FILE_SIZE_MB = 10;
const MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const MOCK_DOCUMENTS: KbDocument[] = [
  {
    id: "1",
    name: "faq-produtos.pdf",
    type: "pdf",
    sizeBytes: 2.3 * 1024 * 1024,
    chunks: 324,
    uploadedAt: "14/02/2026",
    status: "pronto",
  },
  {
    id: "2",
    name: "politica-trocas.txt",
    type: "txt",
    sizeBytes: 450 * 1024,
    chunks: 87,
    uploadedAt: "14/02/2026",
    status: "pronto",
  },
  {
    id: "3",
    name: "tabela-precos.csv",
    type: "csv",
    sizeBytes: 1.1 * 1024 * 1024,
    chunks: null,
    uploadedAt: "14/02/2026",
    status: "processando",
    processingPercent: 60,
  },
];

function extToType(ext: string): KbDocument["type"] {
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "txt";
  if (ext === "md") return "md";
  if (ext === "csv") return "csv";
  return "txt";
}

export default function AgentKBPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: agent } = useAgent(id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = useState(false);
  const [documents, setDocuments] = useState<KbDocument[]>(MOCK_DOCUMENTS);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleFiles = useCallback((files: File[]) => {
    const valid = files.filter((f) => f.size <= MAX_BYTES);
    if (valid.length === 0) {
      toast.error("Nenhum arquivo válido (máx. 10MB por arquivo).");
      return;
    }
    const newUploads: UploadingFile[] = valid.map((f) => ({
      id: `${Date.now()}-${f.name}`,
      file: f,
      progress: 0,
      status: "uploading" as const,
    }));
    setUploadingFiles((prev) => [...prev, ...newUploads]);
    toast.success(`Enviando ${valid.length} arquivo(s)...`);

    newUploads.forEach((uf, idx) => {
      let progress = 0;
      const step = () => {
        progress += 10;
        if (progress <= 100) {
          setUploadingFiles((prev) =>
            prev.map((p) =>
              p.id === uf.id ? { ...p, progress, status: progress === 100 ? "processing" : "uploading" } : p,
            ),
          );
          setTimeout(step, 80);
        } else {
          setUploadingFiles((prev) => prev.filter((p) => p.id !== uf.id));
          const ext = uf.file.name.split(".").pop()?.toLowerCase() ?? "txt";
          setDocuments((prev) => [
            ...prev,
            {
              id: `doc-${Date.now()}-${idx}`,
              name: uf.file.name,
              type: extToType(ext),
              sizeBytes: uf.file.size,
              chunks: null,
              uploadedAt: new Date().toLocaleDateString("pt-BR"),
              status: "processando",
              processingPercent: 0,
            },
          ]);
          toast.success(`${uf.file.name} adicionado à base.`);
        }
      };
      setTimeout(step, 100);
    });
  }, []);

  const handlePreview = useCallback((_doc: KbDocument) => {
    toast.info("Preview em breve");
  }, []);

  const handleRemove = useCallback((doc: KbDocument) => {
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    toast.success(`${doc.name} removido.`);
  }, []);

  const handleCancelProcessing = useCallback((doc: KbDocument) => {
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    toast.info("Processamento cancelado.");
  }, []);

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-6 py-4">
        <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-6 py-4">
        <p className="text-muted-foreground text-sm">Agente não encontrado.</p>
      </div>
    );
  }

  const usedMB = 12;
  const limitMB = 50;
  const totalChunks = documents.reduce((s, d) => s + (d.chunks ?? 0), 0);
  const showEmptyState = documents.length === 0 && uploadingFiles.length === 0;

  return (
    <div className="space-y-6 py-4">
      <KbUsageHeader usedMB={usedMB} limitMB={limitMB} />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length) handleFiles(Array.from(list));
          e.target.value = "";
        }}
      />

      {uploadingFiles.length > 0 && <KbUploadProgress files={uploadingFiles} />}

      <KbDropZone
        dragging={dragging}
        onDraggingChange={setDragging}
        onFiles={handleFiles}
        disabled={uploadingFiles.length > 0}
      />

      {showEmptyState ? (
        <KbEmptyState onUpload={triggerFileSelect} />
      ) : (
        <KbDocumentList
          documents={documents}
          onPreview={handlePreview}
          onRemove={handleRemove}
          onCancel={handleCancelProcessing}
        />
      )}

      <KbHealthCard totalChunks={totalChunks || 411} lastUpdate="14/02 14:30" />
    </div>
  );
}
