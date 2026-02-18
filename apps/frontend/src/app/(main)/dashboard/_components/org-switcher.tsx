"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createOrganization, fetchOrganizations } from "@/lib/api/organizations";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import {
  useOrganizationStore,
  type Organization,
} from "@/store/organization-store";

const DEFAULT_FIRST_ORG = { name: "Meu Espaço", slugPrefix: "meu-espaco" };

/** Placeholder estático para evitar hydration mismatch (store/query só existem no cliente). */
function OrgSwitcherPlaceholder() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="min-w-[140px] justify-between gap-1 font-normal"
      aria-label="Trocar organização"
    >
      <Building2 className="size-4 shrink-0" aria-hidden />
      <span className="truncate">Organização</span>
      <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
    </Button>
  );
}

export function OrgSwitcher() {
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const { currentOrganizationId, setCurrentOrganizationId, setLastOrganizations } =
    useOrganizationStore();

  const { data: orgs = [], isLoading, isError } = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    enabled: mounted && isAuthenticated,
    staleTime: 60_000,
  });

  const createOrg = useMutation({
    mutationFn: () =>
      createOrganization({
        name: DEFAULT_FIRST_ORG.name,
        slug: `${DEFAULT_FIRST_ORG.slugPrefix}-${Date.now().toString(36)}`,
      }),
    onSuccess: (newOrg) => {
      queryClient.setQueryData(["organizations"], (old: Organization[] | undefined) =>
        old ? [...old, newOrg] : [newOrg],
      );
      setCurrentOrganizationId(newOrg.id);
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || orgs.length === 0) return;
    setLastOrganizations(orgs);
    const currentId = useOrganizationStore.getState().currentOrganizationId;
    const valid = currentId && orgs.some((o) => o.id === currentId);
    if (!valid && orgs[0]) setCurrentOrganizationId(orgs[0].id);
  }, [mounted, orgs, setLastOrganizations, setCurrentOrganizationId]);

  const currentOrg = orgs.find((o) => o.id === currentOrganizationId);
  const label = currentOrg ? currentOrg.name : "Organização";

  if (!mounted) {
    return <OrgSwitcherPlaceholder />;
  }

  if (!isAuthenticated) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-w-[140px] justify-between gap-1 font-normal"
          aria-label="Trocar organização"
        >
          {isLoading || createOrg.isPending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Building2 className="size-4 shrink-0" aria-hidden />
          )}
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]" sideOffset={4}>
        {orgs.map((org: Organization) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setCurrentOrganizationId(org.id)}
            className={cn(
              "flex items-center justify-between gap-2",
              currentOrganizationId === org.id && "bg-accent",
            )}
          >
            <span className="truncate">{org.name}</span>
            {currentOrganizationId === org.id ? (
              <Check className="size-4 shrink-0" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
        {orgs.length === 0 && !isLoading && (
          <DropdownMenuItem
            disabled={createOrg.isPending}
            onClick={() => createOrg.mutate()}
            className="cursor-pointer"
          >
            <Plus className="size-4 shrink-0" aria-hidden />
            {createOrg.isPending ? "Criando…" : "Criar minha primeira organização"}
          </DropdownMenuItem>
        )}
        {orgs.length === 0 && isError && (
          <DropdownMenuItem disabled className="text-destructive">
            Erro ao carregar. Tente recarregar a página.
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
