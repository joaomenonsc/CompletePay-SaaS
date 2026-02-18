export const HANDOFF_RULE_TYPES = [
  { value: "turnos", label: "Limite de Turnos" },
  { value: "sentimento", label: "Sentimento Negativo" },
  { value: "palavra-chave", label: "Palavra-Chave" },
  { value: "horario", label: "Horário Comercial" },
  { value: "topico", label: "Tópico Específico" },
  { value: "csat", label: "CSAT Baixo" },
  { value: "custom", label: "Custom (condição livre)" },
] as const;

export type HandoffRuleType = (typeof HANDOFF_RULE_TYPES)[number]["value"];

export interface HandoffRuleConfig {
  turnos?: number;
  keywords?: string[];
  horarioInicio?: string;
  horarioFim?: string;
  dias?: string;
  topico?: string;
  csatLimite?: number;
  customCondition?: string;
}

export interface HandoffRule {
  id: string;
  type: HandoffRuleType;
  label: string;
  enabled: boolean;
  config: HandoffRuleConfig;
  transferMessage: string;
}
