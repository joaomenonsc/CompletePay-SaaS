"""Schemas Pydantic para API do CRM de Saude (request/response)."""
import re
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _cpf_digits(value: str) -> str:
    """Remove nao-digitios do CPF."""
    return re.sub(r"\D", "", value or "")


def _cpf_check_digits_valid(digits: str) -> bool:
    """Valida digitos verificadores do CPF."""
    if len(digits) != 11:
        return False
    if digits == digits[0] * 11:  # rejeita 111.111.111-11 etc
        return False
    # Primeiro digito
    s = sum(int(digits[i]) * (10 - i) for i in range(9))
    d1 = (s * 10 % 11) % 10
    if int(digits[9]) != d1:
        return False
    # Segundo digito
    s = sum(int(digits[i]) * (11 - i) for i in range(10))
    d2 = (s * 10 % 11) % 10
    return int(digits[10]) == d2


def _format_cpf(digits: str) -> str:
    """Formata CPF como XXX.XXX.XXX-XX."""
    return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}" if len(digits) == 11 else digits


def _normalize_phone(value: str) -> str:
    """Mantem apenas digitos do telefone."""
    return re.sub(r"\D", "", value or "")


class PatientCreate(BaseModel):
    """Payload para criar paciente."""

    full_name: str = Field(..., min_length=3, max_length=255)
    social_name: Optional[str] = Field(None, max_length=255)
    birth_date: date
    phone: str = Field(..., min_length=8, max_length=20)
    cpf: Optional[str] = None
    email: Optional[str] = Field(None, max_length=255)
    sex: Optional[str] = Field(None, pattern="^[MFIO]$")  # M, F, I, O
    origin: Optional[str] = Field(None, max_length=50)
    cep: Optional[str] = Field(None, max_length=10)
    logradouro: Optional[str] = Field(None, max_length=255)
    numero: Optional[str] = Field(None, max_length=20)
    complemento: Optional[str] = Field(None, max_length=100)
    bairro: Optional[str] = Field(None, max_length=100)
    cidade: Optional[str] = Field(None, max_length=100)
    uf: Optional[str] = Field(None, max_length=2)

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        digits = _cpf_digits(v)
        if len(digits) != 11:
            raise ValueError("CPF deve ter 11 digitos")
        if not _cpf_check_digits_valid(digits):
            raise ValueError("CPF invalido")
        return _format_cpf(digits)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = _normalize_phone(v)
        if len(digits) < 10 or len(digits) > 11:
            raise ValueError("Telefone deve ter 10 ou 11 digitos")
        return v.strip()


class PatientUpdate(BaseModel):
    """Payload para atualizar paciente (parcial)."""

    full_name: Optional[str] = Field(None, min_length=3, max_length=255)
    social_name: Optional[str] = Field(None, max_length=255)
    birth_date: Optional[date] = None
    phone: Optional[str] = Field(None, min_length=8, max_length=20)
    cpf: Optional[str] = None
    email: Optional[str] = Field(None, max_length=255)
    sex: Optional[str] = Field(None, pattern="^[MFIO]$")
    status: Optional[str] = Field(None, max_length=20)
    origin: Optional[str] = Field(None, max_length=50)
    cep: Optional[str] = Field(None, max_length=10)
    logradouro: Optional[str] = Field(None, max_length=255)
    numero: Optional[str] = Field(None, max_length=20)
    complemento: Optional[str] = Field(None, max_length=100)
    bairro: Optional[str] = Field(None, max_length=100)
    cidade: Optional[str] = Field(None, max_length=100)
    uf: Optional[str] = Field(None, max_length=2)

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not (v and v.strip()):
            return None
        digits = _cpf_digits(v)
        if len(digits) != 11:
            raise ValueError("CPF deve ter 11 digitos")
        if not _cpf_check_digits_valid(digits):
            raise ValueError("CPF invalido")
        return _format_cpf(digits)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        digits = _normalize_phone(v)
        if len(digits) < 10 or len(digits) > 11:
            raise ValueError("Telefone deve ter 10 ou 11 digitos")
        return v.strip()


class PatientGuardianResponse(BaseModel):
    id: str
    patient_id: str
    name: str
    cpf: Optional[str] = None
    parentesco: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    autorizado_informacoes: bool = False

    model_config = ConfigDict(from_attributes=True)


class GuardianCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    cpf: Optional[str] = None
    parentesco: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    autorizado_informacoes: bool = False


class GuardianUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    cpf: Optional[str] = None
    parentesco: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    autorizado_informacoes: Optional[bool] = None


class PatientInsuranceResponse(BaseModel):
    id: str
    patient_id: str
    tipo_atendimento: str
    convenio_id: Optional[str] = None
    plano: Optional[str] = None
    numero_carteirinha: Optional[str] = None
    validade: Optional[date] = None
    titular: Optional[str] = None
    ativo: bool = True

    model_config = ConfigDict(from_attributes=True)


class InsuranceCreate(BaseModel):
    tipo_atendimento: str = Field(..., pattern="^(particular|convenio)$")
    convenio_id: Optional[str] = None
    plano: Optional[str] = Field(None, max_length=100)
    numero_carteirinha: Optional[str] = Field(None, max_length=50)
    validade: Optional[date] = None
    titular: Optional[str] = Field(None, max_length=255)
    ativo: bool = True


class InsuranceUpdate(BaseModel):
    tipo_atendimento: Optional[str] = Field(None, pattern="^(particular|convenio)$")
    convenio_id: Optional[str] = None
    plano: Optional[str] = Field(None, max_length=100)
    numero_carteirinha: Optional[str] = Field(None, max_length=50)
    validade: Optional[date] = None
    titular: Optional[str] = Field(None, max_length=255)
    ativo: Optional[bool] = None


class ConvenioResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConvenioCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)


class PatientConsentResponse(BaseModel):
    id: str
    patient_id: str
    consent_type: str
    granted: bool
    granted_at: datetime
    granted_by: Optional[str] = None
    channel: str
    term_version: str
    revoked_at: Optional[datetime] = None
    revoked_by: Optional[str] = None
    revocation_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ConsentGrant(BaseModel):
    """Registrar ou atualizar consentimento."""
    consent_type: str = Field(..., pattern="^(lembretes|whatsapp|marketing|teleatendimento|contato_familiar)$")
    granted: bool = True
    channel: str = Field(..., pattern="^(presencial|checkbox|whatsapp)$")
    term_version: str = Field(..., min_length=1, max_length=20)


class ConsentRevoke(BaseModel):
    revocation_reason: str = Field(..., min_length=5, max_length=500)


class PatientResponse(BaseModel):
    """Resposta de paciente (detalhe, com guardians e insurances)."""

    id: str
    organization_id: str
    full_name: str
    social_name: Optional[str] = None
    birth_date: date
    phone: str
    cpf: Optional[str] = None
    email: Optional[str] = None
    sex: Optional[str] = None
    status: str
    origin: Optional[str] = None
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    guardians: list[PatientGuardianResponse] = []
    insurances: list[PatientInsuranceResponse] = []

    model_config = ConfigDict(from_attributes=True)


class PatientListItemResponse(BaseModel):
    """Resposta de paciente na listagem (sem relações)."""

    id: str
    organization_id: str
    full_name: str
    social_name: Optional[str] = None
    birth_date: date
    phone: str
    cpf: Optional[str] = None
    email: Optional[str] = None
    sex: Optional[str] = None
    status: str
    origin: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PatientListResponse(BaseModel):
    """Lista paginada de pacientes."""

    items: list[PatientListItemResponse]
    total: int
    limit: int
    offset: int


class PatientDocumentResponse(BaseModel):
    """Documento do paciente. Story 2.5."""

    id: str
    patient_id: str
    organization_id: str
    category: str
    file_path: str
    file_name: str
    file_size: int
    mime_type: str
    uploaded_by: Optional[str] = None
    data_classification: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---- Profissional de Saude (Story 3.1) ----

_CATEGORIES = ("MED", "ENF", "PSI", "FIS", "NUT", "DEN", "FAR", "FNO", "TER", "OUT")
_COUNCILS = ("CRM", "COREN", "CRP", "CREFITO", "CRN", "CRO", "CRF", "CREFONO", "OUTRO")
_EMPLOYMENT_TYPES = ("CLT", "PJ", "autonomo", "parceiro")
_MODALITIES = ("presencial", "remoto", "hibrido")


class ProfessionalCreate(BaseModel):
    """Payload para criar profissional de saude."""

    full_name: str = Field(..., min_length=3, max_length=255)
    social_name: Optional[str] = Field(None, max_length=255)
    cpf: Optional[str] = None
    category: str = Field(..., pattern="^(" + "|".join(_CATEGORIES) + ")$")
    council: str = Field(..., pattern="^(" + "|".join(_COUNCILS) + ")$")
    registration_number: str = Field(..., min_length=1, max_length=20)
    council_uf: str = Field(..., min_length=2, max_length=2)
    rqe: Optional[str] = Field(None, max_length=20)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    uf: Optional[str] = Field(None, max_length=2)
    user_id: Optional[str] = Field(None, max_length=36)
    employment_type: Optional[str] = Field(None, pattern="^(" + "|".join(_EMPLOYMENT_TYPES) + ")$")
    modality: Optional[str] = Field(None, pattern="^(" + "|".join(_MODALITIES) + ")$")
    unit_ids: Optional[list[str]] = Field(None, max_length=50)
    default_slot_minutes: Optional[int] = Field(None, ge=15, le=60)
    accepts_encaixe: Optional[bool] = None
    buffer_between_minutes: Optional[int] = Field(None, ge=0, le=60)

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        digits = _cpf_digits(v)
        if len(digits) != 11:
            raise ValueError("CPF deve ter 11 digitos")
        if not _cpf_check_digits_valid(digits):
            raise ValueError("CPF invalido")
        return _format_cpf(digits)

    @field_validator("council_uf", "uf")
    @classmethod
    def upper_uf(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v and v.strip() else (v if v is not None else None)


class ProfessionalUpdate(BaseModel):
    """Payload para atualizar profissional (parcial)."""

    full_name: Optional[str] = Field(None, min_length=3, max_length=255)
    social_name: Optional[str] = Field(None, max_length=255)
    cpf: Optional[str] = None
    category: Optional[str] = Field(None, pattern="^(" + "|".join(_CATEGORIES) + ")$")
    council: Optional[str] = Field(None, pattern="^(" + "|".join(_COUNCILS) + ")$")
    registration_number: Optional[str] = Field(None, max_length=20)
    council_uf: Optional[str] = Field(None, min_length=2, max_length=2)
    rqe: Optional[str] = Field(None, max_length=20)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    uf: Optional[str] = Field(None, max_length=2)
    status: Optional[str] = Field(None, max_length=20)
    user_id: Optional[str] = Field(None, max_length=36)
    employment_type: Optional[str] = Field(None, pattern="^(" + "|".join(_EMPLOYMENT_TYPES) + ")$")
    modality: Optional[str] = Field(None, pattern="^(" + "|".join(_MODALITIES) + ")$")
    unit_ids: Optional[list[str]] = Field(None, max_length=50)
    default_slot_minutes: Optional[int] = Field(None, ge=15, le=60)
    accepts_encaixe: Optional[bool] = None
    buffer_between_minutes: Optional[int] = Field(None, ge=0, le=60)
    event_type_id: Optional[str] = Field(None, max_length=36)

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not (v and v.strip()):
            return None
        digits = _cpf_digits(v)
        if len(digits) != 11:
            raise ValueError("CPF deve ter 11 digitos")
        if not _cpf_check_digits_valid(digits):
            raise ValueError("CPF invalido")
        return _format_cpf(digits)

    @field_validator("council_uf", "uf")
    @classmethod
    def upper_uf(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v and v.strip() else (v if v is not None else None)


class ProfessionalResponse(BaseModel):
    """Resposta de profissional (detalhe)."""

    id: str
    organization_id: str
    user_id: Optional[str] = None
    full_name: str
    social_name: Optional[str] = None
    cpf: Optional[str] = None
    category: str
    council: str
    registration_number: str
    council_uf: str
    rqe: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    uf: Optional[str] = None
    status: str
    employment_type: Optional[str] = None
    modality: Optional[str] = None
    unit_ids: list[str] = Field(default_factory=list)
    schedule_id: Optional[str] = None
    event_type_id: Optional[str] = None
    default_slot_minutes: Optional[int] = None
    accepts_encaixe: bool = False
    buffer_between_minutes: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Agenda do profissional: conforme PRD 10.3 usa API do Calendario (AvailabilitySchedule).
# Config (default_slot_minutes, accepts_encaixe, buffer_between_minutes) fica no Professional e e atualizado via PATCH.


class ProfessionalListItemResponse(BaseModel):
    """Resposta de profissional na listagem."""

    id: str
    organization_id: str
    full_name: str
    social_name: Optional[str] = None
    category: str
    council: str
    registration_number: str
    council_uf: str
    status: str
    event_type_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfessionalListResponse(BaseModel):
    """Lista paginada de profissionais."""

    items: list[ProfessionalListItemResponse]
    total: int
    limit: int
    offset: int


# ---- Unidade de atendimento (Story 3.3) ----


class UnitCreate(BaseModel):
    """Payload para criar unidade."""

    name: str = Field(..., min_length=1, max_length=200)
    is_active: bool = True
    timezone: Optional[str] = Field(None, max_length=50)
    default_slot_minutes: Optional[int] = Field(None, ge=5, le=120)
    min_advance_minutes: Optional[int] = Field(None, ge=0, le=10080)
    max_advance_days: Optional[int] = Field(None, ge=1, le=365)
    cancellation_policy: Optional[str] = None
    specialities: Optional[list[str]] = None
    modalities: Optional[list[str]] = None
    convenio_ids: Optional[list[str]] = None


class UnitUpdate(BaseModel):
    """Payload para atualizar unidade (parcial)."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    is_active: Optional[bool] = None
    timezone: Optional[str] = Field(None, max_length=50)
    default_slot_minutes: Optional[int] = Field(None, ge=5, le=120)
    min_advance_minutes: Optional[int] = Field(None, ge=0, le=10080)
    max_advance_days: Optional[int] = Field(None, ge=1, le=365)
    cancellation_policy: Optional[str] = None
    specialities: Optional[list[str]] = None
    modalities: Optional[list[str]] = None
    convenio_ids: Optional[list[str]] = None


class UnitResponse(BaseModel):
    """Resposta de unidade."""

    id: str
    organization_id: str
    name: str
    is_active: bool
    timezone: Optional[str] = None
    default_slot_minutes: Optional[int] = None
    min_advance_minutes: Optional[int] = None
    max_advance_days: Optional[int] = None
    cancellation_policy: Optional[str] = None
    specialities: Optional[list[str]] = None
    modalities: Optional[list[str]] = None
    convenio_ids: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---- Sala (Story 3.3) ----


class RoomCreate(BaseModel):
    """Payload para criar sala."""

    name: str = Field(..., min_length=1, max_length=100)
    capacity: Optional[int] = Field(None, ge=1, le=999)
    equipment_notes: Optional[str] = None
    is_active: bool = True


class RoomUpdate(BaseModel):
    """Payload para atualizar sala (parcial)."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    capacity: Optional[int] = Field(None, ge=1, le=999)
    equipment_notes: Optional[str] = None
    is_active: Optional[bool] = None


class RoomResponse(BaseModel):
    """Resposta de sala."""

    id: str
    unit_id: str
    name: str
    capacity: Optional[int] = None
    equipment_notes: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# ---- Documentos / Financeiro / Termos do profissional (Story 3.4) ----


class ProfessionalDocumentCreate(BaseModel):
    """Payload para registrar documento do profissional (upload em outro fluxo)."""
    category: str = Field(..., min_length=1, max_length=50)
    file_path: str = Field(..., min_length=1, max_length=512)
    file_name: str = Field(..., min_length=1, max_length=255)
    file_size: int = Field(..., ge=0)
    mime_type: str = Field(..., max_length=100)
    valid_until: Optional[date] = None


class ProfessionalDocumentResponse(BaseModel):
    id: str
    professional_id: str
    category: str
    file_path: str
    file_name: str
    file_size: int
    mime_type: str
    valid_until: Optional[date] = None
    uploaded_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfessionalFinancialUpdate(BaseModel):
    """Payload para atualizar dados financeiros (fin+gcl)."""
    cnpj: Optional[str] = Field(None, max_length=18)
    razao_social: Optional[str] = Field(None, max_length=255)
    pix_key: Optional[str] = Field(None, max_length=255)
    bank_data: Optional[dict[str, Any]] = None
    repasse_model: Optional[str] = Field(None, max_length=50)


class ProfessionalFinancialResponse(BaseModel):
    id: str
    professional_id: str
    cnpj: Optional[str] = None
    razao_social: Optional[str] = None
    pix_key: Optional[str] = None
    bank_data: Optional[dict[str, Any]] = None
    repasse_model: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfessionalTermAcceptRequest(BaseModel):
    """Registro de aceite de termo."""
    term_type: str = Field(..., min_length=1, max_length=50)
    term_version: str = Field(..., min_length=1, max_length=20)


class ProfessionalTermAcceptanceResponse(BaseModel):
    id: str
    professional_id: str
    term_type: str
    term_version: str
    accepted_at: datetime
    accepted_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CrmHealthResponse(BaseModel):
    """Resposta de health check do modulo CRM."""

    module: str = "crm-saude"
    status: str = "ok"


class AuditLogResponse(BaseModel):
    """Item do log de auditoria (somente leitura)."""

    id: str
    organization_id: str
    user_id: str
    action: str
    resource_type: str
    resource_id: str
    data_classification: Optional[str] = None
    data_before: Optional[dict[str, Any]] = None
    data_after: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    justification: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    """Lista paginada de logs de auditoria."""

    items: list[AuditLogResponse]
    total: int
    limit: int
    offset: int


# ---- Appointments (Epic 4 - Story 4.1) ----


class AppointmentCreate(BaseModel):
    """Payload para criar agendamento (Booking + Appointment)."""

    patient_id: str = Field(..., min_length=1, max_length=36)
    professional_id: str = Field(..., min_length=1, max_length=36)
    event_type_id: str = Field(..., min_length=1, max_length=36)
    unit_id: Optional[str] = Field(None, max_length=36)
    room_id: Optional[str] = Field(None, max_length=36)
    start_time: datetime = Field(...)
    timezone: str = Field(default="America/Sao_Paulo", max_length=50)
    appointment_type: str = Field(default="consulta", pattern="^(consulta|retorno|procedimento|teleconsulta)$")
    notes: Optional[str] = Field(None, max_length=2000)


class AppointmentResponse(BaseModel):
    """Resposta de agendamento (detalhe)."""

    id: str
    organization_id: str
    booking_id: str
    patient_id: str
    professional_id: str
    unit_id: Optional[str] = None
    room_id: Optional[str] = None
    status: str
    appointment_type: str
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AppointmentListItemResponse(BaseModel):
    """Item de agendamento na listagem."""

    id: str
    booking_id: str
    patient_id: str
    professional_id: str
    patient_name: Optional[str] = None
    professional_name: Optional[str] = None
    unit_id: Optional[str] = None
    room_id: Optional[str] = None
    status: str
    appointment_type: str
    start_time: datetime
    end_time: datetime

    model_config = ConfigDict(from_attributes=True)


class AppointmentListResponse(BaseModel):
    """Lista paginada de agendamentos."""

    items: list[AppointmentListItemResponse]
    total: int
    limit: int
    offset: int


# ---- Epic 4.3: Gestao de status e acoes ----

APPOINTMENT_STATUS_TRANSITIONS: dict[str, list[str]] = {
    "agendado": ["confirmado", "cancelado"],
    "confirmado": ["em_atendimento", "cancelado", "no_show"],
    "em_atendimento": ["atendido"],
}

class AppointmentUpdateStatus(BaseModel):
    """Payload para alterar status do agendamento (confirmar, cancelar, no-show, etc)."""

    status: str = Field(
        ...,
        pattern="^(confirmado|cancelado|em_atendimento|atendido|no_show)$",
    )
    cancellation_reason: Optional[str] = Field(None, max_length=500)


class AppointmentRescheduleBody(BaseModel):
    """Payload para remarcar: novo horario (cria novo agendamento e cancela o anterior)."""

    start_time: datetime = Field(...)
    timezone: str = Field(default="America/Sao_Paulo", max_length=50)


# ---- Epic 4.5: Lista de espera ----

class WaitlistEntryCreate(BaseModel):
    """Payload para adicionar paciente à lista de espera."""

    patient_id: str = Field(..., min_length=1, max_length=36)
    professional_id: str = Field(..., min_length=1, max_length=36)
    appointment_type: str = Field(default="consulta", pattern="^(consulta|retorno|procedimento|teleconsulta)$")
    preferred_dates: Optional[list[str]] = Field(None)
    priority: int = Field(default=0, ge=0, le=100)


class WaitlistEntryResponse(BaseModel):
    """Item da lista de espera."""

    id: str
    organization_id: str
    patient_id: str
    professional_id: str
    appointment_type: str
    preferred_dates: Optional[list[str]] = None
    priority: int
    status: str
    created_at: datetime
    patient_name: Optional[str] = None
    professional_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---- Epic 5: Atendimento clinico ----

class ClinicalEncounterCreate(BaseModel):
    """Criar atendimento a partir de agendamento ou por paciente/profissional."""

    appointment_id: Optional[str] = Field(None, max_length=36)
    patient_id: str = Field(..., min_length=1, max_length=36)
    professional_id: str = Field(..., min_length=1, max_length=36)
    unit_id: Optional[str] = Field(None, max_length=36)


class ClinicalEncounterResponse(BaseModel):
    id: str
    organization_id: str
    appointment_id: Optional[str] = None
    patient_id: str
    professional_id: str
    unit_id: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    patient_name: Optional[str] = None
    professional_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TriageCreate(BaseModel):
    """Registro de triagem."""

    chief_complaint: Optional[str] = Field(None, max_length=2000)
    symptom_onset: Optional[str] = Field(None, max_length=255)
    allergies: Optional[list[str]] = None
    current_medications: Optional[list[str]] = None
    past_conditions: Optional[list[str]] = None
    triage_notes: Optional[str] = Field(None, max_length=2000)


class TriageUpdate(BaseModel):
    """Atualizar triagem (parcial)."""

    chief_complaint: Optional[str] = Field(None, max_length=2000)
    symptom_onset: Optional[str] = Field(None, max_length=255)
    allergies: Optional[list[str]] = None
    current_medications: Optional[list[str]] = None
    past_conditions: Optional[list[str]] = None
    triage_notes: Optional[str] = Field(None, max_length=2000)


class TriageResponse(BaseModel):
    id: str
    encounter_id: str
    chief_complaint: Optional[str] = None
    symptom_onset: Optional[str] = None
    allergies: Optional[list[str]] = None
    current_medications: Optional[list[str]] = None
    past_conditions: Optional[list[str]] = None
    triage_notes: Optional[str] = None
    recorded_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---- Story 5.2: Evolucao clinica ----

class ClinicalEvolutionCreate(BaseModel):
    """Criar evolucao clinica (rascunho)."""

    evolution_type: str = Field(
        default="initial",
        pattern="^(initial|followup|emergency|telehealth)$",
    )
    anamnesis: Optional[str] = Field(None, max_length=10000)
    clinical_history: Optional[str] = Field(None, max_length=10000)
    family_history: Optional[str] = Field(None, max_length=5000)
    physical_exam: Optional[str] = Field(None, max_length=10000)
    diagnostic_hypotheses: Optional[str] = Field(None, max_length=5000)
    therapeutic_plan: Optional[str] = Field(None, max_length=10000)
    patient_guidance: Optional[str] = Field(None, max_length=5000)
    suggested_return_date: Optional[date] = None


class ClinicalEvolutionUpdate(BaseModel):
    """Atualizar evolucao (apenas em status draft)."""

    evolution_type: Optional[str] = Field(None, pattern="^(initial|followup|emergency|telehealth)$")
    anamnesis: Optional[str] = Field(None, max_length=10000)
    clinical_history: Optional[str] = Field(None, max_length=10000)
    family_history: Optional[str] = Field(None, max_length=5000)
    physical_exam: Optional[str] = Field(None, max_length=10000)
    diagnostic_hypotheses: Optional[str] = Field(None, max_length=5000)
    therapeutic_plan: Optional[str] = Field(None, max_length=10000)
    patient_guidance: Optional[str] = Field(None, max_length=5000)
    suggested_return_date: Optional[date] = None


class ClinicalEvolutionResponse(BaseModel):
    id: str
    encounter_id: str
    evolution_type: str
    anamnesis: Optional[str] = None
    clinical_history: Optional[str] = None
    family_history: Optional[str] = None
    physical_exam: Optional[str] = None
    diagnostic_hypotheses: Optional[str] = None
    therapeutic_plan: Optional[str] = None
    patient_guidance: Optional[str] = None
    suggested_return_date: Optional[date] = None
    status: str
    recorded_by: Optional[str] = None
    finalized_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---- Story 5.3: Prescricao ----

class PrescriptionItemCreate(BaseModel):
    """Item de prescricao (medicamento)."""
    medication: str = Field(..., min_length=1, max_length=255)
    dosage: str = Field(..., min_length=1, max_length=100)
    posology: Optional[str] = Field(None, max_length=255)
    instructions: Optional[str] = Field(None, max_length=1000)


class PrescriptionItemUpdate(BaseModel):
    medication: Optional[str] = Field(None, min_length=1, max_length=255)
    dosage: Optional[str] = Field(None, min_length=1, max_length=100)
    posology: Optional[str] = Field(None, max_length=255)
    instructions: Optional[str] = Field(None, max_length=1000)


class PrescriptionItemResponse(BaseModel):
    id: str
    prescription_id: str
    medication: str
    dosage: str
    posology: Optional[str] = None
    instructions: Optional[str] = None
    position: int

    model_config = ConfigDict(from_attributes=True)


class PrescriptionCreate(BaseModel):
    """Criar prescricao (rascunho) com itens."""
    items: list[PrescriptionItemCreate] = Field(default_factory=list, max_length=50)


class PrescriptionUpdate(BaseModel):
    """Atualizar prescricao (apenas em draft): substitui itens."""
    items: list[PrescriptionItemCreate] = Field(..., max_length=50)


class PrescriptionResponse(BaseModel):
    id: str
    encounter_id: str
    status: str
    recorded_by: Optional[str] = None
    finalized_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items: list[PrescriptionItemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# ---- Story 5.4: Solicitacao de exames ----

class ExamRequestItemCreate(BaseModel):
    """Item de solicitacao de exame."""
    exam_name: str = Field(..., min_length=1, max_length=255)
    instructions: Optional[str] = Field(None, max_length=1000)


class ExamRequestItemUpdate(BaseModel):
    exam_name: Optional[str] = Field(None, min_length=1, max_length=255)
    instructions: Optional[str] = Field(None, max_length=1000)


class ExamRequestItemResponse(BaseModel):
    id: str
    exam_request_id: str
    exam_name: str
    instructions: Optional[str] = None
    position: int

    model_config = ConfigDict(from_attributes=True)


class ExamRequestCreate(BaseModel):
    """Criar solicitacao de exames (rascunho) com itens."""
    items: list[ExamRequestItemCreate] = Field(default_factory=list, max_length=50)


class ExamRequestUpdate(BaseModel):
    """Atualizar solicitacao (apenas em draft): substitui itens."""
    items: list[ExamRequestItemCreate] = Field(..., max_length=50)


class ExamRequestResponse(BaseModel):
    id: str
    encounter_id: str
    status: str
    recorded_by: Optional[str] = None
    finalized_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items: list[ExamRequestItemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# ---- Epic 6: Financeiro (pagamento por atendimento, recibo) ----

class PaymentCreate(BaseModel):
    """Registrar pagamento de um atendimento."""
    encounter_id: str
    amount: float = Field(..., gt=0)
    payment_method: str = Field("pix", max_length=30)
    notes: Optional[str] = Field(None, max_length=1000)


class PaymentResponse(BaseModel):
    id: str
    organization_id: str
    encounter_id: str
    amount: float
    payment_method: str
    notes: Optional[str] = None
    paid_at: datetime
    recorded_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentListItemResponse(PaymentResponse):
    """Payment com dados do encounter para listagem."""
    patient_name: Optional[str] = None
    professional_name: Optional[str] = None
    encounter_created_at: Optional[datetime] = None


class DashboardMetricsResponse(BaseModel):
    """Metricas do dashboard CRM (Epic 6)."""
    encounters_today: int = 0
    encounters_completed_today: int = 0
    payments_today_count: int = 0
    payments_today_total: float = 0.0
    payments_month_total: float = 0.0
    patients_total: int = 0
    appointments_today: int = 0
