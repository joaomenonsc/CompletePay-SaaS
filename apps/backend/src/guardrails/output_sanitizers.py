"""
Sanitizacao de saida (Output Guardrails, Fase 6).
PII redaction e validacao de schema JSON para respostas estruturadas.
"""
import json
from typing import Any, Optional, Type

from agno.exceptions import CheckTrigger, OutputCheckError
from agno.run.agent import RunOutput
from pydantic import BaseModel

from src.guardrails.pii_detector import redact


def sanitize_pii(output_text: str) -> str:
    """
    Remove/redact PII do texto de saida.
    """
    return redact(output_text)


def output_guardrail_pii(
    run_output: RunOutput,
    **kwargs: Any,
) -> None:
    """
    Post-hook para Agent: aplica redacao de PII no content da resposta.
    Modifica run_output.content in-place quando for string.
    """
    if run_output.content is None:
        return
    if isinstance(run_output.content, str):
        run_output.content = sanitize_pii(run_output.content)
        return
    if isinstance(run_output.content, BaseModel):
        run_output.content = _redact_model(run_output.content)
        return
    if isinstance(run_output.content, dict):
        run_output.content = _redact_dict(run_output.content)
        return


def _redact_dict(d: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in d.items():
        if isinstance(v, str):
            out[k] = redact(v)
        elif isinstance(v, dict):
            out[k] = _redact_dict(v)
        elif isinstance(v, list):
            out[k] = [_redact_value(x) for x in v]
        else:
            out[k] = v
    return out


def _redact_value(v: Any) -> Any:
    if isinstance(v, str):
        return redact(v)
    if isinstance(v, dict):
        return _redact_dict(v)
    if isinstance(v, list):
        return [_redact_value(x) for x in v]
    return v


def _redact_model(model: BaseModel) -> BaseModel:
    data = model.model_dump()
    redacted = _redact_dict(data)
    return model.model_validate(redacted)


def validate_json_schema(
    content: Any,
    schema_model: Optional[Type[BaseModel]] = None,
) -> tuple[bool, str]:
    """
    Valida se content e JSON valido e, se schema_model for passado, confere o schema.

    Returns:
        (True, "") se valido; (False, mensagem) em caso de erro.
    """
    if content is None:
        return True, ""
    text = content if isinstance(content, str) else str(content)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        return False, f"Resposta nao e JSON valido: {e}"
    if schema_model is not None:
        try:
            schema_model.model_validate(data)
        except Exception as e:
            return False, f"Resposta nao confere com o schema: {e}"
    return True, ""


def output_guardrail_validate_schema(
    run_output: RunOutput,
    schema_model: Optional[Type[BaseModel]] = None,
    **kwargs: Any,
) -> None:
    """
    Post-hook que valida run_output.content como JSON (e opcionalmente contra schema).
    Levanta OutputCheckError se falhar.
    """
    ok, message = validate_json_schema(run_output.content, schema_model=schema_model)
    if not ok:
        raise OutputCheckError(
            message,
            check_trigger=CheckTrigger.VALIDATION_FAILED,
        )
