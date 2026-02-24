/**
 * API de organizações (multi-tenancy). Requer autenticação.
 */

import apiClient from "@/lib/api/client";
import type { Organization } from "@/store/organization-store";

interface OrgApiItem {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
  role: string;
  createdAt: string;
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const { data } = await apiClient.get<OrgApiItem[]>("/organizations");
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    avatarUrl: r.avatarUrl ?? null,
    role: r.role,
    createdAt: r.createdAt,
  }));
}

export type CreateOrganizationBody = { name: string; slug: string };

interface OrgCreateApiResponse {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export async function createOrganization(body: CreateOrganizationBody): Promise<Organization> {
  const { data } = await apiClient.post<OrgCreateApiResponse>("/organizations", body);
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    avatarUrl: data.avatarUrl ?? null,
    role: "owner",
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

export type UpdateOrganizationBody = { name?: string; slug?: string; avatarUrl?: string | null };

interface OrgPatchResponse {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export async function updateOrganization(
  organizationId: string,
  body: UpdateOrganizationBody
): Promise<Organization> {
  const { data } = await apiClient.patch<OrgPatchResponse>(
    `/organizations/${organizationId}`,
    body
  );
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    avatarUrl: data.avatarUrl ?? null,
    role: "member",
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

export async function uploadOrganizationAvatar(
  organizationId: string,
  file: File
): Promise<Organization> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<OrgPatchResponse>(
    `/organizations/${organizationId}/avatar`,
    formData
  );
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    avatarUrl: data.avatarUrl ?? null,
    role: "member",
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

// ---- Membros ----

export interface OrgMember {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
}

export async function fetchOrgMembers(organizationId: string): Promise<OrgMember[]> {
  const { data } = await apiClient.get<OrgMember[]>(`/organizations/${organizationId}/members`);
  return (data ?? []).map((m) => ({
    ...m,
    avatarUrl: m.avatarUrl ?? null,
  }));
}

export type InviteMemberBody = { email: string; role: string };

export async function inviteOrgMember(
  organizationId: string,
  body: InviteMemberBody
): Promise<OrgMember> {
  const { data } = await apiClient.post<OrgMember>(
    `/organizations/${organizationId}/members`,
    body
  );
  return { ...data, avatarUrl: data.avatarUrl ?? null };
}

export async function removeOrgMember(
  organizationId: string,
  memberUserId: string
): Promise<void> {
  await apiClient.delete(`/organizations/${organizationId}/members/${memberUserId}`);
}

export async function updateOrgMemberRole(
  organizationId: string,
  memberUserId: string,
  role: string
): Promise<OrgMember> {
  const { data } = await apiClient.patch<OrgMember>(
    `/organizations/${organizationId}/members/${memberUserId}`,
    { role }
  );
  return { ...data, avatarUrl: data.avatarUrl ?? null };
}
