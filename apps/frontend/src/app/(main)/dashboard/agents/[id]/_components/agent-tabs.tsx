"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ArrowRightLeft,
  BarChart2,
  BookOpen,
  MessageSquare,
  PenLine,
  Play,
  Radio,
  Settings,
  Shield,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AGENT_TABS = [
  { value: "editor", label: "Editor", href: "editor", icon: PenLine },
  { value: "playground", label: "Playground", href: "playground", icon: Play },
  { value: "conversas", label: "Conversas", href: "conversas", icon: MessageSquare },
  { value: "analytics", label: "Analytics", href: "analytics", icon: BarChart2 },
  { value: "kb", label: "KB", href: "kb", icon: BookOpen },
  { value: "canais", label: "Canais", href: "canais", icon: Radio },
  { value: "handoff", label: "Regras de Handoff", href: "handoff", icon: ArrowRightLeft },
  { value: "guardrails", label: "Guardrails", href: "guardrails", icon: Shield },
  { value: "avancado", label: "Avançado", href: "avancado", icon: Settings },
] as const;

interface AgentTabsProps {
  agentId: string;
}

export function AgentTabs({ agentId }: AgentTabsProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/agents/${agentId}`;
  const segments = pathname.replace(basePath, "").split("/").filter(Boolean);
  const currentTab = segments[0] ?? "editor";
  const resolvedTab = AGENT_TABS.some((t) => t.value === currentTab) ? currentTab : "editor";

  return (
    <Tabs value={resolvedTab} className="w-full">
      {/* Scroll horizontal em mobile - mesmo padrão do Dashboard (TabsList bg-muted, aba ativa em pill) */}
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        <TabsList className="inline-flex h-9 min-w-max justify-start gap-0">
          {AGENT_TABS.map((tab) => {
            const href = `${basePath}/${tab.href}`;
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="inline-flex shrink-0 items-center gap-2 px-3 sm:px-4"
                asChild
              >
                <Link href={href} prefetch={false}>
                  <Icon className="size-4 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
                </Link>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
    </Tabs>
  );
}
