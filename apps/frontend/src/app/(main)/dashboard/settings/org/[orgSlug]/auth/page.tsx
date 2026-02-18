"use client";

import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsOrgLayout } from "@/app/(main)/dashboard/settings/_components/settings-org-layout";
import { useOrgSlug } from "../_hooks/use-org-slug";
import { toast } from "sonner";

const SSO_PROVIDERS = [
  { id: "github", name: "GitHub" },
  { id: "okta", name: "Okta" },
  { id: "ad", name: "Active Directory" },
  { id: "saml2", name: "SAML 2.0" },
  { id: "onelogin", name: "OneLogin" },
  { id: "rippling", name: "Rippling" },
  { id: "auth0", name: "Auth0" },
  { id: "jumpcloud", name: "JumpCloud" },
];

export default function OrgAuthPage() {
  const { orgSlug, orgDisplayName } = useOrgSlug();

  const handleConfigure = () => {
    toast.info("SSO está disponível no plano Business.");
  };

  return (
    <SettingsOrgLayout
      orgSlug={orgSlug}
      orgDisplayName={orgDisplayName}
      pageTitle="Autenticação (SSO)"
      breadcrumbCurrent="Autenticação (SSO)"
    >
      <div className="space-y-8">
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Single Sign-On (SSO)</AlertTitle>
          <AlertDescription>
            Configure um provedor de identidade para que os membros da organização
            façam login com as credenciais corporativas. Disponível no plano Business.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            Escolha um provedor
          </h3>
          <ul className="space-y-2">
            {SSO_PROVIDERS.map((provider) => (
              <li
                key={provider.id}
                className="flex items-center gap-4 rounded-md border p-4"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-medium">
                  {provider.name.slice(0, 2)}
                </div>
                <span className="min-w-0 flex-1 font-medium">{provider.name}</span>
                <Badge variant="secondary">Plano Business</Badge>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleConfigure}>
                    Configurar
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href="#" target="_blank" rel="noopener noreferrer">
                      Saiba mais
                    </a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SettingsOrgLayout>
  );
}
