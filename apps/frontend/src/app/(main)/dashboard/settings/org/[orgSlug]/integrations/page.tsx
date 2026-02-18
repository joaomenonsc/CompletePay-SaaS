"use client";

import { useMemo, useState } from "react";

import { Plug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsOrgLayout } from "@/app/(main)/dashboard/settings/_components/settings-org-layout";
import { useOrgSlug } from "../_hooks/use-org-slug";
import { toast } from "sonner";

const MOCK_INTEGRATIONS = [
  { id: "1", name: "Slack", description: "Notificações e alertas no Slack.", status: "install" as const },
  { id: "2", name: "GitHub", description: "Conectar repositórios e commits.", status: "configure" as const },
  { id: "3", name: "Jira", description: "Sincronizar issues e sprints.", status: "view" as const },
  { id: "4", name: "PagerDuty", description: "Escalação de incidentes.", status: "disabled" as const },
];

export default function OrgIntegrationsPage() {
  const { orgSlug, orgDisplayName } = useOrgSlug();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return MOCK_INTEGRATIONS;
    const q = search.toLowerCase();
    return MOCK_INTEGRATIONS.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q),
    );
  }, [search]);

  const handleAction = (name: string) => {
    toast.info("Esta funcionalidade estará disponível em breve.");
  };

  return (
    <SettingsOrgLayout
      orgSlug={orgSlug}
      orgDisplayName={orgDisplayName}
      pageTitle="Integrações"
      breadcrumbCurrent="Integrações"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Filtrar integrações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 max-w-[240px]"
          />
          <Button size="sm" disabled title="Em breve">
            Criar nova integração
          </Button>
        </div>

        <ul className="space-y-2">
          {filtered.map((integration) => (
            <li
              key={integration.id}
              className="flex items-center gap-4 rounded-md border p-4"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Plug className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{integration.name}</p>
                <p className="text-muted-foreground text-sm truncate">
                  {integration.description}
                </p>
              </div>
              <div className="shrink-0">
                {integration.status === "install" && (
                  <Button size="sm" variant="secondary" onClick={() => handleAction(integration.name)}>
                    Instalar
                  </Button>
                )}
                {integration.status === "configure" && (
                  <Button size="sm" variant="outline" onClick={() => handleAction(integration.name)}>
                    Configurar
                  </Button>
                )}
                {integration.status === "view" && (
                  <Button size="sm" variant="ghost" onClick={() => handleAction(integration.name)}>
                    Ver
                  </Button>
                )}
                {integration.status === "disabled" && (
                  <Badge variant="secondary">Desabilitado</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </SettingsOrgLayout>
  );
}
