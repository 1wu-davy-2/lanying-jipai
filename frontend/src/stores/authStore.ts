import { create } from "zustand";

import type { AuthSession } from "../types";

const storageKey = "lanying-jipai-auth";

function initialSession(): AuthSession | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

interface AuthState {
  session: AuthSession | null;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: initialSession(),
  setSession: (session) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
    set({ session });
  },
  clearSession: () => {
    localStorage.removeItem(storageKey);
    set({ session: null });
  },
}));
