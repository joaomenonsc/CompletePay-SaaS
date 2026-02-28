"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppointmentDetailSheet } from "../_components/appointment-detail-sheet";
import { CrmCalendarView } from "../_components/crm-calendar-view";
import { CrmKanbanView } from "../_components/crm-kanban-view";
import { NewAppointmentDialog } from "../_components/new-appointment-dialog";
import { RescheduleAppointmentDialog } from "../_components/reschedule-appointment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fetchAppointments, fetchProfessionals } from "@/lib/api/crm";
import type { AppointmentListItem } from "@/types/crm";
import { CalendarDays, Kanban, List, Plus } from "lucide-react";

const DEFAULT_PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_atendimento: "Em atend.",
  atendido: "Atendido",
  no_show: "Não compareceu",
  cancelado: "Cancelado",
};
const STATUS_CLASS: Record<string, string> = {
  agendado: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  confirmado: "bg-green-500/10 text-green-600 dark:text-green-400",
  em_atendimento: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  atendido: "bg-muted text-muted-foreground",
  no_show: "bg-destructive/10 text-destructive",
  cancelado: "bg-destructive/10 text-destructive",
};

type ViewMode = "lista" | "calendario" | "kanban";

// Date range covering 3 months back → 3 months ahead (computed once per render)
function getCalendarRange() {
  const today = new Date();
  return {
    date_from: format(startOfMonth(subMonths(today, 3)), "yyyy-MM-dd"),
    date_to: format(endOfMonth(addMonths(today, 3)), "yyyy-MM-dd"),
  };
}

export default function AgendamentosPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [listDateFrom, setListDateFrom] = useState<string | null>(null);
  const [listDateTo, setListDateTo] = useState<string | null>(null);
  const [detailAppointmentId, setDetailAppointmentId] = useState<string | null>(null);
  const [detailAppointmentItem, setDetailAppointmentItem] = useState<AppointmentListItem | null>(null);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<AppointmentListItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("lista");

  const { date_from: calDateFrom, date_to: calDateTo } = getCalendarRange();

  // ── Shared wide-range query (powers the Calendar view + list preview) ─────────
  // Always active — no `enabled` guard — so data is ready when user switches views.
  const { data: wideData, isLoading: wideLoading } = useQuery({
    queryKey: ["crm-appointments-wide", professionalId, calDateFrom, calDateTo],
    queryFn: () =>
      fetchAppointments({
        limit: 100,
        offset: 0,
        professional_id: professionalId ?? undefined,
        date_from: calDateFrom,
        date_to: calDateTo,
      }),
    staleTime: 60_000,
  });
  const allAppointments = wideData?.items ?? [];

  // ── Paginated list query (only for the Lista view with optional narrow filters) ─
  const hasDateFilter = listDateFrom || listDateTo;
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["crm-appointments-list", pageIndex, professionalId, listDateFrom, listDateTo],
    queryFn: () =>
      fetchAppointments({
        limit: DEFAULT_PAGE_SIZE,
        offset: pageIndex * DEFAULT_PAGE_SIZE,
        professional_id: professionalId ?? undefined,
        // Use date filter if set; otherwise fall back to the wide range so the API
        // receives required date params and the list shows the same period.
        date_from: listDateFrom ?? calDateFrom,
        date_to: listDateTo ?? calDateTo,
      }),
  });

  // ── Professionals filter ─────────────────────────────────────────────────────
  const { data: professionalsData } = useQuery({
    queryKey: ["crm-professionals-list-agendamentos"],
    queryFn: () => fetchProfessionals({ limit: 200 }),
  });

  const listAppointments = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const professionals = professionalsData?.items ?? [];
  const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE) || 1;

  // In calendar view, use the narrow filter if the user set one; otherwise all.
  const calendarAppointments = (professionalId || hasDateFilter)
    ? allAppointments
    : allAppointments;

  function openDetail(a: AppointmentListItem) {
    setDetailAppointmentId(a.id);
    setDetailAppointmentItem(a);
  }

  return (
    <main className="space-y-6" role="main" aria-label="Agendamentos">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            Agenda e gestão de consultas. Crie agendamentos vinculados a
            paciente, profissional e horário disponível.
          </p>
        </div>
        <NewAppointmentDialog
          trigger={
            <Button>
              <Plus className="mr-2 size-4" />
              Novo agendamento
            </Button>
          }
        />
      </header>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-4">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as ViewMode)}
        >
          <ToggleGroupItem value="lista" aria-label="Visão lista">
            <List className="mr-1.5 size-4" />
            Lista
          </ToggleGroupItem>
          <ToggleGroupItem value="calendario" aria-label="Visão calendário">
            <CalendarDays className="mr-1.5 size-4" />
            Calendário
          </ToggleGroupItem>
          <ToggleGroupItem value="kanban" aria-label="Visão kanban">
            <Kanban className="mr-1.5 size-4" />
            Kanban
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Professional filter (shared between views) */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Profissional</span>
          <Select
            value={professionalId ?? "all"}
            onValueChange={(v) => setProfessionalId(v === "all" ? null : v)}
          >
            <SelectTrigger className="h-9 w-[220px]">
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
      </div>

      {/* ── Calendário view ── */}
      {viewMode === "calendario" && (
        <CrmCalendarView
          appointments={calendarAppointments}
          onAppointmentClick={openDetail}
        />
      )}

      {/* ── Kanban view ── */}
      {viewMode === "kanban" && (
        <CrmKanbanView
          appointments={allAppointments}
          isLoading={wideLoading}
          onAppointmentClick={openDetail}
        />
      )}

      {/* ── Lista view ── */}
      {viewMode === "lista" && (
        <Card>
          <CardHeader>
            <CardTitle>Lista de agendamentos</CardTitle>
            <CardDescription>
              {total} agendamento(s) no período.
            </CardDescription>
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">De</span>
                <input
                  type="date"
                  className="flex h-9 w-[140px] rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                  value={listDateFrom ?? ""}
                  onChange={(e) => {
                    setListDateFrom(e.target.value || null);
                    setPageIndex(0);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Até</span>
                <input
                  type="date"
                  className="flex h-9 w-[140px] rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                  value={listDateTo ?? ""}
                  onChange={(e) => {
                    setListDateTo(e.target.value || null);
                    setPageIndex(0);
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {listLoading || wideLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : listAppointments.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum agendamento encontrado neste período.
              </p>
            ) : (
              <>
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-10 px-4 text-left font-medium">
                          Data / Horário
                        </th>
                        <th className="h-10 px-4 text-left font-medium">
                          Paciente
                        </th>
                        <th className="h-10 px-4 text-left font-medium">
                          Profissional
                        </th>
                        <th className="h-10 px-4 text-left font-medium">
                          Tipo
                        </th>
                        <th className="h-10 px-4 text-left font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {listAppointments.map((a: AppointmentListItem) => {
                        const status = (a.status ?? "").toLowerCase();
                        return (
                          <tr
                            key={a.id}
                            className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                            onClick={() => openDetail(a)}
                          >
                            <td className="px-4 py-3">
                              {format(
                                new Date(a.start_time),
                                "dd/MM/yyyy 'às' HH:mm",
                                { locale: ptBR }
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {a.patient_name ?? a.patient_id}
                            </td>
                            <td className="px-4 py-3">
                              {a.professional_name ?? a.professional_id}
                            </td>
                            <td className="px-4 py-3 capitalize">
                              {a.appointment_type}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="secondary"
                                className={STATUS_CLASS[status] ?? ""}
                              >
                                {STATUS_LABELS[status] ?? a.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Página {pageIndex + 1} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pageIndex === 0}
                        onClick={() =>
                          setPageIndex((i) => Math.max(0, i - 1))
                        }
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pageIndex >= totalPages - 1}
                        onClick={() =>
                          setPageIndex((i) => Math.min(totalPages - 1, i + 1))
                        }
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <AppointmentDetailSheet
        appointmentId={detailAppointmentId}
        appointmentListItem={detailAppointmentId ? detailAppointmentItem : null}
        onClose={() => {
          setDetailAppointmentId(null);
          setDetailAppointmentItem(null);
        }}
        onRemarcar={(item) => {
          setRescheduleAppointment(item);
        }}
      />
      <RescheduleAppointmentDialog
        appointment={rescheduleAppointment}
        open={!!rescheduleAppointment}
        onOpenChange={(open) => !open && setRescheduleAppointment(null)}
        onSuccess={() => {
          setDetailAppointmentId(null);
          setDetailAppointmentItem(null);
        }}
      />
    </main>
  );
}
