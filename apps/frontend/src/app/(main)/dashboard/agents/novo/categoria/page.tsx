"use client";

import { useRouter } from "next/navigation";

import { FileText, GitBranch, Headphones, LifeBuoy, Settings, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWizardStore } from "@/store/wizard-store";

const CATEGORIES = [
  {
    id: "atendimento",
    title: "Atendimento",
    description: "Responde perguntas frequentes e direciona clientes para o setor correto.",
    icon: Headphones,
  },
  {
    id: "triagem",
    title: "Triagem",
    description: "Classifica e prioriza solicitações.",
    icon: GitBranch,
  },
  {
    id: "onboarding",
    title: "Onboarding",
    description: "Guia novos clientes pelo setup inicial.",
    icon: UserPlus,
  },
  {
    id: "suporte",
    title: "Suporte",
    description: "Resolve problemas técnicos.",
    icon: LifeBuoy,
  },
  {
    id: "conteudo",
    title: "Conteúdo",
    description: "Cria textos, FAQs e respostas.",
    icon: FileText,
  },
  {
    id: "custom",
    title: "Custom",
    description: "Comece do zero com config personalizada.",
    icon: Settings,
  },
] as const;

export default function WizardCategoriaPage() {
  const router = useRouter();
  const { draft, setCategory } = useWizardStore();

  const handleSelect = (id: string) => {
    setCategory(id);
    router.push("/dashboard/agents/novo/template");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Escolha a categoria do seu agente</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Cada categoria vem com templates otimizados para o caso de uso.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = draft.category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleSelect(cat.id)}
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border p-6 text-center transition-colors hover:bg-muted/50",
                isSelected && "border-primary bg-primary/5 ring-2 ring-primary/20",
              )}
            >
              <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{cat.title}</p>
                <p className="mt-1 text-muted-foreground text-sm leading-snug">{cat.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 border-t pt-6">
        <Button variant="outline" asChild>
          <a href="/dashboard/chat">Voltar</a>
        </Button>
      </div>
    </div>
  );
}
