"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import type { HandoffRule } from "./handoff-types";

interface HandoffRuleCardProps {
  rule: HandoffRule;
  index: number;
  onToggle: (id: string, enabled: boolean) => void;
  onMessageChange: (id: string, message: string) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}

function RuleDescription({ rule }: { rule: HandoffRule }) {
  switch (rule.type) {
    case "turnos":
      return (
        <p className="text-muted-foreground text-sm">
          Quando a conversa exceder <span className="font-medium text-foreground">{rule.config.turnos ?? 15}</span>{" "}
          turnos sem resolução, escalar para humano.
        </p>
      );
    case "sentimento":
      return (
        <p className="text-muted-foreground text-sm">
          Quando detectar sentimento negativo persistente (2+ mensagens consecutivas), escalar para humano.
        </p>
      );
    case "palavra-chave":
      return (
        <p className="text-muted-foreground text-sm">
          Quando o usuário mencionar qualquer uma dessas palavras:{" "}
          <span className="font-medium text-foreground">
            {(rule.config.keywords ?? ["falar com humano", "atendente", "gerente"]).join(" ")}
          </span>{" "}
          escalar imediatamente.
        </p>
      );
    case "horario":
      return (
        <p className="text-muted-foreground text-sm">
          Fora do horário comercial (
          <span className="font-medium text-foreground">
            {rule.config.horarioInicio ?? "09:00"} - {rule.config.horarioFim ?? "18:00"}
          </span>
          , Seg-Sex), informar que não há atendentes disponíveis e coletar dados para retorno.
        </p>
      );
    default:
      return <p className="text-muted-foreground text-sm">Regra de escalação configurada.</p>;
  }
}

export function HandoffRuleCard({ rule, index, onToggle, onMessageChange, onEdit, onRemove }: HandoffRuleCardProps) {
  const showMessage = rule.type === "turnos" || rule.type === "sentimento" || rule.type === "palavra-chave";

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">
              Regra {index}: {rule.label}
            </h3>
            <Switch checked={rule.enabled} onCheckedChange={(checked) => onToggle(rule.id, checked)} />
          </div>
          <RuleDescription rule={rule} />
          {showMessage && (
            <div className="mt-3 space-y-1">
              <Label className="text-xs">Mensagem de transferência:</Label>
              <Input
                value={rule.transferMessage}
                onChange={(e) => onMessageChange(rule.id, e.target.value)}
                placeholder="Mensagem ao transferir..."
                className="mt-0.5 text-sm"
              />
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(rule.id)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(rule.id)}
          >
            Remover
          </Button>
        </div>
      </div>
    </div>
  );
}
