"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCategoryLabel, getTemplatesForCategory, type TemplateOption } from "@/lib/wizard-templates";
import { useWizardStore } from "@/store/wizard-store";

function TemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: TemplateOption;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50",
        isSelected && "border-primary bg-primary/5 ring-2 ring-primary/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border",
              isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input",
            )}
          >
            {isSelected ? <Check className="size-3" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{template.title}</span>
              {template.recommended ? (
                <Badge variant="secondary" className="text-xs">
                  Recomendado
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-muted-foreground text-sm">{template.description}</p>
            {(template.tom !== "—" || template.idioma !== "—") && (
              <p className="mt-2 text-muted-foreground text-xs">
                Tom: {template.tom} · Idioma: {template.idioma}
                {template.model !== "—" ? ` · Model: ${template.model}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>
      {template.preview && template.preview.length > 0 && (
        <div className="mt-4 rounded-md border bg-muted/50 p-3 text-left">
          <p className="mb-2 font-medium text-muted-foreground text-xs">Preview do comportamento:</p>
          {template.preview.map(([user, agent]) => (
            <div key={`${user}-${agent}`} className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium">Usuário:</span> {user}
              </p>
              <p>
                <span className="font-medium">Agente:</span> {agent}
              </p>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

export default function WizardTemplatePage() {
  const router = useRouter();
  const { draft, setTemplate } = useWizardStore();
  const categoryLabel = getCategoryLabel(draft.category);
  const templates = getTemplatesForCategory(draft.category);

  const handleSelect = (id: string) => {
    setTemplate(id);
    router.push("/dashboard/agents/novo/personalizacao");
  };

  if (!draft.category) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">Selecione uma categoria primeiro.</p>
        <Button asChild>
          <Link prefetch={false} href="/dashboard/agents/novo/categoria">
            Ir para Categoria
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Escolha um template para {categoryLabel}</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Templates vêm com instruções, tom e configurações pré-definidas.
        </p>
      </div>

      <div className="space-y-3">
        {templates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            isSelected={draft.templateId === t.id}
            onSelect={() => handleSelect(t.id)}
          />
        ))}
      </div>

      <div className="flex justify-end gap-2 border-t pt-6">
        <Button variant="outline" asChild>
          <Link prefetch={false} href="/dashboard/agents/novo/categoria">
            Voltar
          </Link>
        </Button>
      </div>
    </div>
  );
}
