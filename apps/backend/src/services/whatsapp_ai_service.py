"""
Serviço de IA para o módulo WhatsApp.
Fallback gracioso: se OPENAI_API_KEY não estiver configurada, retorna None sem erro.
PII sanitization antes de enviar ao modelo.
"""
import logging
import os
import re
from typing import Optional

from sqlalchemy.orm import Session

from src.db.models_whatsapp import WhatsAppConversation, WhatsAppMessage

logger = logging.getLogger("completepay.whatsapp.ai")


# ---------------------------------------------------------------------------
# PII Sanitization (remoção antes de enviar ao LLM externo)
# ---------------------------------------------------------------------------

_CPF_RE = re.compile(r"\d{3}\.?\d{3}\.?\d{3}-?\d{2}")
_PHONE_RE = re.compile(r"(\+?55\s?)?(\(?\d{2}\)?\s?)(\d{4,5}[\s-]?\d{4})")
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


def _sanitize_pii(text: str) -> str:
    """Remove CPF, telefones e e-mails do texto antes de enviar ao AI."""
    text = _CPF_RE.sub("[CPF omitido]", text)
    text = _PHONE_RE.sub("[telefone omitido]", text)
    text = _EMAIL_RE.sub("[email omitido]", text)
    return text


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_ai_client():
    """Retorna cliente OpenAI ou None se não configurado."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=api_key)
    except ImportError:
        logger.debug("openai package não instalado.")
        return None


def _get_conversation_text(
    db: Session,
    conversation_id: str,
    max_messages: int = 20,
) -> str:
    """
    Monta texto da conversa (últimas N mensagens) com PII sanitizado.
    """
    messages = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.conversation_id == conversation_id)
        .order_by(WhatsAppMessage.created_at.desc())
        .limit(max_messages)
        .all()
    )
    messages.reverse()

    lines = []
    for msg in messages:
        role = "Atendente" if msg.direction == "outbound" else "Paciente"
        body = _sanitize_pii(msg.body_text or f"[{msg.message_type}]")
        lines.append(f"{role}: {body}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Sugestão de resposta
# ---------------------------------------------------------------------------

def suggest_reply(
    db: Session,
    conversation_id: str,
    organization_id: str,
) -> dict:
    """
    Sugere uma resposta para a última mensagem do contato.
    Retorna {"suggested_reply": str | None, "available": bool}.
    """
    client = _get_ai_client()
    if not client:
        return {"suggested_reply": None, "available": False}

    conv = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.id == conversation_id,
        WhatsAppConversation.organization_id == organization_id,
    ).first()

    if not conv:
        return {"suggested_reply": None, "available": False}

    conversation_text = _get_conversation_text(db, conversation_id)
    if not conversation_text:
        return {"suggested_reply": None, "available": True}

    try:
        system_prompt = (
            "Você é um assistente de atendimento ao cliente de uma clínica de saúde brasileira. "
            "Sugira uma resposta empática, profissional e em português brasileiro para a última "
            "mensagem do paciente. Seja conciso (máximo 2 parágrafos). "
            "Não invente informações médicas. "
            "Se não tiver informações suficientes, sugira solicitar esclarecimentos ao paciente."
        )
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Conversa:\n{conversation_text}"},
            ],
            max_tokens=512,
            temperature=0.5,
        )
        suggestion = resp.choices[0].message.content.strip()
        return {"suggested_reply": suggestion, "available": True}
    except Exception as e:
        logger.warning("AI suggest_reply falhou: %s", e)
        return {"suggested_reply": None, "available": True}


# ---------------------------------------------------------------------------
# Resumo da conversa
# ---------------------------------------------------------------------------

def summarize_conversation(
    db: Session,
    conversation_id: str,
    organization_id: str,
) -> dict:
    """
    Gera um resumo da conversa para o atendente.
    Retorna {"summary": str | None, "available": bool}.
    """
    client = _get_ai_client()
    if not client:
        return {"summary": None, "available": False}

    conv = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.id == conversation_id,
        WhatsAppConversation.organization_id == organization_id,
    ).first()

    if not conv:
        return {"summary": None, "available": False}

    conversation_text = _get_conversation_text(db, conversation_id, max_messages=50)
    if not conversation_text:
        return {"summary": "Sem mensagens para resumir.", "available": True}

    try:
        system_prompt = (
            "Você é um assistente de saúde. Gere um resumo estruturado da conversa WhatsApp "
            "com no máximo 5 bullet points. Foque em: motivo do contato, informações clínicas "
            "relevantes (se mencionadas), próximos passos acordados. "
            "Escreva em português brasileiro."
        )
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Conversa:\n{conversation_text}"},
            ],
            max_tokens=256,
            temperature=0.3,
        )
        summary = resp.choices[0].message.content.strip()
        return {"summary": summary, "available": True}
    except Exception as e:
        logger.warning("AI summarize_conversation falhou: %s", e)
        return {"summary": None, "available": True}


# ---------------------------------------------------------------------------
# Análise de sentimento
# ---------------------------------------------------------------------------

def analyze_sentiment(text: str) -> Optional[str]:
    """
    Análise de sentimento simples (positive/neutral/negative).
    Retorna None se AI não disponível.
    """
    client = _get_ai_client()
    if not client:
        return None

    text_clean = _sanitize_pii(text[:1000])
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Analise o sentimento do texto e responda com exatamente uma palavra: "
                        "'positive', 'neutral' ou 'negative'."
                    ),
                },
                {"role": "user", "content": text_clean},
            ],
            max_tokens=10,
            temperature=0.0,
        )
        result = resp.choices[0].message.content.strip().lower()
        if result in ("positive", "neutral", "negative"):
            return result
        return "neutral"
    except Exception as e:
        logger.debug("AI analyze_sentiment falhou: %s", e)
        return None
