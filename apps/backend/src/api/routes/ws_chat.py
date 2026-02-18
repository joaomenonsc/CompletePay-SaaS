"""
WebSocket endpoint para chat em tempo real com streaming.
Fase 4.4 - Substitui POST /chat para experiencia de streaming.
"""
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError

from src.auth.service import decode_access_token
from src.teams.completepay_team import get_completepay_team

logger = logging.getLogger("completepay.ws_chat")

router = APIRouter(tags=["websocket"])


class WsChatMessage(BaseModel):
    """Mensagem recebida via WebSocket."""
    type: str = "message"  # "message" | "ping"
    content: str = ""
    session_id: str | None = None


async def _authenticate_ws(websocket: WebSocket) -> str | None:
    """
    Extrai e valida JWT do query param ?token=xxx.
    WebSocket nao suporta headers customizados no handshake do browser,
    entao o token vai como query parameter.
    Retorna user_id se valido, None se invalido.
    """
    token = websocket.query_params.get("token")
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        return payload.get("sub")  # user_id
    except Exception:
        return None


async def _send_error(websocket: WebSocket, error: str) -> None:
    """Envia mensagem de erro pelo WebSocket."""
    await websocket.send_json({
        "type": "error",
        "content": error,
    })


def _normalize_ws_error(exc: Exception) -> str:
    """Mensagem amigavel para erros conhecidos."""
    msg = str(exc)
    if "429" in msg or "RESOURCE_EXHAUSTED" in msg.upper():
        return "Limite de uso da API de IA atingido. Tente novamente em alguns minutos."
    if "503" in msg or "UNAVAILABLE" in msg.upper():
        return "Servico de IA temporariamente indisponivel."
    return "Erro ao processar mensagem. Tente novamente."


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket) -> None:
    """
    WebSocket endpoint para chat com streaming.

    Protocolo:
    - Cliente envia: {"type": "message", "content": "...", "session_id": "..."}
    - Servidor responde em chunks:
        {"type": "stream_start"}
        {"type": "token", "content": "palavra "}
        {"type": "token", "content": "por "}
        {"type": "token", "content": "palavra"}
        {"type": "stream_end", "content": "resposta completa aqui"}
    - Heartbeat: cliente envia {"type": "ping"}, servidor responde {"type": "pong"}
    - Erro: {"type": "error", "content": "mensagem de erro"}
    """
    # 1. Autenticar antes de aceitar conexao
    user_id = await _authenticate_ws(websocket)
    if not user_id:
        # Aceitar e fechar imediatamente (protocolo exige accept antes de close)
        await websocket.accept()
        await websocket.close(code=4001, reason="Token invalido ou ausente")
        return

    # 2. Aceitar conexao WebSocket
    await websocket.accept()
    logger.info("WebSocket conectado", extra={"user_id": user_id})

    try:
        while True:
            # 3. Receber mensagem do cliente
            raw = await websocket.receive_text()
            try:
                msg = WsChatMessage.model_validate_json(raw)
            except (ValidationError, json.JSONDecodeError):
                await _send_error(websocket, "Formato de mensagem invalido")
                continue

            # 4. Heartbeat
            if msg.type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            # 5. Validar conteudo
            content = msg.content.strip()
            if not content:
                await _send_error(websocket, "Mensagem vazia")
                continue

            # 6. Processar com streaming
            await websocket.send_json({"type": "stream_start"})

            try:
                team = get_completepay_team()
                full_response = ""

                # Tenta usar streaming do Agno (run com stream=True)
                response_stream = team.run(
                    content,
                    user_id=user_id,
                    session_id=msg.session_id,
                    stream=True,
                )

                # Itera sobre os chunks do stream
                for chunk in response_stream:
                    token = ""
                    if hasattr(chunk, "content") and chunk.content:
                        token = chunk.content
                    elif isinstance(chunk, str):
                        token = chunk

                    if token:
                        full_response += token
                        await websocket.send_json({
                            "type": "token",
                            "content": token,
                        })

                # Fallback: se stream nao produziu nada, tenta sincrono
                if not full_response:
                    sync_response = team.run(
                        content,
                        user_id=user_id,
                        session_id=msg.session_id,
                    )
                    full_response = (
                        sync_response.content
                        if hasattr(sync_response, "content")
                        else str(sync_response)
                    )
                    await websocket.send_json({
                        "type": "token",
                        "content": full_response,
                    })

                await websocket.send_json({
                    "type": "stream_end",
                    "content": full_response,
                })

            except Exception as e:
                logger.error("Erro no processamento WS", extra={"error": str(e), "user_id": user_id})
                await _send_error(websocket, _normalize_ws_error(e))

    except WebSocketDisconnect:
        logger.info("WebSocket desconectado", extra={"user_id": user_id})
    except Exception as e:
        logger.error("Erro inesperado no WebSocket", extra={"error": str(e)})
