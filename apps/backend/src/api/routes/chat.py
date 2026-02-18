"""Rota /chat para envio de mensagens ao agente."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.teams.completepay_team import get_completepay_team

router = APIRouter(tags=["chat"])

# Mensagens amigáveis para erros conhecidos da API do provedor (Gemini, etc.)
RATE_LIMIT_MESSAGE = (
    "Limite de uso da API de IA atingido (cota ou taxa). "
    "Tente novamente em alguns minutos ou confira sua cota no Google AI Studio / Vertex AI."
)


class ChatRequest(BaseModel):
    message: str
    user_id: str = "default"
    session_id: str | None = None


def _normalize_error_detail(exc: Exception) -> str:
    """Retorna mensagem amigável para o cliente, sem vazar JSON bruto do provedor."""
    msg = str(exc).strip()
    if "429" in msg or "RESOURCE_EXHAUSTED" in msg.upper() or "rate limit" in msg.lower():
        return RATE_LIMIT_MESSAGE
    if "503" in msg or "UNAVAILABLE" in msg.upper():
        return "Serviço de IA temporariamente indisponível. Tente novamente em instantes."
    return msg or "Erro interno ao processar a mensagem."


@router.post("/chat")
def chat(body: ChatRequest) -> dict:
    """
    Envia uma mensagem ao agente CompletePay e retorna a resposta.
    """
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message e obrigatorio")
    try:
        team = get_completepay_team()
        response = team.run(
            message,
            user_id=body.user_id,
            session_id=body.session_id,
        )
        content = response.content if hasattr(response, "content") else str(response)
        return {"content": content}
    except Exception as e:
        detail = _normalize_error_detail(e)
        raise HTTPException(status_code=503, detail=detail)
