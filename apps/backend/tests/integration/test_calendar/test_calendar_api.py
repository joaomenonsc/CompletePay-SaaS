"""
Testes de integração das rotas autenticadas do Calendário.
Requer DATABASE_URL, JWT_SECRET e dados seed (conftest calendar_auth_seed).
"""
import os

import pytest


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL necessário para testes de integração do calendário",
)
@pytest.mark.integration
class TestCalendarBookings:
    """GET /api/v1/calendar/bookings"""

    def test_list_bookings_401_without_token(self, client):
        resp = client.get(
            "/api/v1/calendar/bookings",
            headers={"X-Organization-Id": "any-org-id"},
        )
        assert resp.status_code == 401

    def test_list_bookings_400_without_org_header(self, client, calendar_auth_seed):
        resp = client.get(
            "/api/v1/calendar/bookings",
            headers={"Authorization": calendar_auth_seed["auth_headers"]["Authorization"]},
        )
        assert resp.status_code == 400

    def test_list_bookings_200_returns_list(self, client, calendar_auth_seed):
        resp = client.get(
            "/api/v1/calendar/bookings",
            headers=calendar_auth_seed["auth_headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_list_bookings_respects_limit_param(self, client, calendar_auth_seed):
        resp = client.get(
            "/api/v1/calendar/bookings",
            headers=calendar_auth_seed["auth_headers"],
            params={"limit": 5},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) <= 5


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL necessário para testes de integração do calendário",
)
@pytest.mark.integration
class TestCalendarEventTypes:
    """GET /api/v1/calendar/event-types"""

    def test_list_event_types_401_without_token(self, client):
        resp = client.get(
            "/api/v1/calendar/event-types",
            headers={"X-Organization-Id": "any-org-id"},
        )
        assert resp.status_code == 401

    def test_list_event_types_200_returns_seed_type(self, client, calendar_auth_seed):
        resp = client.get(
            "/api/v1/calendar/event-types",
            headers=calendar_auth_seed["auth_headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        slugs = [et["slug"] for et in data]
        assert calendar_auth_seed["event_slug"] in slugs
