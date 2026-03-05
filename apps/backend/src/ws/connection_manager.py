"""
ConnectionManager — gerencia conexões WebSocket do frontend.
Permite broadcast de eventos para todos os clientes conectados a uma conta específica.
"""
import asyncio
import json
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger("completepay.ws.manager")


class ConnectionManager:
    """
    Mantém um mapeamento account_id → set[WebSocket].
    Thread-safe via asyncio.Lock.
    """

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, account_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[account_id].add(websocket)
        logger.info("WS conectado: account=%s total=%d", account_id, len(self._connections[account_id]))

    async def disconnect(self, account_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections[account_id].discard(websocket)
            if not self._connections[account_id]:
                del self._connections[account_id]
        logger.info("WS desconectado: account=%s", account_id)

    async def broadcast(self, account_id: str, event: dict) -> None:
        """Envia evento JSON para todos os clientes conectados a account_id."""
        async with self._lock:
            sockets = set(self._connections.get(account_id, set()))
        if not sockets:
            return
        dead: list[WebSocket] = []
        payload = json.dumps(event, ensure_ascii=False, default=str)
        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        # Limpar conexões mortas
        for ws in dead:
            await self.disconnect(account_id, ws)

    def connected_count(self, account_id: str) -> int:
        return len(self._connections.get(account_id, set()))


# Singleton global
ws_manager = ConnectionManager()
