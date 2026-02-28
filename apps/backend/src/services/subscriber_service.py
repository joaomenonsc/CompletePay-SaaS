"""
Subscriber Service — importacao CSV, sync Patient→Subscriber, recompute contadores.

Todas as operacoes sao multi-tenant (filtradas por organization_id).
"""
import csv
import io
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.db.models_crm import Patient, PatientConsent
from src.db.models_marketing import EmkList, EmkListSubscriber, EmkSubscriber

logger = logging.getLogger("completepay.subscriber_service")

# Regex basico para validacao de email
_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

# Limite de linhas por importacao CSV
MAX_CSV_ROWS = 10_000


# ── Result dataclasses ──────────────────────────────────────────────────────


@dataclass
class CsvImportResult:
    """Resultado de uma importacao CSV."""
    total_rows: int = 0
    created: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


@dataclass
class PatientSyncResult:
    """Resultado de um sync Patient→Subscriber."""
    synced: int = 0
    unsubscribed: int = 0
    skipped: int = 0


# ── CSV Import ──────────────────────────────────────────────────────────────


def parse_csv(content: str) -> tuple[list[dict[str, str]], list[str]]:
    """
    Parseia conteudo CSV e retorna lista de dicts + lista de erros.
    Espera colunas 'email' (obrigatorio) e 'name' (opcional).
    """
    errors: list[str] = []
    rows: list[dict[str, str]] = []

    try:
        reader = csv.DictReader(io.StringIO(content))
    except Exception as e:
        return [], [f"Erro ao ler CSV: {e}"]

    if not reader.fieldnames:
        return [], ["CSV vazio ou sem cabeçalho."]

    # Normalizar nomes de coluna (lowercase, strip)
    normalized_fields = [f.strip().lower() for f in reader.fieldnames]

    if "email" not in normalized_fields:
        return [], ["Coluna 'email' obrigatória não encontrada no CSV."]

    email_idx = normalized_fields.index("email")
    name_idx = normalized_fields.index("name") if "name" in normalized_fields else None
    nome_idx = normalized_fields.index("nome") if "nome" in normalized_fields else None

    # Mapear nome de coluna original
    original_fields = list(reader.fieldnames)

    for i, row in enumerate(reader, start=2):  # linha 2 (1 = header)
        if i > MAX_CSV_ROWS + 1:
            errors.append(f"CSV excede o limite de {MAX_CSV_ROWS} linhas. Linhas extras ignoradas.")
            break

        email_key = original_fields[email_idx]
        email = (row.get(email_key) or "").strip().lower()

        if not email:
            errors.append(f"Linha {i}: email vazio, ignorada.")
            continue

        if not _EMAIL_RE.match(email):
            errors.append(f"Linha {i}: email inválido '{email}', ignorada.")
            continue

        name = ""
        if name_idx is not None:
            name_key = original_fields[name_idx]
            name = (row.get(name_key) or "").strip()
        elif nome_idx is not None:
            nome_key = original_fields[nome_idx]
            name = (row.get(nome_key) or "").strip()

        rows.append({"email": email, "name": name})

    return rows, errors


def import_csv_to_list(
    db: Session,
    list_id: str,
    organization_id: str,
    csv_content: str,
) -> CsvImportResult:
    """
    Importa subscribers de CSV para uma lista.
    - Dedup por organization_id + email
    - Cria subscriber se nao existir
    - Vincula a lista se nao estiver vinculado
    - Atualiza subscriber_count
    """
    result = CsvImportResult()

    rows, parse_errors = parse_csv(csv_content)
    result.errors.extend(parse_errors)
    result.total_rows = len(rows)

    if not rows:
        return result

    for row in rows:
        email = row["email"]
        name = row.get("name", "")

        # Buscar subscriber existente por org+email
        subscriber = db.execute(
            select(EmkSubscriber).where(
                EmkSubscriber.organization_id == organization_id,
                EmkSubscriber.email == email,
            )
        ).scalars().first()

        if not subscriber:
            subscriber = EmkSubscriber(
                organization_id=organization_id,
                email=email,
                name=name or None,
                status="active",
            )
            db.add(subscriber)
            db.flush()
            result.created += 1
        else:
            # Atualizar nome se vazio e CSV fornecer
            if name and not subscriber.name:
                subscriber.name = name
            result.skipped += 1

        # Vincular a lista se nao estiver
        existing_link = db.execute(
            select(EmkListSubscriber).where(
                EmkListSubscriber.list_id == list_id,
                EmkListSubscriber.subscriber_id == subscriber.id,
            )
        ).scalars().first()

        if not existing_link:
            link = EmkListSubscriber(list_id=list_id, subscriber_id=subscriber.id)
            db.add(link)

    db.flush()

    # Recomputar subscriber_count
    recompute_subscriber_count(db, list_id)

    db.commit()
    return result


# ── Patient → Subscriber Sync ──────────────────────────────────────────────


def sync_patients_to_subscribers(
    db: Session,
    organization_id: str,
) -> PatientSyncResult:
    """
    Sincroniza pacientes com email → subscribers.
    - Paciente com email + consent ativo: upsert subscriber (active)
    - Paciente com consent revogado: marca subscriber como unsubscribed
    - Paciente sem email: ignorado
    """
    result = PatientSyncResult()

    # Buscar todos os pacientes da org com email
    patients = db.execute(
        select(Patient).where(
            Patient.organization_id == organization_id,
            Patient.email.isnot(None),
            Patient.email != "",
        )
    ).scalars().all()

    for patient in patients:
        email = patient.email.strip().lower()
        if not _EMAIL_RE.match(email):
            result.skipped += 1
            continue

        # Verificar consentimento de email_marketing
        consent = db.execute(
            select(PatientConsent).where(
                PatientConsent.patient_id == patient.id,
                PatientConsent.consent_type == "email_marketing",
            )
        ).scalars().first()

        has_active_consent = (
            consent is not None
            and consent.granted
            and consent.revoked_at is None
        )

        # Buscar subscriber existente
        subscriber = db.execute(
            select(EmkSubscriber).where(
                EmkSubscriber.organization_id == organization_id,
                EmkSubscriber.email == email,
            )
        ).scalars().first()

        if has_active_consent:
            if not subscriber:
                subscriber = EmkSubscriber(
                    organization_id=organization_id,
                    email=email,
                    name=patient.social_name or patient.full_name,
                    patient_id=patient.id,
                    status="active",
                )
                db.add(subscriber)
            else:
                subscriber.patient_id = patient.id
                subscriber.status = "active"
                subscriber.unsubscribed_at = None
                if not subscriber.name:
                    subscriber.name = patient.social_name or patient.full_name
            result.synced += 1

        elif consent and consent.revoked_at is not None:
            # Consent revogado
            if subscriber and subscriber.status == "active":
                subscriber.status = "unsubscribed"
                subscriber.unsubscribed_at = datetime.now(timezone.utc)
                result.unsubscribed += 1
            else:
                result.skipped += 1
        else:
            # Sem consent -> ignorar
            result.skipped += 1

    db.commit()
    return result


# ── Subscriber Count ────────────────────────────────────────────────────────


def recompute_subscriber_count(db: Session, list_id: str) -> int:
    """
    Recomputa subscriber_count de uma lista baseado nos vinculos reais.
    Retorna o novo count.
    """
    count = db.execute(
        select(func.count()).where(EmkListSubscriber.list_id == list_id)
    ).scalar() or 0

    lst = db.execute(
        select(EmkList).where(EmkList.id == list_id)
    ).scalars().first()

    if lst:
        lst.subscriber_count = count

    return count
