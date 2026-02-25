import { describe, expect, it } from "vitest";

import {
  applyTextFilter,
  filterByTab,
  filterByFilters,
  type TabValue,
} from "./reservas-filters";
import type { Booking } from "@/types/calendar";
import {
  defaultFilterState,
  type FilterState,
} from "../_components/bookings-filter";

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b1",
    uid: "uid-1",
    eventTypeId: "et1",
    hostUserId: "user-1",
    hostAgentConfigId: null,
    guestName: "João Silva",
    guestEmail: "joao@example.com",
    guestNotes: null,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    durationMinutes: 30,
    timezone: "America/Sao_Paulo",
    status: "confirmed",
    cancellationReason: null,
    cancelledBy: null,
    meetingUrl: null,
    rescheduledFrom: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("applyTextFilter", () => {
  it("retorna true quando query está vazia (após trim)", () => {
    expect(applyTextFilter("João Silva", "  ", "contains")).toBe(true);
    expect(applyTextFilter("João", "", "equals")).toBe(true);
  });

  it("contains: campo contém a query (case insensitive)", () => {
    expect(applyTextFilter("João Silva", "joão", "contains")).toBe(true);
    expect(applyTextFilter("João Silva", "SILVA", "contains")).toBe(true);
    expect(applyTextFilter("João Silva", "x", "contains")).toBe(false);
  });

  it("equals: campo igual à query (case insensitive)", () => {
    expect(applyTextFilter("joão", "João", "equals")).toBe(true);
    expect(applyTextFilter("João", "joão silva", "equals")).toBe(false);
  });

  it("not_equals: campo diferente da query", () => {
    expect(applyTextFilter("João", "Maria", "not_equals")).toBe(true);
    expect(applyTextFilter("joão", "João", "not_equals")).toBe(false);
  });

  it("not_contains: campo não contém a query", () => {
    expect(applyTextFilter("João Silva", "Maria", "not_contains")).toBe(true);
    expect(applyTextFilter("João Silva", "Silva", "not_contains")).toBe(false);
  });
});

describe("filterByTab", () => {
  const now = new Date();
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  it("proximos: startTime >= now e status confirmed ou pending", () => {
    const list = [
      makeBooking({ startTime: future.toISOString(), status: "confirmed" }),
      makeBooking({ startTime: future.toISOString(), status: "pending" }),
      makeBooking({ startTime: past.toISOString(), status: "confirmed" }),
      makeBooking({ startTime: future.toISOString(), status: "cancelled" }),
    ];
    const result = filterByTab(list, "proximos");
    expect(result).toHaveLength(2);
    expect(result.every((b) => b.status === "confirmed" || b.status === "pending")).toBe(true);
    expect(result.every((b) => b.startTime >= now.toISOString())).toBe(true);
  });

  it("nao_confirmado: apenas status pending", () => {
    const list = [
      makeBooking({ status: "pending" }),
      makeBooking({ status: "confirmed" }),
    ];
    const result = filterByTab(list, "nao_confirmado");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("pending");
  });

  it("cancelado: apenas status cancelled", () => {
    const list = [
      makeBooking({ status: "cancelled" }),
      makeBooking({ status: "confirmed" }),
    ];
    const result = filterByTab(list, "cancelado");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("cancelled");
  });

  it("anteriores: startTime < now e status não cancelled", () => {
    const list = [
      makeBooking({ startTime: past.toISOString(), status: "confirmed" }),
      makeBooking({ startTime: past.toISOString(), status: "cancelled" }),
      makeBooking({ startTime: future.toISOString(), status: "confirmed" }),
    ];
    const result = filterByTab(list, "anteriores");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("confirmed");
    expect(result[0].startTime < now.toISOString()).toBe(true);
  });

  it("recorrente: mesmo critério que proximos", () => {
    const list = [
      makeBooking({ startTime: future.toISOString(), status: "confirmed" }),
      makeBooking({ startTime: past.toISOString(), status: "confirmed" }),
    ];
    const result = filterByTab(list, "recorrente");
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe(future.toISOString());
  });
});

describe("filterByFilters", () => {
  it("sem filtros preenchidos retorna a mesma lista", () => {
    const list = [
      makeBooking({ id: "1" }),
      makeBooking({ id: "2" }),
    ];
    const result = filterByFilters(list, defaultFilterState);
    expect(result).toHaveLength(2);
  });

  it("filtra por event_type", () => {
    const list = [
      makeBooking({ eventTypeId: "et1" }),
      makeBooking({ eventTypeId: "et2" }),
    ];
    const filters: FilterState = {
      ...defaultFilterState,
      event_type: ["et1"],
    };
    const result = filterByFilters(list, filters);
    expect(result).toHaveLength(1);
    expect(result[0].eventTypeId).toBe("et1");
  });

  it("filtra por participant_name (contains)", () => {
    const list = [
      makeBooking({ guestName: "João Silva" }),
      makeBooking({ guestName: "Maria Santos" }),
    ];
    const filters: FilterState = {
      ...defaultFilterState,
      participant_name: { operator: "contains", value: "Maria" },
    };
    const result = filterByFilters(list, filters);
    expect(result).toHaveLength(1);
    expect(result[0].guestName).toBe("Maria Santos");
  });

  it("filtra por participant_email (equals)", () => {
    const list = [
      makeBooking({ guestEmail: "joao@example.com" }),
      makeBooking({ guestEmail: "maria@example.com" }),
    ];
    const filters: FilterState = {
      ...defaultFilterState,
      participant_email: { operator: "equals", value: "joao@example.com" },
    };
    const result = filterByFilters(list, filters);
    expect(result).toHaveLength(1);
    expect(result[0].guestEmail).toBe("joao@example.com");
  });

  it("filtra por member (hostUserId)", () => {
    const list = [
      makeBooking({ hostUserId: "user-1" }),
      makeBooking({ hostUserId: "user-2" }),
    ];
    const filters: FilterState = {
      ...defaultFilterState,
      member: ["user-1"],
    };
    const result = filterByFilters(list, filters);
    expect(result).toHaveLength(1);
    expect(result[0].hostUserId).toBe("user-1");
  });

  it("filtra por booking_uid (contains)", () => {
    const list = [
      makeBooking({ uid: "abc-123-xyz" }),
      makeBooking({ uid: "def-456" }),
    ];
    const filters: FilterState = {
      ...defaultFilterState,
      booking_uid: { operator: "contains", value: "123" },
    };
    const result = filterByFilters(list, filters);
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe("abc-123-xyz");
  });

  it("filtra por date_range from", () => {
    const base = new Date("2026-06-15T10:00:00.000Z");
    const list = [
      makeBooking({ startTime: new Date("2026-06-10T10:00:00.000Z").toISOString() }),
      makeBooking({ startTime: new Date("2026-06-20T10:00:00.000Z").toISOString() }),
    ];
    const filters: FilterState = {
      ...defaultFilterState,
      date_range: { from: "2026-06-15", to: "" },
    };
    const result = filterByFilters(list, filters);
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe(new Date("2026-06-20T10:00:00.000Z").toISOString());
  });

  it("filtra por date_range to", () => {
    const list = [
      makeBooking({ startTime: "2026-06-10T10:00:00.000Z" }),
      makeBooking({ startTime: "2026-06-25T10:00:00.000Z" }),
    ];
    const filters: FilterState = {
      ...defaultFilterState,
      date_range: { from: "", to: "2026-06-20" },
    };
    const result = filterByFilters(list, filters);
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe("2026-06-10T10:00:00.000Z");
  });

  it("combina múltiplos filtros", () => {
    const list = [
      makeBooking({
        eventTypeId: "et1",
        guestName: "João",
        hostUserId: "user-1",
      }),
      makeBooking({
        eventTypeId: "et1",
        guestName: "Maria",
        hostUserId: "user-1",
      }),
      makeBooking({
        eventTypeId: "et2",
        guestName: "João",
        hostUserId: "user-1",
      }),
    ];
    const filters: FilterState = {
      ...defaultFilterState,
      event_type: ["et1"],
      participant_name: { operator: "contains", value: "João" },
      member: ["user-1"],
    };
    const result = filterByFilters(list, filters);
    expect(result).toHaveLength(1);
    expect(result[0].guestName).toBe("João");
    expect(result[0].eventTypeId).toBe("et1");
  });
});
