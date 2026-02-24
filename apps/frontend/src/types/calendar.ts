// Tipos do modulo de Calendario

export interface EventTypeLocation {
  id: string;
  location_type: "video" | "in_person" | "phone" | "custom_link";
  location_value: string | null;
  position: number;
}

export interface EventType {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  durationMinutes: number;
  isActive: boolean;
  color: string | null;
  requiresConfirmation: boolean;
  allowMultipleDurations: boolean;
  additionalDurations: number[] | null;
  locations: EventTypeLocation[];
  scheduleId: string | null;
  agentConfigId: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventTypeLimit {
  id: string;
  eventTypeId: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  slotIntervalMinutes: number | null;
  maxBookingsPerDay: number | null;
  limitToFirstSlot: boolean;
  maxDurationPerDayMinutes: number | null;
  maxFutureDays: number;
  frequencyLimit: { period: "week" | "month"; max: number } | null;
}

export interface ScheduleInterval {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface Schedule {
  id: string;
  name: string;
  timezone: string;
  isDefault: boolean;
  intervals: ScheduleInterval[];
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityOverride {
  id: string;
  overrideDate: string;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

export interface TimeSlot {
  time: string;
  durationMinutes: number;
}

export interface DaySlots {
  date: string;
  slots: TimeSlot[];
}

export interface AvailableSlotsData {
  eventType: EventType;
  timezone: string;
  days: DaySlots[];
}

export interface Booking {
  id: string;
  uid: string;
  eventTypeId: string;
  hostUserId: string | null;
  hostAgentConfigId: string | null;
  guestName: string;
  guestEmail: string;
  guestNotes: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  timezone: string;
  status:
    | "confirmed"
    | "pending"
    | "cancelled"
    | "completed"
    | "no_show";
  cancellationReason: string | null;
  cancelledBy: "host" | "guest" | "system" | null;
  meetingUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingPublic {
  uid: string;
  eventTitle: string;
  hostName: string;
  guestName: string;
  guestEmail: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  timezone: string;
  status: string;
  meetingUrl: string | null;
  cancelToken: string;
}

export interface PublicProfile {
  hostName: string;
  hostType: "user" | "agent";
  avatarUrl: string | null;
  bio: string | null;
  orgName: string;
  orgAvatarUrl: string | null;
  eventTypes: {
    slug: string;
    title: string;
    description: string | null;
    durationMinutes: number;
    locations: EventTypeLocation[];
  }[];
}

export interface CalendarInsights {
  totalBookings: number;
  cancellationRate: number;
  noShowRate: number;
  bookingsByEventType: {
    eventTypeId: string;
    title: string;
    count: number;
  }[];
  bookingsByWeekday: { day: number; count: number }[];
  topHours: { hour: number; count: number }[];
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
}

export interface WorkflowStep {
  id: string;
  triggerType: string;
  triggerOffsetMinutes: number | null;
  actionType: string;
  actionConfig: Record<string, unknown>;
  stepOrder: number;
  isActive: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  eventTypeId: string | null;
  isActive: boolean;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}
