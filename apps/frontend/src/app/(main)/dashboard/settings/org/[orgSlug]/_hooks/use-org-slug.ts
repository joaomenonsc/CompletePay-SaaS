"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchOrganizations } from "@/lib/api/organizations";
import { useOrganizationStore } from "@/store/organization-store";

export function useOrgSlug() {
  const params = useParams();
  const orgSlug = typeof params.orgSlug === "string" ? params.orgSlug : "";
  const setCurrentOrganizationId = useOrganizationStore((s) => s.setCurrentOrganizationId);

  const { data: orgs = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    staleTime: 60_000,
  });

  const org = orgs.find((o) => o.slug === orgSlug);
  const orgDisplayName = org?.name ?? (orgSlug ? orgSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Organization");

  // Garante que o header X-Organization-Id seja da org que estamos visualizando nas configurações
  useEffect(() => {
    if (org?.id) setCurrentOrganizationId(org.id);
  }, [org?.id, setCurrentOrganizationId]);

  return { orgSlug, org, orgDisplayName };
}
