"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SettingsOrgLayout } from "@/app/(main)/dashboard/settings/_components/settings-org-layout";
import { SettingsSection } from "@/app/(main)/dashboard/settings/_components/settings-section";
import { useOrgSlug } from "../_hooks/use-org-slug";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function OrgSecurityPage() {
  const { orgSlug, orgDisplayName } = useOrgSlug();
  const [ipRestrictions, setIpRestrictions] = useState(false);
  const [require2fa, setRequire2fa] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("24h");
  const [passwordMinLength, setPasswordMinLength] = useState("8");
  const [allowOauth, setAllowOauth] = useState(true);
  const [enableScrubbing, setEnableScrubbing] = useState(false);
  const [scrubIp, setScrubIp] = useState(false);
  const [scrubCreditCard, setScrubCreditCard] = useState(false);

  return (
    <SettingsOrgLayout
      orgSlug={orgSlug}
      orgDisplayName={orgDisplayName}
      pageTitle="Segurança e privacidade"
      breadcrumbCurrent="Segurança e privacidade"
    >
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Segurança e privacidade</CardTitle>
            <CardDescription>Políticas de segurança da organização.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <Label htmlFor="ip-restrictions">Restrições de IP</Label>
              <Switch id="ip-restrictions" checked={ipRestrictions} onCheckedChange={setIpRestrictions} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="require-2fa">Exigir 2FA</Label>
              <Switch id="require-2fa" checked={require2fa} onCheckedChange={setRequire2fa} />
            </div>
            <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center">
              <Label className="w-full @md/field-group:w-auto">Tempo limite da sessão</Label>
              <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                <SelectTrigger className="h-9 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1h</SelectItem>
                  <SelectItem value="4h">4h</SelectItem>
                  <SelectItem value="8h">8h</SelectItem>
                  <SelectItem value="24h">24h</SelectItem>
                  <SelectItem value="72h">72h</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center">
              <Label className="w-full @md/field-group:w-auto">Tamanho mínimo da senha</Label>
              <Select value={passwordMinLength} onValueChange={setPasswordMinLength}>
                <SelectTrigger className="h-9 w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="16">16</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="allow-oauth">Permitir OAuth</Label>
              <Switch id="allow-oauth" checked={allowOauth} onCheckedChange={setAllowOauth} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enforce-sso">Exigir SSO</Label>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Plano Business</Badge>
                <Switch id="enforce-sso" disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ofuscação de dados</CardTitle>
            <CardDescription>Ofuscar dados sensíveis em logs e relatórios.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-scrubbing">Habilitar ofuscação de dados</Label>
              <Switch id="enable-scrubbing" checked={enableScrubbing} onCheckedChange={setEnableScrubbing} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="scrub-ip">Ofuscar endereços IP</Label>
              <Switch id="scrub-ip" checked={scrubIp} onCheckedChange={setScrubIp} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="scrub-cc">Ofuscar números de cartão</Label>
              <Switch id="scrub-cc" checked={scrubCreditCard} onCheckedChange={setScrubCreditCard} />
            </div>
            <div className="space-y-2">
              <Label>Padrões personalizados (opcional)</Label>
              <Textarea placeholder="Regex ou padrões..." rows={2} className="resize-none" />
            </div>
          </CardContent>
        </Card>

        <SettingsSection title="Ofuscação avançada de dados">
          <Alert className="mb-4">
            <Info className="size-4" />
            <AlertTitle>Regras avançadas</AlertTitle>
            <AlertDescription>
              Defina regras customizadas para mascarar dados sensíveis em eventos.
            </AlertDescription>
          </Alert>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nenhuma regra personalizada definida</EmptyTitle>
              <EmptyDescription>
                Adicione regras para ofuscar dados sensíveis nos eventos da organização.
              </EmptyDescription>
            </EmptyHeader>
            <div className="mt-4 flex gap-2">
              <Button disabled title="Em breve">Adicionar regra</Button>
              <Button variant="outline" size="sm" asChild>
                <a href="#">Saiba mais</a>
              </Button>
            </div>
          </Empty>
        </SettingsSection>
      </div>
    </SettingsOrgLayout>
  );
}
