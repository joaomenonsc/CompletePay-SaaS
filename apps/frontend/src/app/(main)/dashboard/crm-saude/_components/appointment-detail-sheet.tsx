"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  createEncounter,
  fetchAppointment,
  fetchAppointmentReminder,
  fetchRooms,
  fetchUnit,
  updateAppointmentStatus,
} from "@/lib/api/crm";
import type { AppointmentListItem } from "@/types/crm";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Pencil,
  Stethoscope,
  User,
  UserCog,
  XCircle,
} from "lucide-react";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_atendimento: "Em atendimento",
  atendido: "Atendido",
  no_show: "Não compareceu",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  agendado: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  confirmado: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  em_atendimento: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  atendido: "bg-muted text-muted-foreground border-border",
  no_show: "bg-destructive/10 text-destructive border-destructive/20",
  cancelado: "bg-destructive/10 text-destructive border-destructive/20",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium leading-snug">{value}</p>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AppointmentDetailSheetProps {
  appointmentId: string | null;
  appointmentListItem: AppointmentListItem | null;
  onClose: () => void;
  onRemarcar?: (appointment: AppointmentListItem) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AppointmentDetailSheet({
  appointmentId,
  appointmentListItem,
  onClose,
  onRemarcar,
}: AppointmentDetailSheetProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);

  const open = !!appointmentId;

  const { data: appointment, isLoading } = useQuery({
    queryKey: ["crm-appointment", appointmentId],
    queryFn: () => fetchAppointment(appointmentId!),
    enabled: open && !!appointmentId,
  });

  const updateStatus = useMutation({
    mutationFn: (body: { status: string; cancellation_reason?: string | null }) =>
      updateAppointmentStatus(appointmentId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["crm-appointments-wide"] });
      queryClient.invalidateQueries({ queryKey: ["crm-appointment", appointmentId] });
      toast.success("Status atualizado.");
      setShowCancelDialog(false);
      setCancelReason("");
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? "Erro ao atualizar status.");
    },
  });

  const startEncounterMutation = useMutation({
    mutationFn: () =>
      createEncounter({
        appointment_id: item!.id,
        patient_id: item!.patient_id,
        professional_id: item!.professional_id,
        unit_id: item?.unit_id ?? undefined,
      }),
    onSuccess: (encounter) => {
      queryClient.invalidateQueries({ queryKey: ["crm-encounters"] });
      onClose();
      router.push(`/dashboard/crm-saude/atendimentos/${encounter.id}`);
      toast.success("Atendimento iniciado.");
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? "Erro ao iniciar atendimento.");
    },
  });

  const item = appointment ?? appointmentListItem;
  const listItem = appointmentListItem ?? (item as AppointmentListItem | null);
  const status = (item?.status ?? "").toLowerCase();

  // ── Resolve unit and room names ──────────────────────────────────────────────
  const { data: unitData } = useQuery({
    queryKey: ["crm-unit", item?.unit_id],
    queryFn: () => fetchUnit(item!.unit_id!),
    enabled: open && !!item?.unit_id,
    staleTime: 300_000,
  });

  const { data: roomsData } = useQuery({
    queryKey: ["crm-rooms", item?.unit_id],
    queryFn: () => fetchRooms(item!.unit_id!),
    enabled: open && !!item?.unit_id && !!item?.room_id,
    staleTime: 300_000,
  });

  const unitName = unitData?.name ?? null;
  const roomName = roomsData?.find((r) => r.id === item?.room_id)?.name ?? null;

  const canConfirm = status === "agendado";
  const canCancel = status === "agendado" || status === "confirmado";
  const canRemarcar = status === "agendado" || status === "confirmado";
  const canNoShow = status === "confirmado";
  const canEmAtendimento = status === "confirmado";
  const canAtendido = status === "em_atendimento";
  const isTerminal = status === "atendido" || status === "cancelado" || status === "no_show";

  const patientName = listItem?.patient_name ?? item?.patient_id ?? "Paciente";
  const professionalName = listItem?.professional_name ?? item?.professional_id ?? "Profissional";
  const initials = patientName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const durationMinutes = item
    ? differenceInMinutes(new Date(item.end_time), new Date(item.start_time))
    : null;

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }
    updateStatus.mutate({ status: "cancelado", cancellation_reason: cancelReason.trim() });
  };

  const handleEnviarLembrete = async () => {
    if (!appointmentId) return;
    setReminderLoading(true);
    try {
      const { whatsapp_link } = await fetchAppointmentReminder(appointmentId);
      if (whatsapp_link) window.open(whatsapp_link, "_blank");
      else toast.error("Paciente sem telefone cadastrado para WhatsApp.");
    } catch {
      toast.error("Erro ao gerar link de lembrete.");
    } finally {
      setReminderLoading(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md" aria-label="Detalhes do agendamento">
          {/* ── Header ── */}
          <div className="relative flex items-start gap-4 border-b bg-muted/30 px-6 py-5">
            {/* Avatar */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
              {isLoading && !item ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                initials
              )}
            </div>

            <div className="min-w-0 flex-1 pr-6">
              <h2 className="truncate text-base font-semibold leading-tight">
                {isLoading && !item ? "Carregando..." : patientName}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                {item?.appointment_type ?? "—"}
              </p>
              {item && (
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${STATUS_COLORS[status] ?? ""}`}
                >
                  {STATUS_LABELS[status] ?? status}
                </Badge>
              )}
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {isLoading && !item ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : !item ? (
              <p className="text-sm text-muted-foreground">Não encontrado.</p>
            ) : (
              <div className="space-y-5">
                {/* Date & time section */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Data e horário
                  </h3>
                  <InfoRow
                    icon={CalendarClock}
                    label="Data"
                    value={format(new Date(item.start_time), "EEEE, d 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  />
                  <InfoRow
                    icon={Clock}
                    label="Horário"
                    value={`${format(new Date(item.start_time), "HH:mm")} – ${format(
                      new Date(item.end_time),
                      "HH:mm"
                    )}${durationMinutes ? ` (${durationMinutes} min)` : ""}`}
                  />
                </section>

                <Separator />

                {/* Participants section */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Participantes
                  </h3>
                  <InfoRow icon={User} label="Paciente" value={patientName} />
                  <InfoRow icon={UserCog} label="Profissional" value={professionalName} />
                </section>

                <Separator />

                {/* Other info */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Outras informações
                  </h3>
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tipo</span>
                      <span className="font-medium capitalize">{item.appointment_type}</span>
                    </div>
                    {unitName && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Unidade</span>
                        <span className="font-medium">{unitName}</span>
                      </div>
                    )}
                    {roomName && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sala</span>
                        <span className="font-medium">{roomName}</span>
                      </div>
                    )}
                    {(item as { notes?: string }).notes && (
                      <div className="pt-1 border-t text-sm">
                        <span className="text-muted-foreground">Observações</span>
                        <p className="mt-1 font-medium">{(item as { notes?: string }).notes}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Status badge for terminal states */}
                {isTerminal && (
                  <>
                    <Separator />
                    <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${STATUS_COLORS[status] ?? ""}`}>
                      {status === "atendido" ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <XCircle className="size-4" />
                      )}
                      {STATUS_LABELS[status] ?? status}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Footer: actions ── */}
          {item && !isTerminal && (
            <div className="border-t bg-background px-6 py-4 space-y-2">
              {/* Primary action */}
              {status === "em_atendimento" && (
                <Button
                  className="w-full"
                  onClick={() => startEncounterMutation.mutate()}
                  disabled={startEncounterMutation.isPending}
                >
                  {startEncounterMutation.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Stethoscope className="mr-2 size-4" />
                  )}
                  Abrir ficha de atendimento
                </Button>
              )}
              {canConfirm && (
                <Button
                  className="w-full"
                  onClick={() => updateStatus.mutate({ status: "confirmado" })}
                  disabled={updateStatus.isPending}
                >
                  {updateStatus.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 size-4" />
                  )}
                  Confirmar agendamento
                </Button>
              )}
              {canEmAtendimento && (
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => updateStatus.mutate({ status: "em_atendimento" })}
                  disabled={updateStatus.isPending}
                >
                  <Stethoscope className="mr-2 size-4" />
                  Iniciar atendimento
                </Button>
              )}
              {canAtendido && (
                <Button
                  className="w-full"
                  onClick={() => updateStatus.mutate({ status: "atendido" })}
                  disabled={updateStatus.isPending}
                >
                  <CheckCircle2 className="mr-2 size-4" />
                  Marcar como atendido
                </Button>
              )}

              {/* Secondary actions */}
              <div className="flex gap-2">
                {status !== "cancelado" && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleEnviarLembrete}
                    disabled={reminderLoading}
                  >
                    {reminderLoading ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <MessageCircle className="mr-2 size-4" />
                    )}
                    WhatsApp
                  </Button>
                )}
                {canRemarcar && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onRemarcar && item ? onRemarcar(item) : onClose()}
                  >
                    <Pencil className="mr-2 size-4" />
                    Remarcar
                  </Button>
                )}
                {canNoShow && (
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => updateStatus.mutate({ status: "no_show" })}
                    disabled={updateStatus.isPending}
                  >
                    Não compareceu
                  </Button>
                )}
              </div>

              {/* Danger action */}
              {canCancel && (
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <XCircle className="mr-2 size-4" />
                  Cancelar agendamento
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Cancel dialog ── */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Motivo do cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo para registrar no histórico do paciente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Ex.: Paciente desistiu, profissional indisponível..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="mt-2"
            onKeyDown={(e) => e.key === "Enter" && handleCancel()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? "Cancelando..." : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
