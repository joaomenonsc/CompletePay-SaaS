"use client";

import { useState } from "react";

import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SettingsOrgLayout } from "@/app/(main)/dashboard/settings/_components/settings-org-layout";
import { useOrgSlug } from "../_hooks/use-org-slug";

const MOCK_METRICS = [
  { label: "Total de eventos", value: "12.4k" },
  { label: "Erros", value: "23" },
  { label: "Transações", value: "8.1k" },
  { label: "Anexos", value: "156" },
  { label: "Aceitos", value: "99.8%" },
];

const MOCK_TABLE = [
  { project: "CompletePay Web", total: "5.2k", errors: "12", transactions: "3.1k", attachments: "80", accepted: "99.7%" },
  { project: "API Gateway", total: "7.2k", errors: "11", transactions: "5.0k", attachments: "76", accepted: "99.9%" },
];

export default function OrgStatsPage() {
  const { orgSlug, orgDisplayName } = useOrgSlug();
  const [period, setPeriod] = useState("30d");
  const [category, setCategory] = useState("errors");

  return (
    <SettingsOrgLayout
      orgSlug={orgSlug}
      orgDisplayName={orgDisplayName}
      pageTitle="Estatísticas e uso"
      breadcrumbCurrent="Estatísticas e uso"
    >
      <div className="space-y-8">
        <Alert className="border-primary/20 bg-primary/5">
          <Info className="size-4" />
          <AlertTitle>Atualize para Business</AlertTitle>
          <AlertDescription>
            Desbloqueie métricas avançadas, retenção estendida e relatórios por projeto.
          </AlertDescription>
          <div className="mt-3 flex gap-2">
            <Button size="sm">Atualizar</Button>
            <Button size="sm" variant="outline">Saiba mais</Button>
          </div>
        </Alert>

        <Tabs defaultValue="usage" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="usage">Uso</TabsTrigger>
            <TabsTrigger value="issues">Problemas</TabsTrigger>
            <TabsTrigger value="health">Saúde</TabsTrigger>
          </TabsList>

          <TabsContent value="usage" className="space-y-6">
            <div className="flex flex-wrap gap-4">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="month">Este mês</SelectItem>
                  <SelectItem value="year">Este ano</SelectItem>
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="errors">Erros</SelectItem>
                  <SelectItem value="transactions">Transações</SelectItem>
                  <SelectItem value="attachments">Anexos</SelectItem>
                  <SelectItem value="replays">Reprises</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {MOCK_METRICS.map((m) => (
                <Card key={m.label}>
                  <CardContent className="pt-4">
                    <p className="text-muted-foreground text-sm">{m.label}</p>
                    <p className="font-semibold text-2xl tracking-tight">{m.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Erros</TableHead>
                    <TableHead>Transações</TableHead>
                    <TableHead>Anexos</TableHead>
                    <TableHead>Aceitos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_TABLE.map((row) => (
                    <TableRow key={row.project}>
                      <TableCell className="font-medium">{row.project}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>{row.errors}</TableCell>
                      <TableCell>{row.transactions}</TableCell>
                      <TableCell>{row.attachments}</TableCell>
                      <TableCell>{row.accepted}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="issues">
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <p className="text-muted-foreground text-sm">Os dados estarão disponíveis em breve.</p>
            </div>
          </TabsContent>

          <TabsContent value="health">
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <p className="text-muted-foreground text-sm">Os dados estarão disponíveis em breve.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SettingsOrgLayout>
  );
}
