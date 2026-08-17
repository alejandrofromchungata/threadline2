import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

/**
 * expo-secure-store is a native module, so it only exists in a build that was
 * compiled with it. Requiring it eagerly means an older build cannot even
 * start — the failure is a blank "App entry not found", not a disabled
 * sign-in. Load it defensively and degrade instead.
 */
let SecureStore = null;
try {
  // eslint-disable-next-line global-require
  const mod = require('expo-secure-store');
  // Touch the API: the require can succeed while the native side is absent.
  if (typeof mod?.getItemAsync === 'function') SecureStore = mod;
} catch {
  SecureStore = null;
}

export const hasSecureStorage = !!SecureStore;

const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig?.extra ?? {};

/**
 * Session tokens go in the keychain rather than AsyncStorage — they are
 * credentials, and AsyncStorage is plain unencrypted files on disk.
 *
 * SecureStore rejects values over 2048 bytes, and a Supabase session can
 * exceed that once the JWT carries any user metadata, so values are split
 * across numbered chunks and reassembled on read.
 */
const CHUNK = 1800;

const secureStorage = SecureStore && {
  async getItem(key) {
    const head = await SecureStore.getItemAsync(`${key}.0`);
    if (head === null) return null;
    let value = head;
    for (let i = 1; ; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) break;
      value += part;
    }
    return value;
  },
  async setItem(key, value) {
    await secureStorage.removeItem(key);
    for (let i = 0; i * CHUNK < value.length; i += 1) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
  },
  async removeItem(key) {
    for (let i = 0; ; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) break;
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
  },
};

/**
 * Sessions are only kept when the keychain is actually available. Without it
 * the app still signs in, but the session is not written anywhere and is gone
 * on restart — better than silently putting credentials somewhere unencrypted.
 */
const memoryStorage = (() => {
  const map = new Map();
  return {
    getItem: async (k) => (map.has(k) ? map.get(k) : null),
    setItem: async (k, v) => { map.set(k, v); },
    removeItem: async (k) => { map.delete(k); },
  };
})();

/** Null until the project keys are configured, so the app can run without them. */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: SecureStore ? secureStorage : memoryStorage,
        persistSession: !!SecureStore,
        autoRefreshToken: true,
        // There is no URL bar to read a token back from in a native app.
        detectSessionInUrl: false,
      },
    })
  : null;

export const isAuthConfigured = !!supabase;
