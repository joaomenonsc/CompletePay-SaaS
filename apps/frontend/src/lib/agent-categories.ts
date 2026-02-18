import type { LucideIcon } from "lucide-react";
import { FileText, GitBranch, Headphones, LifeBuoy, Settings, UserPlus } from "lucide-react";

export const AGENT_CATEGORIES: Record<string, { label: string; icon: LucideIcon }> = {
  atendimento: { label: "Atendimento", icon: Headphones },
  triagem: { label: "Triagem", icon: GitBranch },
  onboarding: { label: "Onboarding", icon: UserPlus },
  suporte: { label: "Suporte", icon: LifeBuoy },
  conteudo: { label: "Conteúdo", icon: FileText },
  custom: { label: "Custom", icon: Settings },
  educacao: { label: "Educação", icon: FileText },
  tecnologia: { label: "Tecnologia", icon: GitBranch },
  negocios: { label: "Negócios e Marketing", icon: Headphones },
  criativo: { label: "Criativo e Design", icon: FileText },
};

export const CATEGORY_IDS = Object.keys(AGENT_CATEGORIES) as string[];

export function getCategoryInfo(categoryId?: string) {
  if (!categoryId) return null;
  return AGENT_CATEGORIES[categoryId] ?? { label: categoryId, icon: FileText };
}
