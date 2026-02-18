"use client";

import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

import { UsageNav } from "./usage-nav";

interface UsageLayoutClientProps {
  children: React.ReactNode;
  pageTitle: string;
  breadcrumbCurrent: string;
}

export function UsageLayoutClient({
  children,
  pageTitle,
  breadcrumbCurrent,
}: UsageLayoutClientProps) {
  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/usage">Uso e Pagamento</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{breadcrumbCurrent}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="font-semibold text-2xl tracking-tight">{pageTitle}</h1>

      <div className={cn("flex flex-1 flex-col gap-8 md:flex-row")}>
        <aside className="w-full shrink-0 md:w-56">
          <UsageNav />
        </aside>
        <main className="min-w-0 max-w-2xl flex-1">{children}</main>
      </div>
    </div>
  );
}
