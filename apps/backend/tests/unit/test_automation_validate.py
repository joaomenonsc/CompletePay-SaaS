"""Testes unitários para validação de automações e sanitização LGPD."""
import pytest
import sys
from pathlib import Path

# Garante que o diretório raiz do backend esteja no path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.services.automation_service import validate_definition, sanitize_io


# ─────────────────────────────────────────────────────────────────────────────
# Helpers para construção de grafos de teste
# ─────────────────────────────────────────────────────────────────────────────

def _node(node_id: str, ntype: str, category: str = "trigger", config: dict | None = None):
    return {
        "id": node_id,
        "type": ntype,
        "category": category,
        "position": {"x": 0, "y": 0},
        "data": {"label": ntype, "config": config or {}},
    }


def _edge(edge_id: str, source: str, target: str):
    return {
        "id": edge_id,
        "source": source,
        "target": target,
        "sourceHandle": "output",
        "targetHandle": "input",
    }


# ─────────────────────────────────────────────────────────────────────────────
# validate_definition — casos válidos
# ─────────────────────────────────────────────────────────────────────────────


class TestValidateDefinitionValid:
    """Grafos que devem passar sem erros."""

    def test_simple_trigger_only(self):
        defn = {"nodes": [_node("t1", "ManualTrigger")], "edges": []}
        assert validate_definition(defn) == []

    def test_trigger_to_action(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("a1", "SendEmail", "action", {"to": "x@y.com", "subject": "Hi"}),
            ],
            "edges": [_edge("e1", "t1", "a1")],
        }
        assert validate_definition(defn) == []

    def test_trigger_set_var_email(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("sv", "SetVariable", "utils", {"key": "email", "value": "{{trigger.payload.email}}"}),
                _node("em", "SendEmail", "action", {"to": "{{vars.email}}", "subject": "Oi"}),
            ],
            "edges": [_edge("e1", "t1", "sv"), _edge("e2", "sv", "em")],
        }
        assert validate_definition(defn) == []

    def test_webhook_trigger(self):
        defn = {
            "nodes": [_node("t1", "WebhookTrigger")],
            "edges": [],
        }
        assert validate_definition(defn) == []

    def test_if_condition_valid(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("if1", "IfCondition", "logic", {
                    "left": "{{trigger.payload.status}}",
                    "operator": "eq",
                    "right": "active",
                }),
            ],
            "edges": [_edge("e1", "t1", "if1")],
        }
        assert validate_definition(defn) == []

    def test_delay_under_cap(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("d1", "Delay", "logic", {"duration": 10, "unit": "seconds"}),
            ],
            "edges": [_edge("e1", "t1", "d1")],
        }
        assert validate_definition(defn) == []


# ─────────────────────────────────────────────────────────────────────────────
# validate_definition — casos inválidos
# ─────────────────────────────────────────────────────────────────────────────


class TestValidateDefinitionInvalid:
    """Grafos que devem retornar erros."""

    def test_empty_nodes(self):
        defn = {"nodes": [], "edges": []}
        errors = validate_definition(defn)
        assert len(errors) == 1
        assert "pelo menos um node" in errors[0]

    def test_no_trigger(self):
        defn = {
            "nodes": [_node("a1", "SendEmail", "action", {"to": "x@y.com", "subject": "Hi"})],
            "edges": [],
        }
        errors = validate_definition(defn)
        assert any("Trigger" in e for e in errors)

    def test_invalid_node_type(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("x1", "InvalidType"),
            ],
            "edges": [],
        }
        errors = validate_definition(defn)
        assert any("inválido" in e for e in errors)

    def test_edge_references_nonexistent_source(self):
        defn = {
            "nodes": [_node("t1", "ManualTrigger")],
            "edges": [_edge("e1", "ghost", "t1")],
        }
        errors = validate_definition(defn)
        assert any("source" in e for e in errors)

    def test_edge_references_nonexistent_target(self):
        defn = {
            "nodes": [_node("t1", "ManualTrigger")],
            "edges": [_edge("e1", "t1", "ghost")],
        }
        errors = validate_definition(defn)
        assert any("target" in e for e in errors)

    def test_cycle_detected(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("a1", "SetVariable", "utils", {"key": "x"}),
                _node("a2", "SetVariable", "utils", {"key": "y"}),
            ],
            "edges": [
                _edge("e1", "t1", "a1"),
                _edge("e2", "a1", "a2"),
                _edge("e3", "a2", "a1"),  # ciclo
            ],
        }
        errors = validate_definition(defn)
        assert any("Ciclo" in e or "ciclo" in e for e in errors)

    def test_http_request_missing_url(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("h1", "HttpRequest", "action", {"method": "GET"}),
            ],
            "edges": [_edge("e1", "t1", "h1")],
        }
        errors = validate_definition(defn)
        assert any("url" in e for e in errors)

    def test_send_email_missing_to(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("em", "SendEmail", "action", {"subject": "Hi"}),
            ],
            "edges": [_edge("e1", "t1", "em")],
        }
        errors = validate_definition(defn)
        assert any("'to'" in e for e in errors)

    def test_send_email_missing_subject(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("em", "SendEmail", "action", {"to": "x@y.com"}),
            ],
            "edges": [_edge("e1", "t1", "em")],
        }
        errors = validate_definition(defn)
        assert any("subject" in e for e in errors)

    def test_if_condition_invalid_operator(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("if1", "IfCondition", "logic", {
                    "left": "x",
                    "operator": "banana",
                }),
            ],
            "edges": [_edge("e1", "t1", "if1")],
        }
        errors = validate_definition(defn)
        assert any("operador" in e for e in errors)

    def test_set_variable_missing_key(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("sv", "SetVariable", "utils", {"value": "hello"}),
            ],
            "edges": [_edge("e1", "t1", "sv")],
        }
        errors = validate_definition(defn)
        assert any("key" in e for e in errors)

    def test_delay_negative_duration(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("d1", "Delay", "logic", {"duration": -5, "unit": "seconds"}),
            ],
            "edges": [_edge("e1", "t1", "d1")],
        }
        errors = validate_definition(defn)
        assert any("positivo" in e for e in errors)

    def test_delay_invalid_unit(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("d1", "Delay", "logic", {"duration": 5, "unit": "hours"}),
            ],
            "edges": [_edge("e1", "t1", "d1")],
        }
        errors = validate_definition(defn)
        assert any("unit" in e for e in errors)

    def test_delay_exceeds_cap(self):
        defn = {
            "nodes": [
                _node("t1", "ManualTrigger"),
                _node("d1", "Delay", "logic", {"duration": 2, "unit": "minutes"}),  # 120s > 55s
            ],
            "edges": [_edge("e1", "t1", "d1")],
        }
        errors = validate_definition(defn)
        assert any("55" in e for e in errors)


# ─────────────────────────────────────────────────────────────────────────────
# sanitize_io
# ─────────────────────────────────────────────────────────────────────────────


class TestSanitizeIo:
    """Testes de sanitização LGPD."""

    def test_cpf_redacted(self):
        assert "[CPF_REDACTED]" in sanitize_io("CPF: 123.456.789-10")

    def test_email_redacted(self):
        assert "[EMAIL_REDACTED]" in sanitize_io("user@example.com")

    def test_phone_br_redacted(self):
        result = sanitize_io("Tel: (11) 98765-4321")
        assert "[PHONE_REDACTED]" in result

    def test_token_redacted(self):
        result = sanitize_io("bearer: abc123secret")
        assert "[SECRET_REDACTED]" in result

    def test_card_number_redacted(self):
        result = sanitize_io("cartão: 4111 1111 1111 1111")
        assert "[CARD_REDACTED]" in result

    def test_nested_dict_sanitized(self):
        data = {"email": "user@test.com", "nested": {"cpf": "111.222.333-44"}}
        result = sanitize_io(data)
        assert "[EMAIL_REDACTED]" in result["email"]
        assert "[CPF_REDACTED]" in result["nested"]["cpf"]

    def test_list_sanitized(self):
        data = ["user@a.com", "111.222.333-44"]
        result = sanitize_io(data)
        assert "[EMAIL_REDACTED]" in result[0]
        assert "[CPF_REDACTED]" in result[1]

    def test_non_pii_unchanged(self):
        assert sanitize_io("Hello world") == "Hello world"

    def test_truncation_at_depth(self):
        data = {"level": 0}
        result = sanitize_io(data, depth=11)
        assert result == "[TRUNCATED]"

    def test_list_capped_at_50(self):
        data = list(range(100))
        result = sanitize_io(data)
        assert len(result) == 50
