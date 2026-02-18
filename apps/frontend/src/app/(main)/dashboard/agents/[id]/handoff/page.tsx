"use client";

import { useCallback, useEffect, useState } from "react";

import { useParams } from "next/navigation";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAgent } from "@/hooks/use-agents";

import { HandoffDestination } from "./_components/handoff-destination";
import { HandoffNewRuleDialog } from "./_components/handoff-new-rule-dialog";
import { HandoffRuleCard } from "./_components/handoff-rule-card";
import type { HandoffRule } from "./_components/handoff-types";

const INITIAL_RULES: HandoffRule[] = [
  {
    id: "1",
    type: "turnos",
    label: "Limite de Turnos",
    enabled: true,
    config: { turnos: 15 },
    transferMessage: "Vou transferir você para um atendente humano.",
  },
  {
    id: "2",
    type: "sentimento",
    label: "Sentimento Negativo",
    enabled: true,
    config: {},
    transferMessage: "Entendo sua frustração. Vou conectar você com um atendente.",
  },
  {
    id: "3",
    type: "palavra-chave",
    label: "Palavra-Chave",
    enabled: false,
    config: {
      keywords: ["falar com humano", "atendente", "gerente"],
    },
    transferMessage: "Claro, vou transferir você agora. Aguarde.",
  },
  {
    id: "4",
    type: "horario",
    label: "Horário Comercial",
    enabled: true,
    config: { horarioInicio: "09:00", horarioFim: "18:00", dias: "Seg-Sex" },
    transferMessage: "",
  },
];

export default function AgentHandoffPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: agent } = useAgent(id);
  const [mounted, setMounted] = useState(false);
  const [rules, setRules] = useState<HandoffRule[]>(INITIAL_RULES);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleToggle = useCallback((ruleId: string, enabled: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled } : r)));
  }, []);

  const handleMessageChange = useCallback((ruleId: string, message: string) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, transferMessage: message } : r)));
  }, []);

  const handleEdit = useCallback((_ruleId: string) => {
    toast.info("Edição em breve");
  }, []);

  const handleRemove = useCallback((ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    toast.success("Regra removida");
  }, []);

  const handleCreateRule = useCallback((rule: Omit<HandoffRule, "id">) => {
    setRules((prev) => [...prev, { ...rule, id: `rule-${Date.now()}` }]);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-6 py-4">
        <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-6 py-4">
        <p className="text-muted-foreground text-sm">Agente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h2 className="font-semibold text-lg">Regras de Escalação para Humano</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Configure quando o agente deve transferir a conversa para um atendente humano.
        </p>
      </div>

      <Button onClick={() => setDialogOpen(true)}>
        <Plus className="size-4" />
        Nova Regra
      </Button>

      <div className="space-y-3">
        {rules.map((rule, index) => (
          <HandoffRuleCard
            key={rule.id}
            rule={rule}
            index={index + 1}
            onToggle={handleToggle}
            onMessageChange={handleMessageChange}
            onEdit={handleEdit}
            onRemove={handleRemove}
          />
        ))}
      </div>

      <HandoffDestination />

      <HandoffNewRuleDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={handleCreateRule} />
    </div>
  );
}
