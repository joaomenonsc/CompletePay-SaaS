"""
Servico de email transacional (calendario e auth).
MVP: Resend como provider. Fallback: logging de erro.
"""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config.settings import get_settings
from src.db.models import Organization
from src.db.models_calendar import Booking, EmailLog, EventType
from src.db.session import SessionLocal

logger = logging.getLogger("completepay.calendar.email")

TEMPLATE_CONFIRMATION_GUEST = "confirmation_guest"
TEMPLATE_CONFIRMATION_HOST = "confirmation_host"
TEMPLATE_CANCELLATION = "cancellation"
TEMPLATE_REMINDER = "reminder"
TEMPLATE_RESCHEDULE = "reschedule"
TEMPLATE_ADD_PARTICIPANTS = "add_participants"
TEMPLATE_REQUEST_RESCHEDULE = "request_reschedule"


class EmailService:
    """Servico de envio de emails transacionais."""

    def __init__(self, db: Session):
        self.db = db
        self._client = None

    def _get_client(self):
        """Lazy init do client Resend."""
        if self._client is None:
            try:
                import resend

                settings = get_settings()
                if getattr(settings, "resend_api_key", None):
                    resend.api_key = settings.resend_api_key
                    self._client = resend
            except (ImportError, AttributeError) as e:
                logger.error("Failed to initialize Resend client: %s", e)
        return self._client

    def send_account_confirmation(self, to_email: str, confirm_url: str) -> bool:
        """
        Envia email de confirmacao de conta (auth). Nao grava em EmailLog.
        Retorna True se enviado com sucesso.
        """
        client = self._get_client()
        if not client:
            logger.warning("Email client not configured. Account confirmation to %s not sent.", to_email)
            return False
        settings = get_settings()
        email_addr = getattr(settings, "email_from_address", None) or "noreply@completepay.com"
        from_name = getattr(settings, "email_from_name", None) or "CompletePay"
        from_addr = f"{from_name} <{email_addr}>"
        subject = "Confirme sua conta - CompletePay"
        html = f"""
        <h2>Confirme sua conta</h2>
        <p>Olá,</p>
        <p>Você criou uma conta no CompletePay. Clique no link abaixo para confirmar seu email e ativar sua conta:</p>
        <p><a href="{confirm_url}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Confirmar conta</a></p>
        <p>Ou copie e cole no navegador:</p>
        <p style="word-break:break-all;color:#666;">{confirm_url}</p>
        <p>Este link expira em 24 horas. Se você não criou esta conta, ignore este email.</p>
        <p>— Equipe CompletePay</p>
        """
        try:
            client.Emails.send({
                "from": from_addr,
                "to": [to_email],
                "subject": subject,
                "html": html,
            })
            logger.info("Account confirmation email sent to %s", to_email)
            return True
        except Exception as e:
            logger.error("Failed to send account confirmation to %s: %s", to_email, e)
            return False

    def send_booking_confirmation_to_guest(
        self, booking: Booking, event_type: EventType, base_url: str = ""
    ) -> None:
        """Envia email de confirmacao ao guest."""
        tz = ZoneInfo(booking.timezone)
        local_start = booking.start_time.astimezone(tz)
        cancel_url = f"{base_url}/calendario/booking/{booking.uid}?action=cancel&token={booking.cancel_token}"
        reschedule_url = f"{base_url}/calendario/booking/{booking.uid}?action=reschedule&token={booking.cancel_token}"

        subject = f"Agendamento Confirmado: {event_type.title}"
        html = self._render_template(
            TEMPLATE_CONFIRMATION_GUEST,
            {
                "guest_name": booking.guest_name,
                "event_title": event_type.title,
                "date": local_start.strftime("%d/%m/%Y"),
                "time": local_start.strftime("%H:%M"),
                "duration": booking.duration_minutes,
                "timezone": booking.timezone,
                "cancel_url": cancel_url,
                "reschedule_url": reschedule_url,
            },
        )

        self._send(
            to=booking.guest_email,
            subject=subject,
            html=html,
            booking_id=booking.id,
            template_type=TEMPLATE_CONFIRMATION_GUEST,
        )

    def send_booking_confirmation_to_host(
        self, booking: Booking, event_type: EventType, host_email: str
    ) -> None:
        """Envia email de confirmacao ao host."""
        tz = ZoneInfo(booking.timezone)
        local_start = booking.start_time.astimezone(tz)

        subject = f"Novo Agendamento: {event_type.title} com {booking.guest_name}"
        html = self._render_template(
            TEMPLATE_CONFIRMATION_HOST,
            {
                "guest_name": booking.guest_name,
                "guest_email": booking.guest_email,
                "event_title": event_type.title,
                "date": local_start.strftime("%d/%m/%Y"),
                "time": local_start.strftime("%H:%M"),
                "duration": booking.duration_minutes,
                "notes": booking.guest_notes or "(Sem notas)",
            },
        )

        self._send(
            to=host_email,
            subject=subject,
            html=html,
            booking_id=booking.id,
            template_type=TEMPLATE_CONFIRMATION_HOST,
        )

    def send_booking_cancellation_to_guest(
        self, booking: Booking, event_type: EventType, reason: str | None = None
    ) -> None:
        """Envia email de cancelamento ao guest."""
        tz = ZoneInfo(booking.timezone)
        local_start = booking.start_time.astimezone(tz)
        subject = f"Agendamento Cancelado: {event_type.title}"
        html = self._render_template(
            TEMPLATE_CANCELLATION,
            {
                "guest_name": booking.guest_name,
                "event_title": event_type.title,
                "date": local_start.strftime("%d/%m/%Y"),
                "time": local_start.strftime("%H:%M"),
                "reason": reason or "Não informado",
            },
        )
        self._send(
            to=booking.guest_email,
            subject=subject,
            html=html,
            booking_id=booking.id,
            template_type=TEMPLATE_CANCELLATION,
        )

    def send_booking_rescheduled_to_guest(
        self, booking: Booking, event_type: EventType, base_url: str = ""
    ) -> None:
        """Envia email de reagendamento ao guest (novo horário)."""
        tz = ZoneInfo(booking.timezone)
        local_start = booking.start_time.astimezone(tz)
        cancel_url = f"{base_url}/calendario/booking/{booking.uid}?action=cancel&token={booking.cancel_token}"
        reschedule_url = f"{base_url}/calendario/booking/{booking.uid}?action=reschedule&token={booking.cancel_token}"
        subject = f"Reserva Reagendada: {event_type.title}"
        html = self._render_template(
            TEMPLATE_RESCHEDULE,
            {
                "guest_name": booking.guest_name,
                "event_title": event_type.title,
                "date": local_start.strftime("%d/%m/%Y"),
                "time": local_start.strftime("%H:%M"),
                "duration": booking.duration_minutes,
                "timezone": booking.timezone,
                "cancel_url": cancel_url,
                "reschedule_url": reschedule_url,
            },
        )
        self._send(
            to=booking.guest_email,
            subject=subject,
            html=html,
            booking_id=booking.id,
            template_type=TEMPLATE_RESCHEDULE,
        )

    def send_added_as_participant(
        self,
        to_email: str,
        participant_name: str,
        booking: Booking,
        event_type: EventType,
    ) -> None:
        """Envia email ao participante adicionado à reserva."""
        tz = ZoneInfo(booking.timezone)
        local_start = booking.start_time.astimezone(tz)
        subject = f"Você foi adicionado(a) ao agendamento: {event_type.title}"
        html = self._render_template(
            TEMPLATE_ADD_PARTICIPANTS,
            {
                "participant_name": participant_name,
                "event_title": event_type.title,
                "guest_name": booking.guest_name,
                "date": local_start.strftime("%d/%m/%Y"),
                "time": local_start.strftime("%H:%M"),
                "duration": booking.duration_minutes,
                "timezone": booking.timezone,
            },
        )
        self._send(
            to=to_email,
            subject=subject,
            html=html,
            booking_id=booking.id,
            template_type=TEMPLATE_ADD_PARTICIPANTS,
        )

    def send_request_reschedule_to_guest(
        self,
        booking: Booking,
        event_type: EventType,
        book_new_url: str,
        reason: str | None = None,
    ) -> None:
        """Envia email ao guest solicitando que escolha novo horário (reserva já cancelada)."""
        tz = ZoneInfo(booking.timezone)
        local_start = booking.start_time.astimezone(tz)
        subject = f"Solicitação de reagendamento: {event_type.title}"
        html = self._render_template(
            TEMPLATE_REQUEST_RESCHEDULE,
            {
                "guest_name": booking.guest_name,
                "event_title": event_type.title,
                "date": local_start.strftime("%d/%m/%Y"),
                "time": local_start.strftime("%H:%M"),
                "reason": reason or "",
                "book_new_url": book_new_url,
            },
        )
        self._send(
            to=booking.guest_email,
            subject=subject,
            html=html,
            booking_id=booking.id,
            template_type=TEMPLATE_REQUEST_RESCHEDULE,
        )

    def _send(
        self,
        to: str,
        subject: str,
        html: str,
        booking_id: str,
        template_type: str,
    ) -> None:
        """Envia email e registra log."""
        log = EmailLog(
            booking_id=str(booking_id),
            template_type=template_type,
            recipient=to,
            subject=subject,
            status="pending",
        )
        self.db.add(log)
        self.db.flush()

        client = self._get_client()
        if not client:
            log.status = "failed"
            log.error = "Email client not configured"
            logger.warning("Email client not configured. Email to %s not sent.", to)
            self.db.commit()
            return

        settings = get_settings()
        email_addr = (
            getattr(settings, "email_from_address", None) or "noreply@completepay.com"
        )
        from_name = getattr(settings, "email_from_name", None) or "CompletePay"
        from_addr = f"{from_name} <{email_addr}>"

        try:
            client.Emails.send({
                "from": from_addr,
                "to": [to],
                "subject": subject,
                "html": html,
            })
            log.status = "sent"
            log.sent_at = datetime.now(ZoneInfo("UTC"))
            logger.info(
                "Email sent: %s to %s for booking %s",
                template_type,
                to,
                booking_id,
            )
        except Exception as e:
            log.status = "failed"
            log.error = str(e)[:500]
            logger.error("Failed to send email %s to %s: %s", template_type, to, e)
        finally:
            self.db.commit()

    def _render_template(self, template_type: str, context: dict) -> str:
        """Renderiza template HTML simples."""
        templates = {
            TEMPLATE_CONFIRMATION_GUEST: """
                <h2>Agendamento Confirmado</h2>
                <p>Olá {guest_name},</p>
                <p>Seu agendamento para <strong>{event_title}</strong> foi confirmado.</p>
                <p><strong>Data:</strong> {date}<br>
                <strong>Horário:</strong> {time} ({timezone})<br>
                <strong>Duração:</strong> {duration} minutos</p>
                <p><a href="{cancel_url}">Cancelar</a> |
                <a href="{reschedule_url}">Reagendar</a></p>
            """,
            TEMPLATE_CONFIRMATION_HOST: """
                <h2>Novo Agendamento</h2>
                <p>Você tem um novo agendamento para <strong>{event_title}</strong>.</p>
                <p><strong>Convidado:</strong> {guest_name} ({guest_email})<br>
                <strong>Data:</strong> {date}<br>
                <strong>Horário:</strong> {time}<br>
                <strong>Duração:</strong> {duration} minutos</p>
                <p><strong>Notas:</strong> {notes}</p>
            """,
            TEMPLATE_CANCELLATION: """
                <h2>Agendamento Cancelado</h2>
                <p>Olá {guest_name},</p>
                <p>O agendamento para <strong>{event_title}</strong> foi cancelado.</p>
                <p><strong>Data/horário anterior:</strong> {date} às {time}</p>
                <p><strong>Motivo:</strong> {reason}</p>
                <p>Se tiver dúvidas, entre em contato com o organizador.</p>
            """,
            TEMPLATE_RESCHEDULE: """
                <h2>Reserva Reagendada</h2>
                <p>Olá {guest_name},</p>
                <p>Seu agendamento para <strong>{event_title}</strong> foi reagendado.</p>
                <p><strong>Novo horário:</strong> {date} às {time} ({timezone})<br>
                <strong>Duração:</strong> {duration} minutos</p>
                <p><a href="{cancel_url}">Cancelar</a> |
                <a href="{reschedule_url}">Reagendar novamente</a></p>
            """,
            TEMPLATE_ADD_PARTICIPANTS: """
                <h2>Você foi adicionado(a) a um agendamento</h2>
                <p>Olá {participant_name},</p>
                <p>Você foi adicionado(a) como participante do agendamento <strong>{event_title}</strong>.</p>
                <p><strong>Convidado principal:</strong> {guest_name}<br>
                <strong>Data:</strong> {date}<br>
                <strong>Horário:</strong> {time} ({timezone})<br>
                <strong>Duração:</strong> {duration} minutos</p>
            """,
            TEMPLATE_REQUEST_RESCHEDULE: """
                <h2>Solicitação de Reagendamento</h2>
                <p>Olá {guest_name},</p>
                <p>O organizador solicitou o reagendamento do agendamento <strong>{event_title}</strong> que estava marcado para {date} às {time}.</p>
                <p><strong>Motivo:</strong> {reason}</p>
                <p>Por favor, escolha um novo horário através do link abaixo:</p>
                <p><a href="{book_new_url}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Escolher novo horário</a></p>
            """,
        }
        template = templates.get(template_type, "<p>Template não encontrado.</p>")
        return template.format(**context)


def _base_url() -> str:
    return get_settings().frontend_url or ""


def send_cancellation_email_task(booking_id: str, reason: str | None = None) -> None:
    """Background task: envia email de cancelamento ao guest."""
    db = SessionLocal()
    try:
        booking = db.execute(select(Booking).where(Booking.id == booking_id)).scalars().one_or_none()
        if not booking:
            return
        event_type = db.execute(
            select(EventType).where(EventType.id == booking.event_type_id)
        ).scalars().one_or_none()
        if not event_type:
            return
        EmailService(db).send_booking_cancellation_to_guest(
            booking, event_type, reason=reason
        )
    finally:
        db.close()


def send_rescheduled_email_task(booking_id: str) -> None:
    """Background task: envia email de reagendamento ao guest."""
    db = SessionLocal()
    try:
        booking = db.execute(select(Booking).where(Booking.id == booking_id)).scalars().one_or_none()
        if not booking:
            return
        event_type = db.execute(
            select(EventType).where(EventType.id == booking.event_type_id)
        ).scalars().one_or_none()
        if not event_type:
            return
        EmailService(db).send_booking_rescheduled_to_guest(
            booking, event_type, base_url=_base_url()
        )
    finally:
        db.close()


def send_add_participants_emails_task(booking_id: str, added_emails: list[str]) -> None:
    """Background task: envia email a cada participante adicionado."""
    db = SessionLocal()
    try:
        booking = db.execute(select(Booking).where(Booking.id == booking_id)).scalars().one_or_none()
        if not booking:
            return
        event_type = db.execute(
            select(EventType).where(EventType.id == booking.event_type_id)
        ).scalars().one_or_none()
        if not event_type:
            return
        svc = EmailService(db)
        for email in added_emails:
            name = (email.split("@")[0] if email else "").strip() or "Participante"
            svc.send_added_as_participant(
                to_email=email.strip(),
                participant_name=name,
                booking=booking,
                event_type=event_type,
            )
    finally:
        db.close()


def send_request_reschedule_email_task(
    booking_id: str, reason: str | None = None
) -> None:
    """Background task: envia email ao guest solicitando novo horário (após cancelamento)."""
    db = SessionLocal()
    try:
        booking = db.execute(select(Booking).where(Booking.id == booking_id)).scalars().one_or_none()
        if not booking:
            return
        event_type = db.execute(
            select(EventType).where(EventType.id == booking.event_type_id)
        ).scalars().one_or_none()
        if not event_type:
            return
        org = db.execute(
            select(Organization).where(Organization.id == event_type.organization_id)
        ).scalars().one_or_none()
        org_slug = org.slug if org else "calendar"
        user_slug = (booking.host_user_id or event_type.user_id or "").strip()
        if not user_slug:
            logger.warning("No host user for request_reschedule email booking %s", booking_id)
            return
        base = _base_url().rstrip("/")
        book_new_url = f"{base}/calendario/{org_slug}/{user_slug}/{event_type.slug}"
        EmailService(db).send_request_reschedule_to_guest(
            booking, event_type, book_new_url=book_new_url, reason=reason or ""
        )
    finally:
        db.close()
