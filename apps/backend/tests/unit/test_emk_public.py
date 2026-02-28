"""Testes unitários para EMK-7 — Webhooks e Unsubscribe público."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Unsubscribe Token Service
# ---------------------------------------------------------------------------


class TestUnsubscribeTokenService:
    @patch("src.services.unsubscribe_service.get_settings")
    def test_generate_and_verify_token(self, mock_settings):
        """Gerar token e verificar que é válido."""
        mock_settings.return_value = MagicMock(jwt_secret="test-secret-key")

        from src.services.unsubscribe_service import (
            generate_unsubscribe_token,
            verify_unsubscribe_token,
        )

        token = generate_unsubscribe_token("sub-123", "camp-456")
        assert isinstance(token, str)
        assert len(token) == 64  # SHA-256 hex

        # Valid token
        assert verify_unsubscribe_token("sub-123", "camp-456", token) is True

    @patch("src.services.unsubscribe_service.get_settings")
    def test_invalid_token_fails(self, mock_settings):
        """Token inválido deve falhar."""
        mock_settings.return_value = MagicMock(jwt_secret="test-secret-key")

        from src.services.unsubscribe_service import verify_unsubscribe_token

        assert verify_unsubscribe_token("sub-123", "camp-456", "invalid-token") is False

    @patch("src.services.unsubscribe_service.get_settings")
    def test_wrong_subscriber_fails(self, mock_settings):
        """Token gerado para outro subscriber deve falhar."""
        mock_settings.return_value = MagicMock(jwt_secret="test-secret-key")

        from src.services.unsubscribe_service import (
            generate_unsubscribe_token,
            verify_unsubscribe_token,
        )

        token = generate_unsubscribe_token("sub-123", "camp-456")
        assert verify_unsubscribe_token("sub-OTHER", "camp-456", token) is False

    @patch("src.services.unsubscribe_service.get_settings")
    def test_build_unsubscribe_url(self, mock_settings):
        """URL deve conter sid, cid e token."""
        mock_settings.return_value = MagicMock(
            jwt_secret="test-secret-key",
            frontend_url="https://app.example.com",
        )

        from src.services.unsubscribe_service import build_unsubscribe_url

        url = build_unsubscribe_url("sub-123", "camp-456")
        assert "sid=sub-123" in url
        assert "cid=camp-456" in url
        assert "token=" in url
        assert url.startswith("https://app.example.com/api/v1/email-marketing/unsubscribe")


# ---------------------------------------------------------------------------
# Webhook Endpoint
# ---------------------------------------------------------------------------


class TestResendWebhook:
    @patch("src.services.marketing_service.process_webhook_event")
    def test_processes_delivery_event(self, mock_process):
        """Deve processar evento de delivery."""
        from fastapi.testclient import TestClient
        from src.api.routes.emk_public import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        payload = {
            "type": "email.delivered",
            "data": {
                "email_id": "msg-abc-123",
                "created_at": "2026-02-28T17:00:00Z",
            },
        }

        response = client.post(
            "/api/v1/email-marketing/webhooks/resend",
            json=payload,
        )

        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert response.json()["event"] == "delivery"
        mock_process.assert_called_once()
        call_args = mock_process.call_args
        assert call_args[0][0] == "delivery"
        assert call_args[0][1] == "msg-abc-123"

    def test_ignores_unknown_event(self):
        """Eventos desconhecidos devem retornar 200 mas ignorar."""
        from fastapi.testclient import TestClient
        from src.api.routes.emk_public import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        payload = {
            "type": "email.delivery_delayed",
            "data": {"email_id": "msg-123"},
        }

        response = client.post(
            "/api/v1/email-marketing/webhooks/resend",
            json=payload,
        )

        assert response.status_code == 200
        assert response.json()["status"] == "ignored"

    def test_missing_message_id(self):
        """Evento sem message_id deve retornar 200 com ignored."""
        from fastapi.testclient import TestClient
        from src.api.routes.emk_public import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        payload = {
            "type": "email.delivered",
            "data": {},
        }

        response = client.post(
            "/api/v1/email-marketing/webhooks/resend",
            json=payload,
        )

        assert response.status_code == 200
        assert response.json()["status"] == "ignored"


# ---------------------------------------------------------------------------
# Unsubscribe Endpoints
# ---------------------------------------------------------------------------


class TestUnsubscribeEndpoint:
    @patch("src.api.routes.emk_public.verify_unsubscribe_token")
    def test_confirm_page_valid_token(self, mock_verify):
        """GET com token válido deve retornar página de confirmação."""
        mock_verify.return_value = True

        from fastapi.testclient import TestClient
        from src.api.routes.emk_public import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        response = client.get(
            "/api/v1/email-marketing/unsubscribe",
            params={"sid": "sub-1", "cid": "camp-1", "token": "valid-token"},
        )

        assert response.status_code == 200
        assert "Confirmar descadastro" in response.text

    @patch("src.api.routes.emk_public.verify_unsubscribe_token")
    def test_confirm_page_invalid_token(self, mock_verify):
        """GET com token inválido deve retornar 403."""
        mock_verify.return_value = False

        from fastapi.testclient import TestClient
        from src.api.routes.emk_public import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        response = client.get(
            "/api/v1/email-marketing/unsubscribe",
            params={"sid": "sub-1", "cid": "camp-1", "token": "bad-token"},
        )

        assert response.status_code == 403
        assert "Link inválido" in response.text

    @patch("src.api.routes.emk_public.SessionLocal")
    @patch("src.api.routes.emk_public.verify_unsubscribe_token")
    def test_process_unsubscribe_valid(self, mock_verify, mock_session_cls):
        """POST com token válido deve descadastrar subscriber."""
        mock_verify.return_value = True

        db = MagicMock()
        subscriber = MagicMock()
        subscriber.id = "sub-1"
        subscriber.status = "active"
        subscriber.unsubscribed_at = None

        campaign = MagicMock()
        campaign.id = "camp-1"
        campaign.total_unsubscribed = 0

        # Primeiro execute retorna subscriber, segundo retorna campaign
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

        response = client.post(
            "/api/v1/email-marketing/unsubscribe",
            data={"sid": "sub-1", "cid": "camp-1", "token": "valid-token"},
        )

        assert response.status_code == 200
        assert "descadastrado" in response.text.lower()
        assert subscriber.status == "unsubscribed"
        assert campaign.total_unsubscribed == 1
        db.commit.assert_called()
