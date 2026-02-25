"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createWebhook,
  deleteWebhook,
  fetchEventType,
  fetchEventTypeLimits,
  fetchSchedules,
  fetchWebhooks,
  updateEventType,
  upsertEventTypeLimits,
} from "@/lib/api/calendar";
import type { EventType, EventTypeLimit, Schedule } from "@/types/calendar";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Globe, Info, Pencil, Plus, Trash2 } from "lucide-react";

const LOCATION_TYPES = [
  { value: "video", label: "Vídeo (ex: Google Meet, Zoom)" },
  { value: "in_person", label: "Presencial" },
  { value: "phone", label: "Telefone" },
  { value: "custom_link", label: "Link customizado" },
] as const;

/** Ordem para exibição: Domingo, Segunda, ..., Sábado (dayOfWeek 6, 0, 1, 2, 3, 4, 5) */
const WEEKDAY_DISPLAY = [
  { dayOfWeek: 6, label: "Domingo" },
  { dayOfWeek: 0, label: "Segunda-feira" },
  { dayOfWeek: 1, label: "Terça-feira" },
  { dayOfWeek: 2, label: "Quarta-feira" },
  { dayOfWeek: 3, label: "Quinta-feira" },
  { dayOfWeek: 4, label: "Sexta-feira" },
  { dayOfWeek: 5, label: "Sábado" },
] as const;

function formatTime12h(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  if (h === 12) return `${h}:${m.toString().padStart(2, "0")} PM`;
  if (h === 0) return `12:${m.toString().padStart(2, "0")} AM`;
  if (h! > 12) return `${h! - 12}:${m.toString().padStart(2, "0")} PM`;
  return `${h}:${m.toString().padStart(2, "0")} AM`;
}

const configSchema = z.object({
  title: z.string().min(1, "Título é obrigatório").max(255),
  description: z.string().optional(),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Apenas letras minúsculas, números e hífens"),
  duration_minutes: z.number().int().min(1, "Mín. 1 min").max(480, "Máx. 480 min"),
  allow_multiple_durations: z.boolean(),
  locations: z.array(
    z.object({
      location_type: z.enum(["video", "in_person", "phone", "custom_link"]),
      location_value: z.string().optional(),
    })
  ).min(1, "Adicione pelo menos um local"),
});

type ConfigFormValues = z.infer<typeof configSchema>;

function toConfigValues(et: EventType): ConfigFormValues {
  return {
    title: et.title,
    description: et.description ?? "",
    slug: et.slug,
    duration_minutes: et.durationMinutes,
    allow_multiple_durations: et.allowMultipleDurations,
    locations:
      et.locations?.length > 0
        ? et.locations.map((l) => ({
            location_type: l.location_type,
            location_value: l.location_value ?? "",
          }))
        : [{ location_type: "video", location_value: "" }],
  };
}

function ConfigForm({ eventType }: { eventType: EventType }) {
  const queryClient = useQueryClient();
  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    values: toConfigValues(eventType),
  });

  const mutation = useMutation({
    mutationFn: (data: ConfigFormValues) =>
      updateEventType(eventType.id, {
        title: data.title,
        description: data.description || null,
        slug: data.slug,
        duration_minutes: data.duration_minutes,
        allow_multiple_durations: data.allow_multiple_durations,
        locations: data.locations.map((l, i) => ({
          location_type: l.location_type,
          location_value: l.location_value || null,
          position: i,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-type", eventType.id] });
      queryClient.invalidateQueries({ queryKey: ["event-types"] });
      toast.success("Configuração salva.");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      toast.error(typeof msg === "string" ? msg : "Erro ao salvar.");
    },
  });

  const locations = form.watch("locations");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração</CardTitle>
        <CardDescription>Dados básicos do tipo de evento</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Reunião de 30 min" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição opcional do evento"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL (slug)</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: reuniao-30" {...field} />
                  </FormControl>
                  <FormDescription>
                    Aparece na URL de agendamento. Apenas letras minúsculas, números e hífens.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="duration_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração (minutos)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={480}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const v = e.target.valueAsNumber;
                        field.onChange(Number.isNaN(v) ? 0 : v);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allow_multiple_durations"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Permitir múltiplas durações</FormLabel>
                    <FormDescription>
                      O convidado poderá escolher entre durações diferentes para este evento.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Local</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    form.setValue("locations", [
                      ...locations,
                      { location_type: "video", location_value: "" },
                    ])
                  }
                >
                  <Plus className="mr-1 size-4" />
                  Adicionar local
                </Button>
              </div>
              {locations.map((_, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-end gap-2 rounded-md border p-3"
                >
                  <FormField
                    control={form.control}
                    name={`locations.${i}.location_type`}
                    render={({ field }) => (
                      <FormItem className="min-w-[200px]">
                        <FormLabel className="text-xs">Tipo</FormLabel>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value as ConfigFormValues["locations"][0]["location_type"])}
                        >
                          {LOCATION_TYPES.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`locations.${i}.location_value`}
                    render={({ field }) => (
                      <FormItem className="flex-1 min-w-[180px]">
                        <FormLabel className="text-xs">Valor (link, endereço, etc.)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: https://meet.google.com/..."
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0"
                    onClick={() =>
                      form.setValue(
                        "locations",
                        locations.filter((_, j) => j !== i)
                      )
                    }
                    disabled={locations.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {form.formState.errors.locations && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.locations.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function DisponibilidadeTab({ eventType }: { eventType: EventType }) {
  const queryClient = useQueryClient();
  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["calendar-schedules"],
    queryFn: fetchSchedules,
  });

  const mutation = useMutation({
    mutationFn: (scheduleId: string | null) =>
      updateEventType(eventType.id, {
        schedule_id: scheduleId && scheduleId.length > 0 ? scheduleId : null,
      } as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-type", eventType.id] });
      queryClient.invalidateQueries({ queryKey: ["event-types"] });
      toast.success("Disponibilidade atualizada.");
    },
    onError: () => toast.error("Erro ao atualizar disponibilidade."),
  });

  const currentScheduleId = eventType.scheduleId ?? null;
  const selectedSchedule = currentScheduleId
    ? schedules.find((s) => s.id === currentScheduleId) ?? null
    : null;

  const handleScheduleChange = (value: string) => {
    const id = value || null;
    mutation.mutate(id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Disponibilidade</CardTitle>
        <CardDescription>
          Escolha o horário de disponibilidade para este tipo de evento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Perfil de disponibilidade</Label>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : schedules.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum schedule criado. Crie um em{" "}
              <Link
                href="/dashboard/calendario/disponibilidade"
                className="text-primary underline"
              >
                Disponibilidade
              </Link>
              .
            </p>
          ) : (
            <select
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={currentScheduleId ?? ""}
              onChange={(e) => handleScheduleChange(e.target.value)}
              disabled={mutation.isPending}
            >
              <option value="">
                — Nenhum vinculado (usa o padrão da organização) —
              </option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isDefault ? " (Padrão)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedSchedule && (
          <div className="rounded-lg border">
            <div className="divide-y">
              {WEEKDAY_DISPLAY.map(({ dayOfWeek, label }) => {
                const dayIntervals = selectedSchedule.intervals.filter(
                  (i) => i.dayOfWeek === dayOfWeek
                );
                const text =
                  dayIntervals.length === 0
                    ? "Indisponível"
                    : dayIntervals
                        .map(
                          (i) =>
                            `${formatTime12h(i.startTime)} - ${formatTime12h(i.endTime)}`
                        )
                        .join(", ");
                return (
                  <div
                    key={dayOfWeek}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className={dayIntervals.length === 0 ? "text-muted-foreground" : ""}>
                      {text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Globe className="size-4" />
            {selectedSchedule?.timezone ?? "—"}
          </span>
          <Link
            href={
              selectedSchedule
                ? `/dashboard/calendario/disponibilidade/${selectedSchedule.id}/editar`
                : "/dashboard/calendario/disponibilidade"
            }
            className="text-primary inline-flex items-center gap-1 text-sm underline"
          >
            Editar disponibilidade
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

const BUFFER_OPTIONS = [
  { value: 0, label: "Sem horário de intervalo" },
  { value: 5, label: "5 minutos" },
  { value: 10, label: "10 minutos" },
  { value: 15, label: "15 minutos" },
  { value: 20, label: "20 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
];

const NOTICE_UNITS = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
] as const;

const SLOT_INTERVAL_OPTIONS = [
  { value: "", label: "Usar a duração do evento (padrão)" },
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
];

function LimitesTab({ eventType }: { eventType: EventType }) {
  const queryClient = useQueryClient();
  const { data: limits, isLoading } = useQuery({
    queryKey: ["event-type-limits", eventType.id],
    queryFn: () => fetchEventTypeLimits(eventType.id),
  });

  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [minimumNoticeValue, setMinimumNoticeValue] = useState(60);
  const [minimumNoticeUnit, setMinimumNoticeUnit] = useState<"minutes" | "hours">("minutes");
  const [slotInterval, setSlotInterval] = useState<string | number>("");
  const [limitToFirstSlot, setLimitToFirstSlot] = useState(false);
  const [maxDurationPerDay, setMaxDurationPerDay] = useState<number | "">("");
  const [maxBookingsPerDay, setMaxBookingsPerDay] = useState<number | "">("");
  const [maxFutureDays, setMaxFutureDays] = useState(60);
  const [frequencyLimitOn, setFrequencyLimitOn] = useState(false);
  const [frequencyPeriod, setFrequencyPeriod] = useState<"week" | "month">("week");
  const [frequencyMax, setFrequencyMax] = useState(1);

  useEffect(() => {
    if (limits == null) return;
    setBufferBefore(limits.bufferBeforeMinutes);
    setBufferAfter(limits.bufferAfterMinutes);
    setMinimumNoticeValue(
      limits.minimumNoticeMinutes >= 60
        ? limits.minimumNoticeMinutes / 60
        : limits.minimumNoticeMinutes
    );
    setMinimumNoticeUnit(
      limits.minimumNoticeMinutes >= 60 ? "hours" : "minutes"
    );
    setSlotInterval(limits.slotIntervalMinutes ?? "");
    setLimitToFirstSlot(limits.limitToFirstSlot);
    setMaxDurationPerDay(limits.maxDurationPerDayMinutes ?? "");
    setMaxBookingsPerDay(limits.maxBookingsPerDay ?? "");
    setMaxFutureDays(limits.maxFutureDays);
    setFrequencyLimitOn(!!limits.frequencyLimit);
    setFrequencyPeriod(limits.frequencyLimit?.period ?? "week");
    setFrequencyMax(limits.frequencyLimit?.max ?? 1);
  }, [limits]);

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof upsertEventTypeLimits>[1]) =>
      upsertEventTypeLimits(eventType.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-type-limits", eventType.id] });
      queryClient.invalidateQueries({ queryKey: ["event-type", eventType.id] });
      toast.success("Limites salvos.");
    },
    onError: () => toast.error("Erro ao salvar limites."),
  });

  const handleSave = () => {
    const minNotice =
      minimumNoticeUnit === "hours"
        ? minimumNoticeValue * 60
        : minimumNoticeValue;
    mutation.mutate({
      buffer_before_minutes: bufferBefore,
      buffer_after_minutes: bufferAfter,
      minimum_notice_minutes: minNotice,
      slot_interval_minutes:
        slotInterval === "" || slotInterval === null ? null : Number(slotInterval),
      limit_to_first_slot: limitToFirstSlot,
      max_duration_per_day_minutes:
        maxDurationPerDay === "" ? null : Number(maxDurationPerDay),
      max_bookings_per_day:
        maxBookingsPerDay === "" ? null : Number(maxBookingsPerDay),
      max_future_days: maxFutureDays,
      frequency_limit: frequencyLimitOn
        ? { period: frequencyPeriod, max: frequencyMax }
        : null,
    });
  };

  if (isLoading && !limits) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Limites</CardTitle>
        <CardDescription>
          Buffer, aviso mínimo, intervalo de slots e limites de reserva.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Antes do evento</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={bufferBefore}
              onChange={(e) => setBufferBefore(Number(e.target.value))}
            >
              {BUFFER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Após o evento</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={bufferAfter}
              onChange={(e) => setBufferAfter(Number(e.target.value))}
            >
              {BUFFER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Aviso mínimo</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                value={minimumNoticeValue}
                onChange={(e) =>
                  setMinimumNoticeValue(
                    e.target.valueAsNumber >= 0 ? e.target.valueAsNumber : 0
                  )
                }
              />
              <select
                className="flex h-9 w-24 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                value={minimumNoticeUnit}
                onChange={(e) =>
                  setMinimumNoticeUnit(e.target.value as "minutes" | "hours")
                }
              >
                {NOTICE_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Intervalos de tempo</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={slotInterval}
              onChange={(e) =>
                setSlotInterval(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              {SLOT_INTERVAL_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Limite frequência de reserva</p>
              <p className="text-muted-foreground text-sm">
                Limite quantas vezes este evento pode ser reservado.
              </p>
            </div>
            <Switch
              checked={frequencyLimitOn}
              onCheckedChange={setFrequencyLimitOn}
            />
          </div>
          {frequencyLimitOn && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-t-0 p-4 pt-2">
              <Input
                type="number"
                min={1}
                className="w-20"
                value={frequencyMax}
                onChange={(e) => setFrequencyMax(e.target.valueAsNumber || 1)}
              />
              <select
                className="flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                value={frequencyPeriod}
                onChange={(e) =>
                  setFrequencyPeriod(e.target.value as "week" | "month")
                }
              >
                <option value="week">por semana</option>
                <option value="month">por mês</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Mostrar apenas o primeiro horário disponível de cada dia</p>
              <p className="text-muted-foreground text-sm">
                Limita a um horário por dia, no primeiro slot disponível.
              </p>
            </div>
            <Switch
              checked={limitToFirstSlot}
              onCheckedChange={setLimitToFirstSlot}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Limitar duração total de reserva</p>
              <p className="text-muted-foreground text-sm">
                Limite de quanto tempo este evento pode ser reservado por dia.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Min"
                className="w-20"
                value={maxDurationPerDay}
                onChange={(e) =>
                  setMaxDurationPerDay(
                    e.target.value === "" ? "" : e.target.valueAsNumber
                  )
                }
              />
              <Switch
                checked={maxDurationPerDay !== "" && maxDurationPerDay !== null}
                onCheckedChange={(on) => setMaxDurationPerDay(on ? 60 : "")}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Limitar número de reservas por dia</p>
              <p className="text-muted-foreground text-sm">
                Máximo de reservas deste evento por dia.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-20"
                value={maxBookingsPerDay}
                onChange={(e) =>
                  setMaxBookingsPerDay(
                    e.target.value === "" ? "" : e.target.valueAsNumber
                  )
                }
              />
              <Switch
                checked={maxBookingsPerDay !== "" && maxBookingsPerDay !== null}
                onCheckedChange={(on) => setMaxBookingsPerDay(on ? 5 : "")}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Limitar reservas futuras</p>
              <p className="text-muted-foreground text-sm">
                Limite quão longe no futuro este evento pode ser agendado (dias).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-20"
                value={maxFutureDays}
                onChange={(e) =>
                  setMaxFutureDays(e.target.valueAsNumber >= 1 ? e.target.valueAsNumber : 1)
                }
              />
              <span className="text-muted-foreground text-sm">dias</span>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}

const LAYOUT_OPTIONS = [
  { id: "month", label: "Mês", icon: "📅" },
  { id: "week", label: "Semanalmente", icon: "📆" },
  { id: "column", label: "Coluna", icon: "📋" },
] as const;

const DEFAULT_QUESTIONS = [
  { id: "name", label: "Seu nome", status: "Obrigatório" as const, type: "Name", required: true },
  { id: "email", label: "Endereço de e-mail", status: "Obrigatório" as const, type: "Email", required: true },
  { id: "phone", label: "Número de Telefone", status: "Esconder" as const, type: "Phone", required: false },
  { id: "about", label: "De que se trata esta reunião?", status: "Esconder" as const, type: "Short Text", required: false },
  { id: "notes", label: "Observações adicionais", status: "Opcional" as const, type: "Long Text", required: false },
  { id: "participants", label: "Participantes Adicionais", status: "Opcional" as const, type: "Multiple Emails", required: false },
  { id: "reschedule", label: "Motivo do reagendamento", status: "Opcional" as const, type: "Long Text", required: false },
];

function AvancadoTab({ eventType }: { eventType: EventType }) {
  const queryClient = useQueryClient();
  const [requiresConfirmation, setRequiresConfirmation] = useState(
    eventType.requiresConfirmation ?? false
  );
  const [eventNameInCalendar, setEventNameInCalendar] = useState(
    `Entre você e {Scheduler}`
  );
  const [showOrganizerEmail, setShowOrganizerEmail] = useState(false);
  const [layoutEnabled, setLayoutEnabled] = useState(["month", "week", "column"]);
  const [defaultView, setDefaultView] = useState<"month" | "week" | "column">("month");
  const [questionToggles, setQuestionToggles] = useState<Record<string, boolean>>({
    name: true,
    email: true,
    phone: false,
    about: false,
    notes: true,
    participants: true,
    reschedule: true,
  });
  const [color, setColor] = useState(eventType.color ?? "");

  useEffect(() => {
    setRequiresConfirmation(eventType.requiresConfirmation ?? false);
    setColor(eventType.color ?? "");
  }, [eventType.requiresConfirmation, eventType.color]);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      updateEventType(eventType.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-type", eventType.id] });
      queryClient.invalidateQueries({ queryKey: ["event-types"] });
      toast.success("Configurações salvas.");
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  const saveAdvanced = (updates: Record<string, unknown>) => {
    mutation.mutate(updates);
  };

  return (
    <div className="space-y-8">
      {/* Sessão 1: Adicionar ao calendário */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionar ao calendário</CardTitle>
          <CardDescription>
            Defina em qual calendário as reservas são adicionadas e como o evento aparece.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Calendário</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option>Padrão (calendário principal)</option>
              </select>
              <p className="text-muted-foreground text-xs">
                Selecione para qual calendário adicionar reservas.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nome do evento no calendário</Label>
              <div className="relative">
                <Input
                  placeholder="Ex: Reunião entre você e {Scheduler}"
                  value={eventNameInCalendar}
                  onChange={(e) => setEventNameInCalendar(e.target.value)}
                  className="pr-9"
                />
                <Pencil className="text-muted-foreground absolute right-3 top-1/2 size-4 -translate-y-1/2" />
              </div>
            </div>
          </div>
          <div className="flex flex-row items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={showOrganizerEmail}
                  onCheckedChange={setShowOrganizerEmail}
                />
                <Label className="font-normal">
                  Exibir e-mail como organizador
                </Label>
                <Info className="text-muted-foreground size-4" />
              </div>
              <p className="text-muted-foreground text-sm">
                Iremos exibir este endereço como organizador e enviar confirmações para ele.
              </p>
            </div>
            {showOrganizerEmail && (
              <select className="flex h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option>Padrão (e-mail da conta)</option>
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sessão 2: Verificar se há conflitos */}
      <Card>
        <CardHeader>
          <CardTitle>Verificar se há conflitos</CardTitle>
          <CardDescription>
            Selecione em quais calendários verificar conflitos para evitar dupla reserva.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Integração com calendários externos (Google, Outlook) para verificação de conflitos estará disponível em breve. Por enquanto, os horários são baseados na sua disponibilidade configurada.
          </p>
        </CardContent>
      </Card>

      {/* Sessão 3: Layout */}
      <Card>
        <CardHeader>
          <CardTitle>Layout</CardTitle>
          <CardDescription>
            Você pode selecionar várias opções; os reservantes podem alternar entre as visualizações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-6">
            {LAYOUT_OPTIONS.map((opt) => (
              <div key={opt.id} className="flex flex-col items-center gap-2">
                <div className="bg-muted flex h-16 w-24 items-center justify-center rounded-lg text-2xl">
                  {opt.icon}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`layout-${opt.id}`}
                    checked={layoutEnabled.includes(opt.id)}
                    onChange={(e) =>
                      setLayoutEnabled((prev) =>
                        e.target.checked
                          ? [...prev, opt.id]
                          : prev.filter((x) => x !== opt.id)
                      )
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor={`layout-${opt.id}`} className="font-normal">
                    {opt.label}
                  </Label>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Visualização padrão</Label>
            <div className="flex gap-2">
              {LAYOUT_OPTIONS.map((opt) => (
                <Button
                  key={opt.id}
                  type="button"
                  variant={defaultView === opt.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDefaultView(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Gerencie para todos em Configurações → Aparência ou substitua apenas para este evento.
          </p>
        </CardContent>
      </Card>

      {/* Sessão 4: Perguntas sobre reserva */}
      <Card>
        <CardHeader>
          <CardTitle>Perguntas sobre reserva</CardTitle>
          <CardDescription>
            Personalize as perguntas feitas na página de agendamento.{" "}
            <button type="button" className="text-primary underline">
              Saiba mais
            </button>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="font-medium">Confirmação</p>
            <p className="text-muted-foreground text-sm">
              O que o agendador deve fornecer para receber confirmações.
            </p>
            <div className="mt-2 flex gap-2">
              <Badge variant="secondary" className="gap-1">
                <span className="size-3 rounded-full bg-blue-500" /> Email
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <span className="size-3 rounded-full bg-green-500" /> Telefone
              </Badge>
            </div>
          </div>
          <div>
            <p className="font-medium">Perguntas</p>
            <p className="text-muted-foreground mb-3 text-sm">
              Informações que o agendador deve fornecer antes de reservar.
            </p>
            <ul className="space-y-2">
              {DEFAULT_QUESTIONS.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-row items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{q.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {q.type} · <Badge variant="outline" className="text-xs">{q.status}</Badge>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={questionToggles[q.id] ?? false}
                      onCheckedChange={(checked) =>
                        setQuestionToggles((prev) => ({ ...prev, [q.id]: checked }))
                      }
                      disabled={q.required}
                    />
                    <Button variant="ghost" size="sm">
                      Editar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="link" className="mt-2 px-0" type="button">
              <Plus className="mr-1 size-4" />
              Adicione uma pergunta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessão 5: Opções avançadas (lista de toggles) */}
      <Card>
        <CardHeader>
          <CardTitle>Opções avançadas</CardTitle>
          <CardDescription>
            Configurações adicionais para confirmação, cancelamento, e-mail e exibição.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 divide-y">
          <div className="flex items-start justify-between gap-4 py-4 first:pt-0">
            <div>
              <p className="font-medium">Requer confirmação</p>
              <p className="text-muted-foreground text-sm">
                O agendamento precisa ser confirmado manualmente antes de ser enviado ao seu calendário.{" "}
                <button type="button" className="text-primary underline">Saiba mais</button>
              </p>
            </div>
            <Switch
              checked={requiresConfirmation}
              onCheckedChange={(v) => {
                setRequiresConfirmation(v);
                saveAdvanced({ requires_confirmation: v });
              }}
            />
          </div>
          <div className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium">Desativar cancelamento</p>
              <p className="text-muted-foreground text-sm">
                Convidados e organizador não podem cancelar pelo convite de calendário ou e-mail.
              </p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium">Desativar reagendamento</p>
              <p className="text-muted-foreground text-sm">
                Convidados e organizador não podem reagendar pelo convite ou e-mail.
              </p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium">Ocultar notas no calendário</p>
              <p className="text-muted-foreground text-sm">
                Por privacidade, notas ficam ocultas na entrada do calendário; ainda são enviadas por e-mail.
              </p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium">Redirecionar após a reserva</p>
              <p className="text-muted-foreground text-sm">
                Redirecionar para uma URL personalizada após a reserva.
              </p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium">Cor do tipo de evento</p>
              <p className="text-muted-foreground text-sm">
                Usado apenas para diferenciar tipos de evento dentro do app. Não é exibido aos agendadores.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                className="h-9 w-14 cursor-pointer p-1"
                value={color || "#3b82f6"}
                onChange={(e) => {
                  const v = e.target.value;
                  setColor(v);
                  saveAdvanced({ color: v });
                }}
              />
              <Input
                type="text"
                className="w-24 font-mono text-sm"
                placeholder="#3b82f6"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                onBlur={() => color && saveAdvanced({ color: color.startsWith("#") ? color : `#${color}` })}
              />
            </div>
          </div>
          <div className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium">Bloquear fuso horário na página de reserva</p>
              <p className="text-muted-foreground text-sm">
                Útil para eventos presenciais. Saiba mais
              </p>
            </div>
            <Switch disabled />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const WEBHOOK_EVENTS = [
  { value: "booking.created", label: "Reserva criada" },
  { value: "booking.cancelled", label: "Reserva cancelada" },
  { value: "booking.rescheduled", label: "Reserva reagendada" },
  { value: "booking.no_show", label: "Marcado como não compareceu" },
  { value: "booking.attendees_added", label: "Participantes adicionados" },
];

function WebhooksTab({ eventTypeId }: { eventTypeId: string }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["webhooks", eventTypeId],
    queryFn: () => fetchWebhooks(eventTypeId),
  });

  const createMutation = useMutation({
    mutationFn: (body: { url: string; events: string[] }) =>
      createWebhook(eventTypeId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", eventTypeId] });
      setUrl("");
      setEvents([]);
      toast.success("Webhook criado");
    },
    onError: () => toast.error("Erro ao criar webhook"),
  });

  const deleteMutation = useMutation({
    mutationFn: (webhookId: string) => deleteWebhook(eventTypeId, webhookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", eventTypeId] });
      toast.success("Webhook removido");
    },
    onError: () => toast.error("Erro ao remover webhook"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || events.length === 0) {
      toast.error("URL e pelo menos um evento são obrigatórios");
      return;
    }
    createMutation.mutate({ url: url.trim(), events });
  };

  const toggleEvent = (value: string) => {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks</CardTitle>
        <CardDescription>
          Notificações HTTP quando reservas são criadas, canceladas, reagendadas, marcadas como não compareceu ou quando participantes são adicionados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL do endpoint</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://seu-servidor.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Eventos</Label>
            <div className="flex flex-wrap gap-4">
              {WEBHOOK_EVENTS.map((ev) => (
                <div key={ev.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`ev-${ev.value}`}
                    checked={events.includes(ev.value)}
                    onCheckedChange={() => toggleEvent(ev.value)}
                  />
                  <Label htmlFor={`ev-${ev.value}`} className="font-normal cursor-pointer">
                    {ev.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Criando..." : "Adicionar webhook"}
          </Button>
        </form>

        <div>
          <Label className="text-base">Webhooks configurados</Label>
          {isLoading ? (
            <Skeleton className="mt-2 h-20 w-full" />
          ) : webhooks?.length ? (
            <ul className="mt-2 space-y-2">
              {webhooks.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground truncate flex-1 mr-2">{w.url}</span>
                  <span className="text-muted-foreground text-xs">
                    {w.events.join(", ")}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(w.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">Nenhum webhook configurado.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EditarTipoDeEventoPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: eventType, isLoading, error } = useQuery({
    queryKey: ["event-type", id],
    queryFn: () => fetchEventType(id),
    enabled: Boolean(id),
  });

  if (error || (!isLoading && !eventType)) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">Tipo de evento não encontrado.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/calendario/tipos-de-evento">Voltar</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !eventType) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/calendario/tipos-de-evento">← Voltar</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{eventType.title}</h1>
        <p className="text-muted-foreground text-sm">/{eventType.slug}</p>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
          <TabsTrigger value="limites">Limites</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="avancado">Avançado</TabsTrigger>
        </TabsList>
        <TabsContent value="config">
          <ConfigForm eventType={eventType} />
        </TabsContent>
        <TabsContent value="disponibilidade">
          <DisponibilidadeTab eventType={eventType} />
        </TabsContent>
        <TabsContent value="limites">
          <LimitesTab eventType={eventType} />
        </TabsContent>
        <TabsContent value="webhooks">
          <WebhooksTab eventTypeId={eventType.id} />
        </TabsContent>
        <TabsContent value="avancado">
          <AvancadoTab eventType={eventType} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
