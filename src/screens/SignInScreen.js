import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { CircleX, Mail } from 'lucide-react-native';
import { Button, Micro, Hint, Banner } from '../components/ui';
import { supabase } from '../services/supabase';
import { FONTS } from '../theme';
import { useTheme } from '../ThemeContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const { googleIosClientId, googleWebClientId } = Constants.expoConfig?.extra ?? {};

/**
 * Loaded defensively for the same reason as SecureStore: it is a native
 * module, so an older build does not contain it, and requiring it eagerly
 * would stop the whole sign-in screen from rendering rather than just hiding
 * one button.
 */
let GoogleSignin = null;
try {
  // eslint-disable-next-line global-require
  const mod = require('@react-native-google-signin/google-signin');
  if (mod?.GoogleSignin?.configure) {
    GoogleSignin = mod.GoogleSignin;
    if (googleIosClientId && googleWebClientId) {
      // webClientId is what makes Google return an idToken Supabase can verify;
      // without it the sign-in succeeds locally and then fails server-side.
      GoogleSignin.configure({ iosClientId: googleIosClientId, webClientId: googleWebClientId });
    }
  }
} catch {
  GoogleSignin = null;
}

const googleReady = !!GoogleSignin && !!googleIosClientId && !!googleWebClientId;

export default function SignInScreen() {
  const { T } = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  React.useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const withBusy = async (fn) => {
    setBusy(true); setError(null); setNotice(null);
    try { await fn(); } catch (e) { setError(e.message || 'Something went wrong.'); } finally { setBusy(false); }
  };

  const submitEmail = () => withBusy(async () => {
    if (!EMAIL_RE.test(email.trim())) throw new Error('That email address does not look right.');
    if (password.length < 8) throw new Error('Use at least 8 characters for the password.');

    if (mode === 'signup') {
      const { error: e } = await supabase.auth.signUp({ email: email.trim(), password });
      if (e) throw e;
      setNotice('Check your email to confirm the address, then sign in.');
      setMode('signin');
    } else {
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (e) throw e;
    }
  });

  const signInWithGoogle = () => withBusy(async () => {
    await GoogleSignin.hasPlayServices();
    const res = await GoogleSignin.signIn();
    const idToken = res?.data?.idToken ?? res?.idToken;
    if (!idToken) throw new Error('Google did not return a sign-in token.');
    const { error: e } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (e) throw e;
  });

  const signInWithApple = () => withBusy(async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('Apple did not return a sign-in token.');
    const { error: e } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (e) throw e;
  });

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.logo}>
          <CircleX size={64} color={T.indigo} strokeWidth={1.6} />
          <Text style={s.wordmark}>Threadline</Text>
        </View>

        <View style={s.card}>
          <Micro style={{ fontSize: 12, lineHeight: 16 }}>
            {mode === 'signup' ? 'Open an account' : 'Welcome back'}
          </Micro>
          <View style={s.hr} />
          <Text style={s.tagline}>
            {mode === 'signup'
              ? 'Your wardrobe, kept in one place across every device.'
              : 'Sign in to reach your wardrobe.'}
          </Text>
        </View>

        {!!error && <View style={{ marginTop: 16 }}><Banner tone="error">{error}</Banner></View>}
        {!!notice && <View style={{ marginTop: 16 }}><Banner>{notice}</Banner></View>}

        {appleAvailable && Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={28}
            style={s.appleBtn}
            onPress={signInWithApple}
          />
        )}

        {googleReady && (
          <Pressable
            onPress={signInWithGoogle}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [s.googleBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.googleText}>Continue with Google</Text>
          </Pressable>
        )}

        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Micro>or with email</Micro>
          <View style={s.dividerLine} />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>EMAIL</Text>
          <View style={s.inputBox}>
            <Mail size={18} color={T.muted} strokeWidth={2} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={T.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={s.input}
            />
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>PASSWORD</Text>
          <View style={s.inputBox}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="at least 8 characters"
              placeholderTextColor={T.muted}
              secureTextEntry
              autoCapitalize="none"
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              style={s.input}
            />
          </View>
        </View>

        <Button
          title={mode === 'signup' ? 'Create Account' : 'Sign In'}
          busy={busy}
          onPress={submitEmail}
          style={{ minHeight: 56, borderRadius: 28, marginTop: 4 }}
        />

        <Pressable
          onPress={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setNotice(null); }}
          style={s.switchLink}
        >
          <Text style={s.switchText}>
            {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </Text>
        </Pressable>

        <Hint style={{ textAlign: 'center', marginTop: 20 }}>
          Signing in keeps your wardrobe on your account rather than on one phone.
        </Hint>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (T) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  body: { padding: 24, paddingTop: 32, paddingBottom: 48 },
  logo: { alignItems: 'center', gap: 12, marginBottom: 28 },
  wordmark: { fontFamily: FONTS.displayBlack, fontSize: 40, lineHeight: 53, color: T.indigo },
  card: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    padding: 20, gap: 12,
  },
  hr: { height: 1, backgroundColor: T.seam },
  tagline: { fontFamily: FONTS.displayMedium, fontSize: 20, lineHeight: 27, color: T.ink },
  appleBtn: { height: 56, marginTop: 20 },
  googleBtn: {
    height: 56, borderRadius: 28, marginTop: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seamDark,
  },
  googleText: { fontFamily: FONTS.sansSemi, fontSize: 16, lineHeight: 21, color: T.ink },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: T.seam },
  field: { marginBottom: 14 },
  fieldLabel: { fontFamily: FONTS.mono, fontSize: 10, lineHeight: 13, color: T.muted, marginBottom: 6 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  input: { flex: 1, padding: 0, fontFamily: FONTS.sans, fontSize: 15, color: T.ink },
  switchLink: { paddingVertical: 14, alignItems: 'center' },
  switchText: { fontFamily: FONTS.sans, fontSize: 14, lineHeight: 18, color: T.indigo },
});
