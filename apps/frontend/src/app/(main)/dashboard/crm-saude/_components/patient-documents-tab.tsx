"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  deletePatientDocument,
  fetchDocumentBlob,
  fetchPatientDocuments,
  uploadPatientDocument,
} from "@/lib/api/crm";
import type {
  PatientDocument,
  PatientDocumentCategory,
  PatientDocumentClassification,
} from "@/types/crm";

const PATIENTS_QUERY_KEY = ["crm-patients"] as const;
const DOCUMENTS_QUERY_KEY = (patientId: string) =>
  [...PATIENTS_QUERY_KEY, patientId, "documents"] as const;

const CATEGORY_LABELS: Record<PatientDocumentCategory, string> = {
  identificacao: "Identificação",
  carteirinha: "Carteirinha",
  exame: "Exame",
  laudo: "Laudo",
  termo: "Termo",
  comprovante: "Comprovante",
};

const CLASSIFICATION_LABELS: Record<PatientDocumentClassification, string> = {
  ADM: "Administrativo",
  CLI: "Clínico",
  FIN: "Financeiro",
  DOC: "Documento",
};

interface PatientDocumentsTabProps {
  patientId: string;
}

export function PatientDocumentsTab({ patientId }: PatientDocumentsTabProps) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<PatientDocumentCategory>("identificacao");
  const [classification, setClassification] =
    useState<PatientDocumentClassification>("ADM");
  const [file, setFile] = useState<File | null>(null);
  const { data: documents = [], isLoading } = useQuery({
    queryKey: DOCUMENTS_QUERY_KEY(patientId),
    queryFn: () => fetchPatientDocuments(patientId),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Selecione um arquivo");
      return uploadPatientDocument(patientId, file, category, classification);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY(patientId) });
      toast.success("Documento enviado");
      setFile(null);
      setClassification("ADM");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao enviar documento");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) =>
      deletePatientDocument(patientId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY(patientId) });
      toast.success("Documento removido");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover");
    },
  });

  const handlePreview = async (doc: PatientDocument) => {
    try {
      const blob = await fetchDocumentBlob(patientId, doc.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error("Não foi possível abrir o documento");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Enviar documento</CardTitle>
          <CardDescription>
            PDF, JPG ou PNG até 10MB. Categorize para localizar depois.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-muted-foreground mb-1 block text-sm">
              Arquivo
            </label>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/jpg"
              className="w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="w-40">
            <label className="text-muted-foreground mb-1 block text-sm">
              Categoria
            </label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as PatientDocumentCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as PatientDocumentCategory[]).map(
                  (k) => (
                    <SelectItem key={k} value={k}>
                      {CATEGORY_LABELS[k]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <label className="text-muted-foreground mb-1 block text-sm">
              Classificação
            </label>
            <Select
              value={classification}
              onValueChange={(v) =>
                setClassification(v as PatientDocumentClassification)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(CLASSIFICATION_LABELS) as PatientDocumentClassification[]
                ).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CLASSIFICATION_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!file || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentos anexados</CardTitle>
          <CardDescription>Lista por categoria e data de envio.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando…</p>
          ) : documents.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum documento anexado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.file_name}</TableCell>
                    <TableCell>
                      {CATEGORY_LABELS[doc.category as PatientDocumentCategory] ??
                        doc.category}
                    </TableCell>
                    <TableCell>
                      {CLASSIFICATION_LABELS[
                        doc.data_classification as PatientDocumentClassification
                      ] ?? doc.data_classification}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(
                        new Date(doc.created_at),
                        "dd/MM/yyyy HH:mm",
                        { locale: ptBR }
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(doc)}
                        >
                          Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(doc.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
