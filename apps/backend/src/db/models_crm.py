"""
Models SQLAlchemy para o modulo CRM de Saude.
Seguindo o padrao de src/db/models_calendar.py: String(36) para IDs,
mapped_column, DateTime(timezone=True), _uuid_str() para defaults.
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, Boolean, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.session import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


class Patient(Base):
    """Paciente do CRM de Saude. Multi-tenant por organization_id."""
    __tablename__ = "crm_patients"
    __table_args__ = (
        UniqueConstraint("organization_id", "cpf", name="uq_crm_patient_org_cpf"),
        Index("ix_crm_patients_organization_id", "organization_id"),
        Index("ix_crm_patients_full_name", "full_name"),
        Index("ix_crm_patients_phone", "phone"),
        Index("ix_crm_patients_birth_date", "birth_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    social_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    cpf: Mapped[Optional[str]] = mapped_column(String(14), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sex: Mapped[Optional[str]] = mapped_column(String(1), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ativo")
    origin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # Endereco (Story 2.2 - Contato)
    cep: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    logradouro: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    numero: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    complemento: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bairro: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cidade: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    uf: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    guardians: Mapped[list["PatientGuardian"]] = relationship(
        "PatientGuardian", back_populates="patient", cascade="all, delete-orphan"
    )
    insurances: Mapped[list["PatientInsurance"]] = relationship(
        "PatientInsurance", back_populates="patient", cascade="all, delete-orphan"
    )


class PatientGuardian(Base):
    """Responsavel legal do paciente (menor/incapaz). Story 2.2."""
    __tablename__ = "crm_patient_guardians"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("crm_patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cpf: Mapped[Optional[str]] = mapped_column(String(14), nullable=True)
    parentesco: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    autorizado_informacoes: Mapped[bool] = mapped_column(default=False)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="guardians")


class Convenio(Base):
    """Convenio/plano de saude. Referenciado por PatientInsurance."""
    __tablename__ = "crm_convenios"
    __table_args__ = (Index("ix_crm_convenios_organization_id", "organization_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PatientInsurance(Base):
    """Vinculo paciente-convenio ou particular. Story 2.2."""
    __tablename__ = "crm_patient_insurances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("crm_patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo_atendimento: Mapped[str] = mapped_column(String(20), nullable=False, default="particular")
    convenio_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_convenios.id", ondelete="SET NULL"), nullable=True
    )
    plano: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    numero_carteirinha: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    validade: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    titular: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ativo: Mapped[bool] = mapped_column(default=True)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="insurances")


class PatientConsent(Base):
    """Consentimento LGPD do paciente. Story 2.3."""
    __tablename__ = "crm_patient_consents"
    __table_args__ = (Index("ix_crm_consent_patient_type", "patient_id", "consent_type"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("crm_patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    consent_type: Mapped[str] = mapped_column(String(50), nullable=False)
    granted: Mapped[bool] = mapped_column(nullable=False)
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    granted_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    term_version: Mapped[str] = mapped_column(String(20), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    revocation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    patient: Mapped["Patient"] = relationship("Patient", backref="consents")


class PatientDocument(Base):
    """Documento anexado ao paciente. Story 2.5."""
    __tablename__ = "crm_patient_documents"
    __table_args__ = (
        Index("ix_crm_docs_patient_id", "patient_id"),
        Index("ix_crm_docs_organization_id", "organization_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("crm_patients.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    data_classification: Mapped[str] = mapped_column(String(10), nullable=False, default="ADM")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    patient: Mapped["Patient"] = relationship("Patient", backref="documents")


class Unit(Base):
    """Unidade de atendimento da clinica. Story 3.3 (config + salas)."""
    __tablename__ = "crm_units"
    __table_args__ = (Index("ix_crm_units_organization_id", "organization_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    # Configuracao operacional (Story 3.3)
    timezone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    default_slot_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    min_advance_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_advance_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cancellation_policy: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    specialities: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)  # lista de strings
    modalities: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)  # presencial, remoto, hibrido
    convenio_ids: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)  # IDs de crm_convenios
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    rooms: Mapped[list["Room"]] = relationship(
        "Room", back_populates="unit", cascade="all, delete-orphan"
    )


class Room(Base):
    """Sala de atendimento dentro de uma unidade. Story 3.3."""
    __tablename__ = "crm_rooms"
    __table_args__ = (Index("ix_crm_rooms_unit_id", "unit_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    unit_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("crm_units.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    equipment_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    unit: Mapped["Unit"] = relationship("Unit", back_populates="rooms")


class HealthProfessionalUnit(Base):
    """Vinculo N:N profissional <-> unidade de atendimento."""
    __tablename__ = "crm_health_professional_units"
    __table_args__ = (
        UniqueConstraint("professional_id", "unit_id", name="uq_crm_professional_unit"),
    )

    professional_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_health_professionals.id", ondelete="CASCADE"),
        primary_key=True,
    )
    unit_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_units.id", ondelete="CASCADE"),
        primary_key=True,
    )

    professional: Mapped["HealthProfessional"] = relationship(
        "HealthProfessional", back_populates="professional_units"
    )
    unit: Mapped["Unit"] = relationship("Unit", back_populates="professional_units")


Unit.professional_units = relationship(
    "HealthProfessionalUnit", back_populates="unit", cascade="all, delete-orphan"
)


class HealthProfessional(Base):
    """Profissional de saude. Story 3.1. Multi-tenant por organization_id."""
    __tablename__ = "crm_health_professionals"
    __table_args__ = (
        Index("ix_crm_professionals_organization_id", "organization_id"),
        Index("ix_crm_professionals_full_name", "full_name"),
        Index("ix_crm_professionals_council_reg", "council", "registration_number", "council_uf"),
        Index("ix_crm_professionals_user_id", "user_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    social_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cpf: Mapped[Optional[str]] = mapped_column(String(14), nullable=True)
    category: Mapped[str] = mapped_column(String(10), nullable=False)  # MED, ENF, PSI, FIS, NUT, DEN, OUT
    council: Mapped[str] = mapped_column(String(10), nullable=False)  # CRM, COREN, CRP, CREFITO, CRN, CRO, OUTRO
    registration_number: Mapped[str] = mapped_column(String(20), nullable=False)
    council_uf: Mapped[str] = mapped_column(String(2), nullable=False)
    rqe: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    uf: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ativo")
    employment_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # CLT, PJ, autonomo, parceiro
    modality: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # presencial, remoto, hibrido
    # Story 3.2: agenda do profissional (usa AvailabilitySchedule do modulo calendar)
    schedule_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("availability_schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    default_slot_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 15, 20, 30, 45, 60
    accepts_encaixe: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    buffer_between_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Epic 4: EventType "Consulta" para slots e criacao de Booking (schedule_id = profissional)
    event_type_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("event_types.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    professional_units: Mapped[list["HealthProfessionalUnit"]] = relationship(
        "HealthProfessionalUnit",
        back_populates="professional",
        cascade="all, delete-orphan",
    )

    documents: Mapped[list["ProfessionalDocument"]] = relationship(
        "ProfessionalDocument",
        back_populates="professional",
        cascade="all, delete-orphan",
    )
    financial: Mapped[Optional["ProfessionalFinancial"]] = relationship(
        "ProfessionalFinancial",
        back_populates="professional",
        uselist=False,
        cascade="all, delete-orphan",
    )
    term_acceptances: Mapped[list["ProfessionalTermAcceptance"]] = relationship(
        "ProfessionalTermAcceptance",
        back_populates="professional",
        cascade="all, delete-orphan",
    )

    @property
    def unit_ids(self) -> list[str]:
        """IDs das unidades de atendimento (para serializacao)."""
        return [pu.unit_id for pu in self.professional_units]


class ProfessionalDocument(Base):
    """Documento do profissional (registro, RQE, diploma, contrato, comprovantes). Story 3.4."""
    __tablename__ = "crm_professional_documents"
    __table_args__ = (Index("ix_crm_prof_docs_professional_id", "professional_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    professional_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_health_professionals.id", ondelete="CASCADE"),
        nullable=False,
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    valid_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    professional: Mapped["HealthProfessional"] = relationship(
        "HealthProfessional", back_populates="documents"
    )


class ProfessionalFinancial(Base):
    """Dados financeiros do profissional (visivel apenas fin+gcl). Story 3.4."""
    __tablename__ = "crm_professional_financial"
    __table_args__ = (
        Index("ix_crm_prof_fin_professional_id", "professional_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    professional_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_health_professionals.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    cnpj: Mapped[Optional[str]] = mapped_column(String(18), nullable=True)
    razao_social: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pix_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bank_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    repasse_model: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    professional: Mapped["HealthProfessional"] = relationship(
        "HealthProfessional", back_populates="financial"
    )


class Appointment(Base):
    """Agendamento CRM (wrapper do Booking). Epic 4 - ADR-001."""
    __tablename__ = "crm_appointments"
    __table_args__ = (
        Index("ix_crm_appointments_organization_id", "organization_id"),
        Index("ix_crm_appointments_booking_id", "booking_id"),
        Index("ix_crm_appointments_patient_id", "patient_id"),
        Index("ix_crm_appointments_professional_id", "professional_id"),
        Index("ix_crm_appointments_start_time", "start_time"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    booking_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("crm_patients.id", ondelete="CASCADE"), nullable=False
    )
    professional_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_health_professionals.id", ondelete="CASCADE"),
        nullable=False,
    )
    unit_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_units.id", ondelete="SET NULL"), nullable=True
    )
    room_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_rooms.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="agendado")
    appointment_type: Mapped[str] = mapped_column(String(30), nullable=False, default="consulta")
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ClinicalEncounter(Base):
    """Atendimento clinico. Epic 5 - vinculado a Appointment (ou criado por busca de paciente)."""
    __tablename__ = "crm_clinical_encounters"
    __table_args__ = (
        Index("ix_crm_encounters_organization_id", "organization_id"),
        Index("ix_crm_encounters_appointment_id", "appointment_id"),
        Index("ix_crm_encounters_patient_id", "patient_id"),
        Index("ix_crm_encounters_professional_id", "professional_id"),
        Index("ix_crm_encounters_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    appointment_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_appointments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("crm_patients.id", ondelete="CASCADE"), nullable=False
    )
    professional_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_health_professionals.id", ondelete="CASCADE"),
        nullable=False,
    )
    unit_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_units.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="in_triage")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Payment(Base):
    """Pagamento vinculado a um atendimento. Epic 6."""
    __tablename__ = "crm_payments"
    __table_args__ = (
        Index("ix_crm_payments_organization_id", "organization_id"),
        Index("ix_crm_payments_encounter_id", "encounter_id"),
        Index("ix_crm_payments_paid_at", "paid_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    encounter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_clinical_encounters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(30), nullable=False, default="pix")  # pix, dinheiro, cartao_credito, cartao_debito, etc.
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    recorded_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Triage(Base):
    """Triagem do atendimento. Epic 5 - Story 5.1."""
    __tablename__ = "crm_triages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    encounter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_clinical_encounters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chief_complaint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    symptom_onset: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    allergies: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    current_medications: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    past_conditions: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    triage_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ClinicalEvolution(Base):
    """Evolucao clinica do atendimento. Epic 5 - Story 5.2."""
    __tablename__ = "crm_clinical_evolutions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    encounter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_clinical_encounters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evolution_type: Mapped[str] = mapped_column(String(20), nullable=False, default="initial")
    anamnesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    clinical_history: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    family_history: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    physical_exam: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    diagnostic_hypotheses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    therapeutic_plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    patient_guidance: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    suggested_return_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    recorded_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Prescription(Base):
    """Prescricao medica do atendimento. Epic 5 - Story 5.3."""
    __tablename__ = "crm_prescriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    encounter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_clinical_encounters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    recorded_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    items: Mapped[list["PrescriptionItem"]] = relationship(
        "PrescriptionItem",
        back_populates="prescription",
        order_by="PrescriptionItem.position",
        cascade="all, delete-orphan",
    )


class PrescriptionItem(Base):
    """Item (medicamento) de uma prescricao. Epic 5 - Story 5.3."""
    __tablename__ = "crm_prescription_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    prescription_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_prescriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    medication: Mapped[str] = mapped_column(String(255), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)
    posology: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    prescription: Mapped["Prescription"] = relationship(
        "Prescription", back_populates="items"
    )


class ExamRequest(Base):
    """Solicitacao de exames do atendimento. Epic 5 - Story 5.4."""
    __tablename__ = "crm_exam_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    encounter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_clinical_encounters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    recorded_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    items: Mapped[list["ExamRequestItem"]] = relationship(
        "ExamRequestItem",
        back_populates="exam_request",
        order_by="ExamRequestItem.position",
        cascade="all, delete-orphan",
    )


class ExamRequestItem(Base):
    """Item (exame) de uma solicitacao de exames. Epic 5 - Story 5.4."""
    __tablename__ = "crm_exam_request_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    exam_request_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_exam_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exam_name: Mapped[str] = mapped_column(String(255), nullable=False)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    exam_request: Mapped["ExamRequest"] = relationship(
        "ExamRequest", back_populates="items"
    )


class WaitlistEntry(Base):
    """Lista de espera para encaixe. Epic 4.5."""
    __tablename__ = "crm_waitlist_entries"
    __table_args__ = (
        Index("ix_crm_waitlist_organization_id", "organization_id"),
        Index("ix_crm_waitlist_patient_id", "patient_id"),
        Index("ix_crm_waitlist_professional_id", "professional_id"),
        Index("ix_crm_waitlist_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("crm_patients.id", ondelete="CASCADE"), nullable=False
    )
    professional_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_health_professionals.id", ondelete="CASCADE"),
        nullable=False,
    )
    appointment_type: Mapped[str] = mapped_column(String(30), nullable=False, default="consulta")
    preferred_dates: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # e.g. ["2026-02-25", "2026-02-26"]
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="waiting")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ProfessionalTermAcceptance(Base):
    """Registro de aceite de termo pelo profissional. Story 3.4."""
    __tablename__ = "crm_professional_term_acceptances"
    __table_args__ = (Index("ix_crm_prof_terms_professional_id", "professional_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    professional_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("crm_health_professionals.id", ondelete="CASCADE"),
        nullable=False,
    )
    term_type: Mapped[str] = mapped_column(String(50), nullable=False)
    term_version: Mapped[str] = mapped_column(String(20), nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    accepted_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    professional: Mapped["HealthProfessional"] = relationship(
        "HealthProfessional", back_populates="term_acceptances"
    )


class AuditLog(Base):
    """
    Log de auditoria append-only para operacoes em dados sensiveis (CLI, FIN, ADM).
    Sem endpoints de UPDATE/DELETE.
    """
    __tablename__ = "crm_audit_logs"
    __table_args__ = (
        Index("ix_crm_audit_organization_id", "organization_id"),
        Index("ix_crm_audit_user_id", "user_id"),
        Index("ix_crm_audit_resource_type", "resource_type"),
        Index("ix_crm_audit_created_at", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    action: Mapped[str] = mapped_column(String(30), nullable=False)  # create, read, update, delete
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False)
    data_classification: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # ADM, CLI, FIN
    data_before: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    data_after: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    justification: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
