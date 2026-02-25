"""
Testes de integração das rotas públicas do Calendário.
Requer DATABASE_URL e dados seed (conftest calendar_public_seed).
"""
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL necessário para testes de integração do calendário",
)
@pytest.mark.integration
class TestPublicProfile:
    """GET /api/v1/public/calendar/{org_slug}/{user_slug}/profile"""

    def test_profile_404_when_org_not_found(self, client, calendar_public_seed):
        resp = client.get(
            f"/api/v1/public/calendar/org-inexistente/{calendar_public_seed['user_slug']}/profile"
        )
        assert resp.status_code == 404
        assert "organizacao" in resp.json().get("detail", "").lower() or "não encontrada" in resp.json().get("detail", "").lower()

    def test_profile_404_when_no_event_types_for_user(self, client, calendar_public_seed):
        resp = client.get(
            f"/api/v1/public/calendar/{calendar_public_seed['org_slug']}/00000000-0000-0000-0000-000000000099/profile"
        )
        assert resp.status_code == 404

    def test_profile_200_returns_host_and_event_types(self, client, calendar_public_seed):
        resp = client.get(
            f"/api/v1/public/calendar/{calendar_public_seed['org_slug']}/{calendar_public_seed['user_slug']}/profile"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "host_name" in data
        assert "event_types" in data
        assert len(data["event_types"]) >= 1
        assert any(et["slug"] == calendar_public_seed["event_slug"] for et in data["event_types"])


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL necessário para testes de integração do calendário",
)
@pytest.mark.integration
class TestPublicSlots:
    """GET /api/v1/public/calendar/{org_slug}/{event_slug}/slots"""

    def test_slots_404_when_event_type_not_found(self, client, calendar_public_seed):
        resp = client.get(
            f"/api/v1/public/calendar/{calendar_public_seed['org_slug']}/evento-inexistente/slots",
            params={"month": "2026-04", "timezone": "America/Sao_Paulo"},
        )
        assert resp.status_code == 404

    def test_slots_200_returns_days_and_slots(self, client, calendar_public_seed):
        resp = client.get(
            f"/api/v1/public/calendar/{calendar_public_seed['org_slug']}/{calendar_public_seed['event_slug']}/slots",
            params={"month": "2026-04", "timezone": "America/Sao_Paulo"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "event_type" in data
        assert "days" in data
        assert data["timezone"] == "America/Sao_Paulo"
        assert data["event_type"]["slug"] == calendar_public_seed["event_slug"]


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL necessário para testes de integração do calendário",
)
@pytest.mark.integration
class TestPublicBooking:
    """POST /api/v1/public/calendar/bookings e GET /api/v1/public/calendar/bookings/{uid}"""

    def test_create_booking_201_returns_uid_and_token(self, client, calendar_public_seed):
        # Slot dentro de max_future_days (60) e após minimum_notice (60 min)
        tz = ZoneInfo("America/Sao_Paulo")
        now = datetime.now(tz)
        start = (now + timedelta(days=7)).replace(hour=9, minute=0, second=0, microsecond=0)
        if start <= now:
            start = now + timedelta(days=7, hours=1)
        body = {
            "org_slug": calendar_public_seed["org_slug"],
            "event_type_slug": calendar_public_seed["event_slug"],
            "guest_name": "Convidado Teste",
            "guest_email": "convidado@example.com",
            "start_time": start.isoformat(),
            "timezone": "America/Sao_Paulo",
        }
        resp = client.post("/api/v1/public/calendar/bookings", json=body)
        assert resp.status_code == 201
        data = resp.json()
        assert "uid" in data
        assert "cancel_token" in data
        assert data["guest_name"] == "Convidado Teste"
        assert data["guest_email"] == "convidado@example.com"
        assert data["duration_minutes"] == 30

        uid = data["uid"]
        cancel_token = data["cancel_token"]

        get_resp = client.get(f"/api/v1/public/calendar/bookings/{uid}")
        assert get_resp.status_code == 200
        assert get_resp.json()["uid"] == uid
        assert get_resp.json()["guest_email"] == "convidado@example.com"

        cancel_resp = client.post(
            f"/api/v1/public/calendar/bookings/{uid}/cancel",
            json={"cancel_token": cancel_token, "reason": None},
        )
        assert cancel_resp.status_code == 200
        assert cancel_resp.json().get("status") == "cancelled"

    def test_get_booking_404_when_uid_invalid(self, client):
        resp = client.get("/api/v1/public/calendar/bookings/uid-inexistente-12345")
        assert resp.status_code == 404
