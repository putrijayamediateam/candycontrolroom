import { createContext, useContext } from 'react';

export interface User {
  id: string; email: string; display_name: string; role: 'owner' | 'clinical_reviewer' | 'reviewer';
  interface_locale: 'en' | 'ms'; content_locale: 'en' | 'ms'; onboarding_done: boolean;
}

export interface SessionCtx {
  user: User;
  setUser: (u: User) => void;
  signOut: () => Promise<void>;
  isOwner: boolean;
}

export const Session = createContext<SessionCtx | null>(null);
export function useSession() {
  const s = useContext(Session);
  if (!s) throw new Error('useSession outside provider');
  return s;
}
