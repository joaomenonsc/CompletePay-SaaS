"""
Validacao de limites financeiros (Seção 6.4, Fase 6).
Extrai valores monetarios do texto e valida contra limite maximo.
"""
import re
from typing import Tuple

from src.config.settings import get_settings

# Padroes comuns para valor + moeda (ex: 10000 BRL, R$ 5.000,00, 10000.50)
_AMOUNT_PATTERNS = [
    re.compile(r"(?i)(?:r\$\s*|brl\s*)?([0-9]+(?:\.[0-9]{3})*(?:,[0-9]{2})?)"),
    re.compile(r"(?i)(?:usd\s*|\$\s*)?([0-9]+(?:\.[0-9]{3})*(?:\.[0-9]{2})?)"),
    re.compile(r"([0-9]+(?:\.[0-9]+)?)\s*(?:brl|usd|eur)", re.I),
]


def _parse_amount_from_str(s: str) -> list[float]:
    """Extrai numeros que parecem valores monetarios do texto."""
    found: list[float] = []
    for pat in _AMOUNT_PATTERNS:
        for m in pat.finditer(s):
            raw = m.group(1).replace(".", "").replace(",", ".")
            try:
                v = float(raw)
                if v > 0:
                    found.append(v)
            except ValueError:
                continue
    # Tambem numeros isolados grandes (ex: "pagar 50000")
    for m in re.finditer(r"\b([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)\b", s):
        raw = m.group(1).replace(".", "").replace(",", ".")
        try:
            v = float(raw)
            if v > 0:
                found.append(v)
        except ValueError:
            continue
    return found


def get_max_transaction_limit() -> float:
    """Retorna o limite maximo de transacao (config)."""
    return get_settings().high_value_threshold


def validate_transaction_limits(input_text: str) -> Tuple[bool, str]:
    """
    Valida se algum valor monetario no texto excede o limite permitido.

    Returns:
        (True, "") se ok; (False, mensagem) se algum valor exceder.
    """
    limit = get_max_transaction_limit()
    amounts = _parse_amount_from_str(input_text)
    for amount in amounts:
        if amount > limit:
            return (
                False,
                f"Valor {amount} excede o limite de transacao permitido ({limit}).",
            )
    return True, ""
