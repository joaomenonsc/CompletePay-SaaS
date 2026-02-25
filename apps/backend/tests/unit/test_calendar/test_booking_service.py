"""Testes unitários do booking_service (módulo Calendário)."""
from datetime import datetime
from unittest.mock import MagicMock
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException

from src.services.booking_service import (
    SlotConflictError,
    _parse_slot_times,
    add_attendees_to_booking,
    cancel_booking_by_host,
    get_booking_by_id,
    get_booking_by_uid,
    mark_booking_no_show,
    report_booking,
    reschedule_booking_by_host,
)
from src.schemas.calendar import BookingCreatePublic


# ---------------------------------------------------------------------------
# SlotConflictError
# ---------------------------------------------------------------------------

class TestSlotConflictError:
    def test_default_message(self):
        err = SlotConflictError()
        assert err.message == "Horario indisponivel. Selecione outro."
        assert str(err) == err.message

    def test_custom_message(self):
        err = SlotConflictError("Slot ocupado.")
        assert err.message == "Slot ocupado."
        assert isinstance(err, Exception)


# ---------------------------------------------------------------------------
# _parse_slot_times
# ---------------------------------------------------------------------------

class TestParseSlotTimes:
    def test_uses_data_timezone_and_duration_from_data(self):
        tz = "America/Sao_Paulo"
        start = datetime(2026, 3, 15, 14, 0, 0, tzinfo=ZoneInfo(tz))
        data = BookingCreatePublic(
            org_slug="acme",
            event_type_slug="reuniao",
            guest_name="João",
            guest_email="joao@example.com",
            start_time=start,
            timezone=tz,
            duration_minutes=45,
        )
        event_type = MagicMock()
        event_type.duration_minutes = 30

        slot_start_utc, slot_end_utc = _parse_slot_times(data, event_type)

        assert slot_start_utc.tzinfo is not None
        assert slot_end_utc.tzinfo is not None
        diff_minutes = (slot_end_utc - slot_start_utc).total_seconds() / 60
        assert diff_minutes == 45

    def test_uses_event_type_duration_when_data_duration_none(self):
        tz = "America/Sao_Paulo"
        start = datetime(2026, 3, 15, 14, 0, 0, tzinfo=ZoneInfo(tz))
        data = BookingCreatePublic(
            org_slug="acme",
            event_type_slug="reuniao",
            guest_name="João",
            guest_email="joao@example.com",
            start_time=start,
            timezone=tz,
            duration_minutes=None,
        )
        event_type = MagicMock()
        event_type.duration_minutes = 30

        slot_start_utc, slot_end_utc = _parse_slot_times(data, event_type)

        diff_minutes = (slot_end_utc - slot_start_utc).total_seconds() / 60
        assert diff_minutes == 30

    def test_naive_start_time_gets_timezone_from_data(self):
        start_naive = datetime(2026, 3, 15, 14, 0, 0)
        data = BookingCreatePublic(
            org_slug="acme",
            event_type_slug="reuniao",
            guest_name="João",
            guest_email="joao@example.com",
            start_time=start_naive,
            timezone="America/Sao_Paulo",
            duration_minutes=30,
        )
        event_type = MagicMock()
        event_type.duration_minutes = 30

        slot_start_utc, slot_end_utc = _parse_slot_times(data, event_type)

        assert slot_start_utc.tzinfo == ZoneInfo("UTC")
        assert (slot_end_utc - slot_start_utc).total_seconds() == 30 * 60


# ---------------------------------------------------------------------------
# get_booking_by_id / get_booking_by_uid
# ---------------------------------------------------------------------------

class TestGetBookingById:
    def test_returns_none_when_not_found(self):
        db = MagicMock()
        db.execute.return_value.scalars.return_value.one_or_none.return_value = None

        result = get_booking_by_id(db, "booking-1", "org-1")

        assert result is None

    def test_returns_booking_when_found(self):
        db = MagicMock()
        booking = MagicMock()
        booking.id = "booking-1"
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        result = get_booking_by_id(db, "booking-1", "org-1")

        assert result is booking


class TestGetBookingByUid:
    def test_returns_none_when_not_found(self):
        db = MagicMock()
        db.execute.return_value.scalars.return_value.one_or_none.return_value = None

        result = get_booking_by_uid(db, "uid-xyz")

        assert result is None

    def test_returns_booking_when_found(self):
        db = MagicMock()
        booking = MagicMock()
        booking.uid = "uid-xyz"
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        result = get_booking_by_uid(db, "uid-xyz")

        assert result is booking


# ---------------------------------------------------------------------------
# cancel_booking_by_host
# ---------------------------------------------------------------------------

class TestCancelBookingByHost:
    def test_raises_404_when_booking_not_found(self):
        db = MagicMock()
        db.execute.return_value.scalars.return_value.one_or_none.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            cancel_booking_by_host(db, "booking-1", "org-1")

        assert exc_info.value.status_code == 404
        assert "nao encontrada" in exc_info.value.detail.lower()

    def test_raises_400_when_booking_already_cancelled(self):
        db = MagicMock()
        booking = MagicMock()
        from src.db.models_calendar import BookingStatus
        booking.status = BookingStatus.cancelled
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        with pytest.raises(HTTPException) as exc_info:
            cancel_booking_by_host(db, "booking-1", "org-1")

        assert exc_info.value.status_code == 400
        assert "cancelada" in exc_info.value.detail.lower()

    def test_sets_cancelled_and_commits(self):
        from src.db.models_calendar import BookingStatus, CancelledBy

        db = MagicMock()
        booking = MagicMock()
        booking.status = BookingStatus.confirmed
        booking.id = "booking-1"
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        result = cancel_booking_by_host(db, "booking-1", "org-1", reason="Motivo")

        assert result is booking
        assert booking.status == BookingStatus.cancelled
        assert booking.cancellation_reason == "Motivo"
        assert booking.cancelled_by == CancelledBy.host
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(booking)


# ---------------------------------------------------------------------------
# mark_booking_no_show
# ---------------------------------------------------------------------------

class TestMarkBookingNoShow:
    def test_raises_404_when_booking_not_found(self):
        db = MagicMock()
        db.execute.return_value.scalars.return_value.one_or_none.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            mark_booking_no_show(db, "booking-1", "org-1")

        assert exc_info.value.status_code == 404

    def test_raises_400_when_booking_cancelled(self):
        from src.db.models_calendar import BookingStatus

        db = MagicMock()
        booking = MagicMock()
        booking.status = BookingStatus.cancelled
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        with pytest.raises(HTTPException) as exc_info:
            mark_booking_no_show(db, "booking-1", "org-1")

        assert exc_info.value.status_code == 400
        assert "cancelada" in exc_info.value.detail.lower()

    def test_raises_400_when_already_no_show(self):
        from src.db.models_calendar import BookingStatus

        db = MagicMock()
        booking = MagicMock()
        booking.status = BookingStatus.no_show
        booking.end_time = None
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        with pytest.raises(HTTPException) as exc_info:
            mark_booking_no_show(db, "booking-1", "org-1")

        assert exc_info.value.status_code == 400
        assert "marcada" in exc_info.value.detail.lower() or "compareceu" in exc_info.value.detail.lower()

    def test_raises_400_when_event_not_ended_yet(self):
        from src.db.models_calendar import BookingStatus

        db = MagicMock()
        booking = MagicMock()
        booking.status = BookingStatus.confirmed
        # end_time no futuro
        booking.end_time = datetime(2030, 1, 1, 12, 0, 0, tzinfo=ZoneInfo("UTC"))
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        with pytest.raises(HTTPException) as exc_info:
            mark_booking_no_show(db, "booking-1", "org-1")

        assert exc_info.value.status_code == 400
        assert "horario" in exc_info.value.detail.lower() or "fim" in exc_info.value.detail.lower()

    def test_sets_no_show_and_commits_when_event_ended(self):
        from src.db.models_calendar import BookingStatus

        db = MagicMock()
        booking = MagicMock()
        booking.status = BookingStatus.confirmed
        booking.end_time = datetime(2020, 1, 1, 10, 0, 0, tzinfo=ZoneInfo("UTC"))
        booking.id = "booking-1"
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        result = mark_booking_no_show(db, "booking-1", "org-1")

        assert result is booking
        assert booking.status == BookingStatus.no_show
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(booking)


# ---------------------------------------------------------------------------
# add_attendees_to_booking
# ---------------------------------------------------------------------------

class TestAddAttendeesToBooking:
    def test_raises_404_when_booking_not_found(self):
        db = MagicMock()
        db.execute.return_value.scalars.return_value.one_or_none.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            add_attendees_to_booking(db, "booking-1", "org-1", ["a@b.com"])

        assert exc_info.value.status_code == 404

    def test_raises_400_when_booking_cancelled(self):
        from src.db.models_calendar import BookingStatus

        db = MagicMock()
        booking = MagicMock()
        booking.status = BookingStatus.cancelled
        booking.attendees = []
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        with pytest.raises(HTTPException) as exc_info:
            add_attendees_to_booking(db, "booking-1", "org-1", ["a@b.com"])

        assert exc_info.value.status_code == 400
        assert "cancelada" in exc_info.value.detail.lower()

    def test_skips_duplicate_guest_email_and_adds_new(self):
        from src.db.models_calendar import BookingStatus, BookingAttendee

        db = MagicMock()
        booking = MagicMock()
        booking.id = "b1"
        booking.status = BookingStatus.confirmed
        booking.guest_email = "guest@example.com"
        booking.attendees = []
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        result_booking, added = add_attendees_to_booking(
            db, "booking-1", "org-1",
            ["guest@example.com", "new@example.com"],
        )

        assert result_booking is booking
        assert added == ["new@example.com"]
        assert db.add.call_count == 1
        call_arg = db.add.call_args[0][0]
        assert isinstance(call_arg, BookingAttendee)
        assert call_arg.email == "new@example.com"
        db.commit.assert_called_once()


# ---------------------------------------------------------------------------
# reschedule_booking_by_host
# ---------------------------------------------------------------------------

class TestRescheduleBookingByHost:
    def test_raises_404_when_booking_not_found(self):
        db = MagicMock()
        db.execute.return_value.scalars.return_value.one_or_none.return_value = None

        new_start = datetime(2026, 4, 1, 15, 0, 0, tzinfo=ZoneInfo("UTC"))

        with pytest.raises(HTTPException) as exc_info:
            reschedule_booking_by_host(db, "booking-1", "org-1", new_start, 30)

        assert exc_info.value.status_code == 404

    def test_raises_400_when_booking_cancelled(self):
        from src.db.models_calendar import BookingStatus

        db = MagicMock()
        booking = MagicMock()
        booking.status = BookingStatus.cancelled
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        new_start = datetime(2026, 4, 1, 15, 0, 0, tzinfo=ZoneInfo("UTC"))

        with pytest.raises(HTTPException) as exc_info:
            reschedule_booking_by_host(db, "booking-1", "org-1", new_start, 30)

        assert exc_info.value.status_code == 400
        assert "cancelada" in exc_info.value.detail.lower()

    def test_updates_times_and_rescheduled_from(self):
        from src.db.models_calendar import BookingStatus

        db = MagicMock()
        old_start = datetime(2026, 3, 1, 14, 0, 0, tzinfo=ZoneInfo("UTC"))
        booking = MagicMock()
        booking.status = BookingStatus.confirmed
        booking.start_time = old_start
        booking.end_time = datetime(2026, 3, 1, 14, 30, 0, tzinfo=ZoneInfo("UTC"))
        booking.duration_minutes = 30
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        new_start = datetime(2026, 4, 1, 15, 0, 0, tzinfo=ZoneInfo("UTC"))

        result = reschedule_booking_by_host(db, "booking-1", "org-1", new_start, 30)

        assert result is booking
        assert booking.rescheduled_from == old_start
        assert booking.start_time == new_start
        assert (booking.end_time - new_start).total_seconds() == 30 * 60
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(booking)


# ---------------------------------------------------------------------------
# report_booking
# ---------------------------------------------------------------------------

class TestReportBooking:
    def test_calls_cancel_booking_by_host_with_reason(self):
        from src.db.models_calendar import BookingStatus, CancelledBy

        db = MagicMock()
        booking = MagicMock()
        booking.status = BookingStatus.confirmed
        db.execute.return_value.scalars.return_value.one_or_none.return_value = booking

        result = report_booking(db, "booking-1", "org-1", "spam", "Descrição extra")

        assert result is booking
        assert booking.status == BookingStatus.cancelled
        assert "Reportado" in (booking.cancellation_reason or "")
        assert "Spam" in (booking.cancellation_reason or "")
        assert "Descrição extra" in (booking.cancellation_reason or "")
