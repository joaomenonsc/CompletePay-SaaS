"""Testes unitarios do esp_adapter (ESPAdapter, ResendAdapter, LogAdapter)."""
from unittest.mock import MagicMock, patch

from src.services.esp_adapter import (
    EmailMessage,
    ESPAdapter,
    LogAdapter,
    ResendAdapter,
    SendResult,
    get_esp_adapter,
)


# ---------------------------------------------------------------------------
# LogAdapter
# ---------------------------------------------------------------------------


class TestLogAdapter:
    def test_send_single_returns_success(self):
        adapter = LogAdapter()
        result = adapter.send_single(
            from_addr="noreply@test.com",
            to="user@example.com",
            subject="Test",
            html="<p>Hello</p>",
        )
        assert result.success is True
        assert result.message_id is not None
        assert result.error is None

    def test_send_batch_returns_list_of_results(self):
        adapter = LogAdapter()
        messages = [
            EmailMessage(to="a@test.com", subject="A", html="<p>A</p>"),
            EmailMessage(to="b@test.com", subject="B", html="<p>B</p>"),
            EmailMessage(to="c@test.com", subject="C", html="<p>C</p>"),
        ]
        results = adapter.send_batch("noreply@test.com", messages)
        assert len(results) == 3
        assert all(r.success for r in results)

    def test_get_status_returns_delivered(self):
        adapter = LogAdapter()
        assert adapter.get_status("any-id") == "delivered"

    def test_verify_webhook_returns_true(self):
        adapter = LogAdapter()
        assert adapter.verify_webhook(b"payload", "sig", "secret") is True


# ---------------------------------------------------------------------------
# ResendAdapter
# ---------------------------------------------------------------------------


class TestResendAdapter:
    def test_send_single_success(self):
        with patch.dict("sys.modules", {"resend": MagicMock()}):
            import sys

            mock_resend = sys.modules["resend"]
            mock_resend.Emails.send.return_value = {"id": "msg-123"}

            adapter = ResendAdapter(api_key="test-key", rate_limit_per_second=0)
            result = adapter.send_single(
                from_addr="noreply@test.com",
                to="user@test.com",
                subject="Test",
                html="<p>Test</p>",
            )

            assert result.success is True
            assert result.message_id == "msg-123"
            mock_resend.Emails.send.assert_called_once()

    def test_send_single_failure(self):
        with patch.dict("sys.modules", {"resend": MagicMock()}):
            import sys

            mock_resend = sys.modules["resend"]
            mock_resend.Emails.send.side_effect = RuntimeError("API error")

            adapter = ResendAdapter(api_key="test-key", rate_limit_per_second=0)
            result = adapter.send_single(
                from_addr="noreply@test.com",
                to="user@test.com",
                subject="Test",
                html="<p>Test</p>",
            )

            assert result.success is False
            assert "API error" in (result.error or "")

    def test_send_single_with_headers(self):
        with patch.dict("sys.modules", {"resend": MagicMock()}):
            import sys

            mock_resend = sys.modules["resend"]
            mock_resend.Emails.send.return_value = {"id": "msg-456"}

            adapter = ResendAdapter(api_key="test-key", rate_limit_per_second=0)
            result = adapter.send_single(
                from_addr="noreply@test.com",
                to="user@test.com",
                subject="Test",
                html="<p>Test</p>",
                headers={"List-Unsubscribe": "<mailto:unsub@test.com>"},
            )

            assert result.success is True
            call_args = mock_resend.Emails.send.call_args[0][0]
            assert "headers" in call_args

    def test_send_batch_chunks_at_100(self):
        with patch.dict("sys.modules", {"resend": MagicMock()}):
            import sys

            mock_resend = sys.modules["resend"]
            mock_resend.Emails.send.return_value = {"id": "msg-batch"}

            adapter = ResendAdapter(api_key="test-key", rate_limit_per_second=0)

            # Criar 150 mensagens — deve dividir em 2 chunks (100 + 50)
            messages = [
                EmailMessage(to=f"user{i}@test.com", subject=f"S{i}", html=f"<p>{i}</p>")
                for i in range(150)
            ]

            results = adapter.send_batch("noreply@test.com", messages)

            assert len(results) == 150
            assert all(r.success for r in results)
            assert mock_resend.Emails.send.call_count == 150

    def test_get_status(self):
        with patch.dict("sys.modules", {"resend": MagicMock()}):
            import sys

            mock_resend = sys.modules["resend"]
            mock_resend.Emails.get.return_value = {"status": "delivered"}

            adapter = ResendAdapter(api_key="test-key", rate_limit_per_second=0)
            status = adapter.get_status("msg-123")
            assert status == "delivered"


# ---------------------------------------------------------------------------
# Factory: get_esp_adapter
# ---------------------------------------------------------------------------


class TestGetEspAdapter:
    def test_returns_log_adapter_without_api_key(self):
        mock_settings = MagicMock()
        mock_settings.resend_api_key = ""

        with patch("src.config.settings.get_settings", return_value=mock_settings):
            adapter = get_esp_adapter()
            assert isinstance(adapter, LogAdapter)

    def test_returns_resend_adapter_with_api_key(self):
        mock_settings = MagicMock()
        mock_settings.resend_api_key = "re_test_abc123"
        mock_settings.marketing_rate_limit_per_second = 8.0

        with patch("src.config.settings.get_settings", return_value=mock_settings):
            with patch.dict("sys.modules", {"resend": MagicMock()}):
                adapter = get_esp_adapter()
                assert isinstance(adapter, ResendAdapter)


# ---------------------------------------------------------------------------
# SendResult / EmailMessage dataclasses
# ---------------------------------------------------------------------------


class TestDataClasses:
    def test_send_result_defaults(self):
        r = SendResult(success=True)
        assert r.success is True
        assert r.message_id is None
        assert r.error is None

    def test_email_message_defaults(self):
        m = EmailMessage(to="a@b.com", subject="S", html="<p>H</p>")
        assert m.headers == {}

    def test_email_message_with_headers(self):
        m = EmailMessage(
            to="a@b.com",
            subject="S",
            html="<p>H</p>",
            headers={"X-Custom": "value"},
        )
        assert m.headers["X-Custom"] == "value"
