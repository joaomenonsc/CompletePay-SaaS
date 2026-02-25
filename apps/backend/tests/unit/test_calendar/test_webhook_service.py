"""Testes unitários do webhook_service (módulo Calendário)."""
from datetime import datetime
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

from src.services.webhook_service import (
    MAX_ATTEMPTS,
    _payload_for_booking,
    _dispatch_one_sync,
    dispatch_webhooks_sync,
)


# ---------------------------------------------------------------------------
# _payload_for_booking
# ---------------------------------------------------------------------------

class TestPayloadForBooking:
    def test_includes_booking_fields_and_event_title(self):
        booking = MagicMock()
        booking.id = "booking-1"
        booking.uid = "uid-abc"
        booking.event_type_id = "et-1"
        booking.guest_name = "João"
        booking.guest_email = "joao@example.com"
        booking.start_time = datetime(2026, 3, 15, 14, 0, 0, tzinfo=ZoneInfo("UTC"))
        booking.end_time = datetime(2026, 3, 15, 14, 30, 0, tzinfo=ZoneInfo("UTC"))
        booking.duration_minutes = 30
        booking.timezone = "America/Sao_Paulo"
        booking.status = MagicMock(value="confirmed")

        payload = _payload_for_booking(booking, "Reunião 30min")

        assert payload["booking_id"] == "booking-1"
        assert payload["uid"] == "uid-abc"
        assert payload["event_type_id"] == "et-1"
        assert payload["event_type_title"] == "Reunião 30min"
        assert payload["guest_name"] == "João"
        assert payload["guest_email"] == "joao@example.com"
        assert "2026-03-15" in (payload["start_time"] or "")
        assert "2026-03-15" in (payload["end_time"] or "")
        assert payload["duration_minutes"] == 30
        assert payload["timezone"] == "America/Sao_Paulo"
        assert payload["status"] == "confirmed"

    def test_handles_none_start_end_time(self):
        booking = MagicMock()
        booking.id = "b1"
        booking.uid = "u1"
        booking.event_type_id = "et1"
        booking.guest_name = "A"
        booking.guest_email = "a@b.com"
        booking.start_time = None
        booking.end_time = None
        booking.duration_minutes = 30
        booking.timezone = "America/Sao_Paulo"
        booking.status = MagicMock(value="pending")

        payload = _payload_for_booking(booking, "Event")

        assert payload["start_time"] is None
        assert payload["end_time"] is None
        assert payload["status"] == "pending"


# ---------------------------------------------------------------------------
# dispatch_webhooks_sync
# ---------------------------------------------------------------------------

class TestDispatchWebhooksSync:
    def test_calls_dispatch_one_for_each_webhook(self):
        db = MagicMock()
        w1 = MagicMock()
        w1.id = "w1"
        w2 = MagicMock()
        w2.id = "w2"
        db.execute.return_value.scalars.return_value.all.return_value = [w1, w2]

        with patch(
            "src.services.webhook_service._dispatch_one_sync"
        ) as mock_dispatch:
            dispatch_webhooks_sync(
                db, "et-1", "booking.created", {"booking_id": "b1"}
            )

            assert mock_dispatch.call_count == 2
            mock_dispatch.assert_any_call(db, w1, "booking.created", {"booking_id": "b1"})
            mock_dispatch.assert_any_call(db, w2, "booking.created", {"booking_id": "b1"})

    def test_calls_nothing_when_no_webhooks(self):
        db = MagicMock()
        db.execute.return_value.scalars.return_value.all.return_value = []

        with patch(
            "src.services.webhook_service._dispatch_one_sync"
        ) as mock_dispatch:
            dispatch_webhooks_sync(
                db, "et-1", "booking.cancelled", {}
            )

            mock_dispatch.assert_not_called()


# ---------------------------------------------------------------------------
# _dispatch_one_sync
# ---------------------------------------------------------------------------

class TestDispatchOneSync:
    def test_sets_delivered_and_commits_on_2xx(self):
        db = MagicMock()
        webhook = MagicMock()
        webhook.id = "wh-1"
        webhook.url = "https://example.com/webhook"
        webhook.secret = "secret"
        payload = {"booking_id": "b1", "event": "booking.created"}

        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)

        with patch("httpx.Client", return_value=mock_client):
            _dispatch_one_sync(db, webhook, "booking.created", payload)

        db.add.assert_called_once()
        delivery = db.add.call_args[0][0]
        assert delivery.event == "booking.created"
        assert delivery.booking_id == "b1"
        assert delivery.status == "delivered"
        assert delivery.response_status == 200
        db.commit.assert_called()

    def test_retries_on_failure_and_marks_failed_after_max_attempts(self):
        db = MagicMock()
        webhook = MagicMock()
        webhook.id = "wh-1"
        webhook.url = "https://example.com/webhook"
        webhook.secret = "secret"
        payload = {"booking_id": "b1"}

        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)

        with patch("httpx.Client", return_value=mock_client):
            with patch("src.services.webhook_service.time.sleep"):
                _dispatch_one_sync(db, webhook, "booking.created", payload)

        db.add.assert_called_once()
        delivery = db.add.call_args[0][0]
        assert delivery.attempts == MAX_ATTEMPTS
        assert delivery.status == "failed"
        assert delivery.response_status == 500
