"""Testes de limites de transacao."""
from src.guardrails.transaction_limits import (
    get_max_transaction_limit,
    validate_transaction_limits,
)


def test_get_max_transaction_limit_positive():
    limit = get_max_transaction_limit()
    assert limit > 0


def test_validate_accepts_low_amount():
    ok, _ = validate_transaction_limits("Pagar 5000 BRL")
    assert ok is True


def test_validate_rejects_above_limit():
    ok, msg = validate_transaction_limits("Transferir 999999 reais")
    assert ok is False
    assert "excede" in msg or "limite" in msg
