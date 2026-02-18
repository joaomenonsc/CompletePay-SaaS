"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchOrganizations } from "@/lib/api/organizations";

export function useOrgSlug() {
  const params = useParams();
  const orgSlug = typeof params.orgSlug === "string" ? params.orgSlug : "";

  const { data: orgs = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    staleTime: 60_000,
  });

  const org = orgs.find((o) => o.slug === orgSlug);
  const orgDisplayName = org?.name ?? (orgSlug ? orgSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Organization");

  return { orgSlug, org, orgDisplayName };
}
