"""Testes unitários do availability_engine (módulo Calendário)."""
from datetime import date, datetime, time
from unittest.mock import MagicMock
from zoneinfo import ZoneInfo

import pytest

from src.services.availability_engine import AvailabilityEngine


def _make_booking_mock(start_utc: datetime, duration_minutes: int = 30):
    b = MagicMock()
    b.start_time = start_utc
    b.end_time = start_utc.replace(tzinfo=start_utc.tzinfo) if start_utc.tzinfo else start_utc
    b.duration_minutes = duration_minutes
    return b


def _make_interval_mock(day_of_week: int, start: time, end: time):
    i = MagicMock()
    i.day_of_week = day_of_week
    i.start_time = start
    i.end_time = end
    return i


# ---------------------------------------------------------------------------
# _compute_daily_stats
# ---------------------------------------------------------------------------

class TestComputeDailyStats:
    def test_empty_bookings_returns_empty_dicts(self):
        engine = AvailabilityEngine(MagicMock())
        tz = ZoneInfo("America/Sao_Paulo")

        counts, durations = engine._compute_daily_stats([], tz)

        assert counts == {}
        assert durations == {}

    def test_counts_and_durations_per_day(self):
        engine = AvailabilityEngine(MagicMock())
        tz = ZoneInfo("America/Sao_Paulo")
        utc = ZoneInfo("UTC")
        d1 = date(2026, 3, 15)
        d2 = date(2026, 3, 16)
        b1 = _make_booking_mock(datetime(2026, 3, 15, 14, 0, 0, tzinfo=utc), 30)
        b2 = _make_booking_mock(datetime(2026, 3, 15, 15, 0, 0, tzinfo=utc), 60)
        b3 = _make_booking_mock(datetime(2026, 3, 16, 10, 0, 0, tzinfo=utc), 45)

        counts, durations = engine._compute_daily_stats([b1, b2, b3], tz)

        assert counts[d1] == 2
        assert counts[d2] == 1
        assert durations[d1] == 30 + 60
        assert durations[d2] == 45


# ---------------------------------------------------------------------------
# _check_frequency_limit
# ---------------------------------------------------------------------------

class TestCheckFrequencyLimit:
    def test_week_under_limit_returns_false(self):
        engine = AvailabilityEngine(MagicMock())
        utc = ZoneInfo("UTC")
        # Segunda 16/03/2026
        ref = date(2026, 3, 16)
        bookings = [
            _make_booking_mock(datetime(2026, 3, 16, 10, 0, 0, tzinfo=utc)),
            _make_booking_mock(datetime(2026, 3, 17, 10, 0, 0, tzinfo=utc)),
        ]
        freq_limit = {"period": "week", "max": 3}

        result = engine._check_frequency_limit(bookings, freq_limit, ref)

        assert result is False

    def test_week_at_or_above_limit_returns_true(self):
        engine = AvailabilityEngine(MagicMock())
        utc = ZoneInfo("UTC")
        ref = date(2026, 3, 16)
        bookings = [
            _make_booking_mock(datetime(2026, 3, 16, 10, 0, 0, tzinfo=utc)),
            _make_booking_mock(datetime(2026, 3, 17, 10, 0, 0, tzinfo=utc)),
            _make_booking_mock(datetime(2026, 3, 18, 10, 0, 0, tzinfo=utc)),
        ]
        freq_limit = {"period": "week", "max": 3}

        result = engine._check_frequency_limit(bookings, freq_limit, ref)

        assert result is True

    def test_month_under_limit_returns_false(self):
        engine = AvailabilityEngine(MagicMock())
        utc = ZoneInfo("UTC")
        ref = date(2026, 3, 15)
        bookings = [
            _make_booking_mock(datetime(2026, 3, 1, 10, 0, 0, tzinfo=utc)),
            _make_booking_mock(datetime(2026, 3, 10, 10, 0, 0, tzinfo=utc)),
        ]
        freq_limit = {"period": "month", "max": 5}

        result = engine._check_frequency_limit(bookings, freq_limit, ref)

        assert result is False

    def test_month_at_limit_returns_true(self):
        engine = AvailabilityEngine(MagicMock())
        utc = ZoneInfo("UTC")
        ref = date(2026, 3, 15)
        bookings = [
            _make_booking_mock(datetime(2026, 3, 1, 10, 0, 0, tzinfo=utc)),
            _make_booking_mock(datetime(2026, 3, 10, 10, 0, 0, tzinfo=utc)),
            _make_booking_mock(datetime(2026, 3, 20, 10, 0, 0, tzinfo=utc)),
        ]
        freq_limit = {"period": "month", "max": 3}

        result = engine._check_frequency_limit(bookings, freq_limit, ref)

        assert result is True

    def test_default_period_is_week(self):
        engine = AvailabilityEngine(MagicMock())
        utc = ZoneInfo("UTC")
        ref = date(2026, 3, 16)
        bookings = [
            _make_booking_mock(datetime(2026, 3, 16, 10, 0, 0, tzinfo=utc)),
            _make_booking_mock(datetime(2026, 3, 17, 10, 0, 0, tzinfo=utc)),
        ]
        freq_limit = {"max": 2}

        result = engine._check_frequency_limit(bookings, freq_limit, ref)

        assert result is True


# ---------------------------------------------------------------------------
# _compute_day_slots
# ---------------------------------------------------------------------------

class TestComputeDaySlots:
    def test_returns_empty_when_no_intervals_for_day(self):
        engine = AvailabilityEngine(MagicMock())
        # 2026-03-16 é segunda (0); intervalos só para terça (1)
        current_date = date(2026, 3, 16)
        intervals = [_make_interval_mock(1, time(9, 0), time(17, 0))]
        schedule_tz = ZoneInfo("America/Sao_Paulo")
        requester_tz = ZoneInfo("America/Sao_Paulo")
        earliest = datetime(2026, 3, 16, 8, 0, 0, tzinfo=schedule_tz)

        result = engine._compute_day_slots(
            current_date=current_date,
            intervals=intervals,
            overrides_map={},
            existing_bookings=[],
            schedule_tz=schedule_tz,
            requester_tz=requester_tz,
            duration=30,
            slot_interval=30,
            buffer_before=0,
            buffer_after=0,
            earliest=earliest,
            max_per_day=None,
            first_only=False,
            max_dur_day=None,
            daily_counts={},
            daily_durations={},
        )

        assert result == []

    def test_returns_slots_when_interval_matches_and_no_bookings(self):
        engine = AvailabilityEngine(MagicMock())
        current_date = date(2026, 3, 16)
        intervals = [_make_interval_mock(0, time(9, 0), time(12, 0))]
        schedule_tz = ZoneInfo("America/Sao_Paulo")
        requester_tz = ZoneInfo("America/Sao_Paulo")
        earliest = datetime(2026, 3, 16, 8, 0, 0, tzinfo=schedule_tz)

        result = engine._compute_day_slots(
            current_date=current_date,
            intervals=intervals,
            overrides_map={},
            existing_bookings=[],
            schedule_tz=schedule_tz,
            requester_tz=requester_tz,
            duration=30,
            slot_interval=30,
            buffer_before=0,
            buffer_after=0,
            earliest=earliest,
            max_per_day=None,
            first_only=False,
            max_dur_day=None,
            daily_counts={},
            daily_durations={},
        )

        assert len(result) >= 1
        assert all("time" in s and "duration_minutes" in s for s in result)
        assert result[0]["duration_minutes"] == 30

    def test_first_only_returns_single_slot(self):
        engine = AvailabilityEngine(MagicMock())
        current_date = date(2026, 3, 16)
        intervals = [_make_interval_mock(0, time(9, 0), time(12, 0))]
        schedule_tz = ZoneInfo("America/Sao_Paulo")
        requester_tz = ZoneInfo("America/Sao_Paulo")
        earliest = datetime(2026, 3, 16, 8, 0, 0, tzinfo=schedule_tz)

        result = engine._compute_day_slots(
            current_date=current_date,
            intervals=intervals,
            overrides_map={},
            existing_bookings=[],
            schedule_tz=schedule_tz,
            requester_tz=requester_tz,
            duration=30,
            slot_interval=30,
            buffer_before=0,
            buffer_after=0,
            earliest=earliest,
            max_per_day=None,
            first_only=True,
            max_dur_day=None,
            daily_counts={},
            daily_durations={},
        )

        assert len(result) == 1

    def test_max_per_day_exceeded_returns_empty(self):
        engine = AvailabilityEngine(MagicMock())
        current_date = date(2026, 3, 16)
        intervals = [_make_interval_mock(0, time(9, 0), time(12, 0))]
        schedule_tz = ZoneInfo("America/Sao_Paulo")
        requester_tz = ZoneInfo("America/Sao_Paulo")
        earliest = datetime(2026, 3, 16, 8, 0, 0, tzinfo=schedule_tz)
        daily_counts = {current_date: 2}
        daily_durations = {}

        result = engine._compute_day_slots(
            current_date=current_date,
            intervals=intervals,
            overrides_map={},
            existing_bookings=[],
            schedule_tz=schedule_tz,
            requester_tz=requester_tz,
            duration=30,
            slot_interval=30,
            buffer_before=0,
            buffer_after=0,
            earliest=earliest,
            max_per_day=2,
            first_only=False,
            max_dur_day=None,
            daily_counts=daily_counts,
            daily_durations=daily_durations,
        )

        assert result == []

    def test_override_unavailable_returns_empty(self):
        engine = AvailabilityEngine(MagicMock())
        current_date = date(2026, 3, 16)
        override = MagicMock()
        override.is_available = False
        override.start_time = None
        override.end_time = None
        schedule_tz = ZoneInfo("America/Sao_Paulo")
        requester_tz = ZoneInfo("America/Sao_Paulo")
        earliest = datetime(2026, 3, 16, 8, 0, 0, tzinfo=schedule_tz)

        result = engine._compute_day_slots(
            current_date=current_date,
            intervals=[],
            overrides_map={current_date: override},
            existing_bookings=[],
            schedule_tz=schedule_tz,
            requester_tz=requester_tz,
            duration=30,
            slot_interval=30,
            buffer_before=0,
            buffer_after=0,
            earliest=earliest,
            max_per_day=None,
            first_only=False,
            max_dur_day=None,
            daily_counts={},
            daily_durations={},
        )

        assert result == []
