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

export async function updateItem(id, item) {
  return supabase
    .from('items')
    .update(item)
    .eq('id', id)
    .select()
    .single();
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

export async function createReservation({ conversationId, itemId, ownerId, date, timeFrom, timeTo, deliveryMethod, program, status = 'pending' }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('No autenticado') };
  return supabase
    .from('reservations')
    .insert({
      conversation_id: conversationId,
      item_id: itemId,
      owner_id: ownerId,
      borrower_id: user.id,
      date,
      time_from: timeFrom,
      time_to: timeTo,
      delivery_method: deliveryMethod,
      program,
      status,
    })
    .select()
    .single();
}

export async function acceptReservation(reservationId) {
  return supabase
    .from('reservations')
    .update({ status: 'confirmed' })
    .eq('id', reservationId)
    .select('id, conversation_id, borrower_id, item_id, date, time_from, time_to, program')
    .single();
}

export async function rejectReservation(reservationId) {
  return supabase
    .from('reservations')
    .update({ status: 'rejected' })
    .eq('id', reservationId)
    .select('id, borrower_id, item_id, date, time_from, item:item_id(name)')
    .single();
}

export async function createNotification({ userId, type, reservationId, title, body }) {
  return supabase
    .from('notifications')
    .insert({ user_id: userId, type, reservation_id: reservationId, title, body })
    .select()
    .single();
}

export async function fetchReservations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  return supabase
    .from('reservations')
    .select('*, item:item_id(name, icon), owner:owner_id(nombre, apellido), borrower:borrower_id(nombre, apellido)')
    .or(`owner_id.eq.${user.id},borrower_id.eq.${user.id}`)
    .eq('status', 'confirmed')
    .order('date', { ascending: true });
}

export async function fetchNotifications() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  return supabase
    .from('notifications')
    .select('*, reservation:reservation_id(id, date, time_from, time_to, program, delivery_method, conversation_id, borrower_id, owner_id, status, item:item_id(name), borrower:borrower_id(nombre, apellido))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
}

export async function markNotificationRead(id) {
  return supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function updateUserLocation(lat, lng) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('profiles')
    .upsert({ id: user.id, lat, lng, updated_at: new Date().toISOString() });
}

export async function fetchNeighborItems(query = '') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };

  let q = supabase
    .from('items')
    .select('*, owner:user_id(id, nombre, apellido, lat, lng), reservations(time_from, time_to, date, status)')
    .neq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (query.trim()) {
    q = q.ilike('name', `%${query.trim()}%`);
  }

  const { data, error } = await q;
  if (!data) return { data: [], error };

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const annotated = data.map((item) => {
    const todayRes = (item.reservations ?? []).filter(
      (r) => r.date === todayStr && r.status === 'confirmed'
    );
    const activeNow = todayRes.find((r) => r.time_from <= nowTime && r.time_to > nowTime) ?? null;
    const nextBusy = todayRes
      .filter((r) => r.time_from > nowTime)
      .sort((a, b) => a.time_from.localeCompare(b.time_from))[0] ?? null;
    return {
      ...item,
      busyUntil: activeNow?.time_to ?? null,
      nextBusy: nextBusy?.time_from ?? null,
    };
  });

  return { data: annotated, error };
}

export async function fetchItemDayReservations(itemId, date) {
  return supabase
    .from('reservations')
    .select('time_from, time_to')
    .eq('item_id', itemId)
    .eq('date', date)
    .eq('status', 'confirmed');
}

export async function fetchItemReservations(itemId) {
  const today = new Date().toISOString().split('T')[0];
  return supabase
    .from('reservations')
    .select('*, borrower:borrower_id(nombre, apellido)')
    .eq('item_id', itemId)
    .eq('status', 'confirmed')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('time_from', { ascending: true });
}

export async function checkConflict(itemId, date, timeFrom, timeTo) {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, time_from, time_to')
    .eq('item_id', itemId)
    .eq('date', date)
    .eq('status', 'confirmed')
    .lt('time_from', timeTo)
    .gt('time_to', timeFrom);
  if (error) return { conflict: false, slots: [], error };
  return { conflict: (data?.length ?? 0) > 0, slots: data ?? [], error: null };
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
