"""Testes do detector e redator de PII."""

from src.guardrails.pii_detector import find_pii, redact


class TestRedact:
    def test_redacts_cpf_formatted(self):
        out = redact("CPF do cliente: 123.456.789-00.")
        assert "123.456.789" not in out
        assert "***.***.***-**" in out

    def test_redacts_cpf_raw(self):
        out = redact("CPF 12345678900")
        assert "12345678900" not in out

    def test_redacts_card(self):
        out = redact("Cartao 4111 1111 1111 1111")
        assert "4111" not in out or out.count("4") < 4
        assert "****" in out

    def test_redacts_email(self):
        out = redact("Contato: user@example.com")
        assert "user@example.com" not in out
        assert "[email redacted]" in out

    def test_redacts_phone(self):
        out = redact("Tel (11) 99999-9999")
        assert "99999" not in out or "(**) *****-****" in out

    def test_returns_empty_unchanged(self):
        assert redact("") == ""
        assert redact(None) is None


class TestFindPii:
    def test_finds_cpf(self):
        found = find_pii("Meu CPF e 123.456.789-00")
        assert any(t == "cpf" for t, _ in found)
        assert any("123" in v for _, v in found)

    def test_finds_email(self):
        found = find_pii("Email: a@b.com")
        assert any(t == "email" for t, _ in found)
