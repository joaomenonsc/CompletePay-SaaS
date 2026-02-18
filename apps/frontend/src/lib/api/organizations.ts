/**
 * API de organizações (multi-tenancy). Requer autenticação.
 */

import apiClient from "@/lib/api/client";
import type { Organization } from "@/store/organization-store";

interface OrgApiItem {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: string;
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const { data } = await apiClient.get<OrgApiItem[]>("/organizations");
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    role: r.role,
    createdAt: r.createdAt,
  }));
}

export type CreateOrganizationBody = { name: string; slug: string };

interface OrgCreateApiResponse {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export async function createOrganization(body: CreateOrganizationBody): Promise<Organization> {
  const { data } = await apiClient.post<OrgCreateApiResponse>("/organizations", body);
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    role: "owner",
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}
