"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchOrganizations } from "@/lib/api/organizations";
import { useOrganizationStore } from "@/store/organization-store";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OrgSettingsEntryPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { currentOrganizationId, lastOrganizations } = useOrganizationStore();

  const { data: orgs = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    enabled: mounted,
    staleTime: 60_000,
  });

  const list = orgs.length > 0 ? orgs : lastOrganizations;
  const currentOrg = list.find((o) => o.id === currentOrganizationId) ?? list[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || list.length === 0) return;
    if (currentOrg?.slug) {
      router.replace(`/dashboard/settings/org/${encodeURIComponent(currentOrg.slug)}/settings`);
    }
  }, [mounted, currentOrg?.slug, list.length, router]);

  if (!mounted || (list.length > 0 && currentOrg?.slug)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">Redirecionando...</p>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="flex h-full flex-col gap-6 p-4 md:p-6">
        <h1 className="font-semibold text-2xl tracking-tight">Organização</h1>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhuma organização</EmptyTitle>
            <EmptyDescription>
              Crie ou participe de uma organização para gerenciar configurações, membros e projetos.
            </EmptyDescription>
          </EmptyHeader>
          <Button asChild>
            <Link href="/dashboard">Voltar ao Dashboard</Link>
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <p className="text-muted-foreground text-sm">Redirecionando...</p>
    </div>
  );
}
