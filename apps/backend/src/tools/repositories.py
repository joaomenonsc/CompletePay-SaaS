"""
Repository Pattern para acesso a dados (Seção 6.1).
Implementacoes concretas podem usar Supabase, APIs, etc.
Aqui: interfaces e implementacoes mock para desenvolvimento.
"""
from abc import ABC, abstractmethod

from src.models.account import Balance, TransactionSummary
from src.models.compliance import AuditLogEntry, IdentityVerificationResult
from src.models.payment import PaymentRequest, PaymentResult, Transaction
from src.models.support import FAQItem, TicketCreate, TicketResult


class PaymentRepository(ABC):
    """Acesso a dados de pagamento."""

    @abstractmethod
    def get_transaction(self, tx_id: str) -> Transaction | None:
        """Retorna uma transacao pelo ID."""
        ...

    @abstractmethod
    def process_payment(self, payment: PaymentRequest) -> PaymentResult:
        """Processa um pagamento."""
        ...

    @abstractmethod
    def refund_payment(self, transaction_id: str, reason: str) -> PaymentResult:
        """Estorna um pagamento."""
        ...


class AccountRepository(ABC):
    """Acesso a dados de conta."""

    @abstractmethod
    def get_balance(self, account_id: str) -> Balance | None:
        """Retorna o saldo da conta."""
        ...

    @abstractmethod
    def get_transactions(self, account_id: str, limit: int = 10) -> list[TransactionSummary]:
        """Lista transacoes da conta."""
        ...


class SupportRepository(ABC):
    """Acesso a dados de suporte."""

    @abstractmethod
    def create_ticket(self, data: TicketCreate) -> TicketResult:
        """Cria um ticket de suporte."""
        ...

    @abstractmethod
    def get_faq(self, category: str | None = None) -> list[FAQItem]:
        """Retorna itens de FAQ."""
        ...


class ComplianceRepository(ABC):
    """Acesso a dados de compliance."""

    @abstractmethod
    def verify_identity(self, user_id: str) -> IdentityVerificationResult:
        """Verifica identidade do usuario."""
        ...

    @abstractmethod
    def audit_log(self, action: str, entity_type: str, entity_id: str, details: str = "") -> AuditLogEntry:
        """Registra entrada no log de auditoria."""
        ...


# Implementacoes mock (substituir por Supabase/API em producao)
class MockPaymentRepository(PaymentRepository):
    """Implementacao mock para desenvolvimento."""

    def get_transaction(self, tx_id: str) -> Transaction | None:
        return Transaction(
            id=tx_id,
            amount=100.0,
            currency="BRL",
            status="completed",
            recipient_id="rec-001",
            description="Pagamento mock",
        )

    def process_payment(self, payment: PaymentRequest) -> PaymentResult:
        return PaymentResult(
            transaction_id=f"tx-{hash(payment.recipient_id) % 10**8}",
            status="completed",
            amount=payment.amount,
            currency=payment.currency,
            message=f"Pagamento de {payment.amount} {payment.currency} processado.",
        )

    def refund_payment(self, transaction_id: str, reason: str) -> PaymentResult:
        return PaymentResult(
            transaction_id=transaction_id,
            status="refunded",
            amount=0,
            currency="BRL",
            message=f"Estorno registrado. Motivo: {reason}",
        )


class MockAccountRepository(AccountRepository):
    """Implementacao mock para desenvolvimento."""

    def get_balance(self, account_id: str) -> Balance | None:
        return Balance(amount=1500.75, currency="BRL")

    def get_transactions(self, account_id: str, limit: int = 10) -> list[TransactionSummary]:
        return [
            TransactionSummary(id="tx-1", amount=-50.0, currency="BRL", status="completed", description="Pagamento"),
            TransactionSummary(id="tx-2", amount=200.0, currency="BRL", status="completed", description="Recebimento"),
        ][:limit]


class MockSupportRepository(SupportRepository):
    """Implementacao mock para desenvolvimento."""

    def create_ticket(self, data: TicketCreate) -> TicketResult:
        return TicketResult(
            ticket_id=f"TKT-{hash(data.subject) % 10**6}",
            status="open",
            message="Ticket criado com sucesso.",
        )

    def get_faq(self, category: str | None = None) -> list[FAQItem]:
        return [
            FAQItem(question="Como alterar minha senha?", answer="Acesse Configuracoes > Seguranca.", category="conta"),
            FAQItem(question="Prazos de transferencia?", answer="TED: mesmo dia. DOC: 1 dia util.", category="pagamentos"),
        ]


class MockComplianceRepository(ComplianceRepository):
    """Implementacao mock para desenvolvimento."""

    def verify_identity(self, user_id: str) -> IdentityVerificationResult:
        return IdentityVerificationResult(verified=True, level="full", message="Identidade verificada.")

    def audit_log(self, action: str, entity_type: str, entity_id: str, details: str = "") -> AuditLogEntry:
        return AuditLogEntry(action=action, entity_type=entity_type, entity_id=entity_id, details=details)


# Singletons para uso nas tools (em producao injetar via config)
_payment_repo: PaymentRepository = MockPaymentRepository()
_account_repo: AccountRepository = MockAccountRepository()
_support_repo: SupportRepository = MockSupportRepository()
_compliance_repo: ComplianceRepository = MockComplianceRepository()


def get_payment_repository() -> PaymentRepository:
    return _payment_repo


def get_account_repository() -> AccountRepository:
    return _account_repo


def get_support_repository() -> SupportRepository:
    return _support_repo


def get_compliance_repository() -> ComplianceRepository:
    return _compliance_repo
