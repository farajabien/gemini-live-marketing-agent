import { create } from "zustand";

interface GenerateParams {
  script?: string;
  format?: "video" | "carousel";
  draftId?: string;
  narrativeId?: string;
  mode?: "verbatim" | "ai";
  planId?: string;
  seriesId?: string;
}

interface GenerateStore {
  isOpen: boolean;
  params: GenerateParams;
  openGenerator: (params?: GenerateParams) => void;
  closeGenerator: () => void;
}

export const useGenerateStore = create<GenerateStore>((set) => ({
  isOpen: false,
  params: {},
  openGenerator: (params = {}) => {
    // Enforce that the generator can ONLY be opened with a script OR an existing planId
    if (!params.script && !params.planId) {
      console.warn("Attempted to open generator without context (script or planId). Blocking.");
      return; 
    }
    set({ isOpen: true, params });
  },
  closeGenerator: () => set({ isOpen: false, params: {} }),
}));
