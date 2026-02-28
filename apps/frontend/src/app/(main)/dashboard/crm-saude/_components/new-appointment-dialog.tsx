"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchPatients,
  fetchProfessionals,
  fetchUnits,
  fetchRooms,
  fetchAvailableSlots,
  createAppointment,
} from "@/lib/api/crm";
import type {
  Patient,
  Professional,
  Unit,
  Room,
  AppointmentType,
  DaySlots,
} from "@/types/crm";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const TIMEZONE = "America/Sao_Paulo";

const formSchema = z.object({
  patient_id: z.string().min(1, "Selecione o paciente"),
  professional_id: z.string().min(1, "Selecione o profissional"),
  unit_id: z.string().optional(),
  room_id: z.string().optional(),
  appointment_type: z.enum(["consulta", "retorno", "procedimento", "teleconsulta"]),
  date: z.date({ required_error: "Selecione a data" }),
  slot_time: z.string().min(1, "Selecione o horário"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  consulta: "Consulta",
  retorno: "Retorno",
  procedimento: "Procedimento",
  teleconsulta: "Teleconsulta",
};

interface NewAppointmentDialogProps {
  trigger?: React.ReactNode;
}

export function NewAppointmentDialog({ trigger }: NewAppointmentDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_id: "",
      professional_id: "",
      unit_id: "",
      room_id: "",
      appointment_type: "consulta",
      notes: "",
    },
  });

  const professionalId = form.watch("professional_id");
  const selectedDate = form.watch("date");
  const unitId = form.watch("unit_id");

  const { data: professionalsData } = useQuery({
    queryKey: ["crm-professionals-list"],
    queryFn: () => fetchProfessionals({ limit: 200 }),
    enabled: open,
  });

  const professionals = useMemo(
    () => professionalsData?.items ?? [],
    [professionalsData?.items]
  );

  const { data: patientsData } = useQuery({
    queryKey: ["crm-patients-list-appointment"],
    queryFn: () => fetchPatients({ limit: 200 }),
    enabled: open,
  });

  const patients = patientsData?.items ?? [];

  const { data: units = [] } = useQuery({
    queryKey: ["crm-units"],
    queryFn: fetchUnits,
    enabled: open,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["crm-rooms", unitId],
    queryFn: () => fetchRooms(unitId!),
    enabled: open && !!unitId,
  });

  const selectedProfessional = professionals.find(
    (p: Professional) => p.id === professionalId
  );
  const eventTypeId = selectedProfessional?.event_type_id ?? null;
  const hasEventType = !!eventTypeId;

  const dateStr = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : null;

  const { data: slotsResponse, isLoading: slotsLoading } = useQuery({
    queryKey: ["crm-available-slots", eventTypeId, dateStr],
    queryFn: () =>
      fetchAvailableSlots({
        event_type_id: eventTypeId!,
        date_from: dateStr!,
        date_to: dateStr!,
        timezone: TIMEZONE,
      }),
    enabled: open && !!eventTypeId && !!dateStr,
  });

  const daySlots: DaySlots | undefined = slotsResponse?.slots?.find(
    (d) => d.date === dateStr
  );
  const slotOptions = daySlots?.slots ?? [];

  const createMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-appointments"] });
      toast.success("Agendamento criado.");
      setOpen(false);
      form.reset();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar agendamento.");
    },
  });

  function onSubmit(values: FormValues) {
    if (!selectedProfessional?.event_type_id) {
      toast.error("Configure a agenda do profissional antes de agendar.");
      return;
    }
    const startTime = `${format(values.date, "yyyy-MM-dd")}T${values.slot_time}:00`;
    createMutation.mutate({
      patient_id: values.patient_id,
      professional_id: values.professional_id,
      event_type_id: selectedProfessional.event_type_id,
      unit_id: values.unit_id || undefined,
      room_id: values.room_id || undefined,
      start_time: startTime,
      timezone: TIMEZONE,
      appointment_type: values.appointment_type,
      notes: values.notes || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 size-4" />
            Novo agendamento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo agendamento. O paciente precisa ter e-mail cadastrado.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o paciente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {patients.map((p: Patient) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} {p.email ? `(${p.email})` : ""}
                        </SelectItem>
                      ))}
                      {patients.length === 0 && (
                        <SelectItem value="__none" disabled>
                          Nenhum paciente cadastrado
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="professional_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissional</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("slot_time", "");
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {professionals.map((p: Professional) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} ({p.council} {p.registration_number}/{p.council_uf})
                        </SelectItem>
                      ))}
                      {professionals.length === 0 && (
                        <SelectItem value="__none" disabled>
                          Nenhum profissional cadastrado
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    O profissional precisa ter a agenda configurada (aba Agenda na ficha dele) para liberar data e horário.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {professionalId && !hasEventType && (
              <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                <AlertDescription>
                  Para liberar <strong>Data</strong> e <strong>Horário</strong>, configure a agenda deste profissional: abra a{" "}
                  <Link
                    href={`/dashboard/crm-saude/profissionais/${professionalId}`}
                    className="underline hover:no-underline font-medium"
                    onClick={() => setOpen(false)}
                  >
                    ficha do profissional
                  </Link>
                  {" "}→ aba <strong>Agenda</strong> → crie ou vincule um tipo de consulta.
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="unit_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade (opcional)</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v === "__none" ? "" : v);
                      form.setValue("room_id", "");
                    }}
                    value={field.value && field.value !== "__none" ? field.value : "__none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none">Nenhuma</SelectItem>
                      {(units as Unit[]).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="room_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sala (opcional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                    value={field.value && field.value !== "__none" ? field.value : "__none"}
                    disabled={!unitId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a sala" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none">Nenhuma</SelectItem>
                      {(rooms as Room[]).map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="appointment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de atendimento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(APPOINTMENT_TYPE_LABELS) as AppointmentType[]).map(
                        (t) => (
                          <SelectItem key={t} value={t}>
                            {APPOINTMENT_TYPE_LABELS[t]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!hasEventType}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? format(field.value, "PPP", { locale: ptBR })
                            : !professionalId
                              ? "Selecione o profissional"
                              : !hasEventType
                                ? "Configure a agenda do profissional"
                                : "Selecione a data"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(d) => {
                          field.onChange(d);
                          form.setValue("slot_time", "");
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slot_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!hasEventType || !dateStr || slotsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !professionalId
                            ? "Selecione o profissional"
                            : !hasEventType
                              ? "Configure a agenda do profissional"
                              : !dateStr
                                ? "Selecione a data"
                                : slotsLoading
                                  ? "Carregando horários..."
                                  : "Selecione o horário"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {slotOptions.map((s) => (
                        <SelectItem key={s.time} value={s.time}>
                          {s.time} ({s.duration_minutes} min)
                        </SelectItem>
                      ))}
                      {slotOptions.length === 0 && eventTypeId && dateStr && !slotsLoading && (
                        <SelectItem value="__none" disabled>
                          Nenhum horário disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações do agendamento"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !hasEventType}
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Agendar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
