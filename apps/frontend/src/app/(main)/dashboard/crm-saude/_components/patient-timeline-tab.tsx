"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchEncounters } from "@/lib/api/crm";
import { FileText, Loader2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  in_triage: "Em triagem",
  in_progress: "Em atendimento",
  completed: "Finalizado",
  pending_docs: "Pend. documentação",
};

export function PatientTimelineTab({ patientId }: { patientId: string }) {
  const { data: encounters = [], isLoading } = useQuery({
    queryKey: ["crm-encounters", patientId],
    queryFn: () => fetchEncounters({ patient_id: patientId, limit: 100 }),
    enabled: !!patientId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (encounters.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Nenhum atendimento registrado para este paciente.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ul className="space-y-3" role="list">
          {encounters.map((enc) => (
            <li key={enc.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {format(new Date(enc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                <p className="text-muted-foreground text-sm">
                  {enc.professional_name ?? enc.professional_id}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {STATUS_LABELS[enc.status] ?? enc.status}
              </Badge>
              <Link
                href={`/dashboard/crm-saude/atendimentos/${enc.id}`}
                className="shrink-0 text-sm font-medium text-primary hover:underline"
              >
                Ver ficha
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
