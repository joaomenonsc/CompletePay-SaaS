"use client";

import { useState } from "react";

import { SettingsAccountLayout } from "@/app/(main)/dashboard/settings/_components/settings-account-layout";
import { SettingsSection } from "@/app/(main)/dashboard/settings/_components/settings-section";
import { Switch } from "@/components/ui/switch";
import { Field, FieldContent, FieldTitle } from "@/components/ui/field";
import Link from "next/link";

const SUBSCRIPTION_ITEMS = [
  {
    id: "newsletter",
    title: "Newsletter",
    description: "Dicas e novidades do produto.",
    status: "Não inscrito atualmente",
  },
  {
    id: "education",
    title: "Educação e treinamento",
    description: "Materiais de treinamento e tutoriais.",
    status: "Não inscrito atualmente",
  },
  {
    id: "conferences",
    title: "Conferências e eventos",
    description: "Eventos e webinars.",
    status: "Não inscrito atualmente",
  },
  {
    id: "marketing",
    title: "Informações de marketing",
    description: "Ofertas e comunicações de marketing.",
    status: "Não inscrito atualmente",
  },
];

export default function SubscriptionsPage() {
  const [companyAnnouncements, setCompanyAnnouncements] = useState(true);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    newsletter: false,
    education: false,
    conferences: false,
    marketing: false,
  });

  const setToggle = (id: string, value: boolean) => {
    setToggles((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <SettingsAccountLayout
      pageTitle="Assinaturas"
      breadcrumbCurrent="Assinaturas"
    >
      <div className="space-y-8">
        <p className="text-muted-foreground text-sm">
          Podemos enviar informações sobre nossos produtos e serviços de acordo
          com nossa Política de Privacidade. Você pode cancelar a inscrição a
          qualquer momento.{" "}
          <Link
            href="#"
            className="underline underline-offset-4 hover:text-primary"
          >
            Política de Privacidade
          </Link>
        </p>

        <SettingsSection title="Preferências de assinatura">
          <div className="space-y-6">
            <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center @md/field-group:justify-between">
              <div>
                <FieldTitle>Comunicados da empresa</FieldTitle>
                <FieldContent>
                  <p className="text-muted-foreground text-sm">
                    Comunicados importantes sobre o produto e a empresa.
                  </p>
                </FieldContent>
              </div>
              <Switch
                checked={companyAnnouncements}
                onCheckedChange={setCompanyAnnouncements}
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Assinaturas para">
          <div className="space-y-6">
            {SUBSCRIPTION_ITEMS.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center @md/field-group:justify-between"
              >
                <div>
                  <FieldTitle>{item.title}</FieldTitle>
                  <FieldContent>
                    <p className="text-muted-foreground text-sm">
                      {item.description}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {item.status}
                    </p>
                  </FieldContent>
                </div>
                <Switch
                  checked={toggles[item.id] ?? false}
                  onCheckedChange={(v) => setToggle(item.id, v)}
                />
              </div>
            ))}
          </div>
        </SettingsSection>

        <p className="text-muted-foreground border-t pt-6 text-sm">
          Respeitamos sua caixa de entrada. Para dúvidas sobre consentimento ou
          dados pessoais, entre em contato:{" "}
          <a
            href="mailto:privacy@completepay.com"
            className="underline underline-offset-4 hover:text-primary"
          >
            privacy@completepay.com
          </a>
        </p>
      </div>
    </SettingsAccountLayout>
  );
}
