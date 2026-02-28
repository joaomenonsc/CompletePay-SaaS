"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDashboardMetrics } from "@/lib/api/crm";
import {
  Calendar,
  ClipboardList,
  DollarSign,
  Loader2,
  Users,
  Wallet,
} from "lucide-react";

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

export default function CrmSaudePage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["crm-dashboard-metrics"],
    queryFn: fetchDashboardMetrics,
  });

  return (
    <main className="space-y-6" role="main" aria-label="CRM Saúde">
      <header>
        <h1 className="text-2xl font-semibold">CRM Saúde</h1>
        <p className="text-muted-foreground text-sm">
          Visão geral: consultas, atendimentos, pagamentos e pacientes.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Consultas hoje</CardTitle>
              <ClipboardList className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metrics?.encounters_today ?? 0}</p>
              <p className="text-muted-foreground text-xs">Atendimentos iniciados hoje</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Finalizados hoje</CardTitle>
              <ClipboardList className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metrics?.encounters_completed_today ?? 0}</p>
              <p className="text-muted-foreground text-xs">Atendimentos concluídos hoje</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agendamentos hoje</CardTitle>
              <Calendar className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metrics?.appointments_today ?? 0}</p>
              <p className="text-muted-foreground text-xs">Consultas agendadas para hoje</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagamentos hoje</CardTitle>
              <DollarSign className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metrics?.payments_today_count ?? 0}</p>
              <p className="text-muted-foreground text-xs">
                {formatBRL(metrics?.payments_today_total ?? 0)} recebido
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento do mês</CardTitle>
              <Wallet className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatBRL(metrics?.payments_month_total ?? 0)}</p>
              <p className="text-muted-foreground text-xs">Total recebido no mês</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pacientes</CardTitle>
              <Users className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{metrics?.patients_total ?? 0}</p>
              <p className="text-muted-foreground text-xs">Cadastrados na organização</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Acesso rápido</CardTitle>
          <CardDescription>Navegue para as principais áreas do CRM.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm-saude/pacientes">Pacientes</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm-saude/profissionais">Profissionais</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm-saude/agendamentos">Agendamentos</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm-saude/atendimentos">Atendimentos</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm-saude/financeiro">Financeiro</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
