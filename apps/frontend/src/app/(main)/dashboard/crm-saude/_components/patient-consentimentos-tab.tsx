"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { fetchConsents, grantConsent, revokeConsent } from "@/lib/api/crm";
import type { ConsentType, PatientConsent } from "@/types/crm";

const PATIENTS_QUERY_KEY = ["crm-patients"] as const;
const CONSENTS_QUERY_KEY = (patientId: string) => ["crm-patients", patientId, "consents"] as const;

const CONSENT_LABELS: Record<ConsentType, string> = {
  lembretes: "Lembretes por WhatsApp/SMS",
  whatsapp: "Contato por WhatsApp",
  marketing: "Marketing e ofertas",
  teleatendimento: "Teleatendimento",
  contato_familiar: "Contato com familiar/responsável",
};

const TERM_VERSION = "1.0";

interface PatientConsentimentosTabProps {
  patientId: string;
}

function getActiveConsentByType(consents: PatientConsent[]): Record<ConsentType, PatientConsent | null> {
  const byType: Record<string, PatientConsent | null> = {
    lembretes: null,
    whatsapp: null,
    marketing: null,
    teleatendimento: null,
    contato_familiar: null,
  };
  for (const c of consents) {
    if (!c.revoked_at && c.granted && (byType[c.consent_type] === null || new Date(c.granted_at) > new Date((byType[c.consent_type] as PatientConsent).granted_at))) {
      byType[c.consent_type] = c;
    }
  }
  return byType as Record<ConsentType, PatientConsent | null>;
}

export function PatientConsentimentosTab({ patientId }: PatientConsentimentosTabProps) {
  const queryClient = useQueryClient();
  const { data: consents = [], isLoading } = useQuery({
    queryKey: CONSENTS_QUERY_KEY(patientId),
    queryFn: () => fetchConsents(patientId),
  });

  const grantMutation = useMutation({
    mutationFn: (consentType: ConsentType) =>
      grantConsent(patientId, {
        consent_type: consentType,
        granted: true,
        channel: "checkbox",
        term_version: TERM_VERSION,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONSENTS_QUERY_KEY(patientId) });
      toast.success("Consentimento registrado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao registrar consentimento");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ consentId, reason }: { consentId: string; reason: string }) =>
      revokeConsent(patientId, consentId, { revocation_reason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONSENTS_QUERY_KEY(patientId) });
      toast.success("Consentimento revogado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao revogar consentimento");
    },
  });

  const activeByType = getActiveConsentByType(consents);
  const types: ConsentType[] = [
    "lembretes",
    "whatsapp",
    "marketing",
    "teleatendimento",
    "contato_familiar",
  ];

  const handleToggle = (type: ConsentType, checked: boolean) => {
    if (checked) {
      grantMutation.mutate(type);
    } else {
      const active = activeByType[type];
      if (active) {
        revokeMutation.mutate({
          consentId: active.id,
          reason: "Revogado pelo paciente/responsável via painel",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">Carregando consentimentos…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Consentimentos LGPD</CardTitle>
          <CardDescription>
            Ative ou desative cada tipo de consentimento. Alterações ficam registradas em histórico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {types.map((type) => {
            const active = activeByType[type];
            const granted = !!active;
            return (
              <div
                key={type}
                className="flex flex-row items-center justify-between rounded-lg border p-4"
              >
                <Label htmlFor={`consent-${type}`} className="flex-1 cursor-pointer text-base">
                  {CONSENT_LABELS[type]}
                </Label>
                <Switch
                  id={`consent-${type}`}
                  checked={granted}
                  onCheckedChange={(checked) => handleToggle(type, checked)}
                  disabled={grantMutation.isPending || revokeMutation.isPending}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Registro de concessões e revogações.</CardDescription>
        </CardHeader>
        <CardContent>
          {consents.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum registro de consentimento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Revogação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consents.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{CONSENT_LABELS[c.consent_type as ConsentType] ?? c.consent_type}</TableCell>
                    <TableCell>
                      {c.revoked_at ? (
                        <span className="text-destructive">Revogado</span>
                      ) : c.granted ? (
                        <span className="text-green-600">Concedido</span>
                      ) : (
                        "Não concedido"
                      )}
                    </TableCell>
                    <TableCell>{c.channel}</TableCell>
                    <TableCell>
                      {format(new Date(c.granted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {c.revoked_at
                        ? format(new Date(c.revoked_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
