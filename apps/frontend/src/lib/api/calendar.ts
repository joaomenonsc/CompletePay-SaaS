/**
 * Cliente da API de Calendario (endpoints autenticados).
 * Segue o mesmo padrao de agents.ts.
 */

import apiClient from "@/lib/api/client";
import type {
  Booking,
  CalendarInsights,
  EventType,
  EventTypeLimit,
  Schedule,
  Webhook,
  Workflow,
} from "@/types/calendar";

interface EventTypeApiResponse {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  duration_minutes: number;
  is_active: boolean;
  color: string | null;
  requires_confirmation: boolean;
  allow_multiple_durations: boolean;
  additional_durations: number[] | null;
  locations: Array<{
    id: string;
    location_type: string;
    location_value: string | null;
    position: number;
  }>;
  schedule_id: string | null;
  agent_config_id: string | null;
  user_id: string | null;
  createdAt: string;
  updatedAt: string;
}

function toEventType(r: EventTypeApiResponse): EventType {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    slug: r.slug,
    durationMinutes: r.duration_minutes,
    isActive: r.is_active,
    color: r.color,
    requiresConfirmation: r.requires_confirmation,
    allowMultipleDurations: r.allow_multiple_durations,
    additionalDurations: r.additional_durations,
    locations: r.locations.map((l) => ({
      id: l.id,
      location_type: l.location_type as EventType["locations"][0]["location_type"],
      location_value: l.location_value,
      position: l.position,
    })),
    scheduleId: r.schedule_id,
    agentConfigId: r.agent_config_id,
    userId: r.user_id,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function fetchEventTypes(): Promise<EventType[]> {
  const { data } = await apiClient.get<EventTypeApiResponse[]>(
    "/api/v1/calendar/event-types"
  );
  return (data ?? []).map(toEventType);
}

export async function fetchEventType(id: string): Promise<EventType | null> {
  const { data } = await apiClient.get<EventTypeApiResponse>(
    `/api/v1/calendar/event-types/${id}`
  );
  return data ? toEventType(data) : null;
}

export async function createEventType(body: {
  title: string;
  slug: string;
  duration_minutes: number;
  description?: string;
  locations?: Array<{
    location_type: string;
    location_value?: string;
  }>;
}): Promise<EventType> {
  const { data } = await apiClient.post<EventTypeApiResponse>(
    "/api/v1/calendar/event-types",
    body
  );
  return toEventType(data);
}

export async function updateEventType(
  id: string,
  body: Record<string, unknown>
): Promise<EventType> {
  const { data } = await apiClient.patch<EventTypeApiResponse>(
    `/api/v1/calendar/event-types/${id}`,
    body
  );
  return toEventType(data);
}

export async function toggleEventType(
  id: string
): Promise<{ id: string; is_active: boolean }> {
  const { data } = await apiClient.patch<{ id: string; is_active: boolean }>(
    `/api/v1/calendar/event-types/${id}/toggle`
  );
  return data;
}

export async function deleteEventType(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/calendar/event-types/${id}`);
}

interface EventTypeLimitApiResponse {
  id: string;
  event_type_id: string;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  minimum_notice_minutes: number;
  slot_interval_minutes: number | null;
  max_bookings_per_day: number | null;
  limit_to_first_slot: boolean;
  max_duration_per_day_minutes: number | null;
  max_future_days: number;
  frequency_limit: { period: string; max: number } | null;
}

function toEventTypeLimit(r: EventTypeLimitApiResponse): EventTypeLimit {
  return {
    id: r.id,
    eventTypeId: r.event_type_id,
    bufferBeforeMinutes: r.buffer_before_minutes,
    bufferAfterMinutes: r.buffer_after_minutes,
    minimumNoticeMinutes: r.minimum_notice_minutes,
    slotIntervalMinutes: r.slot_interval_minutes ?? null,
    maxBookingsPerDay: r.max_bookings_per_day ?? null,
    limitToFirstSlot: r.limit_to_first_slot,
    maxDurationPerDayMinutes: r.max_duration_per_day_minutes ?? null,
    maxFutureDays: r.max_future_days,
    frequencyLimit:
      r.frequency_limit != null
        ? {
            period: r.frequency_limit.period as "week" | "month",
            max: r.frequency_limit.max,
          }
        : null,
  };
}

export async function fetchEventTypeLimits(
  eventTypeId: string
): Promise<EventTypeLimit | null> {
  try {
    const { data } = await apiClient.get<EventTypeLimitApiResponse>(
      `/api/v1/calendar/event-types/${eventTypeId}/limits`
    );
    return data ? toEventTypeLimit(data) : null;
  } catch {
    return null;
  }
}

export async function upsertEventTypeLimits(
  eventTypeId: string,
  body: {
    buffer_before_minutes?: number;
    buffer_after_minutes?: number;
    minimum_notice_minutes?: number;
    slot_interval_minutes?: number | null;
    max_bookings_per_day?: number | null;
    limit_to_first_slot?: boolean;
    max_duration_per_day_minutes?: number | null;
    max_future_days?: number;
    frequency_limit?: { period: "week" | "month"; max: number } | null;
  }
): Promise<EventTypeLimit> {
  const { data } = await apiClient.put<EventTypeLimitApiResponse>(
    `/api/v1/calendar/event-types/${eventTypeId}/limits`,
    body
  );
  return toEventTypeLimit(data);
}

interface ScheduleApiResponse {
  id: string;
  name: string;
  timezone: string;
  is_default: boolean;
  intervals: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

function toSchedule(r: ScheduleApiResponse): Schedule {
  return {
    id: r.id,
    name: r.name,
    timezone: r.timezone,
    isDefault: r.is_default,
    intervals: (r.intervals ?? []).map((i) => ({
      id: i.id,
      dayOfWeek: i.day_of_week,
      startTime: i.start_time,
      endTime: i.end_time,
    })),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function fetchSchedules(): Promise<Schedule[]> {
  const { data } = await apiClient.get<ScheduleApiResponse[]>(
    "/api/v1/calendar/schedules"
  );
  return (data ?? []).map(toSchedule);
}

export async function createSchedule(body: {
  name: string;
  timezone?: string;
  intervals?: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
}): Promise<Schedule> {
  const { data } = await apiClient.post<ScheduleApiResponse>(
    "/api/v1/calendar/schedules",
    body
  );
  return toSchedule(data);
}

interface BookingAttendeeApiResponse {
  id: string;
  booking_id: string;
  name: string;
  email: string;
  is_optional: boolean;
}

interface BookingApiResponse {
  id: string;
  uid: string;
  event_type_id: string;
  host_user_id: string | null;
  host_agent_config_id: string | null;
  guest_name: string;
  guest_email: string;
  guest_notes?: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  timezone: string;
  status: string;
  cancellation_reason?: string | null;
  cancelled_by?: string | null;
  meeting_url?: string | null;
  rescheduled_from?: string | null;
  attendees?: BookingAttendeeApiResponse[];
  createdAt: string;
  updatedAt: string;
}

function toBooking(r: BookingApiResponse): Booking {
  return {
    id: r.id,
    uid: r.uid,
    eventTypeId: r.event_type_id,
    hostUserId: r.host_user_id ?? null,
    hostAgentConfigId: r.host_agent_config_id ?? null,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    guestNotes: r.guest_notes ?? null,
    startTime: r.start_time,
    endTime: r.end_time,
    durationMinutes: r.duration_minutes,
    timezone: r.timezone,
    status: r.status as Booking["status"],
    cancellationReason: r.cancellation_reason ?? null,
    cancelledBy: (r.cancelled_by as Booking["cancelledBy"]) ?? null,
    meetingUrl: r.meeting_url ?? null,
    rescheduledFrom: r.rescheduled_from ?? null,
    attendees: (r.attendees ?? []).map((a) => ({
      id: a.id,
      booking_id: a.booking_id,
      name: a.name,
      email: a.email,
      is_optional: a.is_optional,
    })),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function fetchBookings(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<Booking[]> {
  const { data } = await apiClient.get<BookingApiResponse[]>(
    "/api/v1/calendar/bookings",
    { params }
  );
  return (data ?? []).map(toBooking);
}

export async function fetchBooking(id: string): Promise<Booking | null> {
  const { data } = await apiClient.get<BookingApiResponse>(
    `/api/v1/calendar/bookings/${id}`
  );
  return data ? toBooking(data) : null;
}

export async function cancelBookingHost(
  id: string,
  reason?: string
): Promise<Booking> {
  const { data } = await apiClient.patch<BookingApiResponse>(
    `/api/v1/calendar/bookings/${id}/cancel`,
    { reason }
  );
  return toBooking(data);
}

export async function rescheduleBookingHost(
  id: string,
  body: { new_start_time: string; timezone: string }
): Promise<Booking> {
  const { data } = await apiClient.patch<BookingApiResponse>(
    `/api/v1/calendar/bookings/${id}/reschedule`,
    body
  );
  return toBooking(data);
}

export async function addBookingAttendees(
  bookingId: string,
  emails: string[]
): Promise<Booking> {
  const { data } = await apiClient.post<BookingApiResponse>(
    `/api/v1/calendar/bookings/${bookingId}/attendees`,
    { emails }
  );
  return toBooking(data);
}

export async function markBookingNoShow(bookingId: string): Promise<Booking> {
  const { data } = await apiClient.patch<BookingApiResponse>(
    `/api/v1/calendar/bookings/${bookingId}/mark-no-show`
  );
  return toBooking(data);
}

export async function reportBooking(
  bookingId: string,
  body: { reason: string; description?: string | null }
): Promise<Booking> {
  const { data } = await apiClient.post<BookingApiResponse>(
    `/api/v1/calendar/bookings/${bookingId}/report`,
    body
  );
  return toBooking(data);
}

export async function requestRescheduleBooking(
  bookingId: string,
  reason?: string | null
): Promise<Booking> {
  const { data } = await apiClient.post<BookingApiResponse>(
    `/api/v1/calendar/bookings/${bookingId}/request-reschedule`,
    { reason: reason || undefined }
  );
  return toBooking(data);
}

export async function fetchInsights(): Promise<CalendarInsights> {
  const { data } = await apiClient.get<{
    total_bookings: number;
    cancellation_rate: number;
    no_show_rate: number;
    bookings_by_event_type: { event_type_id: string; title: string; count: number }[];
    bookings_by_weekday: { day: number; count: number }[];
    top_hours: { hour: number; count: number }[];
  }>("/api/v1/calendar/insights");
  if (!data) throw new Error("No insights");
  return {
    totalBookings: data.total_bookings,
    cancellationRate: data.cancellation_rate,
    noShowRate: data.no_show_rate,
    bookingsByEventType: data.bookings_by_event_type.map((x) => ({
      eventTypeId: x.event_type_id,
      title: x.title,
      count: x.count,
    })),
    bookingsByWeekday: data.bookings_by_weekday,
    topHours: data.top_hours,
  };
}

interface WebhookApiResponse {
  id: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  createdAt: string;
}

function toWebhook(r: WebhookApiResponse): Webhook {
  return {
    id: r.id,
    url: r.url,
    events: r.events,
    secret: r.secret,
    isActive: r.is_active,
    createdAt: r.createdAt,
  };
}

export async function fetchWebhooks(eventTypeId: string): Promise<Webhook[]> {
  const { data } = await apiClient.get<WebhookApiResponse[]>(
    `/api/v1/calendar/event-types/${eventTypeId}/webhooks`
  );
  return (data ?? []).map(toWebhook);
}

export async function createWebhook(
  eventTypeId: string,
  body: { url: string; events: string[]; is_active?: boolean }
): Promise<Webhook> {
  const { data } = await apiClient.post<WebhookApiResponse>(
    `/api/v1/calendar/event-types/${eventTypeId}/webhooks`,
    body
  );
  return toWebhook(data);
}

export async function deleteWebhook(
  eventTypeId: string,
  webhookId: string
): Promise<void> {
  await apiClient.delete(
    `/api/v1/calendar/event-types/${eventTypeId}/webhooks/${webhookId}`
  );
}

function toWorkflow(r: {
  id: string;
  name: string;
  event_type_id: string | null;
  is_active: boolean;
  steps: Array<{
    id: string;
    trigger_type: string;
    trigger_offset_minutes: number | null;
    action_type: string;
    action_config: Record<string, unknown>;
    step_order: number;
    is_active: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}): Workflow {
  return {
    id: r.id,
    name: r.name,
    eventTypeId: r.event_type_id ?? null,
    isActive: r.is_active,
    steps: (r.steps ?? []).map((s) => ({
      id: s.id,
      triggerType: s.trigger_type,
      triggerOffsetMinutes: s.trigger_offset_minutes,
      actionType: s.action_type,
      actionConfig: s.action_config,
      stepOrder: s.step_order,
      isActive: s.is_active,
    })),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function fetchWorkflows(eventTypeId?: string): Promise<Workflow[]> {
  const { data } = await apiClient.get<Parameters<typeof toWorkflow>[0][]>(
    "/api/v1/calendar/workflows",
    { params: eventTypeId ? { event_type_id: eventTypeId } : {} }
  );
  return (data ?? []).map(toWorkflow);
}

export async function createWorkflow(body: {
  name: string;
  event_type_id?: string;
  is_active?: boolean;
  steps?: Array<{
    trigger_type: string;
    trigger_offset_minutes?: number;
    action_type: string;
    action_config: Record<string, unknown>;
    step_order?: number;
    is_active?: boolean;
  }>;
}): Promise<Workflow> {
  const { data } = await apiClient.post<Parameters<typeof toWorkflow>[0]>(
    "/api/v1/calendar/workflows",
    body
  );
  return toWorkflow(data);
}

export async function updateWorkflow(
  id: string,
  body: Partial<{ name: string; event_type_id: string; is_active: boolean; steps: Parameters<typeof createWorkflow>[0]["steps"] }>
): Promise<Workflow> {
  const { data } = await apiClient.patch<Parameters<typeof toWorkflow>[0]>(
    `/api/v1/calendar/workflows/${id}`,
    body
  );
  return toWorkflow(data);
}

export async function deleteWorkflow(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/calendar/workflows/${id}`);
}

export async function fetchSchedule(id: string): Promise<Schedule | null> {
  const { data } = await apiClient.get<ScheduleApiResponse | null>(
    `/api/v1/calendar/schedules/${id}`
  );
  return data ? toSchedule(data) : null;
}

export async function updateSchedule(
  id: string,
  body: {
    name?: string;
    timezone?: string;
    intervals?: Array<{ day_of_week: number; start_time: string; end_time: string }>;
  }
): Promise<Schedule> {
  const { data } = await apiClient.patch<ScheduleApiResponse>(
    `/api/v1/calendar/schedules/${id}`,
    body
  );
  return toSchedule(data);
}
