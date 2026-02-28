/**
 * Cliente da API do CRM Saude (pacientes, profissionais, etc).
 * Usa o mesmo apiClient que envia JWT e X-Organization-Id.
 */

import apiClient from "@/lib/api/client";
import type {
  Appointment,
  AppointmentCreateInput,
  AppointmentListResponse,
  AvailableSlotsResponse,
  Convenio,
  ConsentGrantInput,
  ConsentRevokeInput,
  GuardianCreateInput,
  GuardianUpdateInput,
  InsuranceCreateInput,
  InsuranceUpdateInput,
  Patient,
  PatientConsent,
  PatientCreateInput,
  PatientDocument,
  PatientDocumentCategory,
  PatientDocumentClassification,
  PatientGuardian,
  PatientInsurance,
  PatientListResponse,
  PatientUpdateInput,
  Professional,
  ProfessionalCreateInput,
  ProfessionalDocument,
  ProfessionalDocumentCreateInput,
  ProfessionalFinancial,
  ProfessionalFinancialUpdateInput,
  ProfessionalListResponse,
  ProfessionalTermAcceptance,
  ProfessionalTermAcceptInput,
  ProfessionalUpdateInput,
  Room,
  RoomCreateInput,
  RoomUpdateInput,
  Unit,
  UnitUpdateInput,
  WaitlistEntry,
  WaitlistEntryCreateInput,
  ClinicalEncounter,
  ClinicalEncounterCreateInput,
  ClinicalEvolution,
  ClinicalEvolutionCreateInput,
  ClinicalEvolutionUpdateInput,
  Prescription,
  PrescriptionCreateInput,
  ExamRequest,
  ExamRequestCreateInput,
  Triage,
  TriageCreateInput,
  Payment,
  PaymentCreateInput,
  PaymentListItem,
  PaymentListResponse,
  DashboardMetrics,
} from "@/types/crm";

const BASE = "/api/v1/crm";

export async function fetchPatients(params?: {
  limit?: number;
  offset?: number;
  q?: string;
}): Promise<PatientListResponse> {
  const { data } = await apiClient.get<PatientListResponse>(`${BASE}/patients`, {
    params: { limit: params?.limit ?? 20, offset: params?.offset ?? 0, q: params?.q },
  });
  return data ?? { items: [], total: 0, limit: 20, offset: 0 };
}

/** Possíveis duplicatas por CPF, telefone ou nome+data de nascimento. Story 2.4 */
export async function checkDuplicatePatients(params: {
  full_name?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  cpf?: string | null;
}): Promise<Patient[]> {
  const { data } = await apiClient.get<Patient[]>(`${BASE}/patients/check-duplicate`, {
    params: {
      full_name: params.full_name ?? undefined,
      birth_date: params.birth_date ?? undefined,
      phone: params.phone ?? undefined,
      cpf: params.cpf ?? undefined,
    },
  });
  return data ?? [];
}

export async function fetchPatient(id: string): Promise<Patient | null> {
  const { data } = await apiClient.get<Patient>(`${BASE}/patients/${id}`);
  return data ?? null;
}

export async function createPatient(body: PatientCreateInput): Promise<Patient> {
  const { data } = await apiClient.post<Patient>(`${BASE}/patients`, body);
  if (!data) throw new Error("Resposta vazia ao criar paciente");
  return data;
}

export async function updatePatient(
  id: string,
  body: PatientUpdateInput
): Promise<Patient> {
  const { data } = await apiClient.patch<Patient>(`${BASE}/patients/${id}`, body);
  if (!data) throw new Error("Resposta vazia ao atualizar paciente");
  return data;
}

// ---- Convênios da organização ----
export async function fetchConvenios(): Promise<Convenio[]> {
  const { data } = await apiClient.get<Convenio[]>(`${BASE}/convenios`);
  return data ?? [];
}

export async function createConvenio(body: { name: string }): Promise<Convenio> {
  const { data } = await apiClient.post<Convenio>(`${BASE}/convenios`, body);
  if (!data) throw new Error("Resposta vazia ao criar convênio");
  return data;
}

// ---- Responsáveis (guardians) ----
export async function createGuardian(
  patientId: string,
  body: GuardianCreateInput
): Promise<PatientGuardian> {
  const { data } = await apiClient.post<PatientGuardian>(
    `${BASE}/patients/${patientId}/guardians`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao criar responsável");
  return data;
}

export async function updateGuardian(
  patientId: string,
  guardianId: string,
  body: GuardianUpdateInput
): Promise<PatientGuardian> {
  const { data } = await apiClient.patch<PatientGuardian>(
    `${BASE}/patients/${patientId}/guardians/${guardianId}`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao atualizar responsável");
  return data;
}

export async function deleteGuardian(
  patientId: string,
  guardianId: string
): Promise<void> {
  await apiClient.delete(
    `${BASE}/patients/${patientId}/guardians/${guardianId}`
  );
}

// ---- Convênios do paciente (insurances) ----
export async function createInsurance(
  patientId: string,
  body: InsuranceCreateInput
): Promise<PatientInsurance> {
  const { data } = await apiClient.post<PatientInsurance>(
    `${BASE}/patients/${patientId}/insurances`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao criar vínculo");
  return data;
}

export async function updateInsurance(
  patientId: string,
  insuranceId: string,
  body: InsuranceUpdateInput
): Promise<PatientInsurance> {
  const { data } = await apiClient.patch<PatientInsurance>(
    `${BASE}/patients/${patientId}/insurances/${insuranceId}`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao atualizar vínculo");
  return data;
}

export async function deleteInsurance(
  patientId: string,
  insuranceId: string
): Promise<void> {
  await apiClient.delete(
    `${BASE}/patients/${patientId}/insurances/${insuranceId}`
  );
}

// ---- Consentimentos LGPD ----
export async function fetchConsents(patientId: string): Promise<PatientConsent[]> {
  const { data } = await apiClient.get<PatientConsent[]>(
    `${BASE}/patients/${patientId}/consents`
  );
  return data ?? [];
}

export async function grantConsent(
  patientId: string,
  body: ConsentGrantInput
): Promise<PatientConsent> {
  const { data } = await apiClient.post<PatientConsent>(
    `${BASE}/patients/${patientId}/consents`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao registrar consentimento");
  return data;
}

export async function revokeConsent(
  patientId: string,
  consentId: string,
  body: ConsentRevokeInput
): Promise<PatientConsent> {
  const { data } = await apiClient.post<PatientConsent>(
    `${BASE}/patients/${patientId}/consents/${consentId}/revoke`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao revogar consentimento");
  return data;
}

// ---- Documentos do paciente (Story 2.5) ----
export async function fetchPatientDocuments(
  patientId: string
): Promise<PatientDocument[]> {
  const { data } = await apiClient.get<PatientDocument[]>(
    `${BASE}/patients/${patientId}/documents`
  );
  return data ?? [];
}

/** Baixa o arquivo do documento (com JWT). Use URL.createObjectURL(blob) para preview/link. */
export async function fetchDocumentBlob(
  patientId: string,
  documentId: string
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(
    `${BASE}/patients/${patientId}/documents/${documentId}/file`,
    { responseType: "blob" }
  );
  if (!data) throw new Error("Documento não encontrado");
  return data as Blob;
}

export async function uploadPatientDocument(
  patientId: string,
  file: File,
  category: PatientDocumentCategory,
  dataClassification: PatientDocumentClassification = "ADM"
): Promise<PatientDocument> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<PatientDocument>(
    `${BASE}/patients/${patientId}/documents?category=${category}&data_classification=${dataClassification}`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  if (!data) throw new Error("Resposta vazia ao enviar documento");
  return data;
}

export async function deletePatientDocument(
  patientId: string,
  documentId: string
): Promise<void> {
  await apiClient.delete(
    `${BASE}/patients/${patientId}/documents/${documentId}`
  );
}

// ---- Profissionais de Saúde (Story 3.1) ----

export async function fetchProfessionals(params?: {
  limit?: number;
  offset?: number;
  q?: string;
}): Promise<ProfessionalListResponse> {
  const { data } = await apiClient.get<ProfessionalListResponse>(
    `${BASE}/professionals`,
    {
      params: {
        limit: params?.limit ?? 20,
        offset: params?.offset ?? 0,
        q: params?.q,
      },
    }
  );
  return data ?? { items: [], total: 0, limit: 20, offset: 0 };
}

export async function fetchProfessional(id: string): Promise<Professional | null> {
  const { data } = await apiClient.get<Professional>(
    `${BASE}/professionals/${id}`
  );
  return data ?? null;
}

export async function createProfessional(
  body: ProfessionalCreateInput
): Promise<Professional> {
  const { data } = await apiClient.post<Professional>(
    `${BASE}/professionals`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao criar profissional");
  return data;
}

export async function updateProfessional(
  id: string,
  body: ProfessionalUpdateInput
): Promise<Professional> {
  const { data } = await apiClient.patch<Professional>(
    `${BASE}/professionals/${id}`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao atualizar profissional");
  return data;
}

// Agenda do profissional: PRD 10.3 - usar API do Calendário (use-schedules.ts, fetchSchedule, updateSchedule, createSchedule).

// ---- Documentos do profissional (Story 3.4) ----
export async function fetchProfessionalDocuments(
  professionalId: string
): Promise<ProfessionalDocument[]> {
  const { data } = await apiClient.get<ProfessionalDocument[]>(
    `${BASE}/professionals/${professionalId}/documents`
  );
  return data ?? [];
}

export async function createProfessionalDocument(
  professionalId: string,
  body: ProfessionalDocumentCreateInput
): Promise<ProfessionalDocument> {
  const { data } = await apiClient.post<ProfessionalDocument>(
    `${BASE}/professionals/${professionalId}/documents`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao registrar documento");
  return data;
}

export async function deleteProfessionalDocument(
  professionalId: string,
  documentId: string
): Promise<void> {
  await apiClient.delete(
    `${BASE}/professionals/${professionalId}/documents/${documentId}`
  );
}

// ---- Financeiro do profissional (Story 3.4, fin+gcl) ----
export async function fetchProfessionalFinancial(
  professionalId: string
): Promise<ProfessionalFinancial | null> {
  const { data } = await apiClient.get<ProfessionalFinancial | null>(
    `${BASE}/professionals/${professionalId}/financial`
  );
  return data ?? null;
}

export async function updateProfessionalFinancial(
  professionalId: string,
  body: ProfessionalFinancialUpdateInput
): Promise<ProfessionalFinancial> {
  const { data } = await apiClient.patch<ProfessionalFinancial>(
    `${BASE}/professionals/${professionalId}/financial`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao atualizar dados financeiros");
  return data;
}

// ---- Termos de aceite (Story 3.4) ----
export async function fetchProfessionalTerms(
  professionalId: string
): Promise<ProfessionalTermAcceptance[]> {
  const { data } = await apiClient.get<ProfessionalTermAcceptance[]>(
    `${BASE}/professionals/${professionalId}/terms`
  );
  return data ?? [];
}

export async function acceptProfessionalTerm(
  professionalId: string,
  body: ProfessionalTermAcceptInput
): Promise<ProfessionalTermAcceptance> {
  const { data } = await apiClient.post<ProfessionalTermAcceptance>(
    `${BASE}/professionals/${professionalId}/terms`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao registrar aceite");
  return data;
}

// ---- Unidades de atendimento (Story 3.3) ----

export async function fetchUnits(): Promise<Unit[]> {
  const { data } = await apiClient.get<Unit[]>(`${BASE}/units`);
  return data ?? [];
}

export async function fetchUnit(id: string): Promise<Unit | null> {
  const { data } = await apiClient.get<Unit>(`${BASE}/units/${id}`);
  return data ?? null;
}

export async function createUnit(body: {
  name: string;
  is_active?: boolean;
  timezone?: string | null;
  default_slot_minutes?: number | null;
  min_advance_minutes?: number | null;
  max_advance_days?: number | null;
  cancellation_policy?: string | null;
  specialities?: string[] | null;
  modalities?: string[] | null;
  convenio_ids?: string[] | null;
}): Promise<Unit> {
  const { data } = await apiClient.post<Unit>(`${BASE}/units`, body);
  if (!data) throw new Error("Resposta vazia ao criar unidade");
  return data;
}

export async function updateUnit(
  id: string,
  body: UnitUpdateInput
): Promise<Unit> {
  const { data } = await apiClient.patch<Unit>(`${BASE}/units/${id}`, body);
  if (!data) throw new Error("Resposta vazia ao atualizar unidade");
  return data;
}

// ---- Salas (Story 3.3) ----
export async function fetchRooms(unitId: string): Promise<Room[]> {
  const { data } = await apiClient.get<Room[]>(`${BASE}/units/${unitId}/rooms`);
  return data ?? [];
}

export async function createRoom(
  unitId: string,
  body: RoomCreateInput
): Promise<Room> {
  const { data } = await apiClient.post<Room>(
    `${BASE}/units/${unitId}/rooms`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao criar sala");
  return data;
}

export async function updateRoom(
  unitId: string,
  roomId: string,
  body: RoomUpdateInput
): Promise<Room> {
  const { data } = await apiClient.patch<Room>(
    `${BASE}/units/${unitId}/rooms/${roomId}`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao atualizar sala");
  return data;
}

export async function deleteRoom(
  unitId: string,
  roomId: string
): Promise<void> {
  await apiClient.delete(
    `${BASE}/units/${unitId}/rooms/${roomId}`
  );
}

// ---- Agendamentos (Epic 4 - Story 4.1) ----

export async function fetchAppointments(params?: {
  limit?: number;
  offset?: number;
  patient_id?: string | null;
  professional_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
}): Promise<AppointmentListResponse> {
  const { data } = await apiClient.get<AppointmentListResponse>(
    `${BASE}/appointments`,
    {
      params: {
        limit: params?.limit ?? 20,
        offset: params?.offset ?? 0,
        patient_id: params?.patient_id ?? undefined,
        professional_id: params?.professional_id ?? undefined,
        date_from: params?.date_from ?? undefined,
        date_to: params?.date_to ?? undefined,
      },
    }
  );
  return data ?? { items: [], total: 0, limit: 20, offset: 0 };
}

export async function fetchAvailableSlots(params: {
  event_type_id: string;
  date_from: string;
  date_to: string;
  timezone?: string;
}): Promise<AvailableSlotsResponse> {
  const { data } = await apiClient.get<AvailableSlotsResponse>(
    `${BASE}/appointments/available-slots`,
    {
      params: {
        event_type_id: params.event_type_id,
        date_from: params.date_from,
        date_to: params.date_to,
        timezone: params.timezone ?? "America/Sao_Paulo",
      },
    }
  );
  return data ?? { slots: [] };
}

export async function fetchAppointment(id: string): Promise<Appointment | null> {
  const { data } = await apiClient.get<Appointment>(`${BASE}/appointments/${id}`);
  return data ?? null;
}

export async function createAppointment(
  body: AppointmentCreateInput
): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>(
    `${BASE}/appointments`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao criar agendamento");
  return data;
}

/** Epic 4.3: alterar status (confirmado, cancelado, em_atendimento, atendido, no_show). */
export async function updateAppointmentStatus(
  id: string,
  body: { status: string; cancellation_reason?: string | null }
): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(
    `${BASE}/appointments/${id}`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao atualizar status");
  return data;
}

/** Epic 4.3: remarcar (cria novo agendamento e cancela o anterior). */
export async function rescheduleAppointment(
  id: string,
  body: { start_time: string; timezone?: string }
): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>(
    `${BASE}/appointments/${id}/reschedule`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao remarcar");
  return data;
}

/** Epic 4.4: lembrete – link WhatsApp para o paciente. */
export async function fetchAppointmentReminder(
  id: string
): Promise<{ whatsapp_link: string; patient_phone: string | null }> {
  const { data } = await apiClient.get<{ whatsapp_link: string; patient_phone: string | null }>(
    `${BASE}/appointments/${id}/reminder`
  );
  return data ?? { whatsapp_link: "", patient_phone: null };
}

// ---- Lista de espera (Epic 4.5) ----
export async function fetchWaitlist(params?: {
  professional_id?: string | null;
  status?: string | null;
}): Promise<WaitlistEntry[]> {
  const { data } = await apiClient.get<WaitlistEntry[]>(`${BASE}/waitlist`, {
    params: {
      professional_id: params?.professional_id ?? undefined,
      status: params?.status ?? undefined,
    },
  });
  return data ?? [];
}

export async function createWaitlistEntry(
  body: WaitlistEntryCreateInput
): Promise<WaitlistEntry> {
  const { data } = await apiClient.post<WaitlistEntry>(`${BASE}/waitlist`, body);
  if (!data) throw new Error("Resposta vazia ao criar entrada na lista de espera");
  return data;
}

export async function updateWaitlistEntryStatus(
  id: string,
  status: string
): Promise<WaitlistEntry> {
  const { data } = await apiClient.patch<WaitlistEntry>(
    `${BASE}/waitlist/${id}`,
    undefined,
    { params: { status } }
  );
  if (!data) throw new Error("Resposta vazia ao atualizar status");
  return data;
}

// ---- Atendimento clínico (Epic 5) ----
export async function fetchEncounters(params?: {
  patient_id?: string | null;
  professional_id?: string | null;
  status?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  limit?: number;
  offset?: number;
}): Promise<ClinicalEncounter[]> {
  const { data } = await apiClient.get<ClinicalEncounter[]>(`${BASE}/clinical/encounters`, {
    params: {
      patient_id: params?.patient_id ?? undefined,
      professional_id: params?.professional_id ?? undefined,
      status: params?.status ?? undefined,
      date_from: params?.date_from ?? undefined,
      date_to: params?.date_to ?? undefined,
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
    },
  });
  return data ?? [];
}

export async function fetchEncounter(id: string): Promise<ClinicalEncounter | null> {
  const { data } = await apiClient.get<ClinicalEncounter>(`${BASE}/clinical/encounters/${id}`);
  return data ?? null;
}

export async function createEncounter(
  body: ClinicalEncounterCreateInput
): Promise<ClinicalEncounter> {
  const { data } = await apiClient.post<ClinicalEncounter>(`${BASE}/clinical/encounters`, body);
  if (!data) throw new Error("Resposta vazia ao criar atendimento");
  return data;
}

export async function updateEncounterStatus(
  id: string,
  status: string
): Promise<ClinicalEncounter> {
  const { data } = await apiClient.patch<ClinicalEncounter>(
    `${BASE}/clinical/encounters/${id}/status`,
    undefined,
    { params: { status } }
  );
  if (!data) throw new Error("Resposta vazia ao atualizar status");
  return data;
}

export async function fetchTriage(encounterId: string): Promise<Triage | null> {
  const { data } = await apiClient.get<Triage | null>(
    `${BASE}/clinical/encounters/${encounterId}/triage`
  );
  return data ?? null;
}

export async function saveTriage(
  encounterId: string,
  body: TriageCreateInput
): Promise<Triage> {
  const { data } = await apiClient.post<Triage>(
    `${BASE}/clinical/encounters/${encounterId}/triage`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao salvar triagem");
  return data;
}

// ---- Evolução clínica (Story 5.2) ----
export async function fetchEvolutions(encounterId: string): Promise<ClinicalEvolution[]> {
  const { data } = await apiClient.get<ClinicalEvolution[]>(
    `${BASE}/clinical/encounters/${encounterId}/evolutions`
  );
  return data ?? [];
}

export async function fetchEvolution(
  encounterId: string,
  evolutionId: string
): Promise<ClinicalEvolution | null> {
  const { data } = await apiClient.get<ClinicalEvolution>(
    `${BASE}/clinical/encounters/${encounterId}/evolutions/${evolutionId}`
  );
  return data ?? null;
}

export async function createEvolution(
  encounterId: string,
  body: ClinicalEvolutionCreateInput
): Promise<ClinicalEvolution> {
  const { data } = await apiClient.post<ClinicalEvolution>(
    `${BASE}/clinical/encounters/${encounterId}/evolutions`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao criar evolução");
  return data;
}

export async function updateEvolution(
  encounterId: string,
  evolutionId: string,
  body: ClinicalEvolutionUpdateInput
): Promise<ClinicalEvolution> {
  const { data } = await apiClient.patch<ClinicalEvolution>(
    `${BASE}/clinical/encounters/${encounterId}/evolutions/${evolutionId}`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao atualizar evolução");
  return data;
}

export async function finalizeEvolution(
  encounterId: string,
  evolutionId: string
): Promise<ClinicalEvolution> {
  const { data } = await apiClient.post<ClinicalEvolution>(
    `${BASE}/clinical/encounters/${encounterId}/evolutions/${evolutionId}/finalize`
  );
  if (!data) throw new Error("Resposta vazia ao finalizar evolução");
  return data;
}

// ---- Prescrição (Story 5.3) ----
export async function fetchPrescriptions(encounterId: string): Promise<Prescription[]> {
  const { data } = await apiClient.get<Prescription[]>(
    `${BASE}/clinical/encounters/${encounterId}/prescriptions`
  );
  return data ?? [];
}

export async function createPrescription(
  encounterId: string,
  body: PrescriptionCreateInput
): Promise<Prescription> {
  const { data } = await apiClient.post<Prescription>(
    `${BASE}/clinical/encounters/${encounterId}/prescriptions`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao criar prescrição");
  return data;
}

export async function updatePrescription(
  encounterId: string,
  prescriptionId: string,
  body: PrescriptionCreateInput
): Promise<Prescription> {
  const { data } = await apiClient.patch<Prescription>(
    `${BASE}/clinical/encounters/${encounterId}/prescriptions/${prescriptionId}`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao atualizar prescrição");
  return data;
}

export async function finalizePrescription(
  encounterId: string,
  prescriptionId: string
): Promise<Prescription> {
  const { data } = await apiClient.post<Prescription>(
    `${BASE}/clinical/encounters/${encounterId}/prescriptions/${prescriptionId}/finalize`
  );
  if (!data) throw new Error("Resposta vazia ao finalizar prescrição");
  return data;
}

export async function downloadPrescriptionPdf(
  encounterId: string,
  prescriptionId: string
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(
    `${BASE}/clinical/encounters/${encounterId}/prescriptions/${prescriptionId}/pdf`,
    { responseType: "blob" }
  );
  return data as Blob;
}

// ---- Solicitação de exames (Story 5.4) ----
export async function fetchExamRequests(encounterId: string): Promise<ExamRequest[]> {
  const { data } = await apiClient.get<ExamRequest[]>(
    `${BASE}/clinical/encounters/${encounterId}/exam-requests`
  );
  return data ?? [];
}

export async function createExamRequest(
  encounterId: string,
  body: ExamRequestCreateInput
): Promise<ExamRequest> {
  const { data } = await apiClient.post<ExamRequest>(
    `${BASE}/clinical/encounters/${encounterId}/exam-requests`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao criar solicitação de exames");
  return data;
}

export async function updateExamRequest(
  encounterId: string,
  examRequestId: string,
  body: ExamRequestCreateInput
): Promise<ExamRequest> {
  const { data } = await apiClient.patch<ExamRequest>(
    `${BASE}/clinical/encounters/${encounterId}/exam-requests/${examRequestId}`,
    body
  );
  if (!data) throw new Error("Resposta vazia ao atualizar solicitação de exames");
  return data;
}

export async function finalizeExamRequest(
  encounterId: string,
  examRequestId: string
): Promise<ExamRequest> {
  const { data } = await apiClient.post<ExamRequest>(
    `${BASE}/clinical/encounters/${encounterId}/exam-requests/${examRequestId}/finalize`
  );
  if (!data) throw new Error("Resposta vazia ao finalizar solicitação de exames");
  return data;
}

export async function downloadExamRequestPdf(
  encounterId: string,
  examRequestId: string
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(
    `${BASE}/clinical/encounters/${encounterId}/exam-requests/${examRequestId}/pdf`,
    { responseType: "blob" }
  );
  return data as Blob;
}

// ---- Epic 6: Financeiro ----
export async function fetchPayments(params?: {
  encounter_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  limit?: number;
  offset?: number;
}): Promise<PaymentListResponse> {
  const { data } = await apiClient.get<PaymentListResponse>(`${BASE}/financial/payments`, {
    params: {
      encounter_id: params?.encounter_id ?? undefined,
      date_from: params?.date_from ?? undefined,
      date_to: params?.date_to ?? undefined,
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
    },
  });
  return data ?? { items: [], total: 0, limit: 50, offset: 0 };
}

export async function createPayment(body: PaymentCreateInput): Promise<Payment> {
  const { data } = await apiClient.post<Payment>(`${BASE}/financial/payments`, body);
  if (!data) throw new Error("Resposta vazia ao registrar pagamento");
  return data;
}

export async function fetchPaymentByEncounter(encounterId: string): Promise<Payment | null> {
  try {
    const { data } = await apiClient.get<Payment>(
      `${BASE}/financial/encounters/${encounterId}/payment`
    );
    return data ?? null;
  } catch {
    return null;
  }
}

export async function downloadPaymentReceiptPdf(
  paymentId: string
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(
    `${BASE}/financial/payments/${paymentId}/receipt`,
    { responseType: "blob" }
  );
  return data as Blob;
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const { data } = await apiClient.get<DashboardMetrics>(`${BASE}/financial/dashboard`);
  return data ?? {
    encounters_today: 0,
    encounters_completed_today: 0,
    payments_today_count: 0,
    payments_today_total: 0,
    payments_month_total: 0,
    patients_total: 0,
    appointments_today: 0,
  };
}
