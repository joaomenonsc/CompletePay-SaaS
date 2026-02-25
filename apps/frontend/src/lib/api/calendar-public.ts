/**
 * Cliente da API publica de Calendario (sem autenticacao).
 * Usado nas paginas publicas de booking.
 * Mapeia respostas snake_case da API para camelCase dos tipos.
 */

import axios from "axios";

import { API_BASE_URL } from "@/lib/api-config";
import type {
  AvailableSlotsData,
  BookingPublic,
  EventType,
  EventTypeLocation,
  PublicProfile,
  TimeSlot,
} from "@/types/calendar";

const publicClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Respostas da API (snake_case)
interface ApiPublicProfile {
  host_name: string;
  host_type: string;
  avatar_url: string | null;
  bio: string | null;
  org_name: string;
  org_avatar_url: string | null;
  event_types: Array<{
    slug: string;
    title: string;
    description: string | null;
    duration_minutes: number;
    locations: Array<{
      id: string;
      location_type: string;
      location_value: string | null;
      position: number;
    }>;
  }>;
}

interface ApiAvailableSlots {
  event_type: Record<string, unknown>;
  timezone: string;
  days: Array<{
    date: string;
    slots: Array< { time: string; duration_minutes: number }>;
  }>;
}

interface ApiBookingPublic {
  uid: string;
  event_title: string;
  host_name: string;
  guest_name: string;
  guest_email: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  timezone: string;
  status: string;
  meeting_url: string | null;
  cancel_token: string;
}

function toEventTypeLocation(l: {
  id: string;
  location_type: string;
  location_value: string | null;
  position: number;
}): EventTypeLocation {
  return {
    id: l.id,
    location_type: l.location_type as EventTypeLocation["location_type"],
    location_value: l.location_value,
    position: l.position,
  };
}

/** Converte URL relativa do backend (ex: /uploads/avatars/xxx) em URL absoluta. */
function resolveAvatarUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url}`;
}

function toPublicProfile(r: ApiPublicProfile): PublicProfile {
  return {
    hostName: r.host_name,
    hostType: r.host_type as "user" | "agent",
    avatarUrl: resolveAvatarUrl(r.avatar_url),
    bio: r.bio,
    orgName: r.org_name,
    orgAvatarUrl: resolveAvatarUrl(r.org_avatar_url),
    eventTypes: r.event_types.map((et) => ({
      slug: et.slug,
      title: et.title,
      description: et.description,
      durationMinutes: et.duration_minutes,
      locations: et.locations.map(toEventTypeLocation),
    })),
  };
}

function toEventType(r: Record<string, unknown>): EventType {
  const locs = (r.locations as Array<Record<string, unknown>>) ?? [];
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    slug: r.slug as string,
    durationMinutes: (r.duration_minutes as number) ?? 30,
    isActive: (r.is_active as boolean) ?? true,
    color: (r.color as string) ?? null,
    requiresConfirmation: (r.requires_confirmation as boolean) ?? false,
    allowMultipleDurations: (r.allow_multiple_durations as boolean) ?? false,
    additionalDurations: (r.additional_durations as number[] | null) ?? null,
    locations: locs.map((l) => ({
      id: l.id as string,
      location_type: (l.location_type as string) as EventTypeLocation["location_type"],
      location_value: (l.location_value as string) ?? null,
      position: (l.position as number) ?? 0,
    })),
    scheduleId: (r.schedule_id as string) ?? null,
    agentConfigId: (r.agent_config_id as string) ?? null,
    userId: (r.user_id as string) ?? null,
    createdAt: (r.createdAt as string) ?? "",
    updatedAt: (r.updatedAt as string) ?? "",
  };
}

function toAvailableSlotsData(r: ApiAvailableSlots): AvailableSlotsData {
  return {
    eventType: toEventType(r.event_type as Record<string, unknown>),
    timezone: r.timezone,
    days: r.days.map((d) => ({
      date: d.date,
      slots: d.slots.map((s): TimeSlot => ({
        time: s.time,
        durationMinutes: s.duration_minutes,
      })),
    })),
  };
}

function toBookingPublic(r: ApiBookingPublic): BookingPublic {
  return {
    uid: r.uid,
    eventTitle: r.event_title,
    hostName: r.host_name,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    startTime: r.start_time,
    endTime: r.end_time,
    durationMinutes: r.duration_minutes,
    timezone: r.timezone,
    status: r.status,
    meetingUrl: r.meeting_url,
    cancelToken: r.cancel_token,
  };
}

export async function fetchPublicProfile(
  orgSlug: string,
  userSlug: string
): Promise<PublicProfile> {
  const { data } = await publicClient.get<ApiPublicProfile>(
    `/api/v1/public/calendar/${orgSlug}/${userSlug}/profile`
  );
  return toPublicProfile(data);
}

export async function fetchPublicSlots(
  orgSlug: string,
  eventSlug: string,
  month: string,
  timezone: string
): Promise<AvailableSlotsData> {
  const { data } = await publicClient.get<ApiAvailableSlots>(
    `/api/v1/public/calendar/${orgSlug}/${eventSlug}/slots`,
    { params: { month, timezone } }
  );
  return toAvailableSlotsData(data);
}

export async function createPublicBooking(body: {
  org_slug: string;
  event_type_slug: string;
  guest_name: string;
  guest_email: string;
  guest_notes?: string;
  start_time: string;
  timezone: string;
  duration_minutes?: number;
}): Promise<BookingPublic> {
  const { data } = await publicClient.post<ApiBookingPublic>(
    "/api/v1/public/calendar/bookings",
    body
  );
  return toBookingPublic(data);
}

export async function fetchPublicBookingByUid(uid: string): Promise<BookingPublic | null> {
  try {
    const { data } = await publicClient.get<ApiBookingPublic>(
      `/api/v1/public/calendar/bookings/${uid}`
    );
    return toBookingPublic(data);
  } catch {
    return null;
  }
}

export async function cancelPublicBooking(
  uid: string,
  cancelToken: string,
  reason?: string
): Promise<void> {
  await publicClient.post(
    `/api/v1/public/calendar/bookings/${uid}/cancel`,
    { cancel_token: cancelToken, reason }
  );
}

/** Reagenda uma reserva existente (atualiza a mesma reserva, não cria outra). */
export async function reschedulePublicBooking(
  uid: string,
  body: {
    cancel_token: string;
    new_start_time: string;
    timezone: string;
  }
): Promise<BookingPublic> {
  const { data } = await publicClient.post<ApiBookingPublic>(
    `/api/v1/public/calendar/bookings/${uid}/reschedule`,
    {
      cancel_token: body.cancel_token,
      new_start_time: body.new_start_time,
      timezone: body.timezone,
    }
  );
  return toBookingPublic(data);
}
