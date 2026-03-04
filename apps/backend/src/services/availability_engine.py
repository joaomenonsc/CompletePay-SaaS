"""
AvailabilityEngine: motor de calculo de slots disponiveis.
Todas as operacoes internas em UTC. Conversao para timezone do requester na saida.
"""
import logging
from datetime import date, datetime, time, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from cachetools import TTLCache
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from src.db.models_calendar import (
    AvailabilityOverride,
    AvailabilitySchedule,
    AvailabilityScheduleInterval,
    Booking,
    BookingStatus,
    EventType,
)

logger = logging.getLogger("completepay.calendar")

_schedule_cache: TTLCache = TTLCache(maxsize=500, ttl=300)


def _cache_key_schedule(schedule_id: str) -> str:
    return f"schedule:{schedule_id}"


class AvailabilityEngine:
    """Motor de calculo de slots disponiveis."""

    def __init__(self, db: Session):
        self.db = db

    def get_available_slots(
        self,
        event_type_id: str,
        date_from: date,
        date_to: date,
        requester_timezone: str = "America/Sao_Paulo",
    ) -> list[dict]:
        """
        Retorna slots disponiveis agrupados por dia.
        Retorno: [{"date": "2026-03-01", "slots": [{"time": "09:00", "duration_minutes": 30}]}]
        """
        tz = ZoneInfo(requester_timezone)
        utc = ZoneInfo("UTC")

        event_type = self.db.execute(
            select(EventType).where(EventType.id == event_type_id)
        ).scalars().one_or_none()

        if not event_type or not event_type.is_active:
            return []

        limits = event_type.limits
        duration = event_type.duration_minutes
        buffer_before = limits.buffer_before_minutes if limits else 0
        buffer_after = limits.buffer_after_minutes if limits else 0
        min_notice = limits.minimum_notice_minutes if limits else 60
        max_future = limits.max_future_days if limits else 60
        slot_interval = (
            limits.slot_interval_minutes
            if limits and limits.slot_interval_minutes
            else duration
        )
        max_per_day = limits.max_bookings_per_day if limits else None
        first_only = limits.limit_to_first_slot if limits else False
        max_dur_day = limits.max_duration_per_day_minutes if limits else None
        freq_limit = limits.frequency_limit if limits else None

        schedule = self._get_schedule(event_type)
        if not schedule:
            return []

        schedule_tz = ZoneInfo(schedule.timezone)

        now_utc = datetime.now(utc)
        now_local = now_utc.astimezone(tz)
        earliest = now_local + timedelta(minutes=min_notice)
        latest_date = now_local.date() + timedelta(days=max_future)

        effective_from = max(date_from, now_local.date())
        effective_to = min(date_to, latest_date)

        if effective_from > effective_to:
            return []

        intervals = self._get_intervals(schedule.id)
        overrides = self._get_overrides(schedule.id, effective_from, effective_to)
        overrides_map = {o.override_date: o for o in overrides}

        host_user_id = event_type.user_id
        host_agent_id = event_type.agent_config_id
        existing_bookings = self._get_bookings_in_range(
            event_type.organization_id,
            host_user_id,
            host_agent_id,
            effective_from,
            effective_to,
            tz,
        )

        daily_counts, daily_durations = self._compute_daily_stats(
            existing_bookings, tz
        )

        freq_exceeded = False
        if freq_limit:
            freq_exceeded = self._check_frequency_limit(
                existing_bookings, freq_limit, now_local.date()
            )

        if freq_exceeded:
            return []

        results = []
        current_date = effective_from
        while current_date <= effective_to:
            day_slots = self._compute_day_slots(
                current_date=current_date,
                intervals=intervals,
                overrides_map=overrides_map,
                existing_bookings=existing_bookings,
                schedule_tz=schedule_tz,
                requester_tz=tz,
                duration=duration,
                slot_interval=slot_interval,
                buffer_before=buffer_before,
                buffer_after=buffer_after,
                earliest=earliest,
                max_per_day=max_per_day,
                first_only=first_only,
                max_dur_day=max_dur_day,
                daily_counts=daily_counts,
                daily_durations=daily_durations,
            )

            if day_slots:
                results.append({
                    "date": current_date.isoformat(),
                    "slots": day_slots,
                })

            current_date += timedelta(days=1)

        return results

    def _get_schedule(
        self, event_type: EventType
    ) -> Optional[AvailabilitySchedule]:
        """Retorna o schedule vinculado ou o default do user/org."""
        if event_type.schedule_id:
            cache_key = _cache_key_schedule(event_type.schedule_id)
            cached = _schedule_cache.get(cache_key)
            if cached:
                return cached

            schedule = self.db.execute(
                select(AvailabilitySchedule).where(
                    AvailabilitySchedule.id == event_type.schedule_id
                )
            ).scalars().one_or_none()

            if schedule:
                _schedule_cache[cache_key] = schedule
            return schedule

        if event_type.user_id:
            schedule = self.db.execute(
                select(AvailabilitySchedule).where(
                    AvailabilitySchedule.organization_id
                    == event_type.organization_id,
                    AvailabilitySchedule.user_id == event_type.user_id,
                    AvailabilitySchedule.is_default.is_(True),
                )
            ).scalars().first()
            if schedule is not None:
                return schedule

        result = self.db.execute(
            select(AvailabilitySchedule).where(
                AvailabilitySchedule.organization_id
                == event_type.organization_id,
                AvailabilitySchedule.user_id.is_(None),
                AvailabilitySchedule.is_default.is_(True),
            )
        ).scalars().first()
        if result is not None:
            return result

        # Fallback: usar qualquer schedule da org (ex.: org sem default definido)
        fallback = self.db.execute(
            select(AvailabilitySchedule).where(
                AvailabilitySchedule.organization_id == event_type.organization_id,
            ).order_by(AvailabilitySchedule.created_at.asc()).limit(1)
        ).scalars().first()
        return fallback

    def _get_intervals(
        self, schedule_id: str
    ) -> list[AvailabilityScheduleInterval]:
        """Retorna intervalos do schedule."""
        rows = self.db.execute(
            select(AvailabilityScheduleInterval)
            .where(AvailabilityScheduleInterval.schedule_id == schedule_id)
            .order_by(
                AvailabilityScheduleInterval.day_of_week,
                AvailabilityScheduleInterval.start_time,
            )
        ).scalars().all()
        return list(rows)

    def _get_overrides(
        self,
        schedule_id: str,
        date_from: date,
        date_to: date,
    ) -> list[AvailabilityOverride]:
        """Retorna overrides no range."""
        rows = self.db.execute(
            select(AvailabilityOverride).where(
                AvailabilityOverride.schedule_id == schedule_id,
                AvailabilityOverride.override_date >= date_from,
                AvailabilityOverride.override_date <= date_to,
            )
        ).scalars().all()
        return list(rows)

    def _get_bookings_in_range(
        self,
        organization_id: str,
        host_user_id: Optional[str],
        host_agent_id: Optional[str],
        date_from: date,
        date_to: date,
        tz: ZoneInfo,
    ) -> list[Booking]:
        """Retorna bookings confirmados/pendentes que sobrepoem o range."""
        utc = ZoneInfo("UTC")
        range_start = datetime.combine(
            date_from - timedelta(days=1), time.min, tzinfo=tz
        ).astimezone(utc)
        range_end = datetime.combine(
            date_to + timedelta(days=1), time.max, tzinfo=tz
        ).astimezone(utc)

        conditions = [
            Booking.organization_id == organization_id,
            Booking.start_time < range_end,
            Booking.end_time > range_start,
            Booking.status.in_([BookingStatus.confirmed, BookingStatus.pending]),
        ]

        if host_user_id:
            conditions.append(Booking.host_user_id == host_user_id)
        elif host_agent_id:
            conditions.append(
                Booking.host_agent_config_id == host_agent_id
            )

        rows = self.db.execute(
            select(Booking).where(and_(*conditions))
        ).scalars().all()
        return list(rows)

    def _compute_daily_stats(
        self, bookings: list[Booking], tz: ZoneInfo
    ) -> tuple[dict[date, int], dict[date, int]]:
        """Pre-calcula contagem e duracao total por dia."""
        counts: dict[date, int] = {}
        durations: dict[date, int] = {}
        for b in bookings:
            d = b.start_time.astimezone(tz).date()
            counts[d] = counts.get(d, 0) + 1
            durations[d] = durations.get(d, 0) + b.duration_minutes
        return counts, durations

    def _check_frequency_limit(
        self,
        bookings: list[Booking],
        freq_limit: dict,
        ref_date: date,
    ) -> bool:
        """Verifica se o limite de frequencia foi excedido."""
        period = freq_limit.get("period", "week")
        max_count = freq_limit.get("max", 999)

        if period == "week":
            week_start = ref_date - timedelta(days=ref_date.weekday())
            week_end = week_start + timedelta(days=6)
            count = sum(
                1
                for b in bookings
                if week_start <= b.start_time.date() <= week_end
            )
        else:
            count = sum(
                1
                for b in bookings
                if b.start_time.date().month == ref_date.month
                and b.start_time.date().year == ref_date.year
            )

        return count >= max_count

    def _compute_day_slots(
        self,
        current_date: date,
        intervals: list[AvailabilityScheduleInterval],
        overrides_map: dict[date, AvailabilityOverride],
        existing_bookings: list[Booking],
        schedule_tz: ZoneInfo,
        requester_tz: ZoneInfo,
        duration: int,
        slot_interval: int,
        buffer_before: int,
        buffer_after: int,
        earliest: datetime,
        max_per_day: Optional[int],
        first_only: bool,
        max_dur_day: Optional[int],
        daily_counts: dict[date, int],
        daily_durations: dict[date, int],
    ) -> list[dict]:
        """Calcula slots disponiveis para um dia especifico."""
        utc = ZoneInfo("UTC")

        if max_per_day is not None:
            if daily_counts.get(current_date, 0) >= max_per_day:
                return []

        if max_dur_day is not None:
            if (
                daily_durations.get(current_date, 0) + duration
                > max_dur_day
            ):
                return []

        override = overrides_map.get(current_date)
        if override:
            if not override.is_available:
                return []
            if override.start_time and override.end_time:
                windows = [(override.start_time, override.end_time)]
            else:
                return []
        else:
            dow = current_date.weekday()
            day_intervals = [i for i in intervals if i.day_of_week == dow]
            if not day_intervals:
                return []
            windows = [(i.start_time, i.end_time) for i in day_intervals]

        candidates = []
        for window_start, window_end in windows:
            window_start_dt = datetime.combine(
                current_date, window_start, tzinfo=schedule_tz
            )
            window_end_dt = datetime.combine(
                current_date, window_end, tzinfo=schedule_tz
            )

            cursor = window_start_dt
            while cursor + timedelta(minutes=duration) <= window_end_dt:
                slot_start_utc = cursor.astimezone(utc)
                slot_end_utc = (
                    cursor + timedelta(minutes=duration)
                ).astimezone(utc)

                candidates.append((slot_start_utc, slot_end_utc))
                cursor += timedelta(minutes=slot_interval)

        available = []
        for slot_start, slot_end in candidates:
            if slot_start < earliest.astimezone(utc):
                continue

            slot_block_start = slot_start - timedelta(minutes=buffer_before)
            slot_block_end = slot_end + timedelta(minutes=buffer_after)

            conflict = False
            for b in existing_bookings:
                booking_start = b.start_time
                booking_end = b.end_time
                if (
                    slot_block_start < booking_end
                    and slot_block_end > booking_start
                ):
                    conflict = True
                    break

            if conflict:
                continue

            slot_local = slot_start.astimezone(requester_tz)
            available.append({
                "time": slot_local.strftime("%H:%M"),
                "duration_minutes": (slot_end - slot_start).seconds // 60,
            })

        if first_only and available:
            available = [available[0]]

        return available
