"""
Serviço core do módulo WhatsApp.
Responsabilidades: contatos, conversas, mensagens, opt-out.
O db.commit() é responsabilidade da camada de rota (não deste serviço),
exceto nas BackgroundTasks que gerenciam sua própria sessão.
"""
import hashlib
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from src.db.models_whatsapp import (
    WhatsAppAccount,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppMessage,
    WhatsAppTemplate,
    ConversationStatus,
    MessageDirection,
    MessageStatus,
    TemplateStatus,
)

logger = logging.getLogger("completepay.whatsapp.service")


# ---------------------------------------------------------------------------
# Utilitários de telefone
# ---------------------------------------------------------------------------

def _normalize_phone(phone: str) -> str:
    """Remove qualquer caractere não-dígito."""
    return re.sub(r"\D", "", phone or "")


def _to_e164(phone_normalized: str) -> str:
    """Converte phone_normalized para E.164 (com +)."""
    return f"+{phone_normalized}" if phone_normalized else ""


def _display_phone(phone_normalized: str) -> Optional[str]:
    """Formata para exibição BR: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX."""
    d = phone_normalized
    if len(d) == 13 and d.startswith("55"):
        d = d[2:]  # remove DDI 55
    if len(d) == 11:  # celular com DDD
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:  # fixo com DDD
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return None


def _phone_variants(phone_normalized: str) -> list[str]:
    """
    Retorna variantes equivalentes do telefone para deduplicação.
    Regra BR: tratar celular com/sem nono dígito como o mesmo contato.
    """
    normalized = _normalize_phone(phone_normalized)
    if not normalized:
        return []

    variants = {normalized}

    # +55 + DDD + 8 dígitos (12 no total) -> tenta versão com nono dígito
    # apenas quando já parece celular (inicia com 9).
    if len(normalized) == 12 and normalized.startswith("55"):
        subscriber = normalized[4:]
        if subscriber.startswith("9"):
            variants.add(f"{normalized[:4]}9{subscriber}")

    # +55 + DDD + 9 dígitos (13 no total) -> versão sem nono dígito
    if len(normalized) == 13 and normalized.startswith("55") and normalized[4] == "9":
        variants.add(f"{normalized[:4]}{normalized[5:]}")

    # Ordena para manter determinismo (mais longo primeiro: tende ao formato com 9).
    return sorted(variants, key=lambda p: (-len(p), p))


# ---------------------------------------------------------------------------
# Account helpers
# ---------------------------------------------------------------------------

def get_account(
    db: Session,
    account_id: str,
    organization_id: str,
) -> Optional[WhatsAppAccount]:
    """Retorna conta ativa ou None."""
    return db.query(WhatsAppAccount).filter(
        WhatsAppAccount.id == account_id,
        WhatsAppAccount.organization_id == organization_id,
        WhatsAppAccount.is_deleted == False,
    ).first()


def get_account_or_raise(
    db: Session,
    account_id: str,
    organization_id: str,
):
    """Retorna conta ou levanta ValueError."""
    acc = get_account(db, account_id, organization_id)
    if not acc:
        raise ValueError(f"Conta WhatsApp '{account_id}' não encontrada.")
    return acc


def list_accounts(
    db: Session,
    organization_id: str,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[WhatsAppAccount], int]:
    q = db.query(WhatsAppAccount).filter(
        WhatsAppAccount.organization_id == organization_id,
        WhatsAppAccount.is_deleted == False,
    )
    total = q.count()
    items = q.order_by(WhatsAppAccount.created_at).offset(offset).limit(limit).all()
    return items, total


def create_account(
    db: Session,
    organization_id: str,
    display_name: str,
    phone_number: str,
    provider: str,
    instance_name: Optional[str],
    api_base_url: Optional[str],
    api_key: Optional[str],
    webhook_secret: Optional[str],
    is_default: bool,
    created_by: Optional[str],
) -> WhatsAppAccount:
    """Cria uma nova conta WhatsApp com api_key criptografada."""
    from src.providers.whatsapp.encryption import encrypt_api_key

    api_key_encrypted = None
    if api_key:
        api_key_encrypted = encrypt_api_key(api_key)

    webhook_secret_hash = None
    if webhook_secret:
        webhook_secret_hash = hashlib.sha256(webhook_secret.encode()).hexdigest()

    # Se is_default, desativar outros defaults da org
    if is_default:
        db.query(WhatsAppAccount).filter(
            WhatsAppAccount.organization_id == organization_id,
            WhatsAppAccount.is_default == True,
        ).update({"is_default": False})

    # Verificar se já existe conta soft-deleted com o mesmo número — reutilizá-la
    # para evitar violação do unique constraint (organization_id, phone_number)
    existing_deleted = db.query(WhatsAppAccount).filter(
        WhatsAppAccount.organization_id == organization_id,
        WhatsAppAccount.phone_number == phone_number,
        WhatsAppAccount.is_deleted == True,
    ).first()

    if existing_deleted:
        # Reativar a conta com os dados novos
        existing_deleted.is_deleted = False
        existing_deleted.display_name = display_name
        existing_deleted.provider = provider
        existing_deleted.instance_name = instance_name
        existing_deleted.api_base_url = api_base_url
        existing_deleted.api_key_encrypted = api_key_encrypted
        existing_deleted.webhook_secret_hash = webhook_secret_hash
        existing_deleted.is_default = is_default
        existing_deleted.status = "disconnected"
        logger.info(
            "Conta WhatsApp reativada: id=%s org=%s phone=%s",
            existing_deleted.id, organization_id, phone_number,
        )
        return existing_deleted

    account = WhatsAppAccount(
        organization_id=organization_id,
        display_name=display_name,
        phone_number=phone_number,
        provider=provider,
        instance_name=instance_name,
        api_base_url=api_base_url,
        api_key_encrypted=api_key_encrypted,
        webhook_secret_hash=webhook_secret_hash,
        is_default=is_default,
        created_by=created_by,
    )
    db.add(account)
    return account


def update_account(
    db: Session,
    account: WhatsAppAccount,
    display_name: Optional[str] = None,
    instance_name: Optional[str] = None,
    api_base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    webhook_secret: Optional[str] = None,
    is_default: Optional[bool] = None,
) -> WhatsAppAccount:
    from src.providers.whatsapp.encryption import encrypt_api_key

    if display_name is not None:
        account.display_name = display_name
    if instance_name is not None:
        account.instance_name = instance_name
    if api_base_url is not None:
        account.api_base_url = api_base_url
    if api_key is not None:
        account.api_key_encrypted = encrypt_api_key(api_key)
    if webhook_secret is not None:
        account.webhook_secret_hash = hashlib.sha256(webhook_secret.encode()).hexdigest()
    if is_default is not None:
        if is_default:
            db.query(WhatsAppAccount).filter(
                WhatsAppAccount.organization_id == account.organization_id,
                WhatsAppAccount.is_default == True,
                WhatsAppAccount.id != account.id,
            ).update({"is_default": False})
        account.is_default = is_default

    return account


def delete_account(
    db: Session,
    account: WhatsAppAccount,
) -> None:
    """
    Soft-delete da conta WhatsApp.
    Verifica conversas ativas antes de deletar.
    """
    active_conversations = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.account_id == account.id,
        WhatsAppConversation.status == ConversationStatus.OPEN,
        WhatsAppConversation.is_deleted == False,
    ).count()

    if active_conversations > 0:
        raise ValueError(
            f"Conta possui {active_conversations} conversa(s) aberta(s). "
            "Resolva ou arquive as conversas antes de remover a conta."
        )
    account.is_deleted = True


# ---------------------------------------------------------------------------
# Contact helpers
# ---------------------------------------------------------------------------

def get_or_create_contact(
    db: Session,
    organization_id: str,
    phone: str,
    display_name: Optional[str] = None,
    account_id: Optional[str] = None,
) -> WhatsAppContact:
    """
    Retorna contato existente ou cria um novo.
    Deduplicação via phone_normalized unique constraint.
    """
    phone_normalized = _normalize_phone(phone)
    if not phone_normalized:
        raise ValueError("Número de telefone inválido.")

    contact = db.query(WhatsAppContact).filter(
        WhatsAppContact.organization_id == organization_id,
        WhatsAppContact.is_deleted == False,
        WhatsAppContact.phone_normalized == phone_normalized,
    ).first()

    if not contact:
        variants = _phone_variants(phone_normalized)
        candidates = db.query(WhatsAppContact).filter(
            WhatsAppContact.organization_id == organization_id,
            WhatsAppContact.is_deleted == False,
            WhatsAppContact.phone_normalized.in_(variants),
        ).all()

        if candidates:
            # 1) Se já existe conversa aberta na conta, reutilizar o mesmo contato.
            if account_id:
                candidate_ids = [c.id for c in candidates]
                conv_contact = db.query(WhatsAppConversation.contact_id).filter(
                    WhatsAppConversation.organization_id == organization_id,
                    WhatsAppConversation.account_id == account_id,
                    WhatsAppConversation.status == ConversationStatus.OPEN,
                    WhatsAppConversation.is_deleted == False,
                    WhatsAppConversation.contact_id.in_(candidate_ids),
                ).order_by(desc(WhatsAppConversation.last_message_at)).first()
                if conv_contact and conv_contact[0]:
                    mapped = {c.id: c for c in candidates}
                    contact = mapped.get(conv_contact[0])

            # 2) Fallback: preferir formato com nono dígito (mais longo).
            if not contact:
                contact = sorted(
                    candidates,
                    key=lambda c: (
                        -len(c.phone_normalized or ""),
                        -(c.created_at.timestamp() if c.created_at else 0.0),
                    ),
                )[0]

    if contact:
        # Atualiza display_name se fornecido
        if display_name and not contact.display_name:
            contact.display_name = display_name
        return contact

    # Cria novo contato
    contact = WhatsAppContact(
        organization_id=organization_id,
        phone_normalized=phone_normalized,
        phone_e164=_to_e164(phone_normalized),
        phone_display=_display_phone(phone_normalized),
        display_name=display_name,
    )
    db.add(contact)
    db.flush()  # gera o id antes de retornar

    # Tenta auto-link com CRM Patient pelo telefone
    _try_link_patient(db, contact)

    return contact


def _try_link_patient(db: Session, contact: WhatsAppContact) -> None:
    """
    Tenta vincular o contato a um Patient do CRM pelo telefone.
    Silencia erros — o link é opcional.
    """
    try:
        from src.db.models_crm import Patient
        patient = db.query(Patient).filter(
            Patient.organization_id == contact.organization_id,
            func.replace(func.replace(func.replace(Patient.phone, "(", ""), ")", ""), "-", "").like(
                f"%{contact.phone_normalized[-8:]}%"
            ),
        ).first()
        if patient:
            contact.patient_id = patient.id
    except Exception:
        pass  # CRM pode não estar disponível — não bloquear o fluxo


# ---------------------------------------------------------------------------
# Conversation helpers
# ---------------------------------------------------------------------------

def get_or_create_conversation(
    db: Session,
    organization_id: str,
    account_id: str,
    contact_id: str,
) -> WhatsAppConversation:
    """
    Retorna conversa aberta existente ou cria uma nova.
    Cada par (account_id, contact_id) pode ter NO MÁXIMO UMA conversa aberta.
    """
    conv = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.organization_id == organization_id,
        WhatsAppConversation.account_id == account_id,
        WhatsAppConversation.contact_id == contact_id,
        WhatsAppConversation.status == ConversationStatus.OPEN,
        WhatsAppConversation.is_deleted == False,
    ).first()

    if conv:
        return conv

    conv = WhatsAppConversation(
        organization_id=organization_id,
        account_id=account_id,
        contact_id=contact_id,
        status=ConversationStatus.OPEN,
        unread_count=0,
        last_message_at=datetime.now(timezone.utc),
    )
    db.add(conv)
    db.flush()
    return conv


def get_conversation(
    db: Session,
    conversation_id: str,
    organization_id: str,
) -> Optional[WhatsAppConversation]:
    return db.query(WhatsAppConversation).filter(
        WhatsAppConversation.id == conversation_id,
        WhatsAppConversation.organization_id == organization_id,
        WhatsAppConversation.is_deleted == False,
    ).first()


def get_conversations_inbox(
    db: Session,
    organization_id: str,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    account_id: Optional[str] = None,
    search: Optional[str] = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[WhatsAppConversation], int]:
    """
    Listagem de inbox com filtros.
    Retorna ordenado por last_message_at DESC (mais recente primeiro).
    """
    q = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.organization_id == organization_id,
        WhatsAppConversation.is_deleted == False,
    )
    if status:
        q = q.filter(WhatsAppConversation.status == status)
    if assigned_to is not None:
        q = q.filter(WhatsAppConversation.assigned_to == assigned_to)
    if account_id:
        q = q.filter(WhatsAppConversation.account_id == account_id)

    q = q.order_by(desc(WhatsAppConversation.last_message_at))
    total = q.count()
    items = q.offset(offset).limit(limit).all()
    return items, total


def update_conversation(
    db: Session,
    conversation: WhatsAppConversation,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    tags: Optional[list] = None,
    sla_deadline: Optional[datetime] = None,
) -> WhatsAppConversation:
    if status is not None:
        conversation.status = status
        if status == ConversationStatus.RESOLVED:
            conversation.resolved_at = datetime.now(timezone.utc)
    if assigned_to is not None:
        conversation.assigned_to = assigned_to if assigned_to else None
    if tags is not None:
        conversation.tags = tags
    if sla_deadline is not None:
        conversation.sla_deadline = sla_deadline
    return conversation


# ---------------------------------------------------------------------------
# Message helpers
# ---------------------------------------------------------------------------

def record_inbound_message(
    db: Session,
    organization_id: str,
    account: WhatsAppAccount,
    external_message_id: str,
    phone: str,
    message_type: str,
    body_text: Optional[str] = None,
    media_url: Optional[str] = None,
    media_type: Optional[str] = None,
    media_filename: Optional[str] = None,
    display_name: Optional[str] = None,
    provider_metadata: Optional[dict] = None,
) -> Optional[WhatsAppMessage]:
    """
    Registra mensagem inbound recebida via webhook.
    Idempotente: verifica external_message_id antes de criar.
    """
    # Idempotência — C5 fix
    existing = db.query(WhatsAppMessage).filter(
        WhatsAppMessage.organization_id == organization_id,
        WhatsAppMessage.external_message_id == external_message_id,
    ).first()
    if existing:
        logger.debug("Mensagem duplicada recebida: %s — ignorando.", external_message_id)
        return existing

    contact = get_or_create_contact(
        db,
        organization_id,
        phone,
        display_name,
        account_id=account.id,
    )

    # Verificar opt-out
    if contact.opted_out:
        logger.info(
            "Mensagem de contato com opt-out ignorada: contact_id=%s", contact.id
        )
        return None

    conversation = get_or_create_conversation(
        db, organization_id, account.id, contact.id
    )

    # Atualizar metadados da conversa
    now = datetime.now(timezone.utc)
    conversation.last_message_at = now
    conversation.unread_count = (conversation.unread_count or 0) + 1

    preview = (body_text or "")[:256] if body_text else f"[{message_type}]"
    conversation.last_message_preview = preview

    # Registrar first_response_at se ainda não registrado
    if not conversation.first_response_at and conversation.created_at:
        pass  # first_response_at = quando NÓOS respondemos, não quando mensagem chega

    msg = WhatsAppMessage(
        organization_id=organization_id,
        conversation_id=conversation.id,
        contact_id=contact.id,
        external_message_id=external_message_id,
        direction=MessageDirection.INBOUND,
        message_type=message_type,
        status=MessageStatus.READ,  # inbound já é "read" por nós
        body_text=body_text,
        media_url=media_url,
        media_type=media_type,
        media_filename=media_filename,
        provider_metadata=provider_metadata,
        read_at=now,
    )
    db.add(msg)

    # Disparar verificação de triggers de automação (assíncrono/lazy)
    _check_automation_triggers(db, conversation, msg)

    # Detectar opt-out keywords (STOP, PARAR, etc.)
    if body_text:
        _check_opt_out_keyword(db, contact, body_text)

    return msg


def send_text_message(
    db: Session,
    account: WhatsAppAccount,
    conversation: WhatsAppConversation,
    text: str,
    user_id: Optional[str] = None,
) -> WhatsAppMessage:
    """
    Envia mensagem de texto via provider e registra no banco.
    O db.commit() deve ser chamado pela rota após este método.
    """
    from src.providers.whatsapp.factory import get_whatsapp_provider

    contact = db.query(WhatsAppContact).filter(
        WhatsAppContact.id == conversation.contact_id,
    ).first()
    if not contact:
        raise ValueError("Contato da conversa não encontrado.")

    if contact.opted_out:
        raise ValueError("Contato possui opt-out ativo. Não é possível enviar mensagem.")

    # ID interno temporário para idempotência antes do ACK do provider
    temp_external_id = f"pending:{uuid.uuid4()}"

    msg = WhatsAppMessage(
        organization_id=conversation.organization_id,
        conversation_id=conversation.id,
        contact_id=contact.id,
        external_message_id=temp_external_id,
        direction=MessageDirection.OUTBOUND,
        message_type="text",
        status=MessageStatus.PENDING,
        body_text=text,
        sender_user_id=user_id,
    )
    db.add(msg)
    db.flush()  # garante msg.id antes de chamar provider

    # Chama o provider
    try:
        provider = get_whatsapp_provider(account)
        result = provider.send_text(contact.phone_e164, text)

        if result.status != "failed" and result.external_message_id:
            msg.external_message_id = result.external_message_id
            msg.status = MessageStatus.SENT
            msg.sent_at = datetime.now(timezone.utc)
            msg.provider_metadata = result.provider_metadata
        else:
            msg.status = MessageStatus.FAILED
            msg.error_message = result.error or "Falha desconhecida no provider."
            msg.failed_at = datetime.now(timezone.utc)
    except Exception as e:
        logger.exception("Falha ao enviar mensagem via provider")
        msg.status = MessageStatus.FAILED
        msg.error_message = str(e)[:512]
        msg.failed_at = datetime.now(timezone.utc)

    # Atualiza conversa
    now = datetime.now(timezone.utc)
    conversation.last_message_at = now
    conversation.last_message_preview = text[:256]
    # Primeira resposta do atendente
    if not conversation.first_response_at:
        conversation.first_response_at = now

    return msg


def send_template_message(
    db: Session,
    account: WhatsAppAccount,
    conversation: WhatsAppConversation,
    template: WhatsAppTemplate,
    variables: Optional[dict] = None,
    user_id: Optional[str] = None,
) -> WhatsAppMessage:
    """Envia mensagem de template aprovado via provider."""
    from src.providers.whatsapp.factory import get_whatsapp_provider

    if template.status != TemplateStatus.APPROVED:
        raise ValueError(
            f"Template '{template.name}' está com status '{template.status}'. "
            "Apenas templates APPROVED podem ser enviados."
        )

    contact = db.query(WhatsAppContact).filter(
        WhatsAppContact.id == conversation.contact_id,
    ).first()
    if not contact:
        raise ValueError("Contato da conversa não encontrado.")
    if contact.opted_out:
        raise ValueError("Contato possui opt-out ativo.")

    temp_external_id = f"pending:{uuid.uuid4()}"
    msg = WhatsAppMessage(
        organization_id=conversation.organization_id,
        conversation_id=conversation.id,
        contact_id=contact.id,
        external_message_id=temp_external_id,
        direction=MessageDirection.OUTBOUND,
        message_type="template",
        status=MessageStatus.PENDING,
        template_id=template.id,
        template_variables=variables,
        sender_user_id=user_id,
    )
    db.add(msg)
    db.flush()

    try:
        provider = get_whatsapp_provider(account)
        result = provider.send_template(
            contact.phone_e164,
            template.name,
            template.language,
            variables or {},
        )
        if result.status != "failed" and result.external_message_id:
            msg.external_message_id = result.external_message_id
            msg.status = MessageStatus.SENT
            msg.sent_at = datetime.now(timezone.utc)
            msg.provider_metadata = result.provider_metadata
        else:
            msg.status = MessageStatus.FAILED
            msg.error_message = result.error or "Falha desconhecida no provider."
            msg.failed_at = datetime.now(timezone.utc)
    except Exception as e:
        logger.exception("Falha ao enviar template via provider")
        msg.status = MessageStatus.FAILED
        msg.error_message = str(e)[:512]
        msg.failed_at = datetime.now(timezone.utc)

    now = datetime.now(timezone.utc)
    conversation.last_message_at = now
    conversation.last_message_preview = f"[Template: {template.name}]"
    if not conversation.first_response_at:
        conversation.first_response_at = now

    return msg


def update_message_status(
    db: Session,
    organization_id: str,
    external_message_id: str,
    status: str,
    timestamp: Optional[str] = None,
    error: Optional[str] = None,
) -> Optional[WhatsAppMessage]:
    """
    Atualiza status de mensagem outbound a partir de webhook de delivery/read/failed.
    """
    msg = db.query(WhatsAppMessage).filter(
        WhatsAppMessage.organization_id == organization_id,
        WhatsAppMessage.external_message_id == external_message_id,
    ).first()

    if not msg:
        logger.debug("update_message_status: mensagem '%s' não encontrada.", external_message_id)
        return None

    now = datetime.now(timezone.utc)
    msg.status = status

    if status == MessageStatus.DELIVERED:
        msg.delivered_at = msg.delivered_at or now
    elif status == MessageStatus.READ:
        msg.read_at = msg.read_at or now
        if not msg.delivered_at:
            msg.delivered_at = now
    elif status == MessageStatus.FAILED:
        msg.failed_at = msg.failed_at or now
        if error:
            msg.error_message = error[:512]

    return msg


def get_messages(
    db: Session,
    organization_id: str,
    conversation_id: str,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[WhatsAppMessage], int]:
    """Histórico de mensagens de uma conversa."""
    q = db.query(WhatsAppMessage).filter(
        WhatsAppMessage.organization_id == organization_id,
        WhatsAppMessage.conversation_id == conversation_id,
    ).order_by(WhatsAppMessage.created_at)
    total = q.count()
    items = q.offset(offset).limit(limit).all()
    return items, total


# ---------------------------------------------------------------------------
# Opt-out
# ---------------------------------------------------------------------------

_OPT_OUT_KEYWORDS = frozenset(["STOP", "PARAR", "CANCELAR", "SAIR", "DESCADASTRAR", "NÃO QUERO"])


def _check_opt_out_keyword(
    db: Session,
    contact: WhatsAppContact,
    body_text: str,
) -> None:
    """Detecta palavras-chave de opt-out e marca o contato."""
    text_upper = body_text.strip().upper()
    if any(text_upper == kw or text_upper.startswith(kw + " ") for kw in _OPT_OUT_KEYWORDS):
        handle_opt_out(db, contact)


def handle_opt_out(db: Session, contact: WhatsAppContact) -> None:
    """Marca contato como opted-out (LGPD compliance)."""
    if not contact.opted_out:
        contact.opted_out = True
        contact.opted_out_at = datetime.now(timezone.utc)
        logger.info(
            "Opt-out registrado: contact_id=%s org=%s",
            contact.id, contact.organization_id,
        )


# ---------------------------------------------------------------------------
# Automation trigger check (lazy — não bloqueia o fluxo)
# ---------------------------------------------------------------------------

def _check_automation_triggers(
    db: Session,
    conversation: WhatsAppConversation,
    message: WhatsAppMessage,
) -> None:
    """
    Verifica triggers de automação para a mensagem recebida.
    Silencia erros — triggers não devem bloquear o fluxo do webhook.
    """
    try:
        from src.db.models_whatsapp import WhatsAppAutomationTrigger
        triggers = db.query(WhatsAppAutomationTrigger).filter(
            WhatsAppAutomationTrigger.organization_id == conversation.organization_id,
            WhatsAppAutomationTrigger.account_id == conversation.account_id,
            WhatsAppAutomationTrigger.event_type == "message_received",
            WhatsAppAutomationTrigger.is_active == True,
        ).order_by(WhatsAppAutomationTrigger.priority.desc()).all()

        for trigger in triggers:
            try:
                _evaluate_trigger(db, trigger, conversation, message)
            except Exception as e:
                trigger.last_error = str(e)[:1024]
                logger.warning(
                    "Trigger %s falhou: %s", trigger.id, e,
                    exc_info=True
                )

    except Exception:
        pass  # silencia erros de trigger para não bloquear webhook


def _evaluate_trigger(
    db: Session,
    trigger,
    conversation: WhatsAppConversation,
    message: WhatsAppMessage,
) -> None:
    """Avalia e dispara o trigger se as condições forem atendidas."""
    conditions = trigger.conditions or {}
    keyword = conditions.get("keyword")
    if keyword and message.body_text:
        if keyword.upper() not in (message.body_text or "").upper():
            return  # condição não atendida

    # Dispara o workflow via automation_service (best-effort, sem commit aqui)
    try:
        from src.services import automation_service
        from datetime import datetime, timezone as tz
        payload = {
            "trigger": "whatsapp",
            "event_type": trigger.event_type,
            "conversation_id": conversation.id,
            "contact_id": conversation.contact_id,
            "message_id": message.id,
            "organization_id": conversation.organization_id,
        }
        automation_service.trigger_execution_webhook(
            db,
            workflow_id=trigger.workflow_id,
            payload=payload,
            source=f"wa_trigger:{trigger.id}",
        )
        trigger.last_triggered_at = datetime.now(tz.utc)
        trigger.last_error = None
    except Exception as e:
        trigger.last_error = str(e)[:1024]
        raise


# ---------------------------------------------------------------------------
# Template helpers
# ---------------------------------------------------------------------------

def get_template(
    db: Session,
    template_id: str,
    organization_id: str,
) -> Optional[WhatsAppTemplate]:
    return db.query(WhatsAppTemplate).filter(
        WhatsAppTemplate.id == template_id,
        WhatsAppTemplate.organization_id == organization_id,
        WhatsAppTemplate.is_deleted == False,
    ).first()


def list_templates(
    db: Session,
    organization_id: str,
    status: Optional[str] = None,
    account_id: Optional[str] = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[WhatsAppTemplate], int]:
    q = db.query(WhatsAppTemplate).filter(
        WhatsAppTemplate.organization_id == organization_id,
        WhatsAppTemplate.is_deleted == False,
    )
    if status:
        q = q.filter(WhatsAppTemplate.status == status)
    if account_id:
        q = q.filter(WhatsAppTemplate.account_id == account_id)
    total = q.count()
    items = q.order_by(WhatsAppTemplate.name).offset(offset).limit(limit).all()
    return items, total


def create_template(
    db: Session,
    organization_id: str,
    name: str,
    category: str,
    language: str,
    body_text: str,
    account_id: Optional[str] = None,
    header_type: Optional[str] = None,
    header_content: Optional[str] = None,
    footer_text: Optional[str] = None,
    variables: Optional[list] = None,
    buttons: Optional[list] = None,
    created_by: Optional[str] = None,
) -> WhatsAppTemplate:
    template = WhatsAppTemplate(
        organization_id=organization_id,
        account_id=account_id,
        name=name,
        category=category,
        language=language,
        body_text=body_text,
        header_type=header_type,
        header_content=header_content,
        footer_text=footer_text,
        variables=variables or [],
        buttons=buttons or [],
        created_by=created_by,
        status=TemplateStatus.DRAFT,
    )
    db.add(template)
    return template


def submit_template(db: Session, template: WhatsAppTemplate, user_id: str) -> WhatsAppTemplate:
    """DRAFT → PENDING_REVIEW."""
    if template.status != TemplateStatus.DRAFT:
        raise ValueError(f"Template está em status '{template.status}'; só DRAFT pode ser submetido.")
    template.status = TemplateStatus.PENDING_REVIEW
    return template


def approve_template(db: Session, template: WhatsAppTemplate) -> WhatsAppTemplate:
    """PENDING_REVIEW → APPROVED."""
    template.status = TemplateStatus.APPROVED
    template.rejected_reason = None
    return template


def reject_template(db: Session, template: WhatsAppTemplate, reason: str) -> WhatsAppTemplate:
    """PENDING_REVIEW → REJECTED."""
    template.status = TemplateStatus.REJECTED
    template.rejected_reason = reason
    return template


# ---------------------------------------------------------------------------
# Automation Trigger helpers
# ---------------------------------------------------------------------------

def list_automation_triggers(
    db: Session,
    organization_id: str,
    account_id: Optional[str] = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list, int]:
    from src.db.models_whatsapp import WhatsAppAutomationTrigger
    q = db.query(WhatsAppAutomationTrigger).filter(
        WhatsAppAutomationTrigger.organization_id == organization_id,
    )
    if account_id:
        q = q.filter(WhatsAppAutomationTrigger.account_id == account_id)
    total = q.count()
    items = q.order_by(WhatsAppAutomationTrigger.priority.desc()).offset(offset).limit(limit).all()
    return items, total


def create_automation_trigger(
    db: Session,
    organization_id: str,
    account_id: str,
    name: str,
    event_type: str,
    workflow_id: str,
    conditions: Optional[dict] = None,
    is_active: bool = True,
    priority: int = 0,
    created_by: Optional[str] = None,
):
    from src.db.models_whatsapp import WhatsAppAutomationTrigger
    trigger = WhatsAppAutomationTrigger(
        organization_id=organization_id,
        account_id=account_id,
        name=name,
        event_type=event_type,
        workflow_id=workflow_id,
        conditions=conditions,
        is_active=is_active,
        priority=priority,
        created_by=created_by,
    )
    db.add(trigger)
    return trigger


# ---------------------------------------------------------------------------
# Métricas simples
# ---------------------------------------------------------------------------

def get_metrics_overview(
    db: Session,
    organization_id: str,
    period_days: int = 7,
) -> dict:
    """Dashboard de métricas simples para o período."""
    from datetime import timedelta
    since = datetime.now(timezone.utc) - timedelta(days=period_days)

    total_conv = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.organization_id == organization_id,
        WhatsAppConversation.created_at >= since,
        WhatsAppConversation.is_deleted == False,
    ).count()

    open_conv = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.organization_id == organization_id,
        WhatsAppConversation.status == ConversationStatus.OPEN,
        WhatsAppConversation.is_deleted == False,
    ).count()

    resolved_conv = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.organization_id == organization_id,
        WhatsAppConversation.status == ConversationStatus.RESOLVED,
        WhatsAppConversation.resolved_at >= since,
        WhatsAppConversation.is_deleted == False,
    ).count()

    new_contacts = db.query(WhatsAppContact).filter(
        WhatsAppContact.organization_id == organization_id,
        WhatsAppContact.created_at >= since,
        WhatsAppContact.is_deleted == False,
    ).count()

    msgs_sent = db.query(WhatsAppMessage).filter(
        WhatsAppMessage.organization_id == organization_id,
        WhatsAppMessage.direction == MessageDirection.OUTBOUND,
        WhatsAppMessage.created_at >= since,
    ).count()

    msgs_received = db.query(WhatsAppMessage).filter(
        WhatsAppMessage.organization_id == organization_id,
        WhatsAppMessage.direction == MessageDirection.INBOUND,
        WhatsAppMessage.created_at >= since,
    ).count()

    sla_breached = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.organization_id == organization_id,
        WhatsAppConversation.status == ConversationStatus.OPEN,
        WhatsAppConversation.sla_deadline < datetime.now(timezone.utc),
        WhatsAppConversation.is_deleted == False,
    ).count()

    opt_outs = db.query(WhatsAppContact).filter(
        WhatsAppContact.organization_id == organization_id,
        WhatsAppContact.opted_out == True,
        WhatsAppContact.opted_out_at >= since,
    ).count()

    return {
        "period": f"{period_days}d",
        "total_conversations": total_conv,
        "open_conversations": open_conv,
        "resolved_conversations": resolved_conv,
        "new_contacts": new_contacts,
        "messages_sent": msgs_sent,
        "messages_received": msgs_received,
        "avg_response_time_seconds": None,  # Calculado com query mais complexa — Fase 2
        "sla_breached_count": sla_breached,
        "opt_out_count": opt_outs,
        "campaign_stats": None,
    }
