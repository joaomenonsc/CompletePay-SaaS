"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
  fetchWaitlist,
  fetchProfessionals,
  createWaitlistEntry,
  updateWaitlistEntryStatus,
} from "@/lib/api/crm";
import type { WaitlistEntry } from "@/types/crm";
import { Plus } from "lucide-react";

import { NewWaitlistEntryDialog } from "../_components/new-waitlist-entry-dialog";

const STATUS_LABELS: Record<string, string> = {
  waiting: "Aguardando",
  scheduled: "Agendado",
  expired: "Expirado",
  cancelled: "Cancelado",
};

export default function ListaEsperaPage() {
  const queryClient = useQueryClient();
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["crm-waitlist", professionalId, statusFilter],
    queryFn: () =>
      fetchWaitlist({
        professional_id: professionalId ?? undefined,
        status: statusFilter ?? undefined,
      }),
  });

  const { data: professionalsData } = useQuery({
    queryKey: ["crm-professionals-list-waitlist"],
    queryFn: () => fetchProfessionals({ limit: 200 }),
  });
  const professionals = professionalsData?.items ?? [];

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateWaitlistEntryStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-waitlist"] });
      toast.success("Status atualizado.");
    },
    onError: () => toast.error("Erro ao atualizar status."),
  });

  return (
    <main className="space-y-6" role="main" aria-label="Lista de espera">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lista de espera</h1>
          <p className="text-muted-foreground text-sm">
            Pacientes aguardando vaga. Adicione à lista quando não houver horário e encaixe quando houver cancelamento.
          </p>
        </div>
        <NewWaitlistEntryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["crm-waitlist"] });
            setDialogOpen(false);
          }}
        />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 size-4" />
          Adicionar à lista
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Entradas</CardTitle>
          <CardDescription>
            Filtre por profissional ou status.
          </CardDescription>
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Profissional</span>
              <Select
                value={professionalId ?? "all"}
                onValueChange={(v) => setProfessionalId(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {professionals.map((p: { id: string; full_name: string }) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Status</span>
              <Select
                value={statusFilter ?? "all"}
                onValueChange={(v) => setStatusFilter(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Carregando...</p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              Nenhuma entrada na lista de espera. Adicione quando não houver horário disponível.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">Paciente</th>
                    <th className="h-10 px-4 text-left font-medium">Profissional</th>
                    <th className="h-10 px-4 text-left font-medium">Tipo</th>
                    <th className="h-10 px-4 text-left font-medium">Prioridade</th>
                    <th className="h-10 px-4 text-left font-medium">Status</th>
                    <th className="h-10 px-4 text-left font-medium">Entrada em</th>
                    <th className="h-10 w-[120px] px-4 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e: WaitlistEntry) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{e.patient_name ?? e.patient_id}</td>
                      <td className="px-4 py-3">{e.professional_name ?? e.professional_id}</td>
                      <td className="px-4 py-3 capitalize">{e.appointment_type}</td>
                      <td className="px-4 py-3">{e.priority}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{STATUS_LABELS[e.status] ?? e.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {e.status === "waiting" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateStatus.mutate({ id: e.id, status: "cancelled" })
                            }
                            disabled={updateStatus.isPending}
                          >
                            Cancelar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
