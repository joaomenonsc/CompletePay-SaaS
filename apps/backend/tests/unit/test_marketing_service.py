"""Testes unitarios do marketing_service (envio de campanhas via ESP adapter)."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, PropertyMock

from src.services.marketing_service import (
    process_campaign_send,
    render_template,
    render_subject,
    _build_subscriber_context,
    _has_marketing_consent,
)


# ---------------------------------------------------------------------------
# Template rendering
# ---------------------------------------------------------------------------


class TestRenderTemplate:
    def test_substitui_variaveis(self):
        html = "<p>Olá {{nome_paciente}}, seu email é {{email}}</p>"
        result = render_template(html, {"nome_paciente": "João", "email": "joao@test.com"})
        assert "João" in result
        assert "joao@test.com" in result

    def test_variaveis_nao_encontradas_ficam_vazias(self):
        """Jinja2 SilentUndefined: variaveis nao encontradas retornam ''."""
        html = "<p>{{variavel_inexistente}}</p>"
        result = render_template(html, {"outra": "valor"})
        assert "variavel_inexistente" not in result

    def test_html_vazio(self):
        assert render_template("", {"a": "b"}) == ""

    def test_html_none(self):
        assert render_template(None, {"a": "b"}) == ""


class TestRenderSubject:
    def test_substitui_variaveis_no_assunto(self):
        result = render_subject("Olá {{nome_paciente}}", {"nome_paciente": "Maria"})
        assert result == "Olá Maria"


# ---------------------------------------------------------------------------
# Consent check
# ---------------------------------------------------------------------------


class TestHasMarketingConsent:
    def test_returns_true_with_active_consent(self):
        db = MagicMock()
        consent = MagicMock()
        db.execute.return_value.scalars.return_value.first.return_value = consent
        assert _has_marketing_consent(db, "patient-1") is True

    def test_returns_false_without_consent(self):
        db = MagicMock()
        db.execute.return_value.scalars.return_value.first.return_value = None
        assert _has_marketing_consent(db, "patient-2") is False


# ---------------------------------------------------------------------------
# Build subscriber context
# ---------------------------------------------------------------------------


class TestBuildSubscriberContext:
    def test_basic_context_without_patient(self):
        db = MagicMock()
        sub = MagicMock()
        sub.email = "user@test.com"
        sub.name = "User Name"
        sub.patient_id = None

        ctx = _build_subscriber_context(db, sub, "org-1")
        assert ctx["email"] == "user@test.com"
        assert ctx["nome_paciente"] == "User Name"

    def test_uses_email_prefix_when_no_name(self):
        db = MagicMock()
        sub = MagicMock()
        sub.email = "user@test.com"
        sub.name = None
        sub.patient_id = None

        ctx = _build_subscriber_context(db, sub, "org-1")
        assert ctx["nome_paciente"] == "user"


# ---------------------------------------------------------------------------
# process_campaign_send (with mocked adapter)
# ---------------------------------------------------------------------------


class TestProcessCampaignSend:
    def _make_campaign(self):
        c = MagicMock()
        c.id = "camp-1"
        c.template_id = "tmpl-1"
        c.list_id = "list-1"
        c.subject = "Hello {{nome_paciente}}"
        c.from_email = None
        c.from_name = None
        c.total_recipients = 0
        c.total_sent = 0
        c.status = "sending"
        c.sent_at = None
        return c

    def _make_template(self):
        t = MagicMock()
        t.id = "tmpl-1"
        t.html_content = "<p>Olá {{nome_paciente}}</p>"
        return t

    def _make_subscriber(self, email, patient_id=None):
        s = MagicMock()
        s.id = f"sub-{email}"
        s.email = email
        s.name = email.split("@")[0]
        s.patient_id = patient_id
        s.status = "active"
        return s

    @patch("src.services.marketing_service.SessionLocal")
    @patch("src.services.esp_adapter.get_esp_adapter")
    @patch("src.config.settings.get_settings")
    def test_sends_to_eligible_subscribers(self, mock_get_settings, mock_get_adapter, mock_session_local):
        # Setup DB mock
        db = MagicMock()
        mock_session_local.return_value = db

        campaign = self._make_campaign()
        template = self._make_template()
        sub1 = self._make_subscriber("a@test.com")
        sub2 = self._make_subscriber("b@test.com")

        # Mock DB queries in order
        db.execute.return_value.scalars.return_value.first.side_effect = [campaign, template]
        db.execute.return_value.scalars.return_value.all.return_value = [sub1, sub2]

        # Mock adapter
        from src.services.esp_adapter import SendResult
        mock_adapter = MagicMock()
        mock_adapter.send_single.return_value = SendResult(success=True, message_id="msg-1")
        mock_get_adapter.return_value = mock_adapter

        # Mock settings
        mock_settings = MagicMock()
        mock_settings.resend_domain = "test.com"
        mock_get_settings.return_value = mock_settings

        process_campaign_send("camp-1", "org-1")

        assert mock_adapter.send_single.call_count == 2

    @patch("src.services.marketing_service.SessionLocal")
    def test_campaign_not_found(self, mock_session_local):
        db = MagicMock()
        mock_session_local.return_value = db
        db.execute.return_value.scalars.return_value.first.return_value = None

        # Should not raise
        process_campaign_send("nonexistent", "org-1")

    @patch("src.services.marketing_service.SessionLocal")
    def test_template_not_found_marks_failed(self, mock_session_local):
        db = MagicMock()
        mock_session_local.return_value = db

        campaign = self._make_campaign()
        # First call returns campaign, second returns None (template)
        db.execute.return_value.scalars.return_value.first.side_effect = [campaign, None]

        process_campaign_send("camp-1", "org-1")

        assert campaign.status == "failed"
        db.commit.assert_called()
