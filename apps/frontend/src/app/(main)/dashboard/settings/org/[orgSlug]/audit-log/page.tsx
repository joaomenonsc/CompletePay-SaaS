"use client";

import { useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";

const ACTION_LABELS: Record<string, string> = {
  member_invited: "Membro convidado",
  member_removed: "Membro removido",
  role_changed: "Função alterada",
  settings_updated: "Configurações atualizadas",
};

const MOCK_EVENTS = [
  { id: "1", member: "hello@arhamkhnz.com", action: "member_invited", ip: "192.168.1.1", time: "há 2 horas" },
  { id: "2", member: "hello@ammarkhnz.com", action: "member_removed", ip: "10.0.0.1", time: "há 1 dia" },
  { id: "3", member: "hello@arhamkhnz.com", action: "role_changed", ip: "192.168.1.1", time: "há 3 dias" },
];

export default function OrgAuditLogPage() {
  const { orgSlug, orgDisplayName } = useOrgSlug();
  const [period, setPeriod] = useState("7d");
  const [actionFilter, setActionFilter] = useState("all");

  const filtered = useMemo(() => {
    let list = MOCK_EVENTS;
    if (actionFilter !== "all") {
      list = list.filter((e) => e.action === actionFilter);
    }
    return list;
  }, [actionFilter]);

  return (
    <SettingsOrgLayout
      orgSlug={orgSlug}
      orgDisplayName={orgDisplayName}
      pageTitle="Registro de auditoria"
      breadcrumbCurrent="Registro de auditoria"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="member_invited">Membro convidado</SelectItem>
              <SelectItem value="member_removed">Membro removido</SelectItem>
              <SelectItem value="role_changed">Função alterada</SelectItem>
              <SelectItem value="settings_updated">Configurações atualizadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Endereço IP</TableHead>
                <TableHead>Data/hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-mono text-sm">{event.member}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ACTION_LABELS[event.action] ?? event.action}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{event.ip}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{event.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </SettingsOrgLayout>
  );
}
