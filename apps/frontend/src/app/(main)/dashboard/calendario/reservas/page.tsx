"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown, Filter, List, MoreHorizontal } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMe } from "@/lib/api/auth";
import { fetchBookings, fetchEventTypes } from "@/lib/api/calendar";
import { fetchOrgMembers } from "@/lib/api/organizations";
import { useOrganizationStore } from "@/store/organization-store";
import { useCurrentOrg } from "@/app/(main)/dashboard/settings/_hooks/use-current-org";
import type { Booking } from "@/types/calendar";
import { BookingDetailSheet } from "./_components/booking-detail-sheet";
import { CalendarView } from "./_components/calendar-view";
import {
  BookingsFilter,
  defaultFilterState,
  type FilterKey,
  type FilterState,
} from "./_components/bookings-filter";
import {
  filterByTab,
  filterByFilters,
  type TabValue,
} from "./_utils/reservas-filters";

const TAB_LABELS: Record<
  TabValue,
  { title: string; description: string }
> = {
  proximos: {
    title: "Próximas reservas",
    description: "Confirmadas e pendentes nos próximos dias",
  },
  nao_confirmado: {
    title: "Não confirmadas",
    description: "Reservas aguardando confirmação",
  },
  recorrente: {
    title: "Recorrentes",
    description: "Reservas recorrentes confirmadas e pendentes",
  },
  anteriores: {
    title: "Reservas anteriores",
    description: "Confirmadas e concluídas no passado",
  },
  cancelado: {
    title: "Reservas canceladas",
    description: "Eventos cancelados",
  },
};

function SavedFiltersDropdown({
  onSelectDefault,
  onSelectMinhasReservas,
  currentUserId,
}: {
  onSelectDefault: () => void;
  onSelectMinhasReservas: () => void;
  currentUserId: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="Filtros salvos"
        >
          <Filter className="size-4" aria-hidden />
          Filtros salvos
          <ChevronDown
            className={`size-4 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" role="menu" aria-label="Filtros salvos">
        <DropdownMenuItem onSelect={onSelectDefault}>
          Padrão
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={currentUserId ? onSelectMinhasReservas : undefined}
          disabled={!currentUserId}
          className="flex items-center justify-between"
        >
          Minhas reservas
          <MoreHorizontal className="size-4 opacity-50" aria-hidden />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ReservasPage() {
  const [tab, setTab] = useState<TabValue>("proximos");
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterState);
  const [activeFilterKeys, setActiveFilterKeys] = useState<FilterKey[]>([]);
  const [popoverOpenKey, setPopoverOpenKey] = useState<FilterKey | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const currentOrganizationId = useOrganizationStore((s) => s.currentOrganizationId);
  const { orgSlug } = useCurrentOrg();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 60_000,
  });

  const { data: bookings = [], isLoading, error } = useQuery({
    queryKey: ["calendar-bookings"],
    queryFn: () => fetchBookings({ limit: 100 }),
  });

  const { data: eventTypes = [] } = useQuery({
    queryKey: ["event-types"],
    queryFn: fetchEventTypes,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["organizations", currentOrganizationId, "members"],
    queryFn: () => fetchOrgMembers(currentOrganizationId!),
    enabled: Boolean(currentOrganizationId),
  });

  const filteredBookings = useMemo(() => {
    const byTab = filterByTab(bookings, tab);
    return filterByFilters(byTab, filterState);
  }, [bookings, tab, filterState]);

  const handleAddFilter = useCallback((key: FilterKey) => {
    setActiveFilterKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  const handleRemoveFilter = useCallback((key: FilterKey) => {
    setActiveFilterKeys((prev) => prev.filter((k) => k !== key));
    setFilterState((prev) => {
      const next = { ...prev };
      if (key === "event_type") next.event_type = [];
      else if (key === "team") next.team = [];
      else if (key === "member") next.member = [];
      else if (key === "participant_name") next.participant_name = { operator: "contains", value: "" };
      else if (key === "participant_email") next.participant_email = { operator: "contains", value: "" };
      else if (key === "date_range") next.date_range = { from: "", to: "" };
      else if (key === "booking_uid") next.booking_uid = { operator: "contains", value: "" };
      return next;
    });
    setPopoverOpenKey(null);
  }, []);

  return (
    <main className="space-y-6" role="main" aria-label="Reservas">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reservas</h1>
          <p className="text-muted-foreground text-sm">
            {viewMode === "list"
              ? "Lista de agendamentos realizados."
              : "Visão de calendário dos agendamentos."}
          </p>
        </div>

        {/* Lista / Calendário toggle */}
        <div
          className="flex rounded-md border bg-muted/40 p-0.5 gap-0.5 shrink-0"
          role="group"
          aria-label="Modo de visualização"
        >
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "list"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <List className="size-4" aria-hidden />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            aria-pressed={viewMode === "calendar"}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "calendar"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <CalendarDays className="size-4" aria-hidden />
            Calendário
          </button>
        </div>
      </header>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          Erro ao carregar reservas.
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="w-full sm:w-auto" aria-label="Filtrar reservas por status">
            <TabsList className="bg-muted/50 h-9 w-full flex-wrap justify-start gap-1 sm:inline-flex sm:w-auto" role="tablist">
              <TabsTrigger value="proximos" className="flex-1 sm:flex-none">
                Próximos
              </TabsTrigger>
              <TabsTrigger value="nao_confirmado" className="flex-1 sm:flex-none">
                Não confirmado
              </TabsTrigger>
              <TabsTrigger value="recorrente" className="flex-1 sm:flex-none">
                Recorrente
              </TabsTrigger>
              <TabsTrigger value="anteriores" className="flex-1 sm:flex-none">
                Anteriores
              </TabsTrigger>
              <TabsTrigger value="cancelado" className="flex-1 sm:flex-none">
                Cancelado
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <BookingsFilter
            filterState={filterState}
            onFilterChange={setFilterState}
            activeFilterKeys={activeFilterKeys}
            onAddFilter={handleAddFilter}
            onRemoveFilter={handleRemoveFilter}
            eventTypes={eventTypes}
            members={members}
            popoverOpenKey={popoverOpenKey}
            onPopoverOpenChange={setPopoverOpenKey}
          />
        </div>
        <SavedFiltersDropdown
          currentUserId={me?.user_id}
          onSelectDefault={() => {
            setFilterState(defaultFilterState);
            setActiveFilterKeys([]);
            setPopoverOpenKey(null);
          }}
          onSelectMinhasReservas={() => {
            if (!me?.user_id) return;
            setFilterState({ ...defaultFilterState, member: [me.user_id] });
            setActiveFilterKeys(["member"]);
            setPopoverOpenKey(null);
          }}
        />
      </div>

      {/* ── Calendar view ── */}
      {viewMode === "calendar" && (
        <CalendarView
          bookings={filteredBookings}
          eventTypes={eventTypes}
          onBookingClick={setSelectedBooking}
        />
      )}

      {/* ── List view ── */}
      {viewMode === "list" && (
        isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : filteredBookings.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle id="reservas-list-title" className="flex items-center gap-2">
                <CalendarDays className="size-5" aria-hidden />
                {TAB_LABELS[tab].title}
              </CardTitle>
              <CardDescription id="reservas-list-desc">
                {TAB_LABELS[tab].description}
                {activeFilterKeys.length > 0 && " (com filtros aplicados)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul
                className="divide-y"
                aria-labelledby="reservas-list-title"
                aria-describedby="reservas-list-desc"
                aria-label={`${filteredBookings.length} reserva(s)`}
              >
                {filteredBookings.map((b) => {
                  const dateTimeStr = b.startTime
                    ? format(new Date(b.startTime), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : "Data não definida";
                  const statusText =
                    b.rescheduledFrom
                      ? "Reagendado"
                      : b.status === "confirmed"
                        ? "Confirmado"
                        : b.status === "pending"
                          ? "Pendente"
                          : b.status === "cancelled"
                            ? "Cancelado"
                            : b.status === "no_show"
                              ? "Não compareceu"
                              : b.status === "completed"
                                ? "Concluído"
                                : b.status;
                  return (
                    <li
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Reserva de ${b.guestName}, ${dateTimeStr}, ${statusText}. Pressione Enter ou Espaço para ver detalhes`}
                      onClick={() => setSelectedBooking(b)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedBooking(b);
                        }
                      }}
                      className="hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-ring flex cursor-pointer items-center justify-between rounded-lg px-3 py-3 transition-colors first:pt-3 focus-visible:outline focus-visible:outline-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{b.guestName}</p>
                        <p className="text-muted-foreground text-sm">{b.guestEmail}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {b.startTime
                            ? format(new Date(b.startTime), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "-"}
                        </p>
                      </div>
                      <Badge
                        variant={
                          b.rescheduledFrom
                            ? "secondary"
                            : b.status === "confirmed"
                              ? "default"
                              : b.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                        }
                        className={
                          b.rescheduledFrom
                            ? "border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
                            : undefined
                        }
                      >
                        {b.rescheduledFrom
                          ? "Reagendado"
                          : b.status === "confirmed"
                            ? "Confirmado"
                            : b.status === "pending"
                              ? "Pendente"
                              : b.status === "cancelled"
                                ? "Cancelado"
                                : b.status === "no_show"
                                  ? "Não compareceu"
                                  : b.status === "completed"
                                    ? "Concluído"
                                    : b.status}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <Card aria-live="polite" aria-atomic="true">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarDays className="text-muted-foreground mb-4 size-12" aria-hidden />
              <p className="text-muted-foreground text-sm">
                {bookings.length === 0
                  ? "Nenhuma reserva ainda."
                  : "Nenhuma reserva encontrada para esta aba e filtros."}
              </p>
            </CardContent>
          </Card>
        )
      )}

      <BookingDetailSheet
        booking={selectedBooking}
        eventTypes={eventTypes}
        open={!!selectedBooking}
        onOpenChange={(open) => !open && setSelectedBooking(null)}
        orgSlug={orgSlug ?? ""}
        rescheduledByEmail={me?.email ?? ""}
        onAttendeesAdded={setSelectedBooking}
        onBookingUpdated={setSelectedBooking}
      />
    </main>
  );
}
