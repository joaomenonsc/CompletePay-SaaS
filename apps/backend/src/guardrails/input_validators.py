"""
Validadores de entrada e Chain of Responsibility (Seção 6.4, Fase 6).
Compativel com pre_hooks do Agno: recebem run_input e podem levantar InputCheckError.
"""
from typing import Any, Callable, List

from agno.exceptions import CheckTrigger, InputCheckError
from agno.run.agent import RunInput

from src.guardrails.transaction_limits import validate_transaction_limits

# Padroes tipicos de tentativa de prompt injection / jailbreak
_INJECTION_PATTERNS = [
    "ignore previous instructions",
    "ignore all previous",
    "developer mode",
    "jailbreak",
    "roleplay as",
    "you are now",
    "disregard your",
    "forget your instructions",
    "nova instrucao:",
    "novas instrucoes:",
    "ignore o sistema",
    "desconsidere",
]


def check_injection_attempt(input_text: str) -> tuple[bool, str]:
    """
    Detecta padroes de prompt injection no texto.

    Returns:
        (True, "") se ok; (False, mensagem) se detectar tentativa.
    """
    lower = input_text.lower().strip()
    for pattern in _INJECTION_PATTERNS:
        if pattern in lower:
            return False, "Entrada contem padrao nao permitido (seguranca)."
    return True, ""


def check_prohibited_content(input_text: str) -> tuple[bool, str]:
    """
    Verifica conteudo proibido (lista extensivel).
    Por ora, apenas delega para injection; pode acrescentar mais regras.
    """
    return check_injection_attempt(input_text)


def validate_input_chain(input_text: str) -> tuple[bool, str]:
    """
    Cadeia de validacoes de input (Chain of Responsibility).
    Ordem: injection -> limites de transacao -> conteudo proibido.

    Returns:
        (True, "") se todas passarem; (False, mensagem) na primeira falha.
    """
    validators: List[Callable[[str], tuple[bool, str]]] = [
        check_injection_attempt,
        validate_transaction_limits,
        check_prohibited_content,
    ]
    for validator in validators:
        ok, msg = validator(input_text)
        if not ok:
            return False, msg
    return True, ""


def input_guardrail_chain(
    run_input: RunInput,
    **kwargs: Any,
) -> None:
    """
    Pre-hook para Agent: executa a cadeia de validacao sobre o input.
    Levanta InputCheckError se alguma validacao falhar.
    """
    text = run_input.input_content_string()
    ok, message = validate_input_chain(text)
    if not ok:
        raise InputCheckError(
            message,
            check_trigger=CheckTrigger.PROMPT_INJECTION
            if "padrao nao permitido" in message
            else CheckTrigger.VALIDATION_FAILED,
        )
