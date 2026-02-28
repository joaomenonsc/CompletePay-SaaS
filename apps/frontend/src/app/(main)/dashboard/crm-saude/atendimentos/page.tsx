"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

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
import { fetchEncounters, fetchProfessionals } from "@/lib/api/crm";
import type { ClinicalEncounter } from "@/types/crm";

const STATUS_LABELS: Record<string, string> = {
  in_triage: "Em triagem",
  in_progress: "Em atendimento",
  completed: "Finalizado",
  pending_docs: "Pend. documentação",
};

export default function AtendimentosPage() {
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: encounters = [], isLoading } = useQuery({
    queryKey: ["crm-encounters", professionalId, statusFilter],
    queryFn: () =>
      fetchEncounters({
        professional_id: professionalId ?? undefined,
        status: statusFilter ?? undefined,
        limit: 100,
      }),
  });

  const { data: professionalsData } = useQuery({
    queryKey: ["crm-professionals-list-atendimentos"],
    queryFn: () => fetchProfessionals({ limit: 200 }),
  });
  const professionals = professionalsData?.items ?? [];

  return (
    <main className="space-y-6" role="main" aria-label="Atendimentos">
      <header>
        <h1 className="text-2xl font-semibold">Atendimentos</h1>
        <p className="text-muted-foreground text-sm">
          Triagem, evolução clínica e prescrições. Inicie a partir de um agendamento em &quot;Em atendimento&quot; ou por busca de paciente.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lista de atendimentos</CardTitle>
          <CardDescription>
            {encounters.length} atendimento(s). Filtre por profissional ou status.
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
                <SelectTrigger className="w-[180px]">
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
          ) : encounters.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              Nenhum atendimento encontrado. Inicie um atendimento a partir de um agendamento com status &quot;Em atendimento&quot; na página de Agendamentos.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">Data</th>
                    <th className="h-10 px-4 text-left font-medium">Paciente</th>
                    <th className="h-10 px-4 text-left font-medium">Profissional</th>
                    <th className="h-10 px-4 text-left font-medium">Status</th>
                    <th className="h-10 w-[100px] px-4 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {encounters.map((e: ClinicalEncounter) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">{e.patient_name ?? e.patient_id}</td>
                      <td className="px-4 py-3">{e.professional_name ?? e.professional_id}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {STATUS_LABELS[e.status] ?? e.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/crm-saude/atendimentos/${e.id}`}>
                            Abrir
                          </Link>
                        </Button>
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
