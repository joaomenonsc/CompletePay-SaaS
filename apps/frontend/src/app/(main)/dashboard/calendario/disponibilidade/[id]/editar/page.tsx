"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSchedule, updateSchedule } from "@/lib/api/calendar";
import type { ScheduleInterval } from "@/types/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";

const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const intervalSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM"),
});

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  timezone: z.string().min(1, "Timezone é obrigatório"),
  intervals: z.array(intervalSchema),
});

type FormValues = z.infer<typeof formSchema>;

function emptyInterval(): { dayOfWeek: number; startTime: string; endTime: string } {
  return { dayOfWeek: 0, startTime: "09:00", endTime: "17:00" };
}

function toFormValues(s: { name: string; timezone: string; intervals: ScheduleInterval[] }): FormValues {
  return {
    name: s.name,
    timezone: s.timezone,
    intervals:
      s.intervals?.length > 0
        ? s.intervals.map((i) => ({
            dayOfWeek: i.dayOfWeek,
            startTime: i.startTime,
            endTime: i.endTime,
          }))
        : [emptyInterval()],
  };
}

export default function EditarSchedulePage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const { data: schedule, isLoading, error } = useQuery({
    queryKey: ["schedule", id],
    queryFn: () => fetchSchedule(id),
    enabled: Boolean(id),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      timezone: "America/Sao_Paulo",
      intervals: [emptyInterval()],
    },
  });

  useEffect(() => {
    if (schedule) form.reset(toFormValues(schedule));
  }, [schedule, form]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      updateSchedule(id, {
        name: data.name,
        timezone: data.timezone,
        intervals: data.intervals.map((i) => ({
          day_of_week: i.dayOfWeek,
          start_time: i.startTime,
          end_time: i.endTime,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", id] });
      queryClient.invalidateQueries({ queryKey: ["calendar-schedules"] });
      toast.success("Schedule atualizado");
    },
    onError: () => toast.error("Erro ao atualizar schedule"),
  });

  const intervals = form.watch("intervals");

  if (error || (!isLoading && !schedule)) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">Schedule não encontrado.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/calendario/disponibilidade">Voltar</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !schedule) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/calendario/disponibilidade">← Voltar</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Editar schedule</h1>
        <p className="text-muted-foreground text-sm">{schedule.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
          <CardDescription>Nome, timezone e intervalos por dia da semana</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Horário comercial" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Input placeholder="America/Sao_Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <FormLabel>Intervalos</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => form.setValue("intervals", [...intervals, emptyInterval()])}
                  >
                    <Plus className="mr-1 size-4" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {intervals.map((_, index) => (
                    <div
                      key={index}
                      className="flex flex-wrap items-end gap-2 rounded-md border p-2"
                    >
                      <FormField
                        control={form.control}
                        name={`intervals.${index}.dayOfWeek`}
                        render={({ field }) => (
                          <FormItem className="w-32">
                            <FormLabel className="text-xs">Dia</FormLabel>
                            <FormControl>
                              <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                value={field.value}
                              >
                                {DAY_NAMES.map((name, i) => (
                                  <option key={i} value={i}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`intervals.${index}.startTime`}
                        render={({ field }) => (
                          <FormItem className="w-24">
                            <FormLabel className="text-xs">Início</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`intervals.${index}.endTime`}
                        render={({ field }) => (
                          <FormItem className="w-24">
                            <FormLabel className="text-xs">Fim</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() =>
                          form.setValue(
                            "intervals",
                            intervals.filter((_, i) => i !== index)
                          )
                        }
                        disabled={intervals.length <= 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link href="/dashboard/calendario/disponibilidade">Cancelar</Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
