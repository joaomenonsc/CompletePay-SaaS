export interface TemplateOption {
  id: string;
  title: string;
  description: string;
  recommended?: boolean;
  tom: string;
  idioma: string;
  model: string;
  /** Preview conversation: [user, agent] lines */
  preview?: [string, string][];
}

/** Templates por categoria. "custom" e categorias sem lista usam fallback. */
export const TEMPLATES_BY_CATEGORY: Record<string, TemplateOption[]> = {
  atendimento: [
    {
      id: "atendente-virtual",
      title: "Atendente Virtual",
      recommended: true,
      description:
        "Responde perguntas frequentes e direciona clientes para o setor correto. Ideal para empresas com FAQ extenso.",
      tom: "Profissional",
      idioma: "PT-BR",
      model: "Speed",
      preview: [
        [
          "Qual o horário de funcionamento?",
          "Nosso horário é de segunda a sexta, das 9h às 18h. Aos sábados, das 9h às 13h. Posso ajudar com mais alguma coisa?",
        ],
      ],
    },
    {
      id: "atendente-multilingue",
      title: "Atendente Multilíngue",
      description:
        "Atende em múltiplos idiomas, detecta automaticamente a língua do cliente. Ideal para empresas internacionais.",
      tom: "Formal",
      idioma: "Multi",
      model: "Quality",
    },
    {
      id: "zero",
      title: "Começar do Zero",
      description: "Sem template. Configure tudo manualmente.",
      tom: "—",
      idioma: "—",
      model: "—",
    },
  ],
  triagem: [
    {
      id: "classificador",
      title: "Classificador",
      recommended: true,
      description: "Classifica e prioriza solicitações automaticamente.",
      tom: "Profissional",
      idioma: "PT-BR",
      model: "Speed",
    },
    {
      id: "zero",
      title: "Começar do Zero",
      description: "Sem template. Configure tudo manualmente.",
      tom: "—",
      idioma: "—",
      model: "—",
    },
  ],
  onboarding: [
    {
      id: "guia-setup",
      title: "Guia de Setup",
      recommended: true,
      description: "Guia novos clientes pelo processo inicial passo a passo.",
      tom: "Profissional",
      idioma: "PT-BR",
      model: "Speed",
    },
    {
      id: "zero",
      title: "Começar do Zero",
      description: "Sem template. Configure tudo manualmente.",
      tom: "—",
      idioma: "—",
      model: "—",
    },
  ],
  suporte: [
    {
      id: "suporte-tecnico",
      title: "Suporte Técnico",
      recommended: true,
      description: "Resolve problemas técnicos e encaminha para a equipe quando necessário.",
      tom: "Técnico",
      idioma: "PT-BR",
      model: "Quality",
    },
    {
      id: "zero",
      title: "Começar do Zero",
      description: "Sem template. Configure tudo manualmente.",
      tom: "—",
      idioma: "—",
      model: "—",
    },
  ],
  conteudo: [
    {
      id: "gerador-faq",
      title: "Gerador FAQ",
      recommended: true,
      description: "Cria textos, FAQs e respostas padronizadas.",
      tom: "Profissional",
      idioma: "PT-BR",
      model: "Quality",
    },
    {
      id: "zero",
      title: "Começar do Zero",
      description: "Sem template. Configure tudo manualmente.",
      tom: "—",
      idioma: "—",
      model: "—",
    },
  ],
  custom: [
    {
      id: "zero",
      title: "Começar do Zero",
      description: "Sem template. Configure tudo manualmente.",
      tom: "—",
      idioma: "—",
      model: "—",
    },
  ],
};

const CATEGORY_LABELS: Record<string, string> = {
  atendimento: "Atendimento",
  triagem: "Triagem",
  onboarding: "Onboarding",
  suporte: "Suporte",
  conteudo: "Conteúdo",
  custom: "Custom",
};

export function getTemplatesForCategory(categoryId: string): TemplateOption[] {
  return TEMPLATES_BY_CATEGORY[categoryId] ?? TEMPLATES_BY_CATEGORY.custom;
}

export function getCategoryLabel(categoryId: string): string {
  return CATEGORY_LABELS[categoryId] ?? categoryId;
}
