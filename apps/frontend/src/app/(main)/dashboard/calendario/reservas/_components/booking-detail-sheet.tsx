"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Flag,
  Info,
  Loader2,
  MapPin,
  MoreHorizontal,
  Send,
  User,
  UserPlus,
  UserX,
  Users,
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  addBookingAttendees,
  cancelBookingHost,
  markBookingNoShow,
  reportBooking,
  requestRescheduleBooking,
} from "@/lib/api/calendar";
import type { Booking } from "@/types/calendar";
import type { EventType, EventTypeLocation } from "@/types/calendar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  pending: "Pendente",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  completed: "Concluído",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  pending: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  no_show: "bg-destructive/10 text-destructive border-destructive/20",
  completed: "bg-muted text-muted-foreground border-border",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, icon: Icon, children }: { label: string; value?: string; icon?: React.ElementType; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {value && <p className="mt-0.5 text-sm font-medium leading-snug">{value}</p>}
        {children}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BookingDetailSheetProps {
  booking: Booking | null;
  eventTypes: EventType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  rescheduledByEmail: string;
  onAttendeesAdded?: (booking: Booking) => void;
  onBookingUpdated?: (booking: Booking) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const eventTitle = booking
    ? eventTypes.find((e) => e.id === booking.eventTypeId)?.title ?? `Reunião de ${booking.durationMinutes} min`
    : "";
  const dateStr = start
    ? format(start, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : "—";
  const timeStr =
    start && end
      ? `${format(start, "HH:mm")} – ${format(end, "HH:mm")} (${booking?.durationMinutes ?? 0} min)`
      : "—";

  const rescheduledFromStart = booking?.rescheduledFrom
    ? new Date(booking.rescheduledFrom)
    : null;

  const statusKey = booking?.rescheduledFrom ? "rescheduled" : (booking?.status ?? "");
  const statusLabel = booking?.rescheduledFrom
    ? "Reagendado"
    : STATUS_LABELS[booking?.status ?? ""] ?? booking?.status ?? "";
  const statusColor = booking?.rescheduledFrom
    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800"
    : STATUS_COLORS[booking?.status ?? ""] ?? "";

  const guestName = booking?.guestName ?? "Convidado";
  const initials = guestName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const isTerminal = booking?.status === "cancelled" || booking?.status === "no_show" || booking?.status === "completed";

  const locationLabel = booking
    ? getLocationLabel(eventTypes.find((e) => e.id === booking.eventTypeId)?.locations?.[0])
    : "—";

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md" aria-label="Detalhes da reserva">
        {booking && (
          <>
            {/* ── Header ── */}
            <div className="relative flex items-start gap-4 border-b bg-muted/30 px-6 py-5">
              {/* Avatar */}
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                {initials}
              </div>

              <div className="min-w-0 flex-1 pr-6">
                <h2 className="truncate text-base font-semibold leading-tight">
                  {guestName}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {eventTitle}
                </p>
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${statusColor}`}
                >
                  {statusLabel}
                </Badge>
              </div>

              {/* Options dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-12 top-5 size-8 shrink-0"
                    aria-label="Opções da reserva"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-semibold">
                    Editar evento
                  </DropdownMenuLabel>
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                {/* Date & time section */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Data e horário
                  </h3>
                  {rescheduledFromStart ? (
                    <InfoRow icon={CalendarClock} label="Reagendado de">
                      <p className="mt-0.5 text-sm text-muted-foreground line-through">
                        {format(rescheduledFromStart, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      <p className="mt-0.5 text-sm font-medium leading-snug">{dateStr}</p>
                    </InfoRow>
                  ) : (
                    <InfoRow icon={CalendarClock} label="Data" value={dateStr} />
                  )}
                  <InfoRow icon={Clock} label="Horário" value={timeStr} />
                </section>

                <Separator />

                {/* Participants section */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Participantes
                  </h3>
                  <InfoRow icon={User} label="Convidado" value={`${guestName} (${booking.guestEmail})`} />
                  <InfoRow icon={Users} label="Organizador" value="Você" />
                  {booking.attendees && booking.attendees.length > 0 && (
                    <InfoRow icon={UserPlus} label="Participantes adicionais">
                      <div className="mt-0.5 space-y-0.5">
                        {booking.attendees.map((a) => (
                          <p key={a.id} className="text-sm font-medium">{a.email}</p>
                        ))}
                      </div>
                    </InfoRow>
                  )}
                </section>

                <Separator />

                {/* Other info */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Outras informações
                  </h3>
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Evento</span>
                      <span className="font-medium">{eventTitle}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Local</span>
                      <span className="font-medium">{locationLabel}</span>
                    </div>
                    {booking.guestNotes && (
                      <div className="pt-1 border-t text-sm">
                        <span className="text-muted-foreground">Notas</span>
                        <p className="mt-1 font-medium italic">&ldquo;{booking.guestNotes}&rdquo;</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Meeting link */}
                {booking.meetingUrl && (
                  <>
                    <Separator />
                    <section className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Chamada
                      </h3>
                      <a
                        href={booking.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-2 text-sm font-medium"
                      >
                        <Video className="size-4" />
                        Junte-se à chamada
                      </a>
                    </section>
                  </>
                )}

                {/* Terminal status */}
                {isTerminal && (
                  <>
                    <Separator />
                    <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${statusColor}`}>
                      <XCircle className="size-4" />
                      {statusLabel}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Footer: actions ── */}
            {!isTerminal && (
              <div className="border-t bg-background px-6 py-4 space-y-2">
                {/* Primary actions */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={handleReagendarReserva}
                  >
                    <Clock className="mr-2 size-4" />
                    Reagendar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleOpenRequestReschedule}
                  >
                    <Send className="mr-2 size-4" />
                    Solicitar reagendamento
                  </Button>
                </div>

                {/* Danger action */}
                {booking.status !== "cancelled" && (
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => {
                      setCancelReason("");
                      setCancelEventOpen(true);
                    }}
                  >
                    <XCircle className="mr-2 size-4" />
                    Cancelar este evento
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </SheetContent>

      {/* ── Dialogs ── */}

      {/* Request reschedule */}
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

      {/* Edit location */}
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

      {/* Add participants */}
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

      {/* Report */}
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

      {/* Cancel event */}
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
