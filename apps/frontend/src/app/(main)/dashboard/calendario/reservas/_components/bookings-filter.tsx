"use client";

import { useCallback, useState } from "react";
import { ChevronDown, Filter, Layers, Mail, CalendarRange, Hash, User, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import type { EventType } from "@/types/calendar";
import type { OrgMember } from "@/lib/api/organizations";

export type TextFilterOperator = "equals" | "contains" | "not_equals" | "not_contains";

export type FilterKey =
  | "event_type"
  | "team"
  | "member"
  | "participant_name"
  | "participant_email"
  | "date_range"
  | "booking_uid";

export interface FilterState {
  event_type: string[];
  team: string[];
  member: string[];
  participant_name: { operator: TextFilterOperator; value: string };
  participant_email: { operator: TextFilterOperator; value: string };
  date_range: { from: string; to: string };
  booking_uid: { operator: TextFilterOperator; value: string };
}

const FILTER_LABELS: Record<FilterKey, string> = {
  event_type: "Tipo do Evento",
  team: "Equipe",
  member: "Membro",
  participant_name: "Nome do Participante",
  participant_email: "E-mail do Participante",
  date_range: "Intervalo de Datas",
  booking_uid: "UID da Reserva",
};

const FILTER_ICONS: Record<FilterKey, React.ComponentType<{ className?: string }>> = {
  event_type: Layers,
  team: Users,
  member: User,
  participant_name: User,
  participant_email: Mail,
  date_range: CalendarRange,
  booking_uid: Hash,
};

const TEXT_OPERATORS: { value: TextFilterOperator; label: string }[] = [
  { value: "equals", label: "É" },
  { value: "contains", label: "Contém" },
  { value: "not_equals", label: "Não é" },
  { value: "not_contains", label: "Não contém" },
];

const defaultFilterState: FilterState = {
  event_type: [],
  team: [],
  member: [],
  participant_name: { operator: "contains", value: "" },
  participant_email: { operator: "contains", value: "" },
  date_range: { from: "", to: "" },
  booking_uid: { operator: "contains", value: "" },
};

interface BookingsFilterProps {
  filterState: FilterState;
  onFilterChange: (state: FilterState) => void;
  activeFilterKeys: FilterKey[];
  onAddFilter: (key: FilterKey) => void;
  onRemoveFilter: (key: FilterKey) => void;
  eventTypes: EventType[];
  members: OrgMember[];
  popoverOpenKey: FilterKey | null;
  onPopoverOpenChange: (key: FilterKey | null) => void;
}

export function BookingsFilter({
  filterState,
  onFilterChange,
  activeFilterKeys,
  onAddFilter,
  onRemoveFilter,
  eventTypes,
  members,
  popoverOpenKey,
  onPopoverOpenChange,
}: BookingsFilterProps) {
  const [filterSearch, setFilterSearch] = useState("");
  const [eventTypeSearch, setEventTypeSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");

  const filterOptions = (Object.keys(FILTER_LABELS) as FilterKey[]).filter(
    (key) => !activeFilterKeys.includes(key) && FILTER_LABELS[key].toLowerCase().includes(filterSearch.toLowerCase())
  );

  const updateFilter = useCallback(
    (key: FilterKey, value: FilterState[FilterKey]) => {
      onFilterChange({ ...filterState, [key]: value });
    },
    [filterState, onFilterChange]
  );

  const clearFilterValue = useCallback(
    (key: FilterKey) => {
      const next = { ...filterState };
      if (key === "event_type") next.event_type = [];
      else if (key === "team") next.team = [];
      else if (key === "member") next.member = [];
      else if (key === "participant_name") next.participant_name = { operator: "contains", value: "" };
      else if (key === "participant_email") next.participant_email = { operator: "contains", value: "" };
      else if (key === "date_range") next.date_range = { from: "", to: "" };
      else if (key === "booking_uid") next.booking_uid = { operator: "contains", value: "" };
      onFilterChange(next);
    },
    [filterState, onFilterChange]
  );

  const membersFiltered = memberSearch.trim()
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
          m.email.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : members;
  const teamFiltered = teamSearch.trim()
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
          m.email.toLowerCase().includes(teamSearch.toLowerCase())
      )
    : members;

  const eventTypesFiltered = eventTypeSearch
    ? eventTypes.filter((et) => et.title.toLowerCase().includes(eventTypeSearch.toLowerCase()))
    : eventTypes;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu onOpenChange={(open) => !open && setFilterSearch("")}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            aria-haspopup="true"
            aria-label={activeFilterKeys.length > 0 ? `Filtrar reservas (${activeFilterKeys.length} filtro(s) ativo(s))` : "Abrir menu de filtros de reservas"}
          >
            <Filter className="size-4" aria-hidden />
            Filtrar
            {activeFilterKeys.length > 0 && (
              <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-xs font-medium">
                {activeFilterKeys.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56" role="menu" aria-label="Opções de filtro">
          <div className="p-2">
            <Input
              placeholder="Procurar"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="h-8"
              aria-label="Procurar tipo de filtro"
            />
          </div>
          {filterOptions.map((key) => {
            const Icon = FILTER_ICONS[key];
            return (
              <DropdownMenuItem
                key={key}
                onSelect={(e) => {
                  e.preventDefault();
                  onAddFilter(key);
                }}
              >
                {Icon && <Icon className="size-4" />}
                {FILTER_LABELS[key]}
              </DropdownMenuItem>
            );
          })}
          {filterOptions.length === 0 && (
            <div className="text-muted-foreground px-2 py-4 text-center text-sm">
              {filterSearch ? "Nenhuma opção encontrada" : "Todos os filtros já adicionados"}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeFilterKeys.map((key) => {
        const Icon = FILTER_ICONS[key];
        const label = FILTER_LABELS[key];

        const isOpen = popoverOpenKey === key;

        return (
          <Popover
            key={key}
            open={isOpen}
            onOpenChange={(open) => onPopoverOpenChange(open ? key : null)}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 font-normal"
                onClick={(e) => e.stopPropagation()}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={`Filtro ${label}. ${isOpen ? "Aberto" : "Fechado"}. Pressione Enter para ${isOpen ? "fechar" : "abrir"}`}
              >
                {Icon && <Icon className="size-4" aria-hidden />}
                {label}
                <ChevronDown className="size-4 opacity-50" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
              {(key === "event_type" || key === "member" || key === "team") && (
                <div className="border-b p-2">
                  <Input
                    placeholder="Procurar"
                    value={
                      key === "event_type"
                        ? eventTypeSearch
                        : key === "member"
                          ? memberSearch
                          : teamSearch
                    }
                    onChange={(e) => {
                      if (key === "event_type") setEventTypeSearch(e.target.value);
                      else if (key === "member") setMemberSearch(e.target.value);
                      else setTeamSearch(e.target.value);
                    }}
                    className="h-8"
                  />
                </div>
              )}
              <div className="max-h-64 overflow-auto p-2">
                {key === "event_type" && (
                  <div className="space-y-2">
                    {eventTypesFiltered.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhum tipo de evento</p>
                    ) : (
                      eventTypesFiltered.map((et) => (
                        <label
                          key={et.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={filterState.event_type.includes(et.id)}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...filterState.event_type, et.id]
                                : filterState.event_type.filter((id) => id !== et.id);
                              updateFilter("event_type", next);
                            }}
                          />
                          <span className="text-sm">{et.title}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
                {(key === "participant_name" || key === "participant_email" || key === "booking_uid") && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-muted-foreground mb-1.5 block text-xs">Operador</label>
                      <NativeSelect
                        size="sm"
                        value={
                          key === "participant_name"
                            ? filterState.participant_name.operator
                            : key === "participant_email"
                              ? filterState.participant_email.operator
                              : filterState.booking_uid.operator
                        }
                        onChange={(e) => {
                          const op = e.target.value as TextFilterOperator;
                          if (key === "participant_name") updateFilter("participant_name", { ...filterState.participant_name, operator: op });
                          else if (key === "participant_email") updateFilter("participant_email", { ...filterState.participant_email, operator: op });
                          else updateFilter("booking_uid", { ...filterState.booking_uid, operator: op });
                        }}
                        className="h-9 w-full"
                      >
                        {TEXT_OPERATORS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div>
                      <Input
                        placeholder={
                          key === "participant_name"
                            ? "Nome do participante"
                            : key === "participant_email"
                              ? "E-mail do participante"
                              : "UID da reserva"
                        }
                        value={
                          key === "participant_name"
                            ? filterState.participant_name.value
                            : key === "participant_email"
                              ? filterState.participant_email.value
                              : filterState.booking_uid.value
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          if (key === "participant_name") updateFilter("participant_name", { ...filterState.participant_name, value });
                          else if (key === "participant_email") updateFilter("participant_email", { ...filterState.participant_email, value });
                          else updateFilter("booking_uid", { ...filterState.booking_uid, value });
                        }}
                        className="h-9"
                      />
                    </div>
                  </div>
                )}
                {key === "date_range" && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-muted-foreground mb-1 block text-xs">De</label>
                      <Input
                        type="date"
                        value={filterState.date_range.from}
                        onChange={(e) =>
                          updateFilter("date_range", {
                            ...filterState.date_range,
                            from: e.target.value,
                          })
                        }
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground mb-1 block text-xs">Até</label>
                      <Input
                        type="date"
                        value={filterState.date_range.to}
                        onChange={(e) =>
                          updateFilter("date_range", {
                            ...filterState.date_range,
                            to: e.target.value,
                          })
                        }
                        className="h-9"
                      />
                    </div>
                  </div>
                )}
                {key === "member" && (
                  <div className="space-y-2">
                    {membersFiltered.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhum membro encontrado</p>
                    ) : (
                      membersFiltered.map((m) => (
                        <label
                          key={m.userId}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={filterState.member.includes(m.userId)}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...filterState.member, m.userId]
                                : filterState.member.filter((id) => id !== m.userId);
                              updateFilter("member", next);
                            }}
                          />
                          <span className="text-sm">{m.name || m.email}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
                {key === "team" && (
                  <div className="space-y-2">
                    {teamFiltered.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhum membro encontrado</p>
                    ) : (
                      teamFiltered.map((m) => (
                        <label
                          key={m.userId}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={filterState.team.includes(m.userId)}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...filterState.team, m.userId]
                                : filterState.team.filter((id) => id !== m.userId);
                              updateFilter("team", next);
                            }}
                          />
                          <span className="text-sm">{m.name || m.email}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="border-t flex justify-end gap-2 p-2">
                <Button variant="ghost" size="sm" onClick={() => onRemoveFilter(key)}>
                  Remover filtro
                </Button>
                <Button variant="outline" size="sm" onClick={() => clearFilterValue(key)}>
                  Limpar
                </Button>
                {(key === "participant_name" ||
                  key === "participant_email" ||
                  key === "booking_uid" ||
                  key === "date_range") && (
                  <Button
                    size="sm"
                    onClick={() => onPopoverOpenChange(null)}
                  >
                    Aplicar
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}

export { defaultFilterState, FILTER_LABELS };
