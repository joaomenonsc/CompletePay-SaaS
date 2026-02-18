"""Testes dos sanitizadores de saida e validacao JSON."""
from pydantic import BaseModel

from agno.run.agent import RunOutput

from src.guardrails.output_sanitizers import (
    output_guardrail_pii,
    sanitize_pii,
    validate_json_schema,
)


class TestSanitizePii:
    def test_redacts_cpf_in_string(self):
        out = sanitize_pii("Cliente 123.456.789-00 solicitou.")
        assert "123.456.789" not in out


class TestOutputGuardrailPii:
    def test_modifies_run_output_string(self):
        run_output = RunOutput(content="O CPF 123.456.789-00 foi validado.")
        output_guardrail_pii(run_output)
        assert "123.456.789" not in str(run_output.content)
        assert "***" in str(run_output.content)

    def test_handles_none_content(self):
        run_output = RunOutput(content=None)
        output_guardrail_pii(run_output)
        assert run_output.content is None


class TestValidateJsonSchema:
    def test_valid_json_passes(self):
        ok, _ = validate_json_schema('{"a": 1}')
        assert ok is True

    def test_invalid_json_fails(self):
        ok, msg = validate_json_schema("not json at all")
        assert ok is False
        assert "JSON" in msg or "json" in msg

    def test_schema_validation_with_model(self):
        class Foo(BaseModel):
            x: int

        ok, _ = validate_json_schema('{"x": 1}', schema_model=Foo)
        assert ok is True
        ok2, msg = validate_json_schema('{"x": "not int"}', schema_model=Foo)
        assert ok2 is False
