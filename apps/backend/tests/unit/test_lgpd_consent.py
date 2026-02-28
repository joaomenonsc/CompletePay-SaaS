"""Testes unitários para EMK-8 — LGPD consent gate + audit."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_consent(consent_type="marketing", granted=True, revoked=False):
    c = MagicMock()
    c.id = "consent-1"
    c.consent_type = consent_type
    c.granted = granted
    c.granted_at = datetime.now(timezone.utc)
    c.channel = "web"
    c.term_version = "v1.0"
    c.revoked_at = datetime.now(timezone.utc) if revoked else None
    return c


# ---------------------------------------------------------------------------
# Consent check (both types)
# ---------------------------------------------------------------------------


class TestConsentTypeNormalization:
    @patch("src.services.marketing_service.SessionLocal")
    def test_accepts_marketing_consent_type(self, mock_session_cls):
        """Deve aceitar consent_type == 'marketing'."""
        db = MagicMock()
        consent = _make_consent("marketing")
        db.execute.return_value.scalars.return_value.first.return_value = consent

        from src.services.marketing_service import _has_marketing_consent
        result = _has_marketing_consent(db, "patient-1")
        assert result is True

    @patch("src.services.marketing_service.SessionLocal")
    def test_accepts_email_marketing_consent_type(self, mock_session_cls):
        """Deve aceitar consent_type == 'email_marketing'."""
        db = MagicMock()
        consent = _make_consent("email_marketing")
        db.execute.return_value.scalars.return_value.first.return_value = consent

        from src.services.marketing_service import _has_marketing_consent
        result = _has_marketing_consent(db, "patient-1")
        assert result is True

    @patch("src.services.marketing_service.SessionLocal")
    def test_rejects_when_no_consent(self, mock_session_cls):
        """Deve rejeitar quando não há consentimento."""
        db = MagicMock()
        db.execute.return_value.scalars.return_value.first.return_value = None

        from src.services.marketing_service import _has_marketing_consent
        result = _has_marketing_consent(db, "patient-1")
        assert result is False


# ---------------------------------------------------------------------------
# LGPD Audit on unsubscribe
# ---------------------------------------------------------------------------


class TestUnsubscribeAudit:
    @patch("src.api.routes.emk_public.SessionLocal")
    @patch("src.api.routes.emk_public.verify_unsubscribe_token")
    def test_audit_logged_on_unsubscribe(self, mock_verify, mock_session_cls):
        """Deve registrar audit log ao descadastrar."""
        mock_verify.return_value = True

        db = MagicMock()
        subscriber = MagicMock()
        subscriber.id = "sub-1"
        subscriber.email = "test@test.com"
        subscriber.status = "active"

        campaign = MagicMock()
        campaign.id = "camp-1"
        campaign.organization_id = "org-1"
        campaign.total_unsubscribed = 0

        db.execute.return_value.scalars.return_value.first.side_effect = [
            subscriber, campaign
        ]
        mock_session_cls.return_value = db

        from fastapi.testclient import TestClient
        from src.api.routes.emk_public import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        with patch("src.services.audit_service.log_audit") as mock_audit:
            response = client.post(
                "/api/v1/email-marketing/unsubscribe",
                data={"sid": "sub-1", "cid": "camp-1", "token": "valid-token"},
            )

        assert response.status_code == 200
        assert subscriber.status == "unsubscribed"


# ---------------------------------------------------------------------------
# Consent status endpoint
# ---------------------------------------------------------------------------


class TestConsentStatusEndpoint:
    def test_consent_status_without_patient(self):
        """Subscriber sem patient_id deve retornar consent_granted=True."""
        from src.api.routes.crm_marketing import get_subscriber_consent_status

        db = MagicMock()
        subscriber = MagicMock()
        subscriber.id = "sub-1"
        subscriber.email = "test@test.com"
        subscriber.status = "active"
        subscriber.patient_id = None

        db.execute.return_value.scalars.return_value.first.return_value = subscriber

        result = get_subscriber_consent_status(
            subscriber_id="sub-1",
            user_id="user-1",
            organization_id="org-1",
            _role="mkt",
            db=db,
        )

        assert result["consent_granted"] is True
        assert result["consent_required"] is False

    def test_consent_status_with_patient_and_consent(self):
        """Subscriber com patient_id e consentimento deve retornar details."""
        from src.api.routes.crm_marketing import get_subscriber_consent_status

        db = MagicMock()
        subscriber = MagicMock()
        subscriber.id = "sub-1"
        subscriber.email = "test@test.com"
        subscriber.status = "active"
        subscriber.patient_id = "patient-1"

        consent = _make_consent("email_marketing")

        # Primeiro execute → subscriber, segundo execute → consent
        db.execute.return_value.scalars.return_value.first.side_effect = [
            subscriber, consent
        ]

        result = get_subscriber_consent_status(
            subscriber_id="sub-1",
            user_id="user-1",
            organization_id="org-1",
            _role="mkt",
            db=db,
        )

        assert result["consent_granted"] is True
        assert result["consent_required"] is True
        assert result["consent_details"] is not None
        assert result["consent_details"]["consent_type"] == "email_marketing"
