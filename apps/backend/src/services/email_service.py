"""
Servico de email transacional (calendario e auth).
MVP: Resend como provider. Fallback: logging de erro.
"""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from src.config.settings import get_settings
from src.db.models_calendar import Booking, EmailLog, EventType

logger = logging.getLogger("completepay.calendar.email")

TEMPLATE_CONFIRMATION_GUEST = "confirmation_guest"
TEMPLATE_CONFIRMATION_HOST = "confirmation_host"
TEMPLATE_CANCELLATION = "cancellation"
TEMPLATE_REMINDER = "reminder"
TEMPLATE_RESCHEDULE = "reschedule"


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
        }
        template = templates.get(template_type, "<p>Template não encontrado.</p>")
        return template.format(**context)
