/**
 * Funções puras de filtro da página de reservas.
 * Extraídas para permitir testes unitários.
 */
import type { Booking } from "@/types/calendar";
import type { FilterState, TextFilterOperator } from "../_components/bookings-filter";

export type TabValue =
  | "proximos"
  | "nao_confirmado"
  | "recorrente"
  | "anteriores"
  | "cancelado";

export function applyTextFilter(
  field: string,
  q: string,
  operator: TextFilterOperator
): boolean {
  const lower = field.toLowerCase();
  const qLower = q.trim().toLowerCase();
  if (!qLower) return true;
  switch (operator) {
    case "equals":
      return lower === qLower;
    case "contains":
      return lower.includes(qLower);
    case "not_equals":
      return lower !== qLower;
    case "not_contains":
      return !lower.includes(qLower);
    default:
      return lower.includes(qLower);
  }
}

export function filterByTab(bookings: Booking[], tab: TabValue): Booking[] {
  const now = new Date().toISOString();
  switch (tab) {
    case "proximos":
      return bookings.filter(
        (b) =>
          b.startTime >= now &&
          (b.status === "confirmed" || b.status === "pending")
      );
    case "nao_confirmado":
      return bookings.filter((b) => b.status === "pending");
    case "recorrente":
      return bookings.filter(
        (b) =>
          b.startTime >= now &&
          (b.status === "confirmed" || b.status === "pending")
      );
    case "anteriores":
      return bookings.filter(
        (b) => b.startTime < now && b.status !== "cancelled"
      );
    case "cancelado":
      return bookings.filter((b) => b.status === "cancelled");
    default:
      return bookings;
  }
}

export function filterByFilters(
  bookings: Booking[],
  filters: FilterState
): Booking[] {
  let result = bookings;

  if (filters.event_type.length > 0) {
    result = result.filter((b) =>
      filters.event_type.includes(b.eventTypeId)
    );
  }
  if (filters.participant_name.value.trim()) {
    result = result.filter((b) =>
      applyTextFilter(
        b.guestName,
        filters.participant_name.value,
        filters.participant_name.operator
      )
    );
  }
  if (filters.participant_email.value.trim()) {
    result = result.filter((b) =>
      applyTextFilter(
        b.guestEmail,
        filters.participant_email.value,
        filters.participant_email.operator
      )
    );
  }
  if (filters.booking_uid.value.trim()) {
    result = result.filter((b) =>
      applyTextFilter(
        b.uid,
        filters.booking_uid.value,
        filters.booking_uid.operator
      )
    );
  }
  if (filters.member.length > 0) {
    result = result.filter(
      (b) => b.hostUserId && filters.member.includes(b.hostUserId)
    );
  }
  if (filters.team.length > 0) {
    result = result.filter(
      (b) => b.hostUserId && filters.team.includes(b.hostUserId)
    );
  }
  if (filters.date_range.from) {
    const from = new Date(filters.date_range.from);
    from.setHours(0, 0, 0, 0);
    result = result.filter((b) => new Date(b.startTime) >= from);
  }
  if (filters.date_range.to) {
    const to = new Date(filters.date_range.to);
    to.setHours(23, 59, 59, 999);
    result = result.filter((b) => new Date(b.startTime) <= to);
  }

  return result;
}
