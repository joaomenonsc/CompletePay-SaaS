"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CreditCard, Ticket } from "lucide-react";

import { cn } from "@/lib/utils";

const USAGE_NAV_ITEMS = [
  { title: "Assinatura", href: "/dashboard/usage/subscription", icon: CreditCard },
  { title: "Resgatar código promocional", href: "/dashboard/usage/redeem-code", icon: Ticket },
] as const;

export function UsageNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Uso e Pagamento" className="flex shrink-0 flex-col gap-1">
      <div className="flex min-w-max flex-col gap-0.5 py-2">
        {USAGE_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
