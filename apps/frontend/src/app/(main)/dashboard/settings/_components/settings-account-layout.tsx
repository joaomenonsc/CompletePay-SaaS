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

import { useCurrentOrg } from "../_hooks/use-current-org";
import { SettingsNav } from "./settings-nav";

interface SettingsAccountLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  breadcrumbCurrent: string;
}

export function SettingsAccountLayout({
  children,
  pageTitle,
  breadcrumbCurrent,
}: SettingsAccountLayoutProps) {
  const { orgSlug, orgDisplayName } = useCurrentOrg();

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/settings">Configurações</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/settings/account/details">Minha conta</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{breadcrumbCurrent}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="font-semibold text-2xl tracking-tight">{pageTitle}</h1>

      <div className={cn("flex flex-1 flex-col gap-8 md:flex-row md:gap-12")}>
        <aside className="w-full shrink-0 md:w-56 md:pr-2">
          <SettingsNav orgSlug={orgSlug} orgDisplayName={orgDisplayName} />
        </aside>
        <main className="min-w-0 max-w-2xl flex-1 md:pl-8">{children}</main>
      </div>
    </div>
  );
}
