"use client";

import { useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { HANDOFF_RULE_TYPES, type HandoffRule, type HandoffRuleConfig, type HandoffRuleType } from "./handoff-types";

interface HandoffNewRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (rule: Omit<HandoffRule, "id">) => void;
}

const DEFAULT_MESSAGES: Record<HandoffRuleType, string> = {
  turnos: "Vou transferir você para um atendente humano.",
  sentimento: "Entendo sua frustração. Vou conectar você com um atendente.",
  "palavra-chave": "Claro, vou transferir você agora. Aguarde.",
  horario: "No momento não há atendentes disponíveis. Deixe seus dados para retorno.",
  topico: "Vou transferir para um especialista.",
  csat: "Obrigado pelo feedback. Vou conectar você com um atendente.",
  custom: "Transferindo para atendimento humano.",
};

export function HandoffNewRuleDialog({ open, onOpenChange, onCreate }: HandoffNewRuleDialogProps) {
  const [ruleType, setRuleType] = useState<HandoffRuleType>("turnos");
  const [turnos, setTurnos] = useState(15);
  const [keywords, setKeywords] = useState("falar com humano, atendente, gerente");
  const [horarioInicio, setHorarioInicio] = useState("09:00");
  const [horarioFim, setHorarioFim] = useState("18:00");
  const [transferMessage, setTransferMessage] = useState(DEFAULT_MESSAGES.turnos);

  const typeLabel = HANDOFF_RULE_TYPES.find((t) => t.value === ruleType)?.label ?? ruleType;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setRuleType("turnos");
      setTurnos(15);
      setKeywords("falar com humano, atendente, gerente");
      setHorarioInicio("09:00");
      setHorarioFim("18:00");
      setTransferMessage(DEFAULT_MESSAGES.turnos);
    }
    onOpenChange(next);
  };

  const getConfig = (): HandoffRuleConfig => {
    switch (ruleType) {
      case "turnos":
        return { turnos };
      case "palavra-chave":
        return {
          keywords: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        };
      case "horario":
        return {
          horarioInicio,
          horarioFim,
          dias: "Seg-Sex",
        };
      default:
        return {};
    }
  };

  const handleCreate = () => {
    onCreate({
      type: ruleType,
      label: typeLabel,
      enabled: true,
      config: getConfig(),
      transferMessage: transferMessage.trim() || DEFAULT_MESSAGES[ruleType],
    });
    toast.success("Regra criada");
    handleOpenChange(false);
  };

  const updateMessageDefault = (type: HandoffRuleType) => {
    setTransferMessage(DEFAULT_MESSAGES[type]);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Nova Regra de Escalação</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Tipo de Regra:</Label>
            <Select
              value={ruleType}
              onValueChange={(v) => {
                const t = v as HandoffRuleType;
                setRuleType(t);
                updateMessageDefault(t);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {HANDOFF_RULE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Configuração:</Label>
            {ruleType === "turnos" && (
              <div className="flex items-center gap-2">
                <Input type="number" min={1} value={turnos} onChange={(e) => setTurnos(Number(e.target.value) || 15)} />
                <span className="text-muted-foreground text-sm">turnos sem resolução</span>
              </div>
            )}
            {ruleType === "palavra-chave" && (
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="palavra1, palavra2, palavra3"
              />
            )}
            {ruleType === "horario" && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="time"
                  value={horarioInicio}
                  onChange={(e) => setHorarioInicio(e.target.value)}
                  className="w-28"
                />
                <span className="text-muted-foreground">até</span>
                <Input
                  type="time"
                  value={horarioFim}
                  onChange={(e) => setHorarioFim(e.target.value)}
                  className="w-28"
                />
                <span className="text-muted-foreground text-sm">Seg-Sex</span>
              </div>
            )}
            {!["turnos", "palavra-chave", "horario"].includes(ruleType) && (
              <p className="text-muted-foreground text-sm">Configuração específica para este tipo em breve.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Mensagem de Transferência:</Label>
            <Input
              value={transferMessage}
              onChange={(e) => setTransferMessage(e.target.value)}
              placeholder="Mensagem exibida ao transferir..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate}>Criar Regra</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
