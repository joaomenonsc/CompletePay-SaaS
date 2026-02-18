"""
Detector e redator de PII (dados pessoais) no output (Fase 6).
CPF, numeros de cartao, e-mail e telefone.
"""
import re
from typing import List, Tuple

# CPF: 11 digitos, formatos 000.000.000-00 ou 00000000000
_CPF_PATTERN = re.compile(
    r"\b(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})\b"
)
# Cartao: 4 grupos de 4 digitos (podem ter espacos ou hifens)
_CARD_PATTERN = re.compile(
    r"\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4})\b"
)
# E-mail (simplificado)
_EMAIL_PATTERN = re.compile(
    r"\b([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b"
)
# Telefone BR: (11) 99999-9999 ou 11999999999
_PHONE_PATTERN = re.compile(
    r"\b(\(?\d{2}\)?\s*\d{4,5}[\s\-]?\d{4})\b"
)

_MASK_CPF = "***.***.***-**"
_MASK_CARD = "**** **** **** ****"
_MASK_EMAIL = "[email redacted]"
_MASK_PHONE = "(**) *****-****"


def redact(text: str) -> str:
    """
    Substitui PII no texto por mascaras.

    Redacao: CPF, numero de cartao, e-mail, telefone.
    """
    if not text or not isinstance(text, str):
        return text
    out = text
    out = _CPF_PATTERN.sub(_MASK_CPF, out)
    out = _CARD_PATTERN.sub(_MASK_CARD, out)
    out = _EMAIL_PATTERN.sub(_MASK_EMAIL, out)
    out = _PHONE_PATTERN.sub(_MASK_PHONE, out)
    return out


def find_pii(text: str) -> List[Tuple[str, str]]:
    """
    Retorna lista de (tipo, trecho) encontrados para auditoria.
    """
    found: List[Tuple[str, str]] = []
    for m in _CPF_PATTERN.finditer(text):
        found.append(("cpf", m.group(1)))
    for m in _CARD_PATTERN.finditer(text):
        found.append(("card", m.group(1)))
    for m in _EMAIL_PATTERN.finditer(text):
        found.append(("email", m.group(1)))
    for m in _PHONE_PATTERN.finditer(text):
        found.append(("phone", m.group(1)))
    return found
