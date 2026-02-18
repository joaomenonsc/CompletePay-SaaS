"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOrganizations } from "@/lib/api/organizations";
import { useOrganizationStore } from "@/store/organization-store";

/**
 * Returns the current organization (from store) slug and display name.
 * Used so the settings nav can show Organization links even when on Account pages.
 */
export function useCurrentOrg() {
  const { currentOrganizationId, lastOrganizations } = useOrganizationStore();

  const { data: orgs = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    staleTime: 60_000,
  });

  const list = orgs.length > 0 ? orgs : lastOrganizations;
  const current = list.find((o) => o.id === currentOrganizationId) ?? list[0];

  if (!current) {
    return { orgSlug: undefined, orgDisplayName: undefined };
  }

  return {
    orgSlug: current.slug,
    orgDisplayName: current.name,
  };
}
