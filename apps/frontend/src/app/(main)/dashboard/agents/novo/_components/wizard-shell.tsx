"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = [
  { slug: "categoria", short: "Cat.", label: "Categoria" },
  { slug: "template", short: "Tmpl", label: "Template" },
  { slug: "personalizacao", short: "Pers", label: "Personaliz." },
  { slug: "review", short: "Rev.", label: "Revisão" },
] as const;

export function WizardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentIndex = STEPS.findIndex((s) => pathname.includes(`/novo/${s.slug}`));
  const current = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Header: Cancelar | Criar Novo Agente */}
      <div className="flex items-center justify-between">
        <Link
          prefetch={false}
          href="/dashboard/chat"
          className="text-muted-foreground text-sm underline hover:text-foreground"
        >
          Cancelar
        </Link>
        <h1 className="font-semibold text-lg">Criar Novo Agente</h1>
        <div className="w-16" aria-hidden />
      </div>

      {/* Stepper: 1 - 2 - 3 - 4 */}
      <div className="space-y-2">
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const href = `/dashboard/agents/novo/${step.slug}`;
            const isActive = i === current;
            const isPast = i < current;
            return (
              <div key={step.slug} className="flex items-center">
                {i > 0 ? <ChevronRight className="mx-0.5 size-4 shrink-0 text-muted-foreground md:mx-1" /> : null}
                <Link
                  prefetch={false}
                  href={href}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md border font-medium text-sm transition-colors md:size-10",
                    isActive && "border-primary bg-primary text-primary-foreground",
                    isPast && "border-primary/50 bg-primary/10 text-primary",
                    !isActive && !isPast && "border-input bg-muted/50 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {i + 1}
                </Link>
              </div>
            );
          })}
        </div>
        <p className="flex flex-wrap gap-x-2 gap-y-0 text-muted-foreground text-xs md:gap-x-3">
          {STEPS.map((step, i) => (
            <span key={step.slug}>
              <span className={i === current ? "font-medium text-foreground" : ""}>{step.label}</span>
              {i < STEPS.length - 1 ? <span className="mx-1 text-muted-foreground/60">·</span> : null}
            </span>
          ))}
        </p>
      </div>

      {/* Content area */}
      <div className="min-h-[320px]">{children}</div>
    </div>
  );
}
