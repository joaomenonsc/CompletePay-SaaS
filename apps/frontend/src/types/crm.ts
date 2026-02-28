/** Tipos do modulo CRM Saude */

export interface PatientGuardian {
  id: string;
  patient_id: string;
  name: string;
  cpf: string | null;
  parentesco: string | null;
  phone: string | null;
  email: string | null;
  autorizado_informacoes: boolean;
}

export interface PatientInsurance {
  id: string;
  patient_id: string;
  tipo_atendimento: string;
  convenio_id: string | null;
  plano: string | null;
  numero_carteirinha: string | null;
  validade: string | null;
  titular: string | null;
  ativo: boolean;
}

export interface Patient {
  id: string;
  organization_id: string;
  full_name: string;
  social_name: string | null;
  birth_date: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  sex: string | null;
  status: string;
  origin: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  created_at: string;
  updated_at: string;
  guardians?: PatientGuardian[];
  insurances?: PatientInsurance[];
}

export interface PatientListResponse {
  items: Patient[];
  total: number;
  limit: number;
  offset: number;
}

export interface PatientCreateInput {
  full_name: string;
  social_name?: string | null;
  birth_date: string;
  phone: string;
  cpf?: string | null;
  email?: string | null;
  sex?: string | null;
  origin?: string | null;
}

export interface PatientUpdateInput {
  full_name?: string;
  social_name?: string | null;
  birth_date?: string;
  phone?: string;
  cpf?: string | null;
  email?: string | null;
  sex?: string | null;
  status?: string;
  origin?: string | null;
}

export interface Convenio {
  id: string;
  name: string;
}

export interface GuardianCreateInput {
  name: string;
  cpf?: string | null;
  parentesco?: string | null;
  phone?: string | null;
  email?: string | null;
  autorizado_informacoes?: boolean;
}

export interface GuardianUpdateInput {
  name?: string;
  cpf?: string | null;
  parentesco?: string | null;
  phone?: string | null;
  email?: string | null;
  autorizado_informacoes?: boolean;
}

export interface InsuranceCreateInput {
  tipo_atendimento: "particular" | "convenio";
  convenio_id?: string | null;
  plano?: string | null;
  numero_carteirinha?: string | null;
  validade?: string | null;
  titular?: string | null;
  ativo?: boolean;
}

export interface InsuranceUpdateInput {
  tipo_atendimento?: "particular" | "convenio";
  convenio_id?: string | null;
  plano?: string | null;
  numero_carteirinha?: string | null;
  validade?: string | null;
  titular?: string | null;
  ativo?: boolean;
}

export type ConsentType =
  | "lembretes"
  | "whatsapp"
  | "marketing"
  | "teleatendimento"
  | "contato_familiar";
export type ConsentChannel = "presencial" | "checkbox" | "whatsapp";

export interface PatientConsent {
  id: string;
  patient_id: string;
  consent_type: ConsentType;
  granted: boolean;
  granted_at: string;
  granted_by: string | null;
  channel: ConsentChannel;
  term_version: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
}

export interface ConsentGrantInput {
  consent_type: ConsentType;
  granted?: boolean;
  channel: ConsentChannel;
  term_version: string;
}

export interface ConsentRevokeInput {
  revocation_reason: string;
}

export type PatientDocumentCategory =
  | "identificacao"
  | "carteirinha"
  | "exame"
  | "laudo"
  | "termo"
  | "comprovante";

export type PatientDocumentClassification = "ADM" | "CLI" | "FIN" | "DOC";

export interface PatientDocument {
  id: string;
  patient_id: string;
  organization_id: string;
  category: PatientDocumentCategory;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string | null;
  data_classification: PatientDocumentClassification;
  created_at: string;
}

// ---- Profissional de Saúde (Story 3.1) ----

export type ProfessionalCategory =
  | "MED"
  | "ENF"
  | "PSI"
  | "FIS"
  | "NUT"
  | "DEN"
  | "FAR"
  | "FNO"
  | "TER"
  | "OUT";

export type ProfessionalCouncil =
  | "CRM"
  | "COREN"
  | "CRP"
  | "CREFITO"
  | "CRN"
  | "CRO"
  | "CRF"
  | "CREFONO"
  | "OUTRO";

export type ProfessionalEmploymentType = "CLT" | "PJ" | "autonomo" | "parceiro";
export type ProfessionalModality = "presencial" | "remoto" | "hibrido";

export interface Professional {
  id: string;
  organization_id: string;
  user_id: string | null;
  full_name: string;
  social_name: string | null;
  cpf: string | null;
  category: ProfessionalCategory;
  council: ProfessionalCouncil;
  registration_number: string;
  council_uf: string;
  rqe: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  uf: string | null;
  status: string;
  employment_type: ProfessionalEmploymentType | null;
  modality: ProfessionalModality | null;
  unit_ids: string[];
  schedule_id?: string | null;
  event_type_id?: string | null;
  default_slot_minutes?: number | null;
  accepts_encaixe?: boolean;
  buffer_between_minutes?: number | null;
  created_at: string;
  updated_at: string;
}

// Agenda do profissional: PRD 10.3 - dados de disponibilidade vêm da API do Calendário (Schedule); config (default_slot_minutes, accepts_encaixe, buffer_between_minutes) fica no Professional.

// Documentos do profissional (Story 3.4)
export interface ProfessionalDocument {
  id: string;
  professional_id: string;
  category: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  valid_until: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface ProfessionalDocumentCreateInput {
  category: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  valid_until?: string | null;
}

// Financeiro do profissional (Story 3.4, fin+gcl)
export interface ProfessionalFinancial {
  id: string;
  professional_id: string;
  cnpj: string | null;
  razao_social: string | null;
  pix_key: string | null;
  bank_data: Record<string, unknown> | null;
  repasse_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalFinancialUpdateInput {
  cnpj?: string | null;
  razao_social?: string | null;
  pix_key?: string | null;
  bank_data?: Record<string, unknown> | null;
  repasse_model?: string | null;
}

// Termos de aceite (Story 3.4)
export interface ProfessionalTermAcceptance {
  id: string;
  professional_id: string;
  term_type: string;
  term_version: string;
  accepted_at: string;
  accepted_by: string | null;
}

export interface ProfessionalTermAcceptInput {
  term_type: string;
  term_version: string;
}

// Unidade estendida (Story 3.3) e salas
export interface Unit {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  timezone?: string | null;
  default_slot_minutes?: number | null;
  min_advance_minutes?: number | null;
  max_advance_days?: number | null;
  cancellation_policy?: string | null;
  specialities?: string[] | null;
  modalities?: string[] | null;
  convenio_ids?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  unit_id: string;
  name: string;
  capacity: number | null;
  equipment_notes: string | null;
  is_active: boolean;
}

export interface RoomCreateInput {
  name: string;
  capacity?: number | null;
  equipment_notes?: string | null;
  is_active?: boolean;
}

export interface RoomUpdateInput {
  name?: string;
  capacity?: number | null;
  equipment_notes?: string | null;
  is_active?: boolean;
}

export interface UnitUpdateInput {
  name?: string;
  is_active?: boolean;
  timezone?: string | null;
  default_slot_minutes?: number | null;
  min_advance_minutes?: number | null;
  max_advance_days?: number | null;
  cancellation_policy?: string | null;
  specialities?: string[] | null;
  modalities?: string[] | null;
  convenio_ids?: string[] | null;
}

export interface ProfessionalListResponse {
  items: Professional[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProfessionalCreateInput {
  full_name: string;
  social_name?: string | null;
  cpf?: string | null;
  category: ProfessionalCategory;
  council: ProfessionalCouncil;
  registration_number: string;
  council_uf: string;
  rqe?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  uf?: string | null;
  user_id?: string | null;
  employment_type?: ProfessionalEmploymentType | null;
  modality?: ProfessionalModality | null;
  unit_ids?: string[] | null;
  default_slot_minutes?: number | null;
  accepts_encaixe?: boolean;
  buffer_between_minutes?: number | null;
}

export interface ProfessionalUpdateInput {
  full_name?: string;
  social_name?: string | null;
  cpf?: string | null;
  category?: ProfessionalCategory;
  council?: ProfessionalCouncil;
  registration_number?: string;
  council_uf?: string;
  rqe?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  uf?: string | null;
  status?: string;
  user_id?: string | null;
  employment_type?: ProfessionalEmploymentType | null;
  modality?: ProfessionalModality | null;
  unit_ids?: string[] | null;
  default_slot_minutes?: number | null;
  accepts_encaixe?: boolean;
  buffer_between_minutes?: number | null;
  event_type_id?: string | null;
}

// ---- Appointments (Epic 4 - Story 4.1) ----

export type AppointmentType =
  | "consulta"
  | "retorno"
  | "procedimento"
  | "teleconsulta";

export interface Appointment {
  id: string;
  organization_id: string;
  booking_id: string;
  patient_id: string;
  professional_id: string;
  unit_id: string | null;
  room_id: string | null;
  status: string;
  appointment_type: AppointmentType;
  start_time: string;
  end_time: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentListItem {
  id: string;
  booking_id: string;
  patient_id: string;
  professional_id: string;
  patient_name?: string | null;
  professional_name?: string | null;
  unit_id: string | null;
  room_id: string | null;
  status: string;
  appointment_type: AppointmentType;
  start_time: string;
  end_time: string;
}

export interface AppointmentListResponse {
  items: AppointmentListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AppointmentCreateInput {
  patient_id: string;
  professional_id: string;
  event_type_id: string;
  unit_id?: string | null;
  room_id?: string | null;
  start_time: string; // ISO datetime
  timezone?: string;
  appointment_type?: AppointmentType;
  notes?: string | null;
}

/** Resposta de GET /appointments/available-slots */
export interface SlotItem {
  time: string;
  duration_minutes: number;
}

export interface DaySlots {
  date: string;
  slots: SlotItem[];
}

export interface AvailableSlotsResponse {
  slots: DaySlots[];
}

// ---- Lista de espera (Epic 4.5) ----
export interface WaitlistEntry {
  id: string;
  organization_id: string;
  patient_id: string;
  professional_id: string;
  appointment_type: string;
  preferred_dates: string[] | null;
  priority: number;
  status: string;
  created_at: string;
  patient_name?: string | null;
  professional_name?: string | null;
}

export interface WaitlistEntryCreateInput {
  patient_id: string;
  professional_id: string;
  appointment_type?: string;
  preferred_dates?: string[] | null;
  priority?: number;
}

// ---- Atendimento clínico (Epic 5) ----
export interface ClinicalEncounter {
  id: string;
  organization_id: string;
  appointment_id: string | null;
  patient_id: string;
  professional_id: string;
  unit_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  patient_name?: string | null;
  professional_name?: string | null;
}

export interface ClinicalEncounterCreateInput {
  appointment_id?: string | null;
  patient_id: string;
  professional_id: string;
  unit_id?: string | null;
}

export interface Triage {
  id: string;
  encounter_id: string;
  chief_complaint: string | null;
  symptom_onset: string | null;
  allergies: string[] | null;
  current_medications: string[] | null;
  past_conditions: string[] | null;
  triage_notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface TriageCreateInput {
  chief_complaint?: string | null;
  symptom_onset?: string | null;
  allergies?: string[] | null;
  current_medications?: string[] | null;
  past_conditions?: string[] | null;
  triage_notes?: string | null;
}

// ---- Evolução clínica (Story 5.2) ----
export type EvolutionType = "initial" | "followup" | "emergency" | "telehealth";
export type EvolutionStatus = "draft" | "finalized" | "signed";

export interface ClinicalEvolution {
  id: string;
  encounter_id: string;
  evolution_type: EvolutionType;
  anamnesis: string | null;
  clinical_history: string | null;
  family_history: string | null;
  physical_exam: string | null;
  diagnostic_hypotheses: string | null;
  therapeutic_plan: string | null;
  patient_guidance: string | null;
  suggested_return_date: string | null;
  status: EvolutionStatus;
  recorded_by: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicalEvolutionCreateInput {
  evolution_type?: EvolutionType;
  anamnesis?: string | null;
  clinical_history?: string | null;
  family_history?: string | null;
  physical_exam?: string | null;
  diagnostic_hypotheses?: string | null;
  therapeutic_plan?: string | null;
  patient_guidance?: string | null;
  suggested_return_date?: string | null;
}

export interface ClinicalEvolutionUpdateInput {
  evolution_type?: EvolutionType;
  anamnesis?: string | null;
  clinical_history?: string | null;
  family_history?: string | null;
  physical_exam?: string | null;
  diagnostic_hypotheses?: string | null;
  therapeutic_plan?: string | null;
  patient_guidance?: string | null;
  suggested_return_date?: string | null;
}

// ---- Prescrição (Story 5.3) ----
export interface PrescriptionItemType {
  id?: string;
  prescription_id?: string;
  medication: string;
  dosage: string;
  posology?: string | null;
  instructions?: string | null;
  position?: number;
}

export interface Prescription {
  id: string;
  encounter_id: string;
  status: string;
  recorded_by: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
  items: PrescriptionItemType[];
}

export interface PrescriptionItemCreateInput {
  medication: string;
  dosage: string;
  posology?: string | null;
  instructions?: string | null;
}

export interface PrescriptionCreateInput {
  items: PrescriptionItemCreateInput[];
}

// ---- Solicitação de exames (Story 5.4) ----
export interface ExamRequestItemType {
  id?: string;
  exam_request_id?: string;
  exam_name: string;
  instructions?: string | null;
  position?: number;
}

export interface ExamRequest {
  id: string;
  encounter_id: string;
  status: string;
  recorded_by: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
  items: ExamRequestItemType[];
}

export interface ExamRequestItemCreateInput {
  exam_name: string;
  instructions?: string | null;
}

export interface ExamRequestCreateInput {
  items: ExamRequestItemCreateInput[];
}

// ---- Epic 6: Financeiro ----
export interface Payment {
  id: string;
  organization_id: string;
  encounter_id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  paid_at: string;
  recorded_by: string | null;
  created_at: string;
}

export interface PaymentListItem extends Payment {
  patient_name?: string | null;
  professional_name?: string | null;
  encounter_created_at?: string | null;
}

export interface PaymentCreateInput {
  encounter_id: string;
  amount: number;
  payment_method?: string;
  notes?: string | null;
}

export interface PaymentListResponse {
  items: PaymentListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardMetrics {
  encounters_today: number;
  encounters_completed_today: number;
  payments_today_count: number;
  payments_today_total: number;
  payments_month_total: number;
  patients_total: number;
  appointments_today: number;
}
