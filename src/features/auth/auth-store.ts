import { create } from 'zustand';

import {
  clearSession,
  loadSession,
  saveSession,
  saveUser,
  type Session,
  type User,
} from './session-storage';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  /** Reads the saved session on launch. Never touches the network. */
  hydrate: () => Promise<void>;
  signIn: (result: Session & { user: User }) => Promise<void>;
  setTokens: (session: Session) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  /** Forgets the session on this device only (see logout() for the API call). */
  clear: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  user: null,
  session: null,

  hydrate: async () => {
    const saved = await loadSession().catch(() => null);
    set(saved ? { status: 'signedIn', ...saved } : { status: 'signedOut' });
  },

  signIn: async ({ user, ...session }) => {
    await Promise.all([saveSession(session), saveUser(user)]);
    set({ status: 'signedIn', user, session });
  },

  setTokens: async (session) => {
    await saveSession(session);
    set({ session });
  },

  setUser: async (user) => {
    await saveUser(user);
    set({ user });
  },

  clear: async () => {
    await clearSession();
    set({ status: 'signedOut', user: null, session: null });
  },
}));
