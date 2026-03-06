"""
EvolutionSocketClient — conecta ao Socket.IO do Evolution API.
Recebe eventos (messages.upsert, connection.update) e:
  1. Persiste no banco via whatsapp_service
  2. Faz broadcast para o frontend via ConnectionManager
"""
import asyncio
import logging
import re
from typing import Any, Optional
from urllib.parse import urlencode

logger = logging.getLogger("completepay.ws.evolution")


def _normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")


def _build_message_media_proxy_url(message_id: str) -> str:
    return f"/api/v1/whatsapp/messages/{message_id}/media"


def _is_media_message_type(message_type: str) -> bool:
    return message_type.lower() in {"audio", "image", "video", "document", "sticker"}


def _looks_like_message_payload(data: Any) -> bool:
    raw = data.get("data") if isinstance(data, dict) and "data" in data else data
    items = raw if isinstance(raw, list) else [raw]
    for item in items:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        message = item.get("message")
        if isinstance(key, dict) and (
            isinstance(message, dict)
            or bool(item.get("messageType"))
            or isinstance(item.get("content"), dict)
        ):
            return True
    return False


class EvolutionSocketClient:
    """
    Cliente Socket.IO async para uma instância do Evolution API.
    Conecta a: wss://{base_url}/{instance_name}
    """

    def __init__(
        self,
        account_id: str,
        organization_id: str,
        base_url: str,
        instance_name: str,
        api_key: str,
    ) -> None:
        self.account_id = account_id
        self.organization_id = organization_id
        self.base_url = base_url.rstrip("/")
        self.instance_name = instance_name
        self.api_key = api_key
        self._sio: Optional[Any] = None
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        """Inicia a conexão em background."""
        self._running = True
        self._task = asyncio.create_task(self._run(), name=f"evo-ws-{self.instance_name}")

    async def stop(self) -> None:
        """Para a conexão."""
        self._running = False
        if self._sio:
            try:
                await self._sio.disconnect()
            except Exception:
                pass
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run(self) -> None:
        """Loop principal com reconexão automática."""
        import socketio  # type: ignore

        # Socket.IO client usa URL HTTP(S) e faz upgrade para WebSocket automaticamente.
        # Alguns ambientes Evolution operam em modo tradicional (/instance)
        # e outros em modo global (sem /instance).
        connect_urls = [
            f"{self.base_url}/{self.instance_name}",
            self.base_url,
        ]

        backoff = 2.0

        while self._running:
            try:
                await self._ensure_ws_events_enabled()
                connected = False
                last_error: Optional[str] = None

                for connect_url in connect_urls:
                    for mode, transports in (("websocket", ["websocket"]), ("auto", None)):
                        self._sio = socketio.AsyncClient(
                            logger=False,
                            engineio_logger=False,
                            reconnection=False,  # Gerenciamos reconexão manualmente
                        )
                        self._register_handlers()

                        logger.info(
                            "Conectando ao Evolution WS: instance=%s url=%s mode=%s",
                            self.instance_name, connect_url, mode,
                        )

                        # Alguns ambientes/proxies só repassam a credencial em uma forma
                        # (header, query string ou payload auth do Socket.IO).
                        qs = urlencode({"apikey": self.api_key, "apiKey": self.api_key})
                        connect_url_with_auth = f"{connect_url}?{qs}"

                        connect_kwargs: dict[str, Any] = {
                            "headers": {
                                "apikey": self.api_key,
                                "apiKey": self.api_key,
                                "Authorization": f"Bearer {self.api_key}",
                            },
                            "auth": {
                                "apikey": self.api_key,
                                "apiKey": self.api_key,
                            },
                            "wait_timeout": 15,
                        }
                        if transports is not None:
                            connect_kwargs["transports"] = transports

                        try:
                            await self._sio.connect(connect_url_with_auth, **connect_kwargs)
                            connected = True
                            backoff = 2.0  # Reset após conexão bem-sucedida
                            await self._sio.wait()  # Bloqueia até desconexão
                            break
                        except Exception as exc:
                            last_error = str(exc)
                            logger.warning(
                                "Falha ao conectar Evolution WS: instance=%s url=%s mode=%s err=%s",
                                self.instance_name, connect_url, mode, exc,
                            )
                            try:
                                await self._sio.disconnect()
                            except Exception:
                                pass

                    if connected:
                        break

                if not connected:
                    raise RuntimeError(last_error or "Connection error")

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning(
                    "Evolution WS desconectado (instance=%s): %s. Reconectando em %.0fs...",
                    self.instance_name, exc, backoff,
                )
            finally:
                if self._sio:
                    try:
                        await self._sio.disconnect()
                    except Exception:
                        pass

            if not self._running:
                break
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60.0)  # Backoff exponencial até 60s

    async def _ensure_ws_events_enabled(self) -> None:
        """
        Tenta habilitar eventos WS da instância na Evolution.
        Não falha o fluxo caso o endpoint não esteja disponível.
        """
        import httpx

        url = f"{self.base_url}/websocket/set/{self.instance_name}"
        headers = {
            "Content-Type": "application/json",
            "apikey": self.api_key,
        }
        events = [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "CONNECTION_UPDATE",
            "SEND_MESSAGE",
            "SEND_MESSAGE_UPDATE",
            "MESSAGES_SET",
        ]
        payloads = [
            {"websocket": {"enabled": True, "events": events}},
        ]

        last_error: Optional[str] = None
        async with httpx.AsyncClient(timeout=10.0) as client:
            for body in payloads:
                try:
                    response = await client.post(url, headers=headers, json=body)
                    if 200 <= response.status_code < 300:
                        logger.info("Evolution WS events habilitados: instance=%s", self.instance_name)
                        return
                    last_error = f"status={response.status_code} body={response.text[:200]}"
                except Exception as exc:
                    last_error = str(exc)

        if last_error:
            logger.warning(
                "Não foi possível garantir eventos WS na Evolution (instance=%s): %s",
                self.instance_name,
                last_error,
            )

    def _register_handlers(self) -> None:
        sio = self._sio
        known_events = {
            "messages.upsert",
            "messages.update",
            "connection.update",
            "send.message",
            "message.create",
            "message.new",
            "messages.set",
            "message.received",
            "messages.received",
            "messages.append",
            "SEND_MESSAGE",
            "MESSAGES_SET",
            "MESSAGE_RECEIVED",
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "CONNECTION_UPDATE",
        }

        @sio.event
        async def connect():
            logger.info("Evolution WS conectado: instance=%s", self.instance_name)
            from src.ws.connection_manager import ws_manager
            await ws_manager.broadcast(self.account_id, {
                "type": "ws_connected",
                "account_id": self.account_id,
            })

        @sio.event
        async def disconnect():
            logger.info("Evolution WS desconectado: instance=%s", self.instance_name)

        @sio.on("messages.upsert")
        @sio.on("MESSAGES_UPSERT")
        @sio.on("send.message")
        @sio.on("SEND_MESSAGE")
        @sio.on("messages.set")
        @sio.on("MESSAGES_SET")
        @sio.on("message.received")
        @sio.on("MESSAGE_RECEIVED")
        @sio.on("message.new")
        @sio.on("message.create")
        @sio.on("messages.append")
        @sio.on("messages.received")
        async def on_messages_upsert(data: Any):
            await self._handle_message_upsert(data)

        @sio.on("messages.update")
        @sio.on("MESSAGES_UPDATE")
        async def on_messages_update(data: Any):
            # Broadcast simples de atualização de status
            from src.ws.connection_manager import ws_manager
            await ws_manager.broadcast(self.account_id, {
                "type": "message.update",
                "account_id": self.account_id,
                "data": data,
            })

        @sio.on("connection.update")
        @sio.on("CONNECTION_UPDATE")
        async def on_connection_update(data: Any):
            await self._handle_connection_update(data)

        @sio.on("*")
        async def on_any_event(event: str, data: Any):
            if event in known_events:
                return
            if _looks_like_message_payload(data):
                logger.info(
                    "Evolution WS evento message-like não mapeado: instance=%s event=%s",
                    self.instance_name,
                    event,
                )
                await self._handle_message_upsert(data)
                return
            payload_type = type(data).__name__
            if isinstance(data, dict):
                preview = ",".join(list(data.keys())[:8])
            elif isinstance(data, list):
                preview = f"list[{len(data)}]"
            else:
                preview = str(data)[:80]
            logger.info(
                "Evolution WS evento não mapeado: instance=%s event=%s type=%s preview=%s",
                self.instance_name,
                event,
                payload_type,
                preview,
            )

    @staticmethod
    def _unwrap_event_payload(data: Any) -> Any:
        """
        Alguns deploys da Evolution enviam payload "raw" e outros enviam wrapper:
        {"event": "...", "data": {...}}.
        """
        if isinstance(data, dict) and "data" in data and isinstance(data.get("data"), (dict, list)):
            return data.get("data")
        return data

    async def _handle_message_upsert(self, data: Any) -> None:
        """Persiste mensagem no banco e faz broadcast para o frontend."""
        from src.db.session import SessionLocal
        from src.db.models_whatsapp import WhatsAppAccount
        from src.providers.whatsapp.evolution import (
            _extract_chat_display_name,
            _extract_message_datetime,
            _extract_message_body_text,
            _extract_media_payload,
            _extract_message_type,
            _extract_phone_from_evolution_payload,
            _extract_profile_picture_url,
        )
        from src.services import whatsapp_service
        from src.ws.connection_manager import ws_manager

        raw = self._unwrap_event_payload(data)
        items = raw if isinstance(raw, list) else [raw]

        type_map = {
            "conversation": "text",
            "extendedtextmessage": "text",
            "imagemessage": "image",
            "audiomessage": "audio",
            "pttmessage": "audio",
            "videomessage": "video",
            "documentmessage": "document",
            "stickermessage": "sticker",
            "locationmessage": "location",
            "templatemessage": "template",
        }

        db = SessionLocal()
        try:
            account = db.query(WhatsAppAccount).filter(
                WhatsAppAccount.id == self.account_id,
                WhatsAppAccount.is_deleted.is_(False),
            ).first()
            if not account:
                return

            for idx, item in enumerate(items):
                if not isinstance(item, dict):
                    continue
                key = item.get("key", {})
                is_from_me = bool(key.get("fromMe", False))

                phone = _extract_phone_from_evolution_payload(
                    key=key,
                    sender=item.get("sender"),
                )
                if not phone:
                    continue

                message = item.get("message", {})
                mapped_type = type_map.get(_extract_message_type(item), "text")

                body_text = _extract_message_body_text(message)
                media_url, media_type, media_filename = _extract_media_payload(message)
                message_at = _extract_message_datetime(item)
                external_id = key.get("id") or f"evo-ws-{phone}-{idx}"
                display_name = _extract_chat_display_name(item, phone)
                profile_picture_url = _extract_profile_picture_url(item)

                if is_from_me:
                    msg = whatsapp_service.record_provider_outbound_message(
                        db=db,
                        organization_id=self.organization_id,
                        account=account,
                        external_message_id=external_id,
                        phone=phone,
                        message_type=mapped_type,
                        body_text=body_text,
                        media_url=media_url,
                        media_type=media_type,
                        media_filename=media_filename,
                        display_name=display_name,
                        profile_picture_url=profile_picture_url,
                        provider_metadata=item,
                        event_at=message_at,
                    )
                else:
                    msg = whatsapp_service.record_inbound_message(
                        db=db,
                        organization_id=self.organization_id,
                        account=account,
                        external_message_id=external_id,
                        phone=phone,
                        message_type=mapped_type,
                        body_text=body_text,
                        media_url=media_url,
                        media_type=media_type,
                        media_filename=media_filename,
                        display_name=display_name,
                        profile_picture_url=profile_picture_url,
                        provider_metadata=item,
                        event_at=message_at,
                    )
                db.commit()

                if msg:
                    whatsapp_service.enrich_message_sender_context(msg)
                    media_url = msg.media_url
                    if (
                        isinstance(msg.provider_metadata, dict)
                        and (
                            msg.media_url
                            or msg.media_type
                            or _is_media_message_type(str(msg.message_type))
                        )
                    ):
                        media_url = _build_message_media_proxy_url(str(msg.id))

                    # Serializar e enviar para o frontend em tempo real
                    conv = msg.conversation_id
                    await ws_manager.broadcast(self.account_id, {
                        "type": "message.new",
                        "account_id": self.account_id,
                        "conversation_id": conv,
                        "conversation": whatsapp_service.serialize_conversation_snapshot(
                            db,
                            self.organization_id,
                            str(conv),
                        ),
                        "message": {
                            "id": str(msg.id),
                            "conversation_id": conv,
                            "external_message_id": msg.external_message_id,
                            "client_pending_id": msg.client_pending_id,
                            "direction": str(msg.direction),
                            "message_type": msg.message_type,
                            "body_text": msg.body_text,
                            "media_url": media_url,
                            "media_type": msg.media_type,
                            "media_filename": msg.media_filename,
                            "status": msg.status,
                            "created_at": msg.created_at.isoformat() if msg.created_at else None,
                            "is_group_message": bool(getattr(msg, "is_group_message", False)),
                            "sender_name": getattr(msg, "sender_name", None),
                            "sender_phone": getattr(msg, "sender_phone", None),
                        },
                    })
                    logger.info(
                        "WS broadcast message.new: account=%s conv=%s",
                        self.account_id, conv,
                    )
        except Exception as exc:
            logger.error("Erro ao processar messages.upsert via WS: %s", exc)
            db.rollback()
        finally:
            db.close()

    async def _handle_connection_update(self, data: Any) -> None:
        """Atualiza status da conta e notifica o frontend."""
        from src.db.session import SessionLocal
        from src.db.models_whatsapp import WhatsAppAccount
        from src.ws.connection_manager import ws_manager

        state = ""
        raw = self._unwrap_event_payload(data)
        if isinstance(raw, dict):
            state = (raw.get("state") or raw.get("connection") or "").lower()

        status_map = {"open": "connected", "close": "disconnected", "connecting": "pending"}
        new_status = status_map.get(state, "disconnected")

        db = SessionLocal()
        try:
            account = db.query(WhatsAppAccount).filter(
                WhatsAppAccount.id == self.account_id,
            ).first()
            if account:
                account.status = new_status
                db.commit()
        except Exception as exc:
            logger.error("Erro ao atualizar status via WS: %s", exc)
            db.rollback()
        finally:
            db.close()

        await ws_manager.broadcast(self.account_id, {
            "type": "connection.update",
            "account_id": self.account_id,
            "status": new_status,
        })
        logger.info("connection.update: account=%s state=%s → %s", self.account_id, state, new_status)
