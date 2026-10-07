import { create } from 'zustand';

// ─── State & Actions ────────────────────────────────────────────────────────

interface SavedState {
  savedIds: Set<string>;

  addSaved: (id: string) => void;
  removeSaved: (id: string) => void;
  isSaved: (id: string) => boolean;
  setSavedIds: (ids: string[]) => void;
  clearSaved: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useSavedStore = create<SavedState>((set, get) => ({
  savedIds: new Set<string>(),

  addSaved: (id) => {
    set((state) => {
      const next = new Set(state.savedIds);
      next.add(id);
      return { savedIds: next };
    });
  },

  removeSaved: (id) => {
    set((state) => {
      const next = new Set(state.savedIds);
      next.delete(id);
      return { savedIds: next };
    });
  },

  isSaved: (id) => {
    return get().savedIds.has(id);
  },

  setSavedIds: (ids) => {
    set({ savedIds: new Set(ids) });
  },

  clearSaved: () => {
    set({ savedIds: new Set() });
  },
}));
