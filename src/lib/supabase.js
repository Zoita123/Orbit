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

export async function fetchItems() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };

  return supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
}

export async function addItem(item) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('No autenticado') };

  return supabase
    .from('items')
    .insert({ ...item, user_id: user.id })
    .select()
    .single();
}

export async function fetchItemById(id) {
  return supabase.from('items').select('*').eq('id', id).single();
}

export async function deleteItem(id) {
  return supabase.from('items').delete().eq('id', id);
}

export async function fetchProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: null };
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error?.code === 'PGRST116') return { data: null, error: null }; // no row yet
  return { data, error };
}

export async function upsertProfile(profile) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('No autenticado') };
  return supabase
    .from('profiles')
    .upsert({ ...profile, id: user.id, updated_at: new Date().toISOString() })
    .select()
    .single();
}

export async function fetchConversation(conversationId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: null };
  return supabase
    .from('conversations')
    .select('*, item:item_id(name), owner:owner_id(nombre, apellido), borrower:borrower_id(nombre, apellido)')
    .eq('id', conversationId)
    .single();
}

export async function fetchConversations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  return supabase
    .from('conversations')
    .select('*, item:item_id(name), owner:owner_id(nombre, apellido), borrower:borrower_id(nombre, apellido), messages(content, created_at, read, sender_id)')
    .or(`owner_id.eq.${user.id},borrower_id.eq.${user.id}`)
    .order('created_at', { ascending: false });
}

export async function fetchOrCreateConversation(itemId, ownerId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('No autenticado') };

  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('item_id', itemId)
    .eq('owner_id', ownerId)
    .eq('borrower_id', user.id)
    .maybeSingle();

  if (existing) return { data: existing, error: null };

  return supabase
    .from('conversations')
    .insert({ item_id: itemId, owner_id: ownerId, borrower_id: user.id })
    .select()
    .single();
}

export async function fetchMessages(conversationId) {
  return supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
}

export async function sendMessage(conversationId, content, type = 'text') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('No autenticado') };
  return supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, content, type })
    .select()
    .single();
}

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
