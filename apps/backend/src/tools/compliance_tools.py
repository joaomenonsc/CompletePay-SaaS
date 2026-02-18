"""Tools de compliance: verify_identity, audit_log."""
from agno.tools import tool

from src.tools.repositories import get_compliance_repository


@tool
def verify_identity(user_id: str) -> str:
    """Verifica a identidade de um usuario (KYC).

    Args:
        user_id: ID do usuario.
    """
    repo = get_compliance_repository()
    result = repo.verify_identity(user_id)
    if result.verified:
        return f"Identidade verificada. Nivel: {result.level}. {result.message}"
    return f"Verificacao pendente ou reprovada. {result.message}"


@tool
def audit_log(action: str, entity_type: str, entity_id: str, details: str = "") -> str:
    """Registra uma entrada no log de auditoria.

    Args:
        action: Acao realizada (ex: payment_created, refund_requested).
        entity_type: Tipo da entidade (ex: transaction, user).
        entity_id: ID da entidade.
        details: Detalhes opcionais.
    """
    repo = get_compliance_repository()
    entry = repo.audit_log(action=action, entity_type=entity_type, entity_id=entity_id, details=details)
    return f"Auditoria registrada: {entry.action} em {entry.entity_type}/{entry.entity_id}"
