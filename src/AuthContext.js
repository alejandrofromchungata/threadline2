import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase, isAuthConfigured } from './services/supabase';
import { syncNow, hasSyncedBefore } from './services/sync';
import { wipeAll } from './db';

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
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState(null);
  const syncedThisSession = useRef(false);

  /**
   * The very first sync on an install that already has a wardrobe is
   * upload-only. Until that data exists on the server there is nothing to
   * merge with, and a pull that went wrong would have nothing to restore
   * from. Every sync after that is a full two-way merge.
   */
  const runSync = useCallback(async () => {
    if (!supabase) return;
    setSyncing(true);
    try {
      const firstRun = !(await hasSyncedBefore());
      const result = await syncNow({ uploadOnly: firstRun });
      if (firstRun && !result.skipped) await syncNow();
      setLastSyncError(null);
    } catch (e) {
      // Sync failing is not fatal — the phone keeps working offline and the
      // next attempt picks up from the same cursor.
      setLastSyncError(e.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }, []);

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

  // Sync once the profile exists, and again whenever the app is reopened.
  useEffect(() => {
    if (!profile || syncedThisSession.current) return undefined;
    syncedThisSession.current = true;
    runSync();
    return undefined;
  }, [profile, runSync]);

  useEffect(() => {
    if (!profile) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runSync();
    });
    return () => sub.remove();
  }, [profile, runSync]);

  const value = useMemo(() => ({
    session,
    profile,
    ready,
    configured: isAuthConfigured,
    // True once signed in but before a username has been chosen.
    needsProfile: !!session && !profile,
    refreshProfile: () => loadProfile(session?.user?.id),
    syncing,
    lastSyncError,
    runSync,
    signOut: async () => {
      syncedThisSession.current = false;
      await supabase?.auth.signOut();
    },
    /**
     * Remove the account and everything attached to it. The server cascade
     * clears the cloud copy; the local database is wiped separately, because
     * a deleted account that left the wardrobe sitting on the phone would not
     * be a deletion in any sense the user would recognise.
     */
    deleteAccount: async () => {
      const { error } = await supabase.rpc('delete_own_account');
      if (error) throw new Error(error.message);
      syncedThisSession.current = false;
      await wipeAll();
      await supabase.auth.signOut();
    },
  }), [session, profile, ready, loadProfile, syncing, lastSyncError, runSync]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
