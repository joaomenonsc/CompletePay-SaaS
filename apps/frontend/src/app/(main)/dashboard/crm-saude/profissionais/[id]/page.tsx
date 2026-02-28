"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfessional } from "@/hooks/use-professionals";
import { fetchUnits } from "@/lib/api/crm";
import { fetchOrgMembers } from "@/lib/api/organizations";
import { useOrganizationStore } from "@/store/organization-store";
import { ArrowLeft, Calendar, FileText, Pencil, Receipt, Shield } from "lucide-react";

import { EditProfessionalDialog } from "../../_components/edit-professional-dialog";
import { ProfessionalDocumentsTab } from "../../_components/professional-documents-tab";
import { ProfessionalFinancialTab } from "../../_components/professional-financial-tab";
import { ProfessionalScheduleTab } from "../../_components/professional-schedule-tab";
import { ProfessionalTermsTab } from "../../_components/professional-terms-tab";
import {
  professionalCategoryLabel,
  professionalDisplayName,
} from "../../_components/professionals-columns";

const EMPLOYMENT_LABELS: Record<string, string> = {
  CLT: "CLT",
  PJ: "PJ",
  autonomo: "Autônomo",
  parceiro: "Parceiro",
};
const MODALITY_LABELS: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  hibrido: "Híbrido",
};

export default function ProfissionalDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [editOpen, setEditOpen] = useState(false);
  const { data: professional, isLoading, error } = useProfessional(id);
  const currentOrganizationId = useOrganizationStore((s) => s.currentOrganizationId);
  const { data: units = [] } = useQuery({
    queryKey: ["crm-units"],
    queryFn: fetchUnits,
    enabled: !!professional,
  });
  const { data: members = [] } = useQuery({
    queryKey: ["org-members", currentOrganizationId],
    queryFn: () => fetchOrgMembers(currentOrganizationId!),
    enabled: !!professional && !!currentOrganizationId,
  });

  const lastOrganizations = useOrganizationStore((s) => s.lastOrganizations ?? []);
  const canSeeFinancial = useMemo(() => {
    const org = lastOrganizations.find((o) => o.id === currentOrganizationId);
    const role = org?.role?.toLowerCase() ?? "";
    return role === "fin" || role === "gcl" || role === "owner";
  }, [currentOrganizationId, lastOrganizations]);

  if (isLoading) {
    return (
      <main className="space-y-6" role="main" aria-label="Detalhe do profissional">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (error || !professional) {
    return (
      <main className="space-y-6" role="main">
        <p className="text-destructive">Profissional não encontrado.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/crm-saude/profissionais">Voltar à lista</Link>
        </Button>
      </main>
    );
  }

  const displayName = professionalDisplayName(professional);

  return (
    <main className="space-y-6" role="main" aria-label={`Ficha de ${displayName}`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/crm-saude/profissionais" aria-label="Voltar">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{displayName}</h1>
            <p className="text-muted-foreground text-sm">
              {professionalCategoryLabel(professional.category)} ·{" "}
              {professional.council} {professional.registration_number}/
              {professional.council_uf}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            Editar
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm-saude/profissionais">Voltar à lista</Link>
          </Button>
        </div>
      </header>
      <EditProfessionalDialog
        professional={professional}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="dados">Dados cadastrais</TabsTrigger>
          <TabsTrigger value="agenda">
            <Calendar className="mr-2 size-4" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileText className="mr-2 size-4" />
            Documentos
          </TabsTrigger>
          {canSeeFinancial && (
            <TabsTrigger value="financeiro">
              <Receipt className="mr-2 size-4" />
              Financeiro
            </TabsTrigger>
          )}
          <TabsTrigger value="termos">
            <Shield className="mr-2 size-4" />
            Termos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dados cadastrais</CardTitle>
          <CardDescription>Informações do profissional de saúde</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm">Nome completo</p>
              <p>{professional.full_name}</p>
            </div>
            {professional.social_name?.trim() && (
              <div>
                <p className="text-muted-foreground text-sm">Nome social</p>
                <p>{professional.social_name}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-sm">Categoria</p>
              <p>{professionalCategoryLabel(professional.category)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Conselho / Registro</p>
              <p>
                {professional.council} {professional.registration_number}/
                {professional.council_uf}
              </p>
            </div>
            {professional.rqe && (
              <div>
                <p className="text-muted-foreground text-sm">RQE</p>
                <p>{professional.rqe}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-sm">Status</p>
              <Badge
                variant={
                  professional.status === "ativo" ? "secondary" : "outline"
                }
              >
                {professional.status}
              </Badge>
            </div>
          </div>
          {(professional.cpf ||
            professional.phone ||
            professional.email ||
            (professional.city && professional.uf)) && (
            <>
              <h3 className="font-medium">Contato e localização</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {professional.cpf && (
                  <div>
                    <p className="text-muted-foreground text-sm">CPF</p>
                    <p>{professional.cpf}</p>
                  </div>
                )}
                {professional.phone && (
                  <div>
                    <p className="text-muted-foreground text-sm">Telefone</p>
                    <p>{professional.phone}</p>
                  </div>
                )}
                {professional.email && (
                  <div>
                    <p className="text-muted-foreground text-sm">E-mail</p>
                    <p>{professional.email}</p>
                  </div>
                )}
                {(professional.city || professional.uf) && (
                  <div>
                    <p className="text-muted-foreground text-sm">Cidade / UF</p>
                    <p>
                      {[professional.city, professional.uf]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
          {(professional.employment_type ||
            professional.modality ||
            (professional.unit_ids && professional.unit_ids.length > 0) ||
            professional.user_id) && (
            <>
              <h3 className="font-medium">Vínculo</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {professional.employment_type && (
                  <div>
                    <p className="text-muted-foreground text-sm">Tipo</p>
                    <p>{EMPLOYMENT_LABELS[professional.employment_type] ?? professional.employment_type}</p>
                  </div>
                )}
                {professional.modality && (
                  <div>
                    <p className="text-muted-foreground text-sm">Modalidade</p>
                    <p>{MODALITY_LABELS[professional.modality] ?? professional.modality}</p>
                  </div>
                )}
                {professional.unit_ids && professional.unit_ids.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-sm">Unidades de atendimento</p>
                    <p>
                      {professional.unit_ids
                        .map((uid) => units.find((u) => u.id === uid)?.name ?? uid)
                        .join(", ")}
                    </p>
                  </div>
                )}
                {professional.user_id && (
                  <div>
                    <p className="text-muted-foreground text-sm">Usuário vinculado</p>
                    <p>
                      {members.find((m) => m.userId === professional.user_id)?.name ||
                        members.find((m) => m.userId === professional.user_id)?.email ||
                        professional.user_id}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="agenda">
          <ProfessionalScheduleTab professionalId={id} />
        </TabsContent>

        <TabsContent value="documentos">
          <ProfessionalDocumentsTab professionalId={id} />
        </TabsContent>

        {canSeeFinancial && (
          <TabsContent value="financeiro">
            <ProfessionalFinancialTab professionalId={id} />
          </TabsContent>
        )}

        <TabsContent value="termos">
          <ProfessionalTermsTab professionalId={id} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
