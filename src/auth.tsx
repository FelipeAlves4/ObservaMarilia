import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { requireSupabaseConfig, supabase } from './supabase';

export type AppRole = 'citizen' | 'manager' | 'collaborator';
export interface Profile { id: string; name: string; role: AppRole; accountStatus: 'active'|'suspended'; collaboratorId?: string|null; team?: string|null; active?: boolean }
interface AuthValue { session: Session|null; profile: Profile|null; loading: boolean; signOut: () => Promise<void>; refreshProfile: () => Promise<void> }
const AuthContext = createContext<AuthValue|null>(null);

async function loadProfile() {
  const { data, error } = await supabase.rpc('current_profile');
  if (error) throw error;
  return data as unknown as Profile|null;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session|null>(null);
  const [profile, setProfile] = useState<Profile|null>(null);
  const [loading, setLoading] = useState(true);
  const refreshProfile = async () => {
    const { data: { session: current } } = await supabase.auth.getSession();
    setSession(current);
    if (!current) { setProfile(null); return; }
    try { setProfile(await loadProfile()); } catch { setProfile(null); }
  };
  useEffect(() => {
    let active = true;
    void refreshProfile().finally(() => { if (active) setLoading(false); });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) { setProfile(null); return; }
      void loadProfile().then(setProfile).catch(() => setProfile(null));
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);
  const value = useMemo(() => ({ session, profile, loading, refreshProfile, signOut: async () => { requireSupabaseConfig(); await supabase.auth.signOut(); } }), [session, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider ausente.'); return value; }
