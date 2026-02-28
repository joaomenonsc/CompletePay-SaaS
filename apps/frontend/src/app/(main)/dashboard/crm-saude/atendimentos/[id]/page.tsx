"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createEvolution,
  createExamRequest,
  createPayment,
  createPrescription,
  fetchEncounter,
  fetchEvolutions,
  fetchExamRequests,
  fetchPaymentByEncounter,
  fetchPrescriptions,
  fetchTriage,
  finalizeEvolution,
  finalizeExamRequest,
  finalizePrescription,
  saveTriage,
  updateEncounterStatus,
  updateEvolution,
  updateExamRequest,
  updatePrescription,
  downloadPrescriptionPdf,
  downloadExamRequestPdf,
  downloadPaymentReceiptPdf,
} from "@/lib/api/crm";
import type { EvolutionType, PrescriptionItemCreateInput } from "@/types/crm";
import { Loader2, Plus, Printer, Trash2 } from "lucide-react";
import {
  buildEvolutionPrintHtml,
  buildExamRequestPrintHtml,
  buildPrescriptionPrintHtml,
  buildReceiptPrintHtml,
  openPrintWindow,
} from "../../_components/print-utils";

const STATUS_LABELS: Record<string, string> = {
  in_triage: "Em triagem",
  in_progress: "Em atendimento",
  completed: "Finalizado",
  pending_docs: "Pend. documentação",
};

const EVOLUTION_TYPE_LABELS: Record<EvolutionType, string> = {
  initial: "Consulta inicial",
  followup: "Retorno",
  emergency: "Emergência",
  telehealth: "Teleatendimento",
};

export default function AtendimentoDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const handleDownloadPdfBlob = async (action: () => Promise<Blob>, filename: string) => {
    try {
      const blob = await action();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Erro ao gerar PDF. Verifique se o item foi salvo.");
    }
  };

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptomOnset, setSymptomOnset] = useState("");
  const [allergiesText, setAllergiesText] = useState("");
  const [medicationsText, setMedicationsText] = useState("");
  const [pastConditionsText, setPastConditionsText] = useState("");
  const [triageNotes, setTriageNotes] = useState("");
  // Evolução (Story 5.2)
  const [evolutionType, setEvolutionType] = useState<EvolutionType>("initial");
  const [anamnesis, setAnamnesis] = useState("");
  const [clinicalHistory, setClinicalHistory] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");
  const [physicalExam, setPhysicalExam] = useState("");
  const [diagnosticHypotheses, setDiagnosticHypotheses] = useState("");
  const [therapeuticPlan, setTherapeuticPlan] = useState("");
  const [patientGuidance, setPatientGuidance] = useState("");
  const [suggestedReturnDate, setSuggestedReturnDate] = useState("");
  // Prescrição (Story 5.3): linhas do formulário
  const [prescriptionLines, setPrescriptionLines] = useState<
    { medication: string; dosage: string; posology: string; instructions: string }[]
  >([{ medication: "", dosage: "", posology: "", instructions: "" }]);
  // Solicitação de exames (Story 5.4): linhas do formulário
  const [examLines, setExamLines] = useState<
    { exam_name: string; instructions: string }[]
  >([{ exam_name: "", instructions: "" }]);
  // Epic 6: pagamento
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: encounter, isLoading } = useQuery({
    queryKey: ["crm-encounter", id],
    queryFn: () => fetchEncounter(id),
    enabled: !!id,
  });

  const { data: triage } = useQuery({
    queryKey: ["crm-triage", id],
    queryFn: () => fetchTriage(id),
    enabled: !!id,
  });

  const { data: evolutions = [] } = useQuery({
    queryKey: ["crm-evolutions", id],
    queryFn: () => fetchEvolutions(id),
    enabled: !!id,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["crm-prescriptions", id],
    queryFn: () => fetchPrescriptions(id),
    enabled: !!id,
  });

  const { data: examRequests = [] } = useQuery({
    queryKey: ["crm-exam-requests", id],
    queryFn: () => fetchExamRequests(id),
    enabled: !!id,
  });

  const { data: payment } = useQuery({
    queryKey: ["crm-payment-encounter", id],
    queryFn: () => fetchPaymentByEncounter(id),
    enabled: !!id,
  });

  const saveTriageMutation = useMutation({
    mutationFn: (body: {
      chief_complaint?: string | null;
      symptom_onset?: string | null;
      allergies?: string[] | null;
      current_medications?: string[] | null;
      past_conditions?: string[] | null;
      triage_notes?: string | null;
    }) => saveTriage(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-triage", id] });
      toast.success("Triagem salva.");
    },
    onError: () => toast.error("Erro ao salvar triagem."),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => updateEncounterStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-encounter", id] });
      queryClient.invalidateQueries({ queryKey: ["crm-encounters"] });
      toast.success("Status atualizado.");
    },
    onError: () => toast.error("Erro ao atualizar status."),
  });

  const createEvolutionMutation = useMutation({
    mutationFn: (body: Parameters<typeof createEvolution>[1]) => createEvolution(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-evolutions", id] });
      toast.success("Evolução criada.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao criar evolução."),
  });

  const updateEvolutionMutation = useMutation({
    mutationFn: ({ evolutionId, body }: { evolutionId: string; body: Parameters<typeof updateEvolution>[2] }) =>
      updateEvolution(id, evolutionId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-evolutions", id] });
      toast.success("Evolução salva.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar evolução."),
  });

  const finalizeEvolutionMutation = useMutation({
    mutationFn: (evolutionId: string) => finalizeEvolution(id, evolutionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-evolutions", id] });
      toast.success("Evolução finalizada.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao finalizar evolução."),
  });

  const createPrescriptionMutation = useMutation({
    mutationFn: (body: PrescriptionItemCreateInput[]) => createPrescription(id, { items: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-prescriptions", id] });
      toast.success("Prescrição criada.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao criar prescrição."),
  });

  const updatePrescriptionMutation = useMutation({
    mutationFn: ({ prescriptionId, body }: { prescriptionId: string; body: PrescriptionItemCreateInput[] }) =>
      updatePrescription(id, prescriptionId, { items: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-prescriptions", id] });
      toast.success("Prescrição salva.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar prescrição."),
  });

  const finalizePrescriptionMutation = useMutation({
    mutationFn: (prescriptionId: string) => finalizePrescription(id, prescriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-prescriptions", id] });
      toast.success("Prescrição finalizada.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao finalizar prescrição."),
  });

  const createExamRequestMutation = useMutation({
    mutationFn: (body: { exam_name: string; instructions?: string | null }[]) =>
      createExamRequest(id, { items: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-exam-requests", id] });
      toast.success("Solicitação de exames criada.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao criar solicitação de exames."),
  });

  const updateExamRequestMutation = useMutation({
    mutationFn: ({
      examRequestId,
      body,
    }: {
      examRequestId: string;
      body: { exam_name: string; instructions?: string | null }[];
    }) => updateExamRequest(id, examRequestId, { items: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-exam-requests", id] });
      toast.success("Solicitação de exames salva.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar solicitação de exames."),
  });

  const finalizeExamRequestMutation = useMutation({
    mutationFn: (examRequestId: string) => finalizeExamRequest(id, examRequestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-exam-requests", id] });
      toast.success("Solicitação de exames finalizada.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao finalizar solicitação de exames."),
  });

  const createPaymentMutation = useMutation({
    mutationFn: (body: { amount: number; payment_method: string; notes?: string | null }) =>
      createPayment({ encounter_id: id, ...body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-payment-encounter", id] });
      queryClient.invalidateQueries({ queryKey: ["crm-payments"] });
      toast.success("Pagamento registrado.");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao registrar pagamento."),
  });

  useEffect(() => {
    if (triage) {
      setChiefComplaint(triage.chief_complaint ?? "");
      setSymptomOnset(triage.symptom_onset ?? "");
      setAllergiesText((triage.allergies ?? []).join(", "));
      setMedicationsText((triage.current_medications ?? []).join(", "));
      setPastConditionsText((triage.past_conditions ?? []).join(", "));
      setTriageNotes(triage.triage_notes ?? "");
    }
  }, [triage?.id]);

  const draftEvolution = evolutions.find((e) => e.status === "draft") ?? null;

  useEffect(() => {
    if (draftEvolution) {
      setEvolutionType(draftEvolution.evolution_type);
      setAnamnesis(draftEvolution.anamnesis ?? "");
      setClinicalHistory(draftEvolution.clinical_history ?? "");
      setFamilyHistory(draftEvolution.family_history ?? "");
      setPhysicalExam(draftEvolution.physical_exam ?? "");
      setDiagnosticHypotheses(draftEvolution.diagnostic_hypotheses ?? "");
      setTherapeuticPlan(draftEvolution.therapeutic_plan ?? "");
      setPatientGuidance(draftEvolution.patient_guidance ?? "");
      setSuggestedReturnDate(draftEvolution.suggested_return_date ?? "");
    } else {
      setEvolutionType("initial");
      setAnamnesis("");
      setClinicalHistory("");
      setFamilyHistory("");
      setPhysicalExam("");
      setDiagnosticHypotheses("");
      setTherapeuticPlan("");
      setPatientGuidance("");
      setSuggestedReturnDate("");
    }
  }, [draftEvolution?.id]);

  const draftPrescription = prescriptions.find((p) => p.status === "draft") ?? null;

  useEffect(() => {
    if (draftPrescription?.items?.length) {
      setPrescriptionLines(
        draftPrescription.items.map((i) => ({
          medication: i.medication ?? "",
          dosage: i.dosage ?? "",
          posology: i.posology ?? "",
          instructions: i.instructions ?? "",
        }))
      );
    } else {
      setPrescriptionLines([{ medication: "", dosage: "", posology: "", instructions: "" }]);
    }
  }, [draftPrescription]);

  const draftExamRequest = examRequests.find((e) => e.status === "draft") ?? null;

  useEffect(() => {
    if (draftExamRequest?.items?.length) {
      setExamLines(
        draftExamRequest.items.map((i) => ({
          exam_name: i.exam_name ?? "",
          instructions: i.instructions ?? "",
        }))
      );
    } else {
      setExamLines([{ exam_name: "", instructions: "" }]);
    }
  }, [draftExamRequest]);

  const handleSaveTriage = () => {
    saveTriageMutation.mutate({
      chief_complaint: chiefComplaint.trim() || null,
      symptom_onset: symptomOnset.trim() || null,
      allergies: allergiesText.trim() ? allergiesText.split(",").map((s) => s.trim()).filter(Boolean) : null,
      current_medications: medicationsText.trim() ? medicationsText.split(",").map((s) => s.trim()).filter(Boolean) : null,
      past_conditions: pastConditionsText.trim() ? pastConditionsText.split(",").map((s) => s.trim()).filter(Boolean) : null,
      triage_notes: triageNotes.trim() || null,
    });
  };

  if (isLoading || !encounter) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="space-y-6" role="main" aria-label="Ficha de atendimento">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard/crm-saude/atendimentos"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ← Atendimentos
          </Link>
          <h1 className="text-2xl font-semibold mt-1">
            {encounter.patient_name ?? encounter.patient_id} · {encounter.professional_name ?? encounter.professional_id}
          </h1>
          <p className="text-muted-foreground text-sm">
            {format(new Date(encounter.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {STATUS_LABELS[encounter.status] ?? encounter.status}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {encounter.status === "in_triage" && (
          <Button
            size="sm"
            onClick={() => updateStatusMutation.mutate("in_progress")}
            disabled={updateStatusMutation.isPending}
          >
            Iniciar atendimento
          </Button>
        )}
        {encounter.status === "in_progress" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatusMutation.mutate("completed")}
            disabled={updateStatusMutation.isPending}
          >
            Finalizar atendimento
          </Button>
        )}
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/dashboard/crm-saude/pacientes/${encounter.patient_id}`}>
            Ver ficha do paciente
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="triagem">
        <TabsList>
          <TabsTrigger value="triagem">1. Triagem</TabsTrigger>
          <TabsTrigger value="evolucao">2. Evolução</TabsTrigger>
          <TabsTrigger value="exame" disabled>3. Exame físico</TabsTrigger>
          <TabsTrigger value="plano" disabled>4. Plano</TabsTrigger>
          <TabsTrigger value="prescricao">5. Prescrição</TabsTrigger>
          <TabsTrigger value="exames">6. Exames</TabsTrigger>
          <TabsTrigger value="pagamento">7. Pagamento</TabsTrigger>
        </TabsList>
        <TabsContent value="triagem" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Triagem</CardTitle>
              <p className="text-muted-foreground text-sm">
                Queixa principal, alergias, medicamentos em uso e condições prévias.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Queixa principal</Label>
                <Textarea
                  placeholder="Motivo da consulta, queixa principal..."
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label>Início dos sintomas</Label>
                <input
                  type="text"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                  placeholder="Ex.: há 3 dias, há 1 semana"
                  value={symptomOnset}
                  onChange={(e) => setSymptomOnset(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Alergias (separadas por vírgula)</Label>
                <input
                  type="text"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                  placeholder="Ex.: Dipirona, Penicilina"
                  value={allergiesText}
                  onChange={(e) => setAllergiesText(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Medicamentos em uso (separados por vírgula)</Label>
                <input
                  type="text"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                  placeholder="Ex.: Losartana 50mg, Omeprazol"
                  value={medicationsText}
                  onChange={(e) => setMedicationsText(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Condições / doenças prévias (separadas por vírgula)</Label>
                <input
                  type="text"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                  placeholder="Ex.: HAS, DM2"
                  value={pastConditionsText}
                  onChange={(e) => setPastConditionsText(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Observações da triagem</Label>
                <Textarea
                  placeholder="Notas adicionais..."
                  value={triageNotes}
                  onChange={(e) => setTriageNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                onClick={handleSaveTriage}
                disabled={saveTriageMutation.isPending}
              >
                {saveTriageMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Salvar triagem"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="evolucao" className="space-y-4 pt-4">
          {triage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Triagem (somente leitura)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="font-medium">Queixa principal:</span> {triage.chief_complaint || "—"}</p>
                <p><span className="font-medium">Início dos sintomas:</span> {triage.symptom_onset || "—"}</p>
                <p><span className="font-medium">Alergias:</span> {(triage.allergies ?? []).length ? triage.allergies!.join(", ") : "—"}</p>
                <p><span className="font-medium">Medicamentos em uso:</span> {(triage.current_medications ?? []).length ? triage.current_medications!.join(", ") : "—"}</p>
                <p><span className="font-medium">Condições prévias:</span> {(triage.past_conditions ?? []).length ? triage.past_conditions!.join(", ") : "—"}</p>
                {triage.triage_notes && <p><span className="font-medium">Observações:</span> {triage.triage_notes}</p>}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Evolução clínica</CardTitle>
              <p className="text-muted-foreground text-sm">
                Anamnese, história clínica, exame físico, hipóteses e plano terapêutico.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Tipo de atendimento</Label>
                <Select
                  value={evolutionType}
                  onValueChange={(v) => setEvolutionType(v as EvolutionType)}
                  disabled={!!draftEvolution && draftEvolution.status !== "draft"}
                >
                  <SelectTrigger className="w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EVOLUTION_TYPE_LABELS) as EvolutionType[]).map((t) => (
                      <SelectItem key={t} value={t}>{EVOLUTION_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Anamnese</Label>
                <Textarea
                  placeholder="História da doença atual..."
                  value={anamnesis}
                  onChange={(e) => setAnamnesis(e.target.value)}
                  rows={3}
                  readOnly={!!draftEvolution && draftEvolution.status !== "draft"}
                />
              </div>
              <div className="grid gap-2">
                <Label>História clínica</Label>
                <Textarea
                  placeholder="História clínica pregressa..."
                  value={clinicalHistory}
                  onChange={(e) => setClinicalHistory(e.target.value)}
                  rows={2}
                  readOnly={!!draftEvolution && draftEvolution.status !== "draft"}
                />
              </div>
              <div className="grid gap-2">
                <Label>História familiar</Label>
                <Textarea
                  placeholder="Antecedentes familiares..."
                  value={familyHistory}
                  onChange={(e) => setFamilyHistory(e.target.value)}
                  rows={2}
                  readOnly={!!draftEvolution && draftEvolution.status !== "draft"}
                />
              </div>
              <div className="grid gap-2">
                <Label>Exame físico</Label>
                <Textarea
                  placeholder="Achados do exame físico..."
                  value={physicalExam}
                  onChange={(e) => setPhysicalExam(e.target.value)}
                  rows={3}
                  readOnly={!!draftEvolution && draftEvolution.status !== "draft"}
                />
              </div>
              <div className="grid gap-2">
                <Label>Hipóteses diagnósticas</Label>
                <Textarea
                  placeholder="CID / hipóteses..."
                  value={diagnosticHypotheses}
                  onChange={(e) => setDiagnosticHypotheses(e.target.value)}
                  rows={2}
                  readOnly={!!draftEvolution && draftEvolution.status !== "draft"}
                />
              </div>
              <div className="grid gap-2">
                <Label>Plano terapêutico</Label>
                <Textarea
                  placeholder="Conduta, medicamentos, orientações..."
                  value={therapeuticPlan}
                  onChange={(e) => setTherapeuticPlan(e.target.value)}
                  rows={3}
                  readOnly={!!draftEvolution && draftEvolution.status !== "draft"}
                />
              </div>
              <div className="grid gap-2">
                <Label>Orientações ao paciente</Label>
                <Textarea
                  placeholder="Retorno, cuidados em casa..."
                  value={patientGuidance}
                  onChange={(e) => setPatientGuidance(e.target.value)}
                  rows={2}
                  readOnly={!!draftEvolution && draftEvolution.status !== "draft"}
                />
              </div>
              <div className="grid gap-2">
                <Label>Data de retorno sugerida</Label>
                <input
                  type="date"
                  className="border-input bg-background flex h-9 w-full max-w-[200px] rounded-md border px-3 py-1 text-sm"
                  value={suggestedReturnDate}
                  onChange={(e) => setSuggestedReturnDate(e.target.value)}
                  readOnly={!!draftEvolution && draftEvolution.status !== "draft"}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {draftEvolution ? (
                  <>
                    <Button
                      onClick={() =>
                        updateEvolutionMutation.mutate({
                          evolutionId: draftEvolution.id,
                          body: {
                            evolution_type: evolutionType,
                            anamnesis: anamnesis.trim() || null,
                            clinical_history: clinicalHistory.trim() || null,
                            family_history: familyHistory.trim() || null,
                            physical_exam: physicalExam.trim() || null,
                            diagnostic_hypotheses: diagnosticHypotheses.trim() || null,
                            therapeutic_plan: therapeuticPlan.trim() || null,
                            patient_guidance: patientGuidance.trim() || null,
                            suggested_return_date: suggestedReturnDate.trim() || null,
                          },
                        })
                      }
                      disabled={updateEvolutionMutation.isPending}
                    >
                      {updateEvolutionMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Salvar rascunho"}
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => finalizeEvolutionMutation.mutate(draftEvolution.id)}
                      disabled={finalizeEvolutionMutation.isPending}
                    >
                      {finalizeEvolutionMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Finalizar evolução"}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() =>
                      createEvolutionMutation.mutate({
                        evolution_type: evolutionType,
                        anamnesis: anamnesis.trim() || null,
                        clinical_history: clinicalHistory.trim() || null,
                        family_history: familyHistory.trim() || null,
                        physical_exam: physicalExam.trim() || null,
                        diagnostic_hypotheses: diagnosticHypotheses.trim() || null,
                        therapeutic_plan: therapeuticPlan.trim() || null,
                        patient_guidance: patientGuidance.trim() || null,
                        suggested_return_date: suggestedReturnDate.trim() || null,
                      })
                    }
                    disabled={createEvolutionMutation.isPending}
                  >
                    {createEvolutionMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Nova evolução"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ctx = {
                      patientName: encounter?.patient_name ?? "",
                      professionalName: encounter?.professional_name ?? "",
                      date: encounter ? format(new Date(encounter.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
                    };
                    const html = buildEvolutionPrintHtml(
                      ctx,
                      {
                        evolution_type: evolutionType,
                        anamnesis: anamnesis || null,
                        clinical_history: clinicalHistory || null,
                        family_history: familyHistory || null,
                        physical_exam: physicalExam || null,
                        diagnostic_hypotheses: diagnosticHypotheses || null,
                        therapeutic_plan: therapeuticPlan || null,
                        patient_guidance: patientGuidance || null,
                        suggested_return_date: suggestedReturnDate || null,
                      },
                      !!draftEvolution
                    );
                    openPrintWindow(html);
                  }}
                >
                  <Printer className="mr-2 size-4" />
                  Imprimir / PDF
                </Button>
              </div>
              {evolutions.filter((e) => e.status !== "draft").length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Evoluções finalizadas</p>
                  <ul className="space-y-1 text-sm">
                    {evolutions
                      .filter((e) => e.status !== "draft")
                      .map((e) => (
                        <li key={e.id}>
                          {format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} —{" "}
                          <Badge variant="secondary" className="text-xs">{e.status}</Badge>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescricao" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Prescrição médica</CardTitle>
              <p className="text-muted-foreground text-sm">
                Medicamentos: nome, dosagem, posologia e orientações. Salve como rascunho ou finalize.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Itens da prescrição</Label>
                  {(!draftPrescription || draftPrescription.status === "draft") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPrescriptionLines((prev) => [
                          ...prev,
                          { medication: "", dosage: "", posology: "", instructions: "" },
                        ])
                      }
                    >
                      <Plus className="mr-2 size-4" />
                      Adicionar linha
                    </Button>
                  )}
                </div>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left font-medium">Medicamento</th>
                        <th className="p-2 text-left font-medium">Dosagem</th>
                        <th className="p-2 text-left font-medium">Posologia</th>
                        <th className="p-2 text-left font-medium">Orientações</th>
                        {(!draftPrescription || draftPrescription.status === "draft") && (
                          <th className="w-10 p-2" />
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {prescriptionLines.map((line, index) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="p-2">
                            <input
                              className="border-input bg-background w-full rounded border px-2 py-1.5 text-sm"
                              placeholder="Ex.: Dipirona"
                              value={line.medication}
                              onChange={(e) =>
                                setPrescriptionLines((prev) =>
                                  prev.map((row, i) =>
                                    i === index ? { ...row, medication: e.target.value } : row
                                  )
                                )
                              }
                              readOnly={!!draftPrescription && draftPrescription.status !== "draft"}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="border-input bg-background w-full min-w-[80px] rounded border px-2 py-1.5 text-sm"
                              placeholder="Ex.: 500mg"
                              value={line.dosage}
                              onChange={(e) =>
                                setPrescriptionLines((prev) =>
                                  prev.map((row, i) =>
                                    i === index ? { ...row, dosage: e.target.value } : row
                                  )
                                )
                              }
                              readOnly={!!draftPrescription && draftPrescription.status !== "draft"}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="border-input bg-background w-full min-w-[100px] rounded border px-2 py-1.5 text-sm"
                              placeholder="Ex.: 8/8h, 7 dias"
                              value={line.posology}
                              onChange={(e) =>
                                setPrescriptionLines((prev) =>
                                  prev.map((row, i) =>
                                    i === index ? { ...row, posology: e.target.value } : row
                                  )
                                )
                              }
                              readOnly={!!draftPrescription && draftPrescription.status !== "draft"}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="border-input bg-background w-full min-w-[120px] rounded border px-2 py-1.5 text-sm"
                              placeholder="Ex.: Após refeições"
                              value={line.instructions}
                              onChange={(e) =>
                                setPrescriptionLines((prev) =>
                                  prev.map((row, i) =>
                                    i === index ? { ...row, instructions: e.target.value } : row
                                  )
                                )
                              }
                              readOnly={!!draftPrescription && draftPrescription.status !== "draft"}
                            />
                          </td>
                          {(!draftPrescription || draftPrescription.status === "draft") && (
                            <td className="p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setPrescriptionLines((prev) =>
                                    prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
                                  )
                                }
                                aria-label="Remover linha"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {draftPrescription ? (
                  <>
                    <Button
                      onClick={() => {
                        const items = prescriptionLines
                          .map((l) => ({
                            medication: l.medication.trim(),
                            dosage: l.dosage.trim(),
                            posology: l.posology.trim() || null,
                            instructions: l.instructions.trim() || null,
                          }))
                          .filter((i) => i.medication && i.dosage);
                        if (items.length === 0) {
                          toast.error("Adicione ao menos um medicamento com nome e dosagem.");
                          return;
                        }
                        updatePrescriptionMutation.mutate({
                          prescriptionId: draftPrescription.id,
                          body: items,
                        });
                      }}
                      disabled={updatePrescriptionMutation.isPending}
                    >
                      {updatePrescriptionMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Salvar rascunho"
                      )}
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => finalizePrescriptionMutation.mutate(draftPrescription.id)}
                      disabled={
                        finalizePrescriptionMutation.isPending ||
                        !prescriptionLines.some((l) => l.medication.trim() && l.dosage.trim())
                      }
                    >
                      {finalizePrescriptionMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Finalizar prescrição"
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      const items = prescriptionLines
                        .map((l) => ({
                          medication: l.medication.trim(),
                          dosage: l.dosage.trim(),
                          posology: l.posology.trim() || null,
                          instructions: l.instructions.trim() || null,
                        }))
                        .filter((i) => i.medication && i.dosage);
                      if (items.length === 0) {
                        toast.error("Adicione ao menos um medicamento com nome e dosagem.");
                        return;
                      }
                      createPrescriptionMutation.mutate(items);
                    }}
                    disabled={createPrescriptionMutation.isPending}
                  >
                    {createPrescriptionMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Nova prescrição"
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!draftPrescription && prescriptions.length === 0) {
                      toast.error("Salve a prescrição antes de gerar o PDF oficial.");
                      return;
                    }
                    const idToPrint = draftPrescription?.id || prescriptions[0]?.id;
                    if (!idToPrint) return;
                    handleDownloadPdfBlob(
                      () => downloadPrescriptionPdf(encounter!.id, idToPrint),
                      `Receituario_${encounter?.patient_name?.replace(/\\s+/g, "_") || "Paciente"}.pdf`
                    );
                  }}
                >
                  <Printer className="mr-2 size-4" />
                  Baixar PDF Oficial
                </Button>
              </div>
              {prescriptions.filter((p) => p.status !== "draft").length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Prescrições finalizadas</p>
                  <ul className="space-y-1 text-sm">
                    {prescriptions
                      .filter((p) => p.status !== "draft")
                      .map((p) => (
                        <li key={p.id} className="flex items-center justify-between">
                          <div>
                            {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} —{" "}
                            <Badge variant="secondary" className="text-xs">{p.status}</Badge> —{" "}
                            {p.items.length} item(ns)
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              handleDownloadPdfBlob(
                                () => downloadPrescriptionPdf(encounter!.id, p.id),
                                `Receituario_${encounter?.patient_name?.replace(/\\s+/g, "_") || "Paciente"}.pdf`
                              );
                            }}
                          >
                            <Printer className="mr-2 size-3" />
                            PDF
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exames" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Solicitação de exames</CardTitle>
              <p className="text-muted-foreground text-sm">
                Exames solicitados: nome e orientações. Salve como rascunho ou finalize.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Itens da solicitação</Label>
                  {(!draftExamRequest || draftExamRequest.status === "draft") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExamLines((prev) => [...prev, { exam_name: "", instructions: "" }])
                      }
                    >
                      <Plus className="mr-2 size-4" />
                      Adicionar linha
                    </Button>
                  )}
                </div>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left font-medium">Exame</th>
                        <th className="p-2 text-left font-medium">Orientações</th>
                        {(!draftExamRequest || draftExamRequest.status === "draft") && (
                          <th className="w-10 p-2" />
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {examLines.map((line, index) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="p-2">
                            <input
                              className="border-input bg-background w-full rounded border px-2 py-1.5 text-sm"
                              placeholder="Ex.: Hemograma completo, Glicemia de jejum"
                              value={line.exam_name}
                              onChange={(e) =>
                                setExamLines((prev) =>
                                  prev.map((row, i) =>
                                    i === index ? { ...row, exam_name: e.target.value } : row
                                  )
                                )
                              }
                              readOnly={!!draftExamRequest && draftExamRequest.status !== "draft"}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="border-input bg-background w-full min-w-[120px] rounded border px-2 py-1.5 text-sm"
                              placeholder="Ex.: Jejum 8h, trazer pedido médico"
                              value={line.instructions}
                              onChange={(e) =>
                                setExamLines((prev) =>
                                  prev.map((row, i) =>
                                    i === index ? { ...row, instructions: e.target.value } : row
                                  )
                                )
                              }
                              readOnly={!!draftExamRequest && draftExamRequest.status !== "draft"}
                            />
                          </td>
                          {(!draftExamRequest || draftExamRequest.status === "draft") && (
                            <td className="p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setExamLines((prev) =>
                                    prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
                                  )
                                }
                                aria-label="Remover linha"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {draftExamRequest ? (
                  <>
                    <Button
                      onClick={() => {
                        const items = examLines
                          .map((l) => ({
                            exam_name: l.exam_name.trim(),
                            instructions: l.instructions.trim() || null,
                          }))
                          .filter((i) => i.exam_name);
                        if (items.length === 0) {
                          toast.error("Adicione ao menos um exame.");
                          return;
                        }
                        updateExamRequestMutation.mutate({
                          examRequestId: draftExamRequest.id,
                          body: items,
                        });
                      }}
                      disabled={updateExamRequestMutation.isPending}
                    >
                      {updateExamRequestMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Salvar rascunho"
                      )}
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => finalizeExamRequestMutation.mutate(draftExamRequest.id)}
                      disabled={
                        finalizeExamRequestMutation.isPending ||
                        !examLines.some((l) => l.exam_name.trim())
                      }
                    >
                      {finalizeExamRequestMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Finalizar solicitação"
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      const items = examLines
                        .map((l) => ({
                          exam_name: l.exam_name.trim(),
                          instructions: l.instructions.trim() || null,
                        }))
                        .filter((i) => i.exam_name);
                      if (items.length === 0) {
                        toast.error("Adicione ao menos um exame.");
                        return;
                      }
                      createExamRequestMutation.mutate(items);
                    }}
                    disabled={createExamRequestMutation.isPending}
                  >
                    {createExamRequestMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Nova solicitação de exames"
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!draftExamRequest && examRequests.length === 0) {
                      toast.error("Salve a solicitação antes de gerar o PDF oficial.");
                      return;
                    }
                    const idToPrint = draftExamRequest?.id || examRequests[0]?.id;
                    if (!idToPrint) return;
                    handleDownloadPdfBlob(
                      () => downloadExamRequestPdf(encounter!.id, idToPrint),
                      `Exames_${encounter?.patient_name?.replace(/\\s+/g, "_") || "Paciente"}.pdf`
                    );
                  }}
                >
                  <Printer className="mr-2 size-4" />
                  Baixar PDF Oficial
                </Button>
              </div>
              {examRequests.filter((e) => e.status !== "draft").length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-muted-foreground text-sm font-medium mb-2">
                    Solicitações finalizadas
                  </p>
                  <ul className="space-y-1 text-sm">
                    {examRequests
                      .filter((e) => e.status !== "draft")
                      .map((e) => (
                        <li key={e.id} className="flex items-center justify-between">
                          <div>
                            {format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} —{" "}
                            <Badge variant="secondary" className="text-xs">{e.status}</Badge> —{" "}
                            {e.items.length} exame(ns)
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              handleDownloadPdfBlob(
                                () => downloadExamRequestPdf(encounter!.id, e.id),
                                `Exames_${encounter?.patient_name?.replace(/\\s+/g, "_") || "Paciente"}.pdf`
                              );
                            }}
                          >
                            <Printer className="mr-2 size-3" />
                            PDF
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamento" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pagamento (Epic 6)</CardTitle>
              <p className="text-muted-foreground text-sm">
                Registre o pagamento do atendimento e emita recibo.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {payment ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
                    <div>
                      <p className="text-muted-foreground text-xs">Valor</p>
                      <p className="font-semibold">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(payment.amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Forma</p>
                      <p className="capitalize">{payment.payment_method.replace("_", " ")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Data</p>
                      <p>{format(new Date(payment.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                    </div>
                    {payment.notes && (
                      <div>
                        <p className="text-muted-foreground text-xs">Observações</p>
                        <p>{payment.notes}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleDownloadPdfBlob(
                        () => downloadPaymentReceiptPdf(payment.id),
                        `Recibo_${encounter?.patient_name?.replace(/\\s+/g, "_") || "Paciente"}.pdf`
                      );
                    }}
                  >
                    <Printer className="mr-2 size-4" />
                    Baixar Recibo PDF
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label>Valor (R$)</Label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="border-input bg-background mt-1 flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                        placeholder="0,00"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Forma de pagamento</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="cartao_credito">Cartão de crédito</SelectItem>
                          <SelectItem value="cartao_debito">Cartão de débito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Observações (opcional)</Label>
                    <Textarea
                      className="mt-1"
                      placeholder="Observações do pagamento"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      const amount = parseFloat(paymentAmount.replace(",", "."));
                      if (!Number.isFinite(amount) || amount <= 0) {
                        toast.error("Informe um valor válido.");
                        return;
                      }
                      createPaymentMutation.mutate({
                        amount,
                        payment_method: paymentMethod,
                        notes: paymentNotes.trim() || null,
                      });
                    }}
                    disabled={createPaymentMutation.isPending}
                  >
                    {createPaymentMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Registrar pagamento"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
