"use client";

import { useMemo, useState } from "react";

import { Github } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { SettingsAccountLayout } from "@/app/(main)/dashboard/settings/_components/settings-account-layout";
import { SettingsSection } from "@/app/(main)/dashboard/settings/_components/settings-section";
import { IdentityRow } from "./_components/identity-row";
import { toast } from "sonner";

const APPLICATION_IDENTITIES = [
  { id: "github", name: "GitHub", icon: Github, connected: true, dateText: "Conectado em 15 jan 2025" },
  { id: "google", name: "Google", icon: Github, connected: false, dateText: undefined },
];

export default function IdentitiesPage() {
  const [search, setSearch] = useState("");

  const filteredApp = useMemo(() => {
    if (!search.trim()) return APPLICATION_IDENTITIES;
    const q = search.toLowerCase();
    return APPLICATION_IDENTITIES.filter(
      (i) => i.name.toLowerCase().includes(q)
    );
  }, [search]);

  const handleSignIn = () => {
    toast.info("Esta funcionalidade estará disponível em breve.");
  };

  const handleDisconnect = () => {
    toast.info("Esta funcionalidade estará disponível em breve.");
  };

  return (
    <SettingsAccountLayout
      pageTitle="Identidades"
      breadcrumbCurrent="Identidades"
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Input
            placeholder="Buscar identidades..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-[200px]"
          />
        </div>

        <SettingsSection title="Identidades da aplicação">
          <div className="space-y-3">
            {filteredApp.map((identity) => (
              <IdentityRow
                key={identity.id}
                icon={identity.icon}
                name={identity.name}
                dateText={identity.dateText}
                connected={identity.connected}
                onSignIn={handleSignIn}
                onDisconnect={handleDisconnect}
              />
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title="Identidades da organização">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Github className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Nenhuma identidade de organização</EmptyTitle>
              <EmptyDescription>
                Conecte os provedores de identidade da sua organização para habilitar SSO.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </SettingsSection>
      </div>
    </SettingsAccountLayout>
  );
}
