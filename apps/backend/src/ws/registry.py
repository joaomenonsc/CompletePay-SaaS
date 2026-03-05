"""
Gerenciador de clientes Evolution Socket.IO.
Inicializa e mantém um EvolutionSocketClient por conta conectada.
"""
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Dict

if TYPE_CHECKING:
    from src.ws.evolution_client import EvolutionSocketClient

logger = logging.getLogger("completepay.ws.registry")


class EvolutionClientRegistry:
    """Mantém um dicionário account_id → EvolutionSocketClient."""

    def __init__(self) -> None:
        self._clients: Dict[str, EvolutionSocketClient] = {}
        self._lock = asyncio.Lock()

    async def start_account(
        self,
        account_id: str,
        organization_id: str,
        base_url: str,
        instance_name: str,
        api_key: str,
    ) -> None:
        from src.ws.evolution_client import EvolutionSocketClient

        async with self._lock:
            if account_id in self._clients:
                logger.debug("Cliente já registrado: account=%s", account_id)
                return

            client = EvolutionSocketClient(
                account_id=account_id,
                organization_id=organization_id,
                base_url=base_url,
                instance_name=instance_name,
                api_key=api_key,
            )
            self._clients[account_id] = client

        try:
            await client.start()
        except Exception:
            async with self._lock:
                self._clients.pop(account_id, None)
            raise

        logger.info("EvolutionSocketClient iniciado: account=%s instance=%s", account_id, instance_name)

    async def stop_account(self, account_id: str) -> None:
        async with self._lock:
            client = self._clients.pop(account_id, None)
        if client:
            await client.stop()
            logger.info("EvolutionSocketClient parado: account=%s", account_id)

    async def stop_all(self) -> None:
        async with self._lock:
            ids = list(self._clients.keys())
        await asyncio.gather(*[self.stop_account(aid) for aid in ids], return_exceptions=True)

    async def start_all_connected_accounts(self) -> None:
        """
        Na startup: busca todas as contas Evolution com status='connected'
        e inicia um cliente para cada uma.
        """
        try:
            from src.db.session import SessionLocal
            from src.db.models_whatsapp import WhatsAppAccount
            from src.providers.whatsapp.encryption import decrypt_api_key

            db = SessionLocal()
            try:
                accounts = db.query(WhatsAppAccount).filter(
                    WhatsAppAccount.provider == "evolution",
                    WhatsAppAccount.is_deleted.is_(False),
                    WhatsAppAccount.status == "connected",
                ).all()

                logger.info("Iniciando clientes WS para %d conta(s) conectada(s).", len(accounts))
                for acc in accounts:
                    if not acc.api_base_url or not acc.instance_name:
                        continue
                    try:
                        api_key = decrypt_api_key(acc.api_key_encrypted) if acc.api_key_encrypted else ""
                        if not api_key:
                            continue
                        await self.start_account(
                            account_id=str(acc.id),
                            organization_id=str(acc.organization_id),
                            base_url=acc.api_base_url,
                            instance_name=acc.instance_name,
                            api_key=api_key,
                        )
                    except Exception as exc:
                        logger.warning("Falha ao iniciar WS para account=%s: %s", acc.id, exc)
            finally:
                db.close()
        except Exception as exc:
            logger.error("Erro em start_all_connected_accounts: %s", exc)


# Singleton global
evolution_registry = EvolutionClientRegistry()
