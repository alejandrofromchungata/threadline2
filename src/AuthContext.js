import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isAuthConfigured } from './services/supabase';

const AuthContext = createContext({
  session: null,
  profile: null,
  ready: false,
  configured: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(!isAuthConfigured);

  const loadProfile = useCallback(async (userId) => {
    if (!supabase || !userId) { setProfile(null); return null; }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data ?? null);
    return data ?? null;
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      await loadProfile(data.session?.user?.id);
      setReady(true);
    });

    // Fires on sign in, sign out, and silent token refreshes.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next ?? null);
      await loadProfile(next?.user?.id);
      setReady(true);
    });

    return () => { cancelled = true; sub?.subscription?.unsubscribe(); };
  }, [loadProfile]);

  const value = useMemo(() => ({
    session,
    profile,
    ready,
    configured: isAuthConfigured,
    // True once signed in but before a username has been chosen.
    needsProfile: !!session && !profile,
    refreshProfile: () => loadProfile(session?.user?.id),
    signOut: async () => { await supabase?.auth.signOut(); },
  }), [session, profile, ready, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
