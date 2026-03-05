"""
Factory de providers WhatsApp.
Recebe um WhatsAppAccount e retorna o provider correto com a API key descriptografada.
"""
from src.db.models_whatsapp import WhatsAppAccount
from src.providers.whatsapp.base import WhatsAppProviderInterface
from src.providers.whatsapp.encryption import decrypt_api_key


def get_whatsapp_provider(account: WhatsAppAccount) -> WhatsAppProviderInterface:
    """
    Retorna o provider WhatsApp correto para a conta informada.
    Descriptografa a api_key antes de instanciar.

    Args:
        account: WhatsAppAccount com os campos provider, api_key_encrypted,
                 api_base_url e instance_name.

    Returns:
        Instância de WhatsAppProviderInterface pronta para uso.

    Raises:
        ValueError: Se o provider não for reconhecido ou a conta não tiver as credenciais.
        RuntimeError: Se a descriptografia falhar (chave errada ou dado corrompido).
    """
    provider = (account.provider or "").lower()

    api_key = ""
    if account.api_key_encrypted:
        try:
            api_key = decrypt_api_key(account.api_key_encrypted)
        except Exception as e:
            raise RuntimeError(
                f"Falha ao descriptografar api_key da conta {account.id}: {e}"
            )

    if provider == "evolution":
        from src.providers.whatsapp.evolution import EvolutionAPIProvider
        base_url = account.api_base_url or ""
        if not base_url:
            raise ValueError(
                f"Conta {account.id} (Evolution): api_base_url não configurada."
            )
        if not api_key:
            raise ValueError(
                f"Conta {account.id} (Evolution): api_key não configurada."
            )
        return EvolutionAPIProvider(
            base_url=base_url,
            api_key=api_key,
            instance_name=account.instance_name or "",
        )

    elif provider == "waha":
        from src.providers.whatsapp.waha import WAHAProvider
        return WAHAProvider()

    elif provider == "meta":
        from src.providers.whatsapp.meta import MetaOfficialProvider
        return MetaOfficialProvider()

    else:
        raise ValueError(
            f"Provider WhatsApp desconhecido: '{provider}'. "
            "Valores aceitos: 'evolution', 'waha', 'meta'."
        )
