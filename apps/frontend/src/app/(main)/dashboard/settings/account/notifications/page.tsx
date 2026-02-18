"use client";

import Link from "next/link";

import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SettingsAccountLayout } from "@/app/(main)/dashboard/settings/_components/settings-account-layout";
import { SettingsSection } from "@/app/(main)/dashboard/settings/_components/settings-section";
import { NotificationRow } from "./_components/notification-row";

const NOTIFICATION_OPTIONS = [
  { value: "off", label: "Desligado" },
  { value: "on", label: "Ligado" },
];

const FREQUENCY_OPTIONS = [
  { value: "always", label: "Sempre" },
  { value: "daily", label: "Resumo diário" },
  { value: "weekly", label: "Semanal" },
];

export default function NotificationsPage() {
  return (
    <SettingsAccountLayout
      pageTitle="Notificações"
      breadcrumbCurrent="Notificações"
    >
      <div className="space-y-8">
        <p className="text-muted-foreground text-sm">
          Configure suas preferências de notificação pessoais.
        </p>

        <SettingsSection title="Preferências de notificação">
          <div className="space-y-6">
            <NotificationRow
              title="Relatórios semanais"
              description="Resumo semanal de atividade"
              control={
                <Select defaultValue="weekly">
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <NotificationRow
              title="Roteamento de e-mail"
              description="Para onde enviar notificações por e-mail"
              control={
                <Select defaultValue="always">
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <NotificationRow
              title="Monitores de cron com falha"
              description="Alertas quando um cron falha"
              control={
                <Select defaultValue="always">
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <NotificationRow
              title="Minha própria atividade"
              control={
                <Select defaultValue="off">
                  <SelectTrigger className="h-9 w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <NotificationRow
              title="Resolver e atribuir automaticamente"
              control={
                <Select defaultValue="off">
                  <SelectTrigger className="h-9 w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          </div>
        </SettingsSection>

        <Alert>
          <Info className="size-4" />
          <AlertTitle>Preferências de notificação</AlertTitle>
          <AlertDescription>
            Aplicam-se a todas as suas organizações. Ajustes por organização
            podem ser feitos em{" "}
            <Link
              href="/dashboard/settings/account/emails"
              className="font-medium underline underline-offset-4 hover:text-primary"
            >
              Endereços de e-mail
            </Link>
            .
          </AlertDescription>
        </Alert>
      </div>
    </SettingsAccountLayout>
  );
}
