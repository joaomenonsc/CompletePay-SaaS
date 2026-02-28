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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfessionalTerms, useAcceptProfessionalTerm } from "@/hooks/use-professionals";
import { Plus } from "lucide-react";

const TERM_TYPES = [
  { value: "uso_plataforma", label: "Uso da plataforma" },
  { value: "privacidade", label: "Privacidade" },
  { value: "confidencialidade", label: "Confidencialidade" },
  { value: "telemedicina", label: "Telemedicina" },
];

interface ProfessionalTermsTabProps {
  professionalId: string;
}

export function ProfessionalTermsTab({ professionalId }: ProfessionalTermsTabProps) {
  const { data: terms = [], isLoading } = useProfessionalTerms(professionalId);
  const acceptMutation = useAcceptProfessionalTerm(professionalId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [termType, setTermType] = useState(TERM_TYPES[0].value);
  const [termVersion, setTermVersion] = useState("1.0");

  const handleAccept = (e: React.FormEvent) => {
    e.preventDefault();
    acceptMutation.mutate(
      { term_type: termType, term_version: termVersion.trim() },
      {
        onSuccess: () => {
          toast.success("Aceite registrado");
          setDialogOpen(false);
          setTermVersion("1.0");
        },
        onError: (err: Error) => toast.error(err?.message ?? "Erro ao registrar"),
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Carregando termos…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Termos de aceite</CardTitle>
            <CardDescription>
              Registro de aceites: uso da plataforma, privacidade, confidencialidade, telemedicina.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 size-4" />
                Registrar aceite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar aceite de termo</DialogTitle>
                <DialogDescription>
                  Informe o tipo e a versão do termo aceito pelo profissional.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAccept}>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label>Tipo do termo</Label>
                    <select
                      className="border-input bg-background ring-offset-background flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={termType}
                      onChange={(e) => setTermType(e.target.value)}
                    >
                      {TERM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Versão do termo *</Label>
                    <Input
                      value={termVersion}
                      onChange={(e) => setTermVersion(e.target.value)}
                      placeholder="1.0"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={acceptMutation.isPending}>
                    {acceptMutation.isPending ? "Salvando…" : "Registrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {terms.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Nenhum aceite registrado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Data do aceite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    {TERM_TYPES.find((x) => x.value === t.term_type)?.label ?? t.term_type}
                  </TableCell>
                  <TableCell>{t.term_version}</TableCell>
                  <TableCell>
                    {format(new Date(t.accepted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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
