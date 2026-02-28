"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchProfessionals,
  fetchAvailableSlots,
  rescheduleAppointment,
} from "@/lib/api/crm";
import type { AppointmentListItem, DaySlots } from "@/types/crm";
import { Loader2 } from "lucide-react";

const TIMEZONE = "America/Sao_Paulo";

interface RescheduleAppointmentDialogProps {
  appointment: AppointmentListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RescheduleAppointmentDialog({
  appointment,
  open,
  onOpenChange,
  onSuccess,
}: RescheduleAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [slotTime, setSlotTime] = useState<string>("");

  const professionalId = appointment?.professional_id ?? null;
  const { data: professionalsData } = useQuery({
    queryKey: ["crm-professionals-list"],
    queryFn: () => fetchProfessionals({ limit: 200 }),
    enabled: open && !!professionalId,
  });
  const professional = professionalsData?.items?.find(
    (p: { id: string }) => p.id === professionalId
  );
  const eventTypeId = professional?.event_type_id ?? null;
  const dateStr = date ? format(date, "yyyy-MM-dd") : null;

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
    (d: { date: string }) => d.date === dateStr
  );
  const slotOptions = daySlots?.slots ?? [];

  const rescheduleMutation = useMutation({
    mutationFn: (body: { start_time: string; timezone: string }) =>
      rescheduleAppointment(appointment!.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["crm-appointment", appointment?.id] });
      toast.success("Agendamento remarcado.");
      onOpenChange(false);
      setDate(undefined);
      setSlotTime("");
      onSuccess?.();
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? "Erro ao remarcar.");
    },
  });

  const handleSubmit = () => {
    if (!date || !slotTime || !appointment) return;
    const startTime = `${format(date, "yyyy-MM-dd")}T${slotTime}:00`;
    rescheduleMutation.mutate({ start_time: startTime, timezone: TIMEZONE });
  };

  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remarcar agendamento</DialogTitle>
          <DialogDescription>
            Escolha a nova data e horário para {appointment.patient_name ?? appointment.patient_id}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!eventTypeId ? (
            <p className="text-muted-foreground text-sm">
              Profissional sem agenda configurada. Configure o tipo de evento na ficha do profissional.
            </p>
          ) : (
            <>
              <div>
                <p className="text-muted-foreground mb-2 text-sm">Nova data</p>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setSlotTime("");
                  }}
                  disabled={(d) => d < minDate}
                  locale={undefined}
                />
              </div>
              {date && (
                <div>
                  <p className="text-muted-foreground mb-2 text-sm">Horário</p>
                  {slotsLoading ? (
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  ) : slotOptions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum horário disponível neste dia.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slotOptions.map((s: { time: string }) => (
                        <Button
                          key={s.time}
                          type="button"
                          variant={slotTime === s.time ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSlotTime(s.time)}
                        >
                          {s.time}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!date || !slotTime || rescheduleMutation.isPending || !eventTypeId}
          >
            {rescheduleMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Remarcar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
