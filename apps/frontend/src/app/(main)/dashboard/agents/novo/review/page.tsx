"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Info, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCreateAgent } from "@/hooks/use-agents";
import { getCategoryLabel, getTemplatesForCategory } from "@/lib/wizard-templates";
import { useWizardStore } from "@/store/wizard-store";

const TONE_LABELS: Record<string, string> = {
  formal: "Formal",
  profissional: "Profissional",
  casual: "Casual",
  tecnico: "Técnico",
};

function SummaryRow({ label, value, editHref }: { label: string; value: string; editHref?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 last:border-0">
      <div>
        <span className="text-muted-foreground text-sm">{label}</span>
        <p className="font-medium">{value}</p>
      </div>
      {editHref ? (
        <Button variant="ghost" size="sm" asChild>
          <Link prefetch={false} href={editHref}>
            Editar
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

export default function WizardReviewPage() {
  const router = useRouter();
  const { draft, clearDraft } = useWizardStore();
  const createAgent = useCreateAgent();
  const templates = getTemplatesForCategory(draft.category);
  const template = templates.find((t) => t.id === draft.templateId);
  const instructionCount = draft.systemInstructions
    ? draft.systemInstructions.trim().split(/\n+/).filter(Boolean).length
    : 0;

  const handleCreate = () => {
    createAgent.mutate(
      {
        name: draft.name,
        description: draft.description || undefined,
        status: "rascunho",
        model: draft.model,
        system_instructions: draft.systemInstructions,
        category: draft.category || undefined,
        template_id: draft.templateId || undefined,
      },
      {
        onSuccess: (agent) => {
          clearDraft();
          toast.success("Agente criado", {
            description: `"${agent.name}" foi criado. Redirecionando para o editor.`,
          });
          router.push(`/dashboard/agents/${agent.id}/editor`);
        },
        onError: () => toast.error("Falha ao criar agente"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Revise as configurações do seu agente</h2>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <p className="font-medium text-muted-foreground text-sm">RESUMO</p>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex items-start gap-4 pb-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="size-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{draft.name}</h3>
            </div>
          </div>

          <SummaryRow
            label="Categoria"
            value={getCategoryLabel(draft.category) || "—"}
            editHref="/dashboard/agents/novo/categoria"
          />
          <SummaryRow
            label="Template"
            value={template?.title ?? draft.templateId ?? "—"}
            editHref="/dashboard/agents/novo/template"
          />
          <SummaryRow
            label="Tom"
            value={TONE_LABELS[draft.tone] ?? draft.tone}
            editHref="/dashboard/agents/novo/personalizacao"
          />
          <SummaryRow label="Idioma" value={template?.idioma ?? "PT-BR"} />
          <SummaryRow label="Modelo" value={draft.model || "—"} />

          {draft.welcomeMessage ? (
            <div className="py-3">
              <span className="text-muted-foreground text-sm">Boas-vindas:</span>
              <p className="mt-1 border-l-2 pl-3 text-muted-foreground text-sm italic">
                &quot;{draft.welcomeMessage.slice(0, 60)}
                {draft.welcomeMessage.length > 60 ? "..." : ""}&quot;
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <span className="text-muted-foreground text-sm">Instruções:</span>
              <p className="font-medium">
                {instructionCount} instrução{instructionCount !== 1 ? "ões" : ""} configurada
                {instructionCount !== 1 ? "s" : ""}
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link prefetch={false} href="/dashboard/agents/novo/personalizacao">
                Ver
              </Link>
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <span className="text-muted-foreground text-sm">Guardrails:</span>
              <p className="font-medium">2 tópicos proibidos (do template)</p>
            </div>
            <Button variant="ghost" size="sm">
              Ver
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 rounded-lg border bg-muted/50 p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          Após criar, você poderá adicionar Knowledge Base, configurar canais e testar no Playground.
        </p>
      </div>

      <div className="flex justify-end gap-2 border-t pt-6">
        <Button variant="outline" asChild>
          <Link prefetch={false} href="/dashboard/agents/novo/personalizacao">
            Voltar
          </Link>
        </Button>
        <Button onClick={handleCreate}>Criar Agente →</Button>
      </div>
    </div>
  );
}
