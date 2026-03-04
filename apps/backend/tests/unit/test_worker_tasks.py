"""Testes unitários para o worker EMK-6 (ARQ Worker + Batch Send Processor)."""
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch, AsyncMock

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_db():
    return MagicMock()


def _make_subscriber(sub_id="sub-1", email="paciente@test.com", patient_id=None):
    s = MagicMock()
    s.id = sub_id
    s.email = email
    s.patient_id = patient_id
    s.first_name = "João"
    s.last_name = "Silva"
    s.phone = None
    s.status = "active"
    s.tags = []
    s.custom_fields = {}
    return s


def _make_send(send_id="send-1", subscriber_id="sub-1"):
    s = MagicMock()
    s.id = send_id
    s.subscriber_id = subscriber_id
    s.status = "queued"
    s.retry_count = 0
    s.error_message = None
    s.esp_message_id = None
    s.sent_at = None
    return s


def _make_campaign(
    campaign_id="camp-1",
    status="sending",
    template_id="tmpl-1",
    list_id="list-1",
    scheduled_at=None,
):
    c = MagicMock()
    c.id = campaign_id
    c.organization_id = "org-1"
    c.name = "Test Campaign"
    c.subject = "Hello {{nome}}"
    c.status = status
    c.template_id = template_id
    c.list_id = list_id
    c.from_email = "mkt@clinica.com"
    c.from_name = "Clinica"
    c.reply_to = "contato@clinica.com"
    c.scheduled_at = scheduled_at
    c.sent_at = None
    c.total_recipients = 0
    c.total_sent = 0
    return c


# ---------------------------------------------------------------------------
# Batch chunking
# ---------------------------------------------------------------------------


class TestBatchChunking:
    def test_chunks_120_into_3_batches(self):
        """120 subscribers devem ser divididos em 3 chunks de 50+50+20."""
        from src.workers.tasks import DEFAULT_BATCH_SIZE

        send_ids = [f"send-{i}" for i in range(120)]
        batch_size = DEFAULT_BATCH_SIZE

        chunks = []
        for i in range(0, len(send_ids), batch_size):
            chunk = send_ids[i:i + batch_size]
            chunks.append(chunk)

        assert len(chunks) == 3
        assert len(chunks[0]) == 50
        assert len(chunks[1]) == 50
        assert len(chunks[2]) == 20

    def test_chunks_exact_batch_size(self):
        """50 subscribers = exatamente 1 chunk."""
        from src.workers.tasks import DEFAULT_BATCH_SIZE

        send_ids = [f"send-{i}" for i in range(50)]
        batch_size = DEFAULT_BATCH_SIZE

        chunks = []
        for i in range(0, len(send_ids), batch_size):
            chunks.append(send_ids[i:i + batch_size])

        assert len(chunks) == 1
        assert len(chunks[0]) == 50

    def test_chunks_small_list(self):
        """3 subscribers = 1 chunk de 3."""
        from src.workers.tasks import DEFAULT_BATCH_SIZE

        send_ids = [f"send-{i}" for i in range(3)]
        batch_size = DEFAULT_BATCH_SIZE

        chunks = []
        for i in range(0, len(send_ids), batch_size):
            chunks.append(send_ids[i:i + batch_size])

        assert len(chunks) == 1
        assert len(chunks[0]) == 3


# ---------------------------------------------------------------------------
# Retry logic
# ---------------------------------------------------------------------------


class TestRetryLogic:
    @patch("src.workers.tasks.time.sleep")  # Skip real sleep
    @patch("src.services.esp_adapter.get_esp_adapter")
    @patch("src.workers.tasks._build_subscriber_context")
    @patch("src.workers.tasks.SessionLocal")
    def test_retry_on_esp_failure_then_success(
        self, mock_session_cls, mock_build_ctx, mock_get_adapter, mock_sleep
    ):
        """Deve fazer retry com backoff e ter sucesso na segunda tentativa."""
        from src.workers.tasks import _process_batch_chunk
        from src.services.esp_adapter import SendResult

        mock_build_ctx.return_value = {"nome": "João"}

        send = _make_send()
        subscriber = _make_subscriber()

        db = _make_db()
        db.execute.return_value.all.return_value = [(send, subscriber)]
        mock_session_cls.return_value = db

        # ESP falha na primeira, sucesso na segunda
        adapter = MagicMock()
        adapter.send_single.side_effect = [
            SendResult(success=False, error="rate limited"),
            SendResult(success=True, message_id="msg-123"),
        ]
        mock_get_adapter.return_value = adapter

        result = _process_batch_chunk(
            campaign_id="camp-1",
            organization_id="org-1",
            send_ids=["send-1"],
            template_html="<p>Hello</p>",
            campaign_subject="Test",
            from_email="mkt@clinica.com",
            from_name="Clinica",
            reply_to=None,
        )

        assert result["sent"] == 1
        assert result["failed"] == 0
        assert adapter.send_single.call_count == 2
        mock_sleep.assert_called_once()  # Backoff entre tentativas


# ---------------------------------------------------------------------------
# Scheduled campaigns checker
# ---------------------------------------------------------------------------


class TestScheduledCampaignsChecker:
    def test_dispatches_overdue_campaigns(self):
        """Deve encontrar campanhas agendadas no passado e despachar."""
        past = datetime.now(timezone.utc) - timedelta(minutes=5)
        campaign = _make_campaign(status="scheduled", scheduled_at=past)

        db = _make_db()
        db.execute.return_value.scalars.return_value.all.return_value = [campaign]

        # Quando o cron roda sem Redis (sem ctx["redis"]), deve processar diretamente
        from src.workers.tasks import task_check_scheduled_campaigns

        ctx = {}

        # O cron vai tentar chamar task_send_campaign diretamente
        with patch("src.workers.tasks.task_send_campaign", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = {"sent": 0, "total": 0}

            with patch("src.workers.tasks.SessionLocal", return_value=db):
                result = asyncio.run(
                    task_check_scheduled_campaigns(ctx)
                )

        assert result["dispatched"] == 1
        assert campaign.status == "sending"

    def test_skips_when_no_scheduled(self):
        """Sem campanhas agendadas, retorna dispatched=0."""
        db = _make_db()
        db.execute.return_value.scalars.return_value.all.return_value = []

        from src.workers.tasks import task_check_scheduled_campaigns

        with patch("src.workers.tasks.SessionLocal", return_value=db):
            result = asyncio.run(
                task_check_scheduled_campaigns({})
            )

        assert result["dispatched"] == 0


# ---------------------------------------------------------------------------
# Route fallback
# ---------------------------------------------------------------------------


class TestSendCampaignRouteFallback:
    @patch("src.api.routes.crm_marketing._get_campaign_or_404")
    @patch("src.api.routes.crm_marketing.log_audit")
    @patch("src.api.routes.crm_marketing.CampaignResponse")
    def test_falls_back_to_background_tasks_when_redis_down(
        self, mock_response, mock_audit, mock_get
    ):
        """Quando Redis está offline, deve cair no fallback BackgroundTasks."""
        from src.api.routes.crm_marketing import send_campaign

        db = _make_db()
        campaign = _make_campaign(status="draft")
        mock_get.return_value = campaign
        mock_response.model_validate.return_value = MagicMock()

        background = MagicMock()

        # Simular arq falha (Redis offline) — patch create_pool no módulo arq
        with patch("arq.connections.create_pool", side_effect=ConnectionError("Redis offline")):
            send_campaign(
                campaign_id="camp-1",
                background_tasks=background,
                user_id="user-1",
                organization_id="org-1",
                _role="mkt",
                db=db,
            )

        # Deve ter usado BackgroundTasks como fallback
        assert background.add_task.called
        assert campaign.status == "sending"
