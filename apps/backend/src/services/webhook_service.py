"""
Servico de despacho de webhooks para o modulo de calendario.
Envio com assinatura HMAC-SHA256 e retry com backoff.
"""
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models_calendar import Booking, EventType, Webhook, WebhookDelivery

logger = logging.getLogger("completepay.calendar.webhook")


def dispatch_webhooks_for_booking_task(booking_id: str, event: str) -> None:
    """
    Background task: carrega booking, monta payload e despacha webhooks.
    Uso: background_tasks.add_task(dispatch_webhooks_for_booking_task, str(booking.id), "booking.cancelled")
    """
    from src.db.session import SessionLocal

    db = SessionLocal()
    try:
        booking = db.execute(
            select(Booking).where(Booking.id == booking_id)
        ).scalars().one_or_none()
        if not booking:
            return
        event_type = db.execute(
            select(EventType).where(EventType.id == booking.event_type_id)
        ).scalars().one_or_none()
        if not event_type:
            return
        event_title = event_type.title
        payload = _payload_for_booking(booking, event_title)
        dispatch_webhooks_sync(db, booking.event_type_id, event, payload)
    finally:
        db.close()

MAX_ATTEMPTS = 3
BACKOFF_SECONDS = [30, 120, 600]


def _payload_for_booking(booking, event_type_title: str) -> dict:
    """Monta payload serializavel para webhook."""
    return {
        "booking_id": booking.id,
        "uid": booking.uid,
        "event_type_id": booking.event_type_id,
        "event_type_title": event_type_title,
        "guest_name": booking.guest_name,
        "guest_email": booking.guest_email,
        "start_time": booking.start_time.isoformat() if booking.start_time else None,
        "end_time": booking.end_time.isoformat() if booking.end_time else None,
        "duration_minutes": booking.duration_minutes,
        "timezone": booking.timezone,
        "status": booking.status.value if hasattr(booking.status, "value") else str(booking.status),
    }


def dispatch_webhooks_sync(
    db: Session,
    event_type_id: str,
    event: str,
    payload: dict,
) -> None:
    """
    Busca webhooks ativos para o event_type e evento, envia com retry (sync).
    Usado via BackgroundTasks.
    """
    webhooks = db.execute(
        select(Webhook).where(
            Webhook.event_type_id == event_type_id,
            Webhook.is_active.is_(True),
            Webhook.events.contains([event]),
        )
    ).scalars().all()

    for webhook in webhooks:
        _dispatch_one_sync(db, webhook, event, payload)


def _dispatch_one_sync(
    db: Session,
    webhook: Webhook,
    event: str,
    payload: dict,
) -> None:
    """Envia um webhook com retry (sync, httpx)."""
    body = json.dumps(payload, default=str)
    signature = hmac.new(
        webhook.secret.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()

    delivery = WebhookDelivery(
        webhook_id=webhook.id,
        booking_id=payload.get("booking_id", ""),
        event=event,
        payload=payload,
        status="pending",
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)

    try:
        import httpx
    except ImportError:
        delivery.status = "failed"
        delivery.error = "httpx not installed"
        db.commit()
        logger.error("httpx not installed, webhook not sent")
        return

    for attempt in range(MAX_ATTEMPTS):
        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.post(
                    webhook.url,
                    content=body,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Signature": f"sha256={signature}",
                        "X-Webhook-Event": event,
                    },
                )
            delivery.response_status = response.status_code
            delivery.attempts = attempt + 1
            delivery.last_attempt_at = datetime.now(ZoneInfo("UTC"))

            if 200 <= response.status_code < 300:
                delivery.status = "delivered"
                db.commit()
                logger.info("Webhook delivered: %s to %s", event, webhook.url)
                return

        except Exception as e:
            delivery.attempts = attempt + 1
            delivery.last_attempt_at = datetime.now(ZoneInfo("UTC"))
            logger.warning("Webhook attempt %s failed: %s", attempt + 1, e)

        if attempt < MAX_ATTEMPTS - 1:
            time.sleep(BACKOFF_SECONDS[attempt])

    delivery.status = "failed"
    db.commit()
    logger.error(
        "Webhook failed after %s attempts: %s to %s",
        MAX_ATTEMPTS,
        event,
        webhook.url,
    )
