"use client";

import { create } from "zustand";

export type ToneOfVoice = "formal" | "profissional" | "casual" | "tecnico";

export interface WizardDraft {
  category: string;
  templateId: string;
  name: string;
  description: string;
  model: string;
  systemInstructions: string;
  tone: ToneOfVoice;
  welcomeMessage: string;
  avatarUrl?: string | null;
}

const defaultDraft: WizardDraft = {
  category: "",
  templateId: "",
  name: "",
  description: "",
  model: "",
  systemInstructions: "",
  tone: "profissional",
  welcomeMessage: "",
  avatarUrl: null,
};

interface WizardState {
  draft: WizardDraft;
  setCategory: (category: string) => void;
  setTemplate: (templateId: string) => void;
  setPersonalization: (
    data: Partial<
      Pick<
        WizardDraft,
        "name" | "description" | "model" | "systemInstructions" | "tone" | "welcomeMessage" | "avatarUrl"
      >
    >,
  ) => void;
  clearDraft: () => void;
}

export const useWizardStore = create<WizardState>((set) => ({
  draft: defaultDraft,

  setCategory: (category) => set((s) => ({ draft: { ...s.draft, category } })),

  setTemplate: (templateId) => set((s) => ({ draft: { ...s.draft, templateId } })),

  setPersonalization: (data) => set((s) => ({ draft: { ...s.draft, ...data } })),

  clearDraft: () => set({ draft: defaultDraft }),
}));
