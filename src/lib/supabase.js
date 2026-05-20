import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const SUPABASE_URL = 'https://tawxjwuokpjqjduqdhay.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jR3Ee3P54NcC1dEq3pGw4Q_q-sH2Qrp';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({ scheme: 'orbitapp', path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) return { data: null, error };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success' && result.url) {
    const fragment = result.url.split('#')[1] ?? result.url.split('?')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token') ?? '';

    if (access_token) {
      const { data: session, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      return { data: session, error: sessionError };
    }
  }

  return { data: null, error: new Error('Autenticación cancelada') };
}
