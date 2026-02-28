"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePatient } from "@/hooks/use-patients";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Pencil, Plus, Trash2 } from "lucide-react";

import { PatientConsentimentosTab } from "../../_components/patient-consentimentos-tab";
import { PatientDocumentsTab } from "../../_components/patient-documents-tab";
import { PatientTimelineTab } from "../../_components/patient-timeline-tab";
import { PatientGuardianDialog } from "../../_components/patient-guardian-dialog";
import { PatientInsuranceDialog } from "../../_components/patient-insurance-dialog";
import { patientDisplayName } from "../../_components/patients-columns";
import { deleteGuardian, deleteInsurance } from "@/lib/api/crm";
import type { PatientGuardian, PatientInsurance } from "@/types/crm";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function formatAddress(p: {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}) {
  const parts = [
    [p.logradouro, p.numero].filter(Boolean).join(", "),
    p.complemento,
    p.bairro,
    p.cidade && p.uf ? `${p.cidade} - ${p.uf}` : p.cidade || p.uf,
    p.cep,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

const PATIENTS_QUERY_KEY = ["crm-patients"] as const;

export default function PacienteDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();
  const { data: patient, isLoading, error } = usePatient(id);

  const [guardianDialogOpen, setGuardianDialogOpen] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<PatientGuardian | null>(null);
  const [insuranceDialogOpen, setInsuranceDialogOpen] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<PatientInsurance | null>(null);

  const deleteGuardianMutation = useMutation({
    mutationFn: ({ patientId, guardianId }: { patientId: string; guardianId: string }) =>
      deleteGuardian(patientId, guardianId),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: [...PATIENTS_QUERY_KEY, patientId] });
      toast.success("Responsável removido");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover");
    },
  });

  const deleteInsuranceMutation = useMutation({
    mutationFn: ({ patientId, insuranceId }: { patientId: string; insuranceId: string }) =>
      deleteInsurance(patientId, insuranceId),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: [...PATIENTS_QUERY_KEY, patientId] });
      toast.success("Vínculo removido");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover");
    },
  });

  if (isLoading) {
    return (
      <main className="space-y-6" role="main" aria-label="Detalhe do paciente">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (error || !patient) {
    return (
      <main className="space-y-6" role="main">
        <p className="text-destructive">Paciente não encontrado.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/crm-saude/pacientes">Voltar à lista</Link>
        </Button>
      </main>
    );
  }

  const displayName = patientDisplayName(patient);

  return (
    <main className="space-y-6" role="main" aria-label={`Ficha de ${displayName}`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/crm-saude/pacientes" aria-label="Voltar">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Avatar className="size-10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold">{displayName}</h1>
            {patient.social_name && patient.social_name.trim() && (
              <p className="text-muted-foreground text-sm">Registro: {patient.full_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{patient.status}</Badge>
          <span className="text-muted-foreground text-sm">{patient.phone}</span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm-saude/agendamentos">
              <Calendar className="mr-2 size-4" />
              Agendar consulta
            </Link>
          </Button>
        </div>
      </header>

      <Tabs defaultValue="cadastro" className="w-full">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="contato">Contato</TabsTrigger>
          <TabsTrigger value="responsavel">Responsável</TabsTrigger>
          <TabsTrigger value="convenio">Convênio</TabsTrigger>
          <TabsTrigger value="comunicacao">Comunicação</TabsTrigger>
          <TabsTrigger value="consentimentos">Consentimentos</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="cadastro" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados cadastrais</CardTitle>
              <CardDescription>Informações básicas do paciente</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-sm">Nome completo</p>
                <p className="font-medium">{patient.full_name}</p>
              </div>
              {patient.social_name && (
                <div>
                  <p className="text-muted-foreground text-sm">Nome social</p>
                  <p className="font-medium">{patient.social_name}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-sm">Data de nascimento</p>
                <p className="font-medium">
                  {format(new Date(patient.birth_date), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Telefone</p>
                <p className="font-medium">{patient.phone}</p>
              </div>
              {patient.cpf && (
                <div>
                  <p className="text-muted-foreground text-sm">CPF</p>
                  <p className="font-medium">{patient.cpf}</p>
                </div>
              )}
              {patient.email && (
                <div>
                  <p className="text-muted-foreground text-sm">E-mail</p>
                  <p className="font-medium">{patient.email}</p>
                </div>
              )}
              {patient.origin && (
                <div>
                  <p className="text-muted-foreground text-sm">Origem</p>
                  <p className="font-medium">{patient.origin}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contato" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Endereço</CardTitle>
              <CardDescription>Dados de contato e localização</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{formatAddress(patient)}</p>
              {!patient.logradouro && !patient.cidade && (
                <p className="text-muted-foreground text-sm mt-2">Nenhum endereço cadastrado.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responsavel" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Responsável legal</CardTitle>
                <CardDescription>Dados do responsável (menores ou incapazes)</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingGuardian(null);
                  setGuardianDialogOpen(true);
                }}
              >
                <Plus className="mr-2 size-4" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {patient.guardians?.length ? (
                <ul className="space-y-3">
                  {patient.guardians.map((g) => (
                    <li key={g.id} className="flex items-start justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{g.name}</p>
                        {g.parentesco && <p className="text-muted-foreground text-sm">{g.parentesco}</p>}
                        {g.phone && <p className="text-sm">{g.phone}</p>}
                        {g.email && <p className="text-sm">{g.email}</p>}
                        {g.autorizado_informacoes && (
                          <Badge variant="outline" className="mt-2">Autorizado a receber informações</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar responsável"
                          onClick={() => {
                            setEditingGuardian(g);
                            setGuardianDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover responsável"
                          onClick={() =>
                            deleteGuardianMutation.mutate({ patientId: id, guardianId: g.id })
                          }
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum responsável cadastrado.</p>
              )}
            </CardContent>
          </Card>
          <PatientGuardianDialog
            open={guardianDialogOpen}
            onOpenChange={(open) => {
              setGuardianDialogOpen(open);
              if (!open) setEditingGuardian(null);
            }}
            patientId={id}
            guardian={editingGuardian}
          />
        </TabsContent>

        <TabsContent value="convenio" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Convênio / Financeiro</CardTitle>
                <CardDescription>Tipo de atendimento e dados de plano</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingInsurance(null);
                  setInsuranceDialogOpen(true);
                }}
              >
                <Plus className="mr-2 size-4" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {patient.insurances?.length ? (
                <ul className="space-y-3">
                  {patient.insurances.map((i) => (
                    <li key={i.id} className="flex items-start justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{i.tipo_atendimento === "convenio" ? "Convênio" : "Particular"}</p>
                        {i.plano && <p className="text-sm">{i.plano}</p>}
                        {i.numero_carteirinha && <p className="text-muted-foreground text-sm">Carteirinha: {i.numero_carteirinha}</p>}
                        {i.validade && <p className="text-sm">Validade: {format(new Date(i.validade), "dd/MM/yyyy", { locale: ptBR })}</p>}
                        {i.titular && <p className="text-sm">Titular: {i.titular}</p>}
                        {!i.ativo && <Badge variant="secondary">Inativo</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar vínculo"
                          onClick={() => {
                            setEditingInsurance(i);
                            setInsuranceDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover vínculo"
                          onClick={() =>
                            deleteInsuranceMutation.mutate({ patientId: id, insuranceId: i.id })
                          }
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum convênio cadastrado. Atendimento particular.</p>
              )}
            </CardContent>
          </Card>
          <PatientInsuranceDialog
            open={insuranceDialogOpen}
            onOpenChange={(open) => {
              setInsuranceDialogOpen(open);
              if (!open) setEditingInsurance(null);
            }}
            patientId={id}
            insurance={editingInsurance}
          />
        </TabsContent>

        <TabsContent value="comunicacao" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm">Preferências de comunicação (em implementação).</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consentimentos" className="mt-4">
          <PatientConsentimentosTab patientId={id} />
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          <PatientDocumentsTab patientId={id} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <PatientTimelineTab patientId={id} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
