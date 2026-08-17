import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { Button, Micro, Hint, Banner } from '../components/ui';
import { supabase } from '../services/supabase';
import { useAuth } from '../AuthContext';
import { FONTS } from '../theme';
import { useTheme } from '../ThemeContext';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Suggest a starting username from whatever the provider gave us. */
const seedFrom = (session) => {
  const raw = session?.user?.user_metadata?.preferred_username
    || session?.user?.email?.split('@')[0]
    || '';
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
};

export default function ProfileSetupScreen() {
  const { T } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { session, refreshProfile, signOut } = useAuth();

  const [username, setUsername] = useState(() => seedFrom(session));
  const [displayName, setDisplayName] = useState(
    () => session?.user?.user_metadata?.full_name || ''
  );
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const valid = USERNAME_RE.test(username);

  // Debounced availability check, so a name is not queried on every keystroke.
  useEffect(() => {
    if (!valid) { setAvailable(null); return undefined; }
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(async () => {
      const { data, error: e } = await supabase.rpc('username_available', { candidate: username });
      if (cancelled) return;
      setAvailable(e ? null : data);
      setChecking(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); setChecking(false); };
  }, [username, valid]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const name = displayName.trim();
      if (!name) throw new Error('Add a display name — it is what the app calls you.');
      const { error: e } = await supabase.from('profiles').insert({
        id: session.user.id,
        username: username.toLowerCase(),
        display_name: name,
      });
      // 23505 is Postgres' unique-violation code: the name went between the
      // availability check and this insert.
      if (e) throw new Error(e.code === '23505' ? 'That username was just taken. Try another.' : e.message);
      await refreshProfile();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Micro strong style={{ color: T.indigo, fontSize: 12, lineHeight: 16 }}>01 / YOUR NAME</Micro>
        <Text style={s.h2}>What should we call you?</Text>
        <Hint style={{ marginTop: 4, fontSize: 15, lineHeight: 21 }}>
          The display name is what you will see in the app. The username is unique and is how
          you would be found if Threadline ever shares wardrobes.
        </Hint>

        {!!error && <View style={{ marginTop: 16 }}><Banner tone="error">{error}</Banner></View>}

        <View style={s.field}>
          <Text style={s.fieldLabel}>DISPLAY NAME</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ingrid"
            placeholderTextColor={T.muted}
            style={s.input}
            maxLength={40}
          />
          <View style={s.rule} />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>USERNAME</Text>
          <View style={s.usernameRow}>
            <Text style={s.at}>@</Text>
            <TextInput
              value={username}
              onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="ingrid"
              placeholderTextColor={T.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[s.input, { flex: 1 }]}
              maxLength={20}
            />
            {checking && <ActivityIndicator size="small" color={T.muted} />}
            {!checking && available === true && <Check size={18} color={T.sage} strokeWidth={2.5} />}
            {!checking && available === false && <X size={18} color={T.rust} strokeWidth={2.5} />}
          </View>
          <View style={s.rule} />
          <Text style={s.help}>
            {!username
              ? '3–20 characters: letters, numbers and underscores.'
              : !valid
                ? '3–20 characters: letters, numbers and underscores.'
                : available === false
                  ? 'Taken — try another.'
                  : available === true
                    ? 'Available.'
                    : 'Checking…'}
          </Text>
        </View>

        <Button
          title="Continue"
          busy={busy}
          disabled={!valid || available !== true || !displayName.trim()}
          onPress={save}
          style={{ minHeight: 56, borderRadius: 28, marginTop: 8 }}
        />
        <Button title="Sign out" variant="ghost" style={{ marginTop: 10 }} onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (T) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  body: { padding: 24, paddingTop: 32, paddingBottom: 48 },
  h2: { fontFamily: FONTS.display, fontSize: 32, lineHeight: 43, color: T.ink, marginTop: 8 },
  field: { marginTop: 24 },
  fieldLabel: { fontFamily: FONTS.mono, fontSize: 10, lineHeight: 13, color: T.muted, marginBottom: 4 },
  input: { fontFamily: FONTS.sansSemi, fontSize: 16, lineHeight: 21, color: T.ink, padding: 0, paddingVertical: 4 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  at: { fontFamily: FONTS.sansSemi, fontSize: 16, lineHeight: 21, color: T.muted },
  rule: { height: 1, backgroundColor: T.seam, marginTop: 4 },
  help: { fontFamily: FONTS.mono, fontSize: 11, lineHeight: 14, color: T.muted, marginTop: 6 },
});
