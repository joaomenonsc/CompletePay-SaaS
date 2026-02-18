"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const STEPS = [
  { slug: "categoria", label: "Categoria" },
  { slug: "template", label: "Template" },
  { slug: "personalizacao", label: "Personalização" },
  { slug: "review", label: "Review" },
] as const;

export function WizardSteps() {
  const pathname = usePathname();
  const currentIndex = STEPS.findIndex((s) => pathname.includes(`/novo/${s.slug}`));
  const current = currentIndex >= 0 ? currentIndex : 0;

  return (
    <nav aria-label="Progresso do assistente" className="mb-6">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((step, i) => {
          const href = `/dashboard/agents/novo/${step.slug}`;
          const isActive = i === current;
          const isPast = i < current;
          return (
            <li key={step.slug} className="flex items-center gap-2">
              {i > 0 ? (
                <span className="hidden size-6 text-muted-foreground sm:inline" aria-hidden>
                  /
                </span>
              ) : null}
              {isPast ? (
                <Link
                  prefetch={false}
                  href={href}
                  className="text-muted-foreground text-sm underline hover:text-foreground"
                >
                  {i + 1}. {step.label}
                </Link>
              ) : (
                <span className={cn("text-sm", isActive ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {i + 1}. {step.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
