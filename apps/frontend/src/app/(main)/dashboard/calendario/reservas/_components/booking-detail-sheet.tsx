"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Clock,
  Flag,
  Info,
  MapPin,
  MoreHorizontal,
  Send,
  UserPlus,
  UserX,
  Video,
  VideoIcon,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addBookingAttendees,
  cancelBookingHost,
  markBookingNoShow,
  reportBooking,
  requestRescheduleBooking,
} from "@/lib/api/calendar";
import type { Booking } from "@/types/calendar";
import type { EventType, EventTypeLocation } from "@/types/calendar";

/** Rótulo do local para exibição (ex.: "Cal Video", "Pessoalmente (endereço do organizador)"). */
function getLocationLabel(loc: EventTypeLocation | undefined): string {
  if (!loc) return "Cal Video";
  switch (loc.location_type) {
    case "video":
      return loc.location_value?.toLowerCase().includes("meet") ? "Google Meet" : "Cal Video (Padrão)";
    case "in_person":
      return "Pessoalmente (endereço do organizador)";
    case "custom_link":
      return "Vincular reunião";
    case "phone":
      return "Telefone";
    default:
      return "Cal Video";
  }
}

/** Valor único para o select de local (video | video_google_meet | in_person | custom_link | phone). */
const LOCATION_OPTIONS: { group: string; value: string; label: string }[] = [
  { group: "Conferência", value: "video", label: "Cal Video (Padrão)" },
  { group: "Conferência", value: "video_google_meet", label: "Google Meet" },
  { group: "Presencial", value: "in_person", label: "Pessoalmente (endereço do organizador)" },
  { group: "Outras", value: "custom_link", label: "Vincular reunião" },
  { group: "Telefone", value: "phone", label: "Telefone" },
];

function getCurrentLocationValue(booking: Booking, eventTypes: EventType[]): string {
  const et = eventTypes.find((e) => e.id === booking.eventTypeId);
  const loc = et?.locations?.[0];
  if (!loc) return "video";
  if (loc.location_type === "video" && loc.location_value?.toLowerCase().includes("meet")) return "video_google_meet";
  return loc.location_type;
}

const EMAIL_REGEX = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;

const REPORT_REASONS = [
  { value: "spam", label: "Spam ou reserva indesejada" },
  { value: "unknown_person", label: "Não conheço esta pessoa" },
  { value: "other", label: "Outro" },
] as const;

interface BookingDetailSheetProps {
  booking: Booking | null;
  eventTypes: EventType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Slug da organização (para link de reagendamento). */
  orgSlug: string;
  /** E-mail de quem está reagendando (ex.: usuário logado). */
  rescheduledByEmail: string;
  /** Chamado após adicionar participantes (recebe a reserva atualizada). */
  onAttendeesAdded?: (booking: Booking) => void;
  /** Chamado quando a reserva é atualizada (ex.: marcada como não compareceu). */
  onBookingUpdated?: (booking: Booking) => void;
}

function getEventTitle(booking: Booking, eventTypes: EventType[]): string {
  const et = eventTypes.find((e) => e.id === booking.eventTypeId);
  if (et) return et.title;
  return `Reunião de ${booking.durationMinutes} min`;
}

export function BookingDetailSheet({
  booking,
  eventTypes,
  open,
  onOpenChange,
  orgSlug,
  rescheduledByEmail,
  onAttendeesAdded,
  onBookingUpdated,
}: BookingDetailSheetProps) {
  const router = useRouter();
  const [requestRescheduleOpen, setRequestRescheduleOpen] = useState(false);
  const [requestRescheduleReason, setRequestRescheduleReason] = useState("");
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [selectedLocationValue, setSelectedLocationValue] = useState<string>("video");
  const [addParticipantsOpen, setAddParticipantsOpen] = useState(false);
  const [emailFields, setEmailFields] = useState<string[]>([""]);
  const [isSubmittingAttendees, setIsSubmittingAttendees] = useState(false);
  const [isMarkingNoShow, setIsMarkingNoShow] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>("spam");
  const [reportDescription, setReportDescription] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [cancelEventOpen, setCancelEventOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const hasEventPassed =
    booking?.endTime != null && new Date(booking.endTime) <= new Date();

  const start = booking?.startTime ? new Date(booking.startTime) : null;
  const end = booking?.endTime ? new Date(booking.endTime) : null;
  const eventTitle = booking ? getEventTitle(booking, eventTypes) : "";
  const dateStr = start
    ? format(start, "EEE, d MMM", { locale: ptBR })
    : "-";
  const timeStr =
    start && end
      ? `${format(start, "HH:mm", { locale: ptBR })} - ${format(end, "HH:mm", { locale: ptBR })}`
      : "-";

  const rescheduledFromStart = booking?.rescheduledFrom
    ? new Date(booking.rescheduledFrom)
    : null;
  const rescheduledFromEnd = rescheduledFromStart
    ? new Date(
        rescheduledFromStart.getTime() + (booking?.durationMinutes ?? 0) * 60 * 1000
      )
    : null;
  const oldDateStr =
    rescheduledFromStart &&
    format(rescheduledFromStart, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const oldTimeStr =
    rescheduledFromStart &&
    rescheduledFromEnd &&
    `${format(rescheduledFromStart, "h:mma", { locale: ptBR })} - ${format(rescheduledFromEnd, "h:mma", { locale: ptBR })}`;
  const newDateStr =
    start && format(start, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const newTimeStr =
    start &&
    end &&
    `${format(start, "h:mma", { locale: ptBR })} - ${format(end, "h:mma", { locale: ptBR })}`;
  const timezoneLabel =
    booking?.timezone === "America/Sao_Paulo"
      ? "Horário Padrão de Brasília"
      : booking?.timezone?.replace(/_/g, " ") ?? "";

  const statusLabel = !booking
    ? ""
    : booking.rescheduledFrom
      ? "Reagendado"
      : booking.status === "confirmed"
        ? "Confirmado"
        : booking.status === "pending"
          ? "Pendente"
          : booking.status === "cancelled"
            ? "Cancelado"
            : booking.status === "no_show"
              ? "Não compareceu"
              : booking.status === "completed"
                ? "Concluído"
                : booking.status;

  function handleOpenRequestReschedule() {
    setRequestRescheduleReason("");
    setRequestRescheduleOpen(true);
  }

  async function handleSubmitRequestReschedule() {
    if (!booking) return;
    setIsSubmittingReschedule(true);
    try {
      const updated = await requestRescheduleBooking(
        booking.id,
        requestRescheduleReason.trim() || undefined
      );
      toast.success("Solicitação de reagendamento enviada. O convidado receberá um email.");
      setRequestRescheduleOpen(false);
      setRequestRescheduleReason("");
      onBookingUpdated?.(updated);
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível enviar a solicitação.");
    } finally {
      setIsSubmittingReschedule(false);
    }
  }

  function handleReagendarReserva() {
    if (!booking || !orgSlug) return;
    const eventType = eventTypes.find((e) => e.id === booking.eventTypeId);
    const eventSlug = eventType?.slug;
    const userSlug = eventType?.userId ?? booking.hostUserId;
    if (!eventSlug || !userSlug) return;
    const params = new URLSearchParams({
      rescheduleUid: booking.uid,
      rescheduledBy: rescheduledByEmail || "",
      overlayCalendar: "true",
    });
    const href = `/calendario/${encodeURIComponent(orgSlug)}/${encodeURIComponent(userSlug)}/${encodeURIComponent(eventSlug)}?${params.toString()}`;
    onOpenChange(false);
    router.push(href);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        title="Detalhes da reserva"
        className="flex w-full flex-col sm:max-w-md"
        aria-describedby={booking ? "booking-detail-sheet-desc" : undefined}
        role="dialog"
        aria-modal="true"
      >
        {booking && (
          <>
            <SheetHeader className="flex flex-row items-start justify-between gap-3 border-b pb-4 pr-1">
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-lg font-semibold">Detalhes da reserva</h2>
                <p id="booking-detail-sheet-desc" className="sr-only">
                  {dateStr}. Status: {statusLabel}. Use o menu de opções para reagendar, solicitar reagendamento ou cancelar.
                </p>
                <p className="text-muted-foreground text-sm">{dateStr}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge
                  variant={
                    booking.rescheduledFrom
                      ? "secondary"
                      : booking.status === "confirmed"
                        ? "default"
                        : booking.status === "cancelled"
                          ? "destructive"
                          : booking.status === "no_show"
                            ? "secondary"
                            : "secondary"
                  }
                  className={
                    booking.rescheduledFrom
                      ? "border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
                      : undefined
                  }
                >
                  {statusLabel}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-haspopup="true"
                      aria-expanded={undefined}
                      aria-label="Abrir menu de opções da reserva"
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                      <span className="sr-only">Opções</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-semibold">
                      Editar evento
                    </DropdownMenuLabel>
                    <DropdownMenuItem onSelect={handleReagendarReserva}>
                      <Clock className="mr-2 size-4" />
                      Reagendar reserva
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleOpenRequestReschedule}>
                      <Send className="mr-2 size-4" />
                      Solicitar reagendamento
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        if (booking) {
                          setSelectedLocationValue(getCurrentLocationValue(booking, eventTypes));
                          setEditLocationOpen(true);
                        }
                      }}
                    >
                      <MapPin className="mr-2 size-4" />
                      Editar Localização
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setEmailFields([""]);
                        setAddParticipantsOpen(true);
                      }}
                    >
                      <UserPlus className="mr-2 size-4" />
                      Participantes Adicionais
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="font-semibold">
                      Após o evento
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      disabled={!hasEventPassed}
                      className={!hasEventPassed ? "opacity-50" : undefined}
                      onSelect={() =>
                        hasEventPassed &&
                        toast.info("Gravações estarão disponíveis em breve.")
                      }
                    >
                      <VideoIcon className="mr-2 size-4" />
                      Ver gravações
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!hasEventPassed}
                      className={!hasEventPassed ? "opacity-50" : undefined}
                      onSelect={() =>
                        hasEventPassed &&
                        toast.info("Detalhes da sessão em breve.")
                      }
                    >
                      <Info className="mr-2 size-4" />
                      Ver detalhes da sessão
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={
                        !hasEventPassed ||
                        booking.status === "no_show" ||
                        booking.status === "cancelled" ||
                        isMarkingNoShow
                      }
                      className={
                        !hasEventPassed ? "opacity-50" : undefined
                      }
                      onSelect={async () => {
                        if (!hasEventPassed || !booking || booking.status === "no_show" || booking.status === "cancelled") return;
                        setIsMarkingNoShow(true);
                        try {
                          const updated = await markBookingNoShow(booking.id);
                          toast.success("Reserva marcada como não compareceu.");
                          onBookingUpdated?.(updated);
                        } catch {
                          toast.error(
                            "Não foi possível marcar como não compareceu."
                          );
                        } finally {
                          setIsMarkingNoShow(false);
                        }
                      }}
                    >
                      <UserX className="mr-2 size-4" />
                      {isMarkingNoShow
                        ? "Marcando..."
                        : "Marcar como não compareceu"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={booking.status === "cancelled"}
                      onSelect={() => {
                        if (booking.status === "cancelled") return;
                        setReportReason("spam");
                        setReportDescription("");
                        setReportOpen(true);
                      }}
                    >
                      <Flag className="mr-2 size-4" />
                      Reportar agendamento
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={booking.status === "cancelled"}
                      onSelect={() => {
                        if (booking.status === "cancelled") return;
                        setCancelReason("");
                        setCancelEventOpen(true);
                      }}
                    >
                      <XCircle className="mr-2 size-4" />
                      Cancelar este evento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label="Fechar painel"
                  >
                    <X className="size-4" />
                  </Button>
                </SheetClose>
              </div>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-auto p-4">
              <div>
                <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">
                  {booking.rescheduledFrom ? "Quando" : "Data e horário"}
                </p>
                {booking.rescheduledFrom && oldDateStr && oldTimeStr ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground line-through text-sm capitalize">
                      {oldDateStr}
                    </p>
                    <p className="text-muted-foreground line-through text-sm">
                      {oldTimeStr}
                      {timezoneLabel && ` (${timezoneLabel})`}
                    </p>
                    <p className="font-medium text-sm capitalize">
                      {newDateStr}
                    </p>
                    <p className="font-medium text-sm">
                      {newTimeStr}
                      {timezoneLabel && ` (${timezoneLabel})`}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="font-medium">{dateStr}</p>
                    <p className="text-muted-foreground text-sm">{timeStr}</p>
                  </>
                )}
              </div>

              <div>
                <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">
                  Evento
                </p>
                <p className="font-medium">
                  {eventTitle} entre Você e {booking.guestName}
                </p>
              </div>

              {booking.guestNotes && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">
                    Notas
                  </p>
                  <p className="text-muted-foreground text-sm italic">
                    &ldquo;{booking.guestNotes}&rdquo;
                  </p>
                </div>
              )}

              <div>
                <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">
                  Participantes
                </p>
                <p className="text-sm">Você e {booking.guestName}</p>
                <p className="text-muted-foreground text-sm">{booking.guestEmail}</p>
                {booking.attendees && booking.attendees.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-muted-foreground text-xs">Participantes adicionais:</p>
                    {booking.attendees.map((a) => (
                      <p key={a.id} className="text-muted-foreground text-sm">{a.email}</p>
                    ))}
                  </div>
                )}
              </div>

              {booking.meetingUrl && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">
                    Chamada
                  </p>
                  <a
                    href={booking.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-2 text-sm font-medium"
                  >
                    <Video className="size-4" />
                    Junte-se à chamada
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>

      <Dialog open={requestRescheduleOpen} onOpenChange={setRequestRescheduleOpen}>
        <DialogContent showCloseButton={true} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="size-5" />
              Solicitar reagendamento
            </DialogTitle>
            <DialogDescription>
              Isso cancelará a reunião agendada, notifique quem agendou e peça
              que escolha outro horário.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="request-reschedule-reason"
              className="text-sm font-medium"
            >
              Motivo da solicitação de reagendamento (opcional)
            </label>
            <Textarea
              id="request-reschedule-reason"
              placeholder="Descreva o motivo, se desejar..."
              value={requestRescheduleReason}
              onChange={(e) => setRequestRescheduleReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRequestRescheduleOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmitRequestReschedule}
              disabled={isSubmittingReschedule}
            >
              {isSubmittingReschedule
                ? "Enviando..."
                : "Solicitar reagendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editLocationOpen} onOpenChange={setEditLocationOpen}>
        <DialogContent showCloseButton={true} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="size-5" />
              Editar Localização
            </DialogTitle>
          </DialogHeader>
          {booking && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-muted-foreground mb-1 text-sm">Local atual:</p>
                <p className="font-medium text-sm">
                  {getLocationLabel(
                    eventTypes.find((e) => e.id === booking.eventTypeId)?.locations?.[0]
                  )}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground mb-2 block text-sm">
                  Novo local
                </label>
                <Select
                  value={selectedLocationValue}
                  onValueChange={setSelectedLocationValue}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o local" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Conferência", "Presencial", "Outras", "Telefone"].map(
                      (group) => (
                        <SelectGroup key={group}>
                          <SelectLabel>{group}</SelectLabel>
                          {LOCATION_OPTIONS.filter((o) => o.group === group).map(
                            (opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                              >
                                {opt.label}
                              </SelectItem>
                            )
                          )}
                        </SelectGroup>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditLocationOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                toast.success("Localização atualizada.");
setEditLocationOpen(false);
            }}
            >
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addParticipantsOpen} onOpenChange={setAddParticipantsOpen}>
        <DialogContent showCloseButton={true} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5" />
              Participantes Adicionais
            </DialogTitle>
            <DialogDescription>
              Adicione e-mails de participantes que também devem ser incluídos nesta reserva.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Adicionar e-mails</label>
            {emailFields.map((value, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={value}
                  onChange={(e) => {
                    const next = [...emailFields];
                    next[index] = e.target.value;
                    setEmailFields(next);
                  }}
                  className="flex-1"
                />
                {emailFields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label="Remover campo"
                    onClick={() =>
                      setEmailFields((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="w-fit justify-start gap-2 text-muted-foreground"
              onClick={() => setEmailFields((prev) => [...prev, ""])}
            >
              <UserPlus className="size-4" />
              Adicionar outro
            </Button>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddParticipantsOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSubmittingAttendees}
              onClick={async () => {
                if (!booking) return;
                const emails = emailFields
                  .map((e) => e.trim())
                  .filter(Boolean);
                if (emails.length === 0) {
                  toast.error("Informe ao menos um e-mail.");
                  return;
                }
                const invalid = emails.filter((e) => !EMAIL_REGEX.test(e));
                if (invalid.length > 0) {
                  toast.error(`E-mail inválido: ${invalid[0]}`);
                  return;
                }
                setIsSubmittingAttendees(true);
                try {
                  const updated = await addBookingAttendees(booking.id, emails);
                  toast.success("Participantes adicionados.");
                  setAddParticipantsOpen(false);
                  setEmailFields([""]);
                  onAttendeesAdded?.(updated);
                } catch {
                  toast.error("Não foi possível adicionar os participantes.");
                } finally {
                  setIsSubmittingAttendees(false);
                }
              }}
            >
              {isSubmittingAttendees ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent showCloseButton={true} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reportar agendamento</DialogTitle>
            <DialogDescription>
              Reportar esta reserva como suspeita. Isso nos ajuda a identificar e
              prevenir spam ou reservas indesejadas.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="report-reason" className="text-sm font-medium">
                Motivo <span className="text-destructive">*</span>
              </label>
              <Select
                value={reportReason}
                onValueChange={setReportReason}
              >
                <SelectTrigger id="report-reason" className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                htmlFor="report-description"
                className="text-sm font-medium"
              >
                Descrição (Opcional)
              </label>
              <Textarea
                id="report-description"
                placeholder="Por favor, forneça detalhes adicionais sobre o motivo pelo qual você está reportando esta reserva (opcional)"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={3}
                className="mt-1.5 resize-none"
              />
            </div>
            <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-800 dark:border-amber-600/50 dark:bg-amber-500/10 dark:text-amber-200 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Reportar este agendamento irá cancelá-lo automaticamente
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReportOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSubmittingReport}
              onClick={async () => {
                if (!booking) return;
                setIsSubmittingReport(true);
                try {
                  const updated = await reportBooking(booking.id, {
                    reason: reportReason,
                    description: reportDescription.trim() || undefined,
                  });
                  toast.success("Relatório enviado. A reserva foi cancelada.");
                  setReportOpen(false);
                  onBookingUpdated?.(updated);
                  onOpenChange(false);
                } catch {
                  toast.error("Não foi possível enviar o relatório.");
                } finally {
                  setIsSubmittingReport(false);
                }
              }}
            >
              {isSubmittingReport ? "Enviando..." : "Enviar relatório"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelEventOpen} onOpenChange={setCancelEventOpen}>
        <DialogContent showCloseButton={true} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar este evento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="cancel-reason"
                className="text-sm font-medium"
              >
                Motivo do cancelamento
              </label>
              <Textarea
                id="cancel-reason"
                placeholder="Por que você está cancelando?"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="mt-1.5 resize-none"
              />
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Info className="size-4 shrink-0" />
              O motivo do cancelamento será compartilhado com os convidados
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelEventOpen(false)}
            >
              Não importa
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSubmittingCancel}
              onClick={async () => {
                if (!booking) return;
                setIsSubmittingCancel(true);
                try {
                  const updated = await cancelBookingHost(
                    booking.id,
                    cancelReason.trim() || undefined
                  );
                  toast.success("Evento cancelado.");
                  setCancelEventOpen(false);
                  onBookingUpdated?.(updated);
                  onOpenChange(false);
                } catch {
                  toast.error("Não foi possível cancelar o evento.");
                } finally {
                  setIsSubmittingCancel(false);
                }
              }}
            >
              {isSubmittingCancel ? "Cancelando..." : "Cancelar este evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
