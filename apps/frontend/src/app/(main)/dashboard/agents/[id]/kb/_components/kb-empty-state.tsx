"use client";

import { FolderOpen, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "FAQ do produto/serviço",
  "Política de trocas e devoluções",
  "Tabela de preços",
  "Horário de funcionamento",
];

interface KbEmptyStateProps {
  onUpload: () => void;
}

export function KbEmptyState({ onUpload }: KbEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
        <FolderOpen className="size-12" strokeWidth={1.25} />
      </div>
      <h3 className="font-semibold text-lg">Nenhum documento na Knowledge Base</h3>
      <p className="mt-2 max-w-sm text-muted-foreground text-sm">
        Adicione documentos para que o agente possa responder perguntas com base no seu conteúdo.
      </p>
      <p className="mt-4 font-medium text-muted-foreground text-xs">Sugestões para Atendimento:</p>
      <ul className="mt-1 list-inside list-disc text-muted-foreground text-xs">
        {SUGGESTIONS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <Button className="mt-6" size="sm" onClick={onUpload}>
        <Upload className="size-4" />
        Upload Primeiro Documento
      </Button>
    </div>
  );
}
