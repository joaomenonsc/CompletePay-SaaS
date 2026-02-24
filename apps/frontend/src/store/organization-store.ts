"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "completepay-organization";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
}

export interface OrganizationState {
  currentOrganizationId: string | null;
  setCurrentOrganizationId: (id: string | null) => void;
  /** Última lista em memória (preenchida por OrgSwitcher). */
  lastOrganizations: Organization[];
  setLastOrganizations: (orgs: Organization[]) => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      currentOrganizationId: null,
      setCurrentOrganizationId: (id) => set({ currentOrganizationId: id }),
      lastOrganizations: [],
      setLastOrganizations: (orgs) => set({ lastOrganizations: orgs }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({ currentOrganizationId: s.currentOrganizationId }),
    },
  ),
);
