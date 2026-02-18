"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UsageLayoutClient } from "../_components/usage-layout-client";
import { toast } from "sonner";

const LEARN_MORE_URL = "https://completepay.com/planos";

export default function SubscriptionPage() {
  const handleManagePlan = () => {
    toast.info("O gerenciamento de plano estará disponível em breve.");
  };

  return (
    <UsageLayoutClient
      pageTitle="Plano em período de teste"
      breadcrumbCurrent="Assinatura"
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Button onClick={handleManagePlan}>Gerenciar plano</Button>
        </div>

        <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <CardTitle>Teste do plano Business</CardTitle>
          <Badge
            variant="secondary"
            className="shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
          >
            13 dias restantes
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Você está no período de teste do plano Business. Durante o teste, você tem acesso a
            todos os recursos do plano Business, incluindo analytics avançados, SSO e suporte prioritário.
            Seu teste expira em 2 de março de 2026.
          </p>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <a href={LEARN_MORE_URL} target="_blank" rel="noopener noreferrer">
              Saiba mais
              <ExternalLink className="ml-2 size-4" />
            </a>
          </Button>
        </CardFooter>
        </Card>
      </div>
    </UsageLayoutClient>
  );
}
