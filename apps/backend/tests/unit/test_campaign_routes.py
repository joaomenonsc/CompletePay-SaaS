"""Testes unitarios para as rotas de campanha EMK-5 (CRUD + Scheduling + Validações)."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from src.api.routes.crm_marketing import (
    _validate_from_email_domain,
    create_campaign,
    update_campaign,
    send_campaign,
    schedule_campaign,
    delete_campaign,
    duplicate_campaign,
    cancel_campaign,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_db():
    """Cria um mock de Session."""
    return MagicMock()


def _make_campaign(status="draft", template_id="tmpl-1", list_id="list-1", from_email=None):
    c = MagicMock()
    c.id = "camp-1"
    c.organization_id = "org-1"
    c.name = "Test Campaign"
    c.subject = "Hello"
    c.status = status
    c.template_id = template_id
    c.list_id = list_id
    c.from_email = from_email
    c.from_name = None
    c.reply_to = None
    c.scheduled_at = None
    c.sent_at = None
    c.total_recipients = 0
    c.total_sent = 0
    c.total_delivered = 0
    c.total_opened = 0
    c.total_clicked = 0
    c.total_bounced = 0
    c.total_unsubscribed = 0
    c.created_by = "user-1"
    c.created_at = datetime.now(timezone.utc)
    c.updated_at = datetime.now(timezone.utc)
    return c


def _make_domain(status="verified"):
    d = MagicMock()
    d.id = "dom-1"
    d.organization_id = "org-1"
    d.domain = "clinica.com"
    d.status = status
    return d


# ---------------------------------------------------------------------------
# _validate_from_email_domain
# ---------------------------------------------------------------------------


class TestValidateFromEmailDomain:
    def test_invalid_email_no_at(self):
        db = _make_db()
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            _validate_from_email_domain(db, "invalido", "org-1")
        assert exc_info.value.status_code == 422

    def test_unverified_domain_raises(self):
        db = _make_db()
        db.execute.return_value.scalars.return_value.first.return_value = None
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            _validate_from_email_domain(db, "marketing@noverificado.com", "org-1")
        assert exc_info.value.status_code == 422
        assert "noverificado.com" in str(exc_info.value.detail)

    def test_verified_domain_passes(self):
        db = _make_db()
        db.execute.return_value.scalars.return_value.first.return_value = _make_domain("verified")
        # Should not raise
        _validate_from_email_domain(db, "marketing@clinica.com", "org-1")


# ---------------------------------------------------------------------------
# schedule_campaign
# ---------------------------------------------------------------------------


class TestScheduleCampaign:
    @patch("src.api.routes.crm_marketing._get_campaign_or_404")
    @patch("src.api.routes.crm_marketing.log_audit")
    def test_schedule_draft_campaign(self, mock_audit, mock_get):
        db = _make_db()
        campaign = _make_campaign(status="draft")
        mock_get.return_value = campaign

        body = MagicMock()
        body.scheduled_at = datetime(2026, 3, 15, 10, 0, tzinfo=timezone.utc)

        schedule_campaign(
            campaign_id="camp-1", body=body,
            user_id="user-1", organization_id="org-1",
            _role="mkt", db=db,
        )

        assert campaign.status == "scheduled"
        assert campaign.scheduled_at == body.scheduled_at
        db.commit.assert_called()

    @patch("src.api.routes.crm_marketing._get_campaign_or_404")
    def test_schedule_sent_campaign_fails(self, mock_get):
        db = _make_db()
        campaign = _make_campaign(status="sent")
        mock_get.return_value = campaign

        body = MagicMock()
        body.scheduled_at = datetime(2026, 3, 15, 10, 0, tzinfo=timezone.utc)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            schedule_campaign(
                campaign_id="camp-1", body=body,
                user_id="user-1", organization_id="org-1",
                _role="mkt", db=db,
            )
        assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# delete_campaign
# ---------------------------------------------------------------------------


class TestDeleteCampaign:
    @patch("src.api.routes.crm_marketing._get_campaign_or_404")
    @patch("src.api.routes.crm_marketing.log_audit")
    def test_delete_draft_campaign(self, mock_audit, mock_get):
        db = _make_db()
        campaign = _make_campaign(status="draft")
        mock_get.return_value = campaign

        result = delete_campaign(
            campaign_id="camp-1",
            user_id="user-1", organization_id="org-1",
            _role="mkt", db=db,
        )
        assert result is None
        db.delete.assert_called_once_with(campaign)
        db.commit.assert_called()

    @patch("src.api.routes.crm_marketing._get_campaign_or_404")
    def test_delete_sent_campaign_fails(self, mock_get):
        db = _make_db()
        campaign = _make_campaign(status="sent")
        mock_get.return_value = campaign

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            delete_campaign(
                campaign_id="camp-1",
                user_id="user-1", organization_id="org-1",
                _role="mkt", db=db,
            )
        assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# duplicate_campaign
# ---------------------------------------------------------------------------


class TestDuplicateCampaign:
    @patch("src.api.routes.crm_marketing._get_campaign_or_404")
    @patch("src.api.routes.crm_marketing.log_audit")
    def test_duplicate_creates_draft_copy(self, mock_audit, mock_get):
        db = _make_db()
        original = _make_campaign(status="sent", from_email="mkt@clinica.com")
        original.name = "Original Campaign"
        original.from_name = "Clinica"
        original.reply_to = "contato@clinica.com"
        mock_get.return_value = original

        # Mock db.add storing the new campaign, and refresh pulling from_attributes
        added_items = []
        db.add.side_effect = lambda item: added_items.append(item)

        # We need to patch EmkCampaign creation
        from src.db.models_marketing import EmkCampaign
        with patch("src.api.routes.crm_marketing.EmkCampaign") as MockCampaign, \
             patch("src.api.routes.crm_marketing.CampaignResponse") as MockResponse:

            mock_new = MagicMock()
            mock_new.id = "camp-new"
            mock_new.name = "Original Campaign (cópia)"
            mock_new.status = "draft"
            MockCampaign.return_value = mock_new

            mock_response = MagicMock()
            MockResponse.model_validate.return_value = mock_response

            result = duplicate_campaign(
                campaign_id="camp-1",
                user_id="user-1", organization_id="org-1",
                _role="mkt", db=db,
            )

            # Verify the new campaign was created with correct params
            MockCampaign.assert_called_once()
            call_kwargs = MockCampaign.call_args[1]
            assert call_kwargs["name"] == "Original Campaign (cópia)"
            assert call_kwargs["status"] == "draft"
            assert call_kwargs["from_email"] == "mkt@clinica.com"
            assert call_kwargs["reply_to"] == "contato@clinica.com"
            db.add.assert_called_once_with(mock_new)
            db.commit.assert_called()


# ---------------------------------------------------------------------------
# cancel_campaign
# ---------------------------------------------------------------------------


class TestCancelCampaign:
    @patch("src.api.routes.crm_marketing._get_campaign_or_404")
    def test_cancel_sending_campaign(self, mock_get):
        db = _make_db()
        campaign = _make_campaign(status="sending")
        mock_get.return_value = campaign

        cancel_campaign(
            campaign_id="camp-1",
            user_id="user-1", organization_id="org-1",
            _role="mkt", db=db,
        )
        assert campaign.status == "cancelled"

    @patch("src.api.routes.crm_marketing._get_campaign_or_404")
    def test_cancel_already_cancelled_fails(self, mock_get):
        db = _make_db()
        campaign = _make_campaign(status="cancelled")
        mock_get.return_value = campaign

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            cancel_campaign(
                campaign_id="camp-1",
                user_id="user-1", organization_id="org-1",
                _role="mkt", db=db,
            )
        assert exc_info.value.status_code == 400
