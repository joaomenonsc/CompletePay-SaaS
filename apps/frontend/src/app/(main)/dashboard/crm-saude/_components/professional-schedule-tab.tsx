"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useProfessional, useUpdateProfessional } from "@/hooks/use-professionals";
import { useSchedule, useCreateSchedule, useUpdateSchedule } from "@/hooks/use-schedules";
import { fetchEventTypes } from "@/lib/api/calendar";
import { Plus, Trash2 } from "lucide-react";

const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const SLOT_OPTIONS = [15, 20, 30, 45, 60];

interface ProfessionalScheduleTabProps {
  professionalId: string;
}

/** PRD 10.3: Agenda do profissional usa API do Calendário (use-schedules.ts). Config no Professional via PATCH. */
export function ProfessionalScheduleTab({ professionalId }: ProfessionalScheduleTabProps) {
  const { data: professional } = useProfessional(professionalId);
  const { data: schedule, isLoading: scheduleLoading } = useSchedule(
    professional?.schedule_id ?? null
  );
  const { data: eventTypes = [] } = useQuery({
    queryKey: ["calendar-event-types"],
    queryFn: fetchEventTypes,
  });
  const createScheduleMutation = useCreateSchedule();
  const updateScheduleMutation = useUpdateSchedule();
  const updateProfessionalMutation = useUpdateProfessional();

  const [intervals, setIntervals] = useState<
    { day_of_week: number; start_time: string; end_time: string }[]
  >([]);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [defaultSlot, setDefaultSlot] = useState<number | null>(null);
  const [acceptsEncaixe, setAcceptsEncaixe] = useState(false);
  const [bufferMinutes, setBufferMinutes] = useState<number | "">("");
  const initializedSchedule = useRef<string | null>(null);
  const initializedConfig = useRef<string | null>(null);

  // Ao trocar de profissional, permitir nova inicialização
  useEffect(() => {
    initializedSchedule.current = null;
    initializedConfig.current = null;
  }, [professionalId]);

  // Sincronizar estado local com schedule (API Calendário)
  useEffect(() => {
    if (!schedule || initializedSchedule.current === schedule.id) return;
    initializedSchedule.current = schedule.id;
    setIntervals(
      schedule.intervals.map((i) => ({
        day_of_week: i.dayOfWeek,
        start_time: i.startTime,
        end_time: i.endTime,
      }))
    );
    setTimezone(schedule.timezone || "America/Sao_Paulo");
  }, [schedule]);

  // Sincronizar config com professional
  useEffect(() => {
    if (!professional || initializedConfig.current === professionalId) return;
    initializedConfig.current = professionalId;
    setDefaultSlot(professional.default_slot_minutes ?? null);
    setAcceptsEncaixe(professional.accepts_encaixe ?? false);
    setBufferMinutes(professional.buffer_between_minutes ?? "");
  }, [professionalId, professional]);

  const addInterval = () => {
    setIntervals((prev) => [
      ...prev,
      { day_of_week: 0, start_time: "08:00", end_time: "12:00" },
    ]);
  };

  const removeInterval = (index: number) => {
    setIntervals((prev) => prev.filter((_, i) => i !== index));
  };

  const updateInterval = (
    index: number,
    field: "day_of_week" | "start_time" | "end_time",
    value: number | string
  ) => {
    setIntervals((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleCreateAgenda = () => {
    if (!professional) return;
    createScheduleMutation.mutate(
      {
        name: `${professional.full_name} - Agenda`,
        timezone: "America/Sao_Paulo",
        intervals: [],
      },
      {
        onSuccess: (newSchedule) => {
          updateProfessionalMutation.mutate(
            { id: professionalId, body: { schedule_id: newSchedule.id } },
            {
              onSuccess: () => {
                toast.success("Agenda criada. Configure os horários abaixo.");
                initializedSchedule.current = null;
              },
              onError: (err: Error) => toast.error(err?.message ?? "Erro ao vincular agenda"),
            }
          );
        },
        onError: (err: Error) => toast.error(err?.message ?? "Erro ao criar agenda"),
      }
    );
  };

  const handleSaveSchedule = () => {
    if (!professional?.schedule_id) return;
    updateScheduleMutation.mutate(
      {
        id: professional.schedule_id,
        body: { timezone, intervals },
      },
      {
        onSuccess: (updatedSchedule) => {
          toast.success("Horários atualizados");
          setIntervals(
            updatedSchedule.intervals.map((i) => ({
              day_of_week: i.dayOfWeek,
              start_time: i.startTime,
              end_time: i.endTime,
            }))
          );
          setTimezone(updatedSchedule.timezone || "America/Sao_Paulo");
          initializedSchedule.current = updatedSchedule.id;
        },
        onError: (err: Error & { response?: { data?: { detail?: string | string[] } } }) => {
          const detail = err?.response?.data?.detail;
          const msg = Array.isArray(detail)
            ? detail.join(", ")
            : typeof detail === "string"
              ? detail
              : err?.message ?? "Erro ao salvar horários";
          toast.error(msg);
          console.error("Erro ao salvar agenda:", err);
        },
      }
    );
  };

  const handleSaveConfig = () => {
    updateProfessionalMutation.mutate(
      {
        id: professionalId,
        body: {
          default_slot_minutes: defaultSlot ?? undefined,
          accepts_encaixe: acceptsEncaixe,
          buffer_between_minutes:
            bufferMinutes === "" ? undefined : (bufferMinutes as number),
        },
      },
      {
        onSuccess: () => toast.success("Configurações salvas"),
        onError: (err: Error) => toast.error(err?.message ?? "Erro ao salvar"),
      }
    );
  };

  const hasSchedule = !!professional?.schedule_id;

  if (!professional) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Carregando…
        </CardContent>
      </Card>
    );
  }

  if (!hasSchedule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuração de agenda</CardTitle>
          <CardDescription>
            PRD 10.3: a agenda usa o módulo de Calendário (AvailabilitySchedule). Crie uma agenda
            para este profissional para definir dias e horários de atendimento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleCreateAgenda}
            disabled={createScheduleMutation.isPending || updateProfessionalMutation.isPending}
          >
            {createScheduleMutation.isPending || updateProfessionalMutation.isPending
              ? "Criando…"
              : "Criar agenda"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (scheduleLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Carregando agenda…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração de agenda</CardTitle>
        <CardDescription>
          Dias e horários via API do Calendário (use-schedules). Slot padrão, encaixe e buffer no
          cadastro do profissional.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-base">Tipo de consulta (para agendamento)</Label>
          <p className="text-muted-foreground mb-2 text-sm">
            Vincule um tipo de consulta para que, em Novo agendamento, Data e Horário sejam
            liberados. Crie tipos em{" "}
            <Link
              href="/dashboard/calendario/tipos-de-evento"
              className="underline hover:no-underline"
            >
              Calendário → Tipos de evento
            </Link>
            .
          </p>
          <Select
            value={professional?.event_type_id ?? "__none"}
            onValueChange={(v) => {
              const value = v === "__none" ? null : v;
              updateProfessionalMutation.mutate(
                {
                  id: professionalId,
                  body: { event_type_id: value },
                },
                {
                  onSuccess: () =>
                    value
                      ? toast.success("Tipo de consulta vinculado.")
                      : toast.success("Tipo de consulta desvinculado."),
                  onError: (err: Error) =>
                    toast.error(err?.message ?? "Erro ao atualizar tipo de consulta."),
                }
              );
            }}
            disabled={updateProfessionalMutation.isPending}
          >
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Selecione o tipo de consulta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Nenhum (Data/Horário ficarão bloqueados)</SelectItem>
              {eventTypes
                .filter((et) => et.isActive)
                .map((et) => (
                  <SelectItem key={et.id} value={et.id}>
                    {et.title} ({et.durationMinutes} min)
                  </SelectItem>
                ))}
              {eventTypes.filter((et) => et.isActive).length === 0 && eventTypes.length > 0 && (
                <SelectItem value="__unavailable" disabled>
                  Nenhum tipo ativo — ative em Calendário → Tipos de evento
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <hr />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Horários de atendimento</Label>
            <Button type="button" variant="outline" size="sm" onClick={addInterval}>
              <Plus className="mr-2 size-4" />
              Adicionar
            </Button>
          </div>
          {intervals.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum horário definido. Adicione pelo menos um intervalo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {intervals.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Select
                        value={String(row.day_of_week)}
                        onValueChange={(v) =>
                          updateInterval(index, "day_of_week", parseInt(v, 10))
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_NAMES.map((name, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={row.start_time}
                        onChange={(e) =>
                          updateInterval(index, "start_time", e.target.value)
                        }
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={row.end_time}
                        onChange={(e) =>
                          updateInterval(index, "end_time", e.target.value)
                        }
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeInterval(index)}
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
          <div className="mt-2">
            <Label htmlFor="schedule-timezone">Fuso horário</Label>
            <Input
              id="schedule-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/Sao_Paulo"
              className="mt-1 max-w-xs"
            />
          </div>
          <Button
            className="mt-2"
            onClick={handleSaveSchedule}
            disabled={updateScheduleMutation.isPending || intervals.length === 0}
          >
            {updateScheduleMutation.isPending ? "Salvando…" : "Salvar horários"}
          </Button>
        </div>

        <hr />

        <div>
          <h3 className="mb-2 font-medium">Configurações do profissional</h3>
          <p className="text-muted-foreground mb-3 text-sm">
            Duração padrão, buffer e encaixe (gravados no cadastro do profissional).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Duração padrão da consulta (min)</Label>
              <Select
                value={defaultSlot != null ? String(defaultSlot) : "none"}
                onValueChange={(v) =>
                  setDefaultSlot(v === "none" ? null : parseInt(v, 10))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {SLOT_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} min
                    </SelectItem>
                  ))}
                  <SelectItem value="none">—</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Buffer entre consultas (min)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={bufferMinutes}
                onChange={(e) => {
                  const v = e.target.value;
                  setBufferMinutes(v === "" ? "" : parseInt(v, 10) || 0);
                }}
                placeholder="0"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-2">
            <Checkbox
              id="accepts_encaixe"
              checked={acceptsEncaixe}
              onCheckedChange={(c) => setAcceptsEncaixe(!!c)}
            />
            <Label htmlFor="accepts_encaixe">Aceita encaixe</Label>
          </div>
          <Button
            className="mt-2"
            onClick={handleSaveConfig}
            disabled={updateProfessionalMutation.isPending}
          >
            {updateProfessionalMutation.isPending ? "Salvando…" : "Salvar configurações"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
