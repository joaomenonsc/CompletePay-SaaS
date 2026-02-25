"""
Fixtures para testes de integração do Calendário.
Requer DATABASE_URL. Cria org, schedule, event type e opcionalmente membership + JWT para rotas autenticadas.
"""
import os
from datetime import time
from typing import Generator

import pytest
from fastapi.testclient import TestClient

from sqlalchemy import delete

from src.api.app import app
from src.db.session import SessionLocal
from src.db.models import Organization, UserOrganization
from src.db.models_calendar import (
    AvailabilitySchedule,
    AvailabilityScheduleInterval,
    Booking,
    EventType,
    EventTypeLimit,
)


TEST_ORG_SLUG = "test-calendar-int"
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
TEST_EVENT_SLUG = "30min"


@pytest.fixture(scope="module")
def db_session() -> Generator:
    """Sessão de DB para o módulo (compartilhada entre testes do módulo)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module")
def client() -> Generator:
    """TestClient da aplicação FastAPI."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def calendar_public_seed(db_session):
    """
    Cria org, schedule, interval, event type e limits para rotas públicas.
    Retorna dict com org_slug, user_slug, event_slug, org_id, event_type_id.
    Remove dados ao final do módulo.
    """
    org = Organization(
        name="Test Calendar Org",
        slug=TEST_ORG_SLUG,
    )
    db_session.add(org)
    db_session.flush()

    schedule = AvailabilitySchedule(
        organization_id=org.id,
        user_id=TEST_USER_ID,
        name="Padrão",
        timezone="America/Sao_Paulo",
        is_default=True,
    )
    db_session.add(schedule)
    db_session.flush()

    for day in range(5):
        db_session.add(
            AvailabilityScheduleInterval(
                schedule_id=schedule.id,
                day_of_week=day,
                start_time=time(9, 0),
                end_time=time(17, 0),
            )
        )
    db_session.flush()

    event_type = EventType(
        organization_id=org.id,
        user_id=TEST_USER_ID,
        schedule_id=schedule.id,
        title="Reunião 30min",
        slug=TEST_EVENT_SLUG,
        duration_minutes=30,
        is_active=True,
    )
    db_session.add(event_type)
    db_session.flush()

    limit = EventTypeLimit(
        event_type_id=event_type.id,
        buffer_before_minutes=0,
        buffer_after_minutes=0,
        minimum_notice_minutes=60,
        max_future_days=60,
    )
    db_session.add(limit)
    db_session.commit()
    db_session.refresh(org)
    db_session.refresh(event_type)

    yield {
        "org_slug": org.slug,
        "user_slug": TEST_USER_ID,
        "event_slug": event_type.slug,
        "org_id": org.id,
        "event_type_id": event_type.id,
    }

    # Teardown: remove em ordem (bookings, limits, event_types, intervals, schedule, org)
    db_session.execute(delete(Booking).where(Booking.event_type_id == event_type.id))
    db_session.execute(delete(EventTypeLimit).where(EventTypeLimit.event_type_id == event_type.id))
    db_session.execute(delete(EventType).where(EventType.id == event_type.id))
    db_session.execute(
        delete(AvailabilityScheduleInterval).where(
            AvailabilityScheduleInterval.schedule_id == schedule.id
        )
    )
    db_session.execute(delete(AvailabilitySchedule).where(AvailabilitySchedule.id == schedule.id))
    db_session.execute(delete(Organization).where(Organization.id == org.id))
    db_session.commit()


@pytest.fixture(scope="module")
def calendar_auth_seed(db_session, calendar_public_seed):
    """
    Adiciona UserOrganization para test_user_id na org, para rotas autenticadas.
    Retorna dict com auth_headers (Authorization + X-Organization-Id) e org_id, user_id.
    """
    try:
        import jwt
    except ImportError:
        pytest.skip("pyjwt não instalado")

    from src.config.settings import get_settings

    org_id = calendar_public_seed["org_id"]
    uo = UserOrganization(
        user_id=TEST_USER_ID,
        organization_id=org_id,
        role="member",
    )
    db_session.add(uo)
    db_session.commit()

    secret = get_settings().jwt_secret
    if not secret:
        pytest.skip("JWT_SECRET não configurado")
    token = jwt.encode(
        {"sub": TEST_USER_ID, "role": "user"},
        secret,
        algorithm="HS256",
    )
    if hasattr(token, "decode"):
        token = token.decode("utf-8")

    yield {
        "auth_headers": {
            "Authorization": f"Bearer {token}",
            "X-Organization-Id": org_id,
        },
        "org_id": org_id,
        "user_id": TEST_USER_ID,
        **calendar_public_seed,
    }

    db_session.execute(
        delete(UserOrganization).where(
            UserOrganization.user_id == TEST_USER_ID,
            UserOrganization.organization_id == org_id,
        )
    )
    db_session.commit()


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "integration: marca testes de integração que exigem DATABASE_URL",
    )
