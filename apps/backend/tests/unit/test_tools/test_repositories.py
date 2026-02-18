"""Testes dos repositories (mock) da Fase 3."""

from src.models.payment import PaymentRequest
from src.models.support import TicketCreate
from src.tools.repositories import (
    MockAccountRepository,
    MockComplianceRepository,
    MockPaymentRepository,
    MockSupportRepository,
    get_account_repository,
    get_payment_repository,
    get_support_repository,
    get_compliance_repository,
)


class TestPaymentRepository:
    def test_process_payment(self):
        repo = MockPaymentRepository()
        req = PaymentRequest(amount=100.0, currency="BRL", recipient_id="rec-1", description="Teste")
        result = repo.process_payment(req)
        assert result.transaction_id
        assert result.status == "completed"
        assert result.amount == 100.0
        assert result.currency == "BRL"

    def test_refund_payment(self):
        repo = MockPaymentRepository()
        result = repo.refund_payment("tx-123", "Cliente solicitou")
        assert result.status == "refunded"
        assert "Estorno" in result.message

    def test_get_transaction(self):
        repo = MockPaymentRepository()
        tx = repo.get_transaction("tx-1")
        assert tx is not None
        assert tx.id == "tx-1"
        assert tx.status == "completed"


class TestAccountRepository:
    def test_get_balance(self):
        repo = MockAccountRepository()
        balance = repo.get_balance("acc-1")
        assert balance is not None
        assert balance.amount == 1500.75
        assert balance.currency == "BRL"

    def test_get_transactions(self):
        repo = MockAccountRepository()
        items = repo.get_transactions("acc-1", limit=5)
        assert len(items) <= 5
        assert all(hasattr(t, "id") and hasattr(t, "amount") for t in items)


class TestSupportRepository:
    def test_create_ticket(self):
        repo = MockSupportRepository()
        data = TicketCreate(subject="Problema", description="Nao consigo pagar", priority="high")
        result = repo.create_ticket(data)
        assert result.ticket_id.startswith("TKT-")
        assert result.status == "open"

    def test_get_faq(self):
        repo = MockSupportRepository()
        items = repo.get_faq()
        assert len(items) >= 1
        assert any("senha" in q.question.lower() or "conta" in q.category.lower() for q in items)


class TestComplianceRepository:
    def test_verify_identity(self):
        repo = MockComplianceRepository()
        result = repo.verify_identity("user-1")
        assert result.verified is True
        assert result.level == "full"

    def test_audit_log(self):
        repo = MockComplianceRepository()
        entry = repo.audit_log("payment_created", "transaction", "tx-1", "valor 100")
        assert entry.action == "payment_created"
        assert entry.entity_type == "transaction"
        assert entry.entity_id == "tx-1"


class TestGetRepositories:
    def test_getters_return_implementations(self):
        assert get_payment_repository() is not None
        assert get_account_repository() is not None
        assert get_support_repository() is not None
        assert get_compliance_repository() is not None
