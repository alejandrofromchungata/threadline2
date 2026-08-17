import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

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

const secureStorage = {
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

/** Null until the project keys are configured, so the app can run without them. */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        // There is no URL bar to read a token back from in a native app.
        detectSessionInUrl: false,
      },
    })
  : null;

export const isAuthConfigured = !!supabase;
