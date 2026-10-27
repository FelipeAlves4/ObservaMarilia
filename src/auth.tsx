import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { requireSupabaseConfig, supabase } from './supabase';
import { canAccessProfile, profileAccessIssue } from './accessPolicy';

export type AppRole = 'citizen' | 'manager' | 'collaborator';
export interface Profile { id: string; name: string; role: AppRole; accountStatus: 'active'|'suspended'; collaboratorId?: string|null; team?: string|null; active?: boolean }
interface AuthValue { session: Session|null; profile: Profile|null; loading: boolean; authEvent: AuthChangeEvent|null; signOut: () => Promise<void>; refreshProfile: () => Promise<Profile|null> }
const AuthContext = createContext<AuthValue|null>(null);

async function loadProfile() {
  const { data, error } = await supabase.rpc('current_profile');
  if (error) throw error;
  return data as unknown as Profile|null;
}
export { canAccessProfile, profileAccessIssue };
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session|null>(null);
  const [profile, setProfile] = useState<Profile|null>(null);
  const [loading, setLoading] = useState(true);
  const [authEvent, setAuthEvent] = useState<AuthChangeEvent|null>(null);
  const refreshProfile = async () => {
    const { data: { session: current } } = await supabase.auth.getSession();
    setSession(current);
    if (!current) { setProfile(null); return null; }
    try { const nextProfile = await loadProfile(); setProfile(nextProfile); return nextProfile; } catch { setProfile(null); return null; }
  };
  useEffect(() => {
    let active = true;
    void refreshProfile().finally(() => { if (active) setLoading(false); });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setAuthEvent(event);
      setSession(nextSession);
      if (!nextSession) { setProfile(null); return; }
      void loadProfile().then(setProfile).catch(() => setProfile(null));
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);
  const value = useMemo(() => ({ session, profile, loading, authEvent, refreshProfile, signOut: async () => { requireSupabaseConfig(); await supabase.auth.signOut(); } }), [session, profile, loading, authEvent]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider ausente.'); return value; }
