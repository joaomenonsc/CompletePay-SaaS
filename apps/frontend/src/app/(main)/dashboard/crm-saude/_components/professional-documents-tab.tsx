"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useProfessionalDocuments,
  useDeleteProfessionalDocument,
  useCreateProfessionalDocument,
} from "@/hooks/use-professionals";
import type { ProfessionalDocument } from "@/types/crm";
import { Plus, Trash2 } from "lucide-react";

const DOC_CATEGORIES = [
  "registro_conselho",
  "rqe",
  "diploma",
  "contrato",
  "comprovante_fiscal",
] as const;
const CATEGORY_LABELS: Record<string, string> = {
  registro_conselho: "Registro no conselho",
  rqe: "RQE",
  diploma: "Diploma",
  contrato: "Contrato",
  comprovante_fiscal: "Comprovante fiscal",
};

interface ProfessionalDocumentsTabProps {
  professionalId: string;
}

export function ProfessionalDocumentsTab({ professionalId }: ProfessionalDocumentsTabProps) {
  const { data: documents = [], isLoading } = useProfessionalDocuments(professionalId);
  const createMutation = useCreateProfessionalDocument(professionalId);
  const deleteMutation = useDeleteProfessionalDocument(professionalId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState<string>(DOC_CATEGORIES[0]);
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState<string>("0");
  const [mimeType, setMimeType] = useState("application/pdf");
  const [validUntil, setValidUntil] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim() || !filePath.trim()) {
      toast.error("Preencha nome e caminho do arquivo");
      return;
    }
    createMutation.mutate(
      {
        category,
        file_path: filePath.trim(),
        file_name: fileName.trim(),
        file_size: parseInt(fileSize, 10) || 0,
        mime_type: mimeType,
        valid_until: validUntil || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Documento registrado");
          setDialogOpen(false);
          setFilePath("");
          setFileName("");
          setFileSize("0");
          setValidUntil("");
        },
        onError: (err: Error) => toast.error(err?.message ?? "Erro ao registrar"),
      }
    );
  };

  const handleDelete = (doc: ProfessionalDocument) => {
    if (!confirm(`Remover "${doc.file_name}"?`)) return;
    deleteMutation.mutate(doc.id, {
      onSuccess: () => toast.success("Documento removido"),
      onError: (err: Error) => toast.error(err?.message ?? "Erro ao remover"),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Carregando documentos…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Documentos</CardTitle>
            <CardDescription>
              Registro profissional, RQE, diploma, contrato e comprovantes. Alerta 30 dias antes do
              vencimento.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 size-4" />
                Registrar documento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar documento</DialogTitle>
                <DialogDescription>
                  Informe os dados do documento (upload do arquivo em fluxo separado).
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label>Categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOC_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {CATEGORY_LABELS[c] ?? c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Caminho do arquivo *</Label>
                    <Input
                      value={filePath}
                      onChange={(e) => setFilePath(e.target.value)}
                      placeholder="/uploads/..."
                    />
                  </div>
                  <div>
                    <Label>Nome do arquivo *</Label>
                    <Input
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="documento.pdf"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tamanho (bytes)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={fileSize}
                        onChange={(e) => setFileSize(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Validade</Label>
                      <Input
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Salvando…" : "Registrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Nenhum documento registrado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{CATEGORY_LABELS[doc.category] ?? doc.category}</TableCell>
                  <TableCell>{doc.file_name}</TableCell>
                  <TableCell>
                    {doc.valid_until
                      ? format(new Date(doc.valid_until), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc)}
                      aria-label="Remover"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
