"""Testes unitarios do subscriber_service (CSV import, Patient sync, recompute)."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, PropertyMock

from src.services.subscriber_service import (
    CsvImportResult,
    PatientSyncResult,
    import_csv_to_list,
    parse_csv,
    recompute_subscriber_count,
    sync_patients_to_subscribers,
)


# ---------------------------------------------------------------------------
# CSV Parsing
# ---------------------------------------------------------------------------


class TestParseCsv:
    def test_csv_valido_com_email_e_name(self):
        csv = "email,name\njoao@test.com,João\nmaria@test.com,Maria"
        rows, errors = parse_csv(csv)
        assert len(rows) == 2
        assert rows[0]["email"] == "joao@test.com"
        assert rows[0]["name"] == "João"
        assert len(errors) == 0

    def test_csv_apenas_email(self):
        csv = "email\na@test.com\nb@test.com"
        rows, errors = parse_csv(csv)
        assert len(rows) == 2
        assert rows[0]["name"] == ""

    def test_csv_com_coluna_nome_pt(self):
        csv = "email,nome\na@test.com,Ana"
        rows, errors = parse_csv(csv)
        assert len(rows) == 1
        assert rows[0]["name"] == "Ana"

    def test_csv_sem_coluna_email(self):
        csv = "name,telefone\nJoão,11999"
        rows, errors = parse_csv(csv)
        assert len(rows) == 0
        assert any("email" in e.lower() for e in errors)

    def test_csv_vazio(self):
        csv = ""
        rows, errors = parse_csv(csv)
        assert len(rows) == 0
        assert len(errors) > 0

    def test_email_invalido_ignorado(self):
        csv = "email,name\ninvalido,Test\na@test.com,OK"
        rows, errors = parse_csv(csv)
        assert len(rows) == 1
        assert rows[0]["email"] == "a@test.com"
        assert any("inválido" in e.lower() or "invalido" in e.lower() for e in errors)

    def test_email_vazio_ignorado(self):
        csv = "email,name\n,Empty\na@test.com,OK"
        rows, errors = parse_csv(csv)
        assert len(rows) == 1
        assert any("vazio" in e.lower() for e in errors)

    def test_emails_normalizados_para_lowercase(self):
        csv = "email\nJOAO@TEST.COM"
        rows, errors = parse_csv(csv)
        assert rows[0]["email"] == "joao@test.com"


# ---------------------------------------------------------------------------
# CSV Import to List
# ---------------------------------------------------------------------------


class TestImportCsvToList:
    def test_cria_subscribers_novos(self):
        db = MagicMock()
        # Subscriber nao existe
        db.execute.return_value.scalars.return_value.first.return_value = None
        db.execute.return_value.scalar.return_value = 2

        csv = "email,name\na@test.com,Ana\nb@test.com,Bruno"
        result = import_csv_to_list(db, "list-1", "org-1", csv)

        assert result.total_rows == 2
        assert result.created == 2
        assert result.skipped == 0

    def test_dedup_subscriber_existente(self):
        db = MagicMock()
        existing = MagicMock()
        existing.name = "Existing"
        existing.id = "sub-1"
        lst = MagicMock()
        lst.subscriber_count = 0

        # side_effect: subscriber exists, link not exists, list for recompute
        db.execute.return_value.scalars.return_value.first.side_effect = [
            existing, None, lst,
        ]
        db.execute.return_value.scalar.return_value = 1

        csv = "email\na@test.com"
        result = import_csv_to_list(db, "list-1", "org-1", csv)

        assert result.skipped == 1
        assert result.created == 0

    def test_csv_vazio_retorna_result_vazio(self):
        db = MagicMock()
        csv = "email\n"
        result = import_csv_to_list(db, "list-1", "org-1", csv)
        assert result.total_rows == 0


# ---------------------------------------------------------------------------
# Patient Sync
# ---------------------------------------------------------------------------


class TestSyncPatientsToSubscribers:
    def _make_patient(self, email, patient_id="p-1"):
        p = MagicMock()
        p.id = patient_id
        p.email = email
        p.full_name = "Test Patient"
        p.social_name = None
        p.organization_id = "org-1"
        return p

    def _make_consent(self, granted=True, revoked=False):
        c = MagicMock()
        c.granted = granted
        c.revoked_at = datetime.now(timezone.utc) if revoked else None
        c.consent_type = "email_marketing"
        return c

    def test_sync_com_consent_ativo_cria_subscriber(self):
        db = MagicMock()
        patient = self._make_patient("joao@test.com")
        consent = self._make_consent(granted=True)

        # patients query -> [patient], consent query -> consent, subscriber -> None
        db.execute.return_value.scalars.return_value.all.return_value = [patient]
        db.execute.return_value.scalars.return_value.first.side_effect = [consent, None]

        result = sync_patients_to_subscribers(db, "org-1")
        assert result.synced == 1

    def test_sync_com_consent_revogado_marca_unsubscribed(self):
        db = MagicMock()
        patient = self._make_patient("joao@test.com")
        consent = self._make_consent(granted=True, revoked=True)
        subscriber = MagicMock()
        subscriber.status = "active"

        db.execute.return_value.scalars.return_value.all.return_value = [patient]
        db.execute.return_value.scalars.return_value.first.side_effect = [consent, subscriber]

        result = sync_patients_to_subscribers(db, "org-1")
        assert result.unsubscribed == 1
        assert subscriber.status == "unsubscribed"

    def test_sync_sem_consent_ignora(self):
        db = MagicMock()
        patient = self._make_patient("joao@test.com")

        db.execute.return_value.scalars.return_value.all.return_value = [patient]
        db.execute.return_value.scalars.return_value.first.return_value = None

        result = sync_patients_to_subscribers(db, "org-1")
        assert result.skipped == 1

    def test_email_invalido_skipped(self):
        db = MagicMock()
        patient = self._make_patient("nao-e-email")

        db.execute.return_value.scalars.return_value.all.return_value = [patient]

        result = sync_patients_to_subscribers(db, "org-1")
        assert result.skipped == 1


# ---------------------------------------------------------------------------
# Recompute subscriber count
# ---------------------------------------------------------------------------


class TestRecomputeSubscriberCount:
    def test_atualiza_count(self):
        db = MagicMock()
        db.execute.return_value.scalar.return_value = 42
        lst = MagicMock()
        lst.subscriber_count = 0
        db.execute.return_value.scalars.return_value.first.return_value = lst

        count = recompute_subscriber_count(db, "list-1")
        assert count == 42
