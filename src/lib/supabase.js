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
  // Fetch reservation IDs for this item first
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id')
    .eq('item_id', id);

  if (reservations?.length) {
    const reservationIds = reservations.map((r) => r.id);
    // Delete notifications linked to those reservations
    await supabase.from('notifications').delete().in('reservation_id', reservationIds);
    // Delete reviews linked to those reservations
    await supabase.from('reviews').delete().in('reservation_id', reservationIds);
    // Delete the reservations themselves
    await supabase.from('reservations').delete().eq('item_id', id);
  }

  // Fetch conversation IDs for this item
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .eq('item_id', id);

  if (conversations?.length) {
    const conversationIds = conversations.map((c) => c.id);
    // Delete messages in those conversations
    await supabase.from('messages').delete().in('conversation_id', conversationIds);
    // Delete the conversations
    await supabase.from('conversations').delete().eq('item_id', id);
  }

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
    .select('*, item:item_id(name), owner:owner_id(nombre, apellido, avatar_url), borrower:borrower_id(nombre, apellido, avatar_url)')
    .eq('id', conversationId)
    .single();
}

export async function fetchConversations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  return supabase
    .from('conversations')
    .select('*, item:item_id(name), owner:owner_id(nombre, apellido, avatar_url), borrower:borrower_id(nombre, apellido, avatar_url), messages(content, created_at, read, sender_id), reservations(transaction_status, status)')
    .or(`owner_id.eq.${user.id},borrower_id.eq.${user.id}`)
    .order('created_at', { ascending: false });
}

export async function deleteConversation(conversationId) {
  await supabase.from('messages').delete().eq('conversation_id', conversationId);
  return supabase.from('conversations').delete().eq('id', conversationId);
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

export async function markMessagesRead(conversationId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  return supabase
    .from('messages')
    .update({ read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .eq('read', false);
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

export async function fetchUnreadNotifCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('read', true);
  return count ?? 0;
}

export async function markAllNotificationsRead() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
}

export async function markNotificationRead(id) {
  return supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function deleteNotification(id) {
  return supabase.from('notifications').delete().eq('id', id);
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
    .select('*, reservations(time_from, time_to, date, status)')
    .neq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (query.trim()) {
    q = q.ilike('name', `%${query.trim()}%`);
  }

  const { data: items, error } = await q;
  if (!items) return { data: [], error };

  // Fetch profiles separately to avoid FK join ambiguity
  const ownerIds = [...new Set(items.map((i) => i.user_id))];
  let profiles = [];
  if (ownerIds.length) {
    const { data: p1, error: e1 } = await supabase
      .from('profiles').select('id, nombre, apellido, lat, lng, avatar_url').in('id', ownerIds);
    if (e1) {
      // avatar_url column may not exist yet — fallback without it
      const { data: p2 } = await supabase
        .from('profiles').select('id, nombre, apellido, lat, lng').in('id', ownerIds);
      profiles = p2 ?? [];
    } else {
      profiles = p1 ?? [];
    }
  }
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const annotated = items.map((item) => {
    const todayRes = (item.reservations ?? []).filter(
      (r) => r.date === todayStr && r.status === 'confirmed'
    );
    const activeNow = todayRes.find((r) => r.time_from <= nowTime && r.time_to > nowTime) ?? null;
    const nextBusy = todayRes
      .filter((r) => r.time_from > nowTime)
      .sort((a, b) => a.time_from.localeCompare(b.time_from))[0] ?? null;
    return {
      ...item,
      owner: profileMap[item.user_id] ?? null,
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

export async function syncAvatarUrl() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const avatarUrl = user.user_metadata?.avatar_url;
  if (!avatarUrl) return;
  await supabase
    .from('profiles')
    .upsert({ id: user.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() });
}

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({ scheme: 'orbitapp', path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
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

export async function createMPPreference({ itemId, itemName, price, borrowerId }) {
  const { data, error } = await supabase.functions.invoke('reate-mp-preference', {
    body: { itemId, itemName, price, borrowerId },
  });
  if (error) return { error: error.message };
  return data;
}

export async function fetchActiveTransactions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  const result = await supabase
    .from('reservations')
    .select('*, item:item_id(name, icon), owner:owner_id(nombre, apellido), borrower:borrower_id(nombre, apellido)')
    .eq('status', 'confirmed')
    .or(`and(owner_id.eq.${user.id},owner_reviewed.eq.false),and(borrower_id.eq.${user.id},borrower_reviewed.eq.false)`)
    .order('date', { ascending: true });
  if (result.data) {
    result.data = result.data.map(r => ({ ...r, isOwner: r.owner_id === user.id }));
  }
  return result;
}

export async function markOwnerReviewed(reservationId) {
  return supabase.from('reservations').update({ owner_reviewed: true }).eq('id', reservationId);
}

export async function markBorrowerReviewed(reservationId) {
  return supabase.from('reservations').update({ borrower_reviewed: true }).eq('id', reservationId);
}

export async function submitReview({ reservationId, reviewedUserId, rating, comment }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('No autenticado') };
  return supabase
    .from('reviews')
    .insert({ reservation_id: reservationId, reviewer_id: user.id, reviewed_user_id: reviewedUserId, rating, comment: comment || null })
    .select()
    .single();
}

export async function addPoints(delta) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc('add_points', { p_user_id: user.id, delta });
}

export async function fetchUserReviews(userId) {
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, reviewer_id')
    .eq('reviewed_user_id', userId)
    .order('created_at', { ascending: false });

  if (!reviews?.length) return { data: [], error };

  const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nombre, apellido')
    .in('id', reviewerIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  return {
    data: reviews.map((r) => ({ ...r, reviewer: profileMap[r.reviewer_id] ?? null })),
    error,
  };
}

export async function fetchItemStats(itemId) {
  const { data, error } = await supabase
    .from('reservations')
    .select('time_from, time_to')
    .eq('item_id', itemId)
    .eq('status', 'confirmed');

  if (error || !data?.length) return { uses: 0, totalMinutes: 0 };

  const uses = data.length;
  const totalMinutes = data.reduce((sum, r) => {
    const [fh, fm] = r.time_from.split(':').map(Number);
    const [th, tm] = r.time_to.split(':').map(Number);
    return sum + (th * 60 + tm) - (fh * 60 + fm);
  }, 0);

  return { uses, totalMinutes };
}

export async function fetchItemReviews(itemId) {
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id')
    .eq('item_id', itemId)
    .eq('status', 'confirmed');

  if (!reservations?.length) return { data: [], error: null };

  const reservationIds = reservations.map((r) => r.id);
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, reviewer_id')
    .in('reservation_id', reservationIds)
    .order('created_at', { ascending: false });

  if (!reviews?.length) return { data: [], error };

  const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nombre, apellido')
    .in('id', reviewerIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  return {
    data: reviews.map((r) => ({ ...r, reviewer: profileMap[r.reviewer_id] ?? null })),
    error,
  };
}

export async function ensureReferralCode() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('referral_code, nombre')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.referral_code) return profile.referral_code;
  const namePart = (profile?.nombre ?? 'USR')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const idPart = user.id.replace(/-/g, '').slice(0, 4).toUpperCase();
  const code = `${namePart}${idPart}`;
  await supabase.from('profiles').update({ referral_code: code }).eq('id', user.id);
  return code;
}

export async function fetchReferralStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { sent: 0, completed: 0 };
  const { data, error } = await supabase
    .from('referrals')
    .select('completed')
    .eq('referrer_id', user.id);
  if (error) return { sent: 0, completed: 0 };
  const sent = data?.length ?? 0;
  const completed = data?.filter((r) => r.completed).length ?? 0;
  return { sent, completed };
}

export async function fetchMyAverageRating() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('reviews')
    .select('rating')
    .eq('reviewed_user_id', user.id);
  if (!data?.length) return null;
  const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
  return Math.round(avg * 10) / 10;
}

export async function fetchMonthlyEarnings() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const { data } = await supabase
    .from('reservations')
    .select('item:item_id(price)')
    .eq('owner_id', user.id)
    .eq('status', 'confirmed')
    .eq('transaction_status', 'completed')
    .gte('date', firstDay);
  if (!data?.length) return 0;
  return data.reduce((sum, r) => {
    const match = r.item?.price?.match(/\$?(\d+)/);
    return sum + (match ? parseInt(match[1], 10) : 0);
  }, 0);
}

export async function fetchCompletedTransactions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  const result = await supabase
    .from('reservations')
    .select('*, item:item_id(name, icon), owner:owner_id(nombre, apellido), borrower:borrower_id(nombre, apellido)')
    .eq('status', 'confirmed')
    .eq('transaction_status', 'completed')
    .or(`owner_id.eq.${user.id},borrower_id.eq.${user.id}`)
    .order('date', { ascending: false });
  if (result.data) {
    result.data = result.data.map(r => ({ ...r, isOwner: r.owner_id === user.id }));
  }
  return result;
}

export async function advanceTransactionStatus(reservationId, status) {
  const result = await supabase
    .from('reservations')
    .update({ transaction_status: status })
    .eq('id', reservationId)
    .select('*, item:item_id(name, icon), owner:owner_id(nombre, apellido), borrower:borrower_id(nombre, apellido)')
    .single();

  if (status === 'completed' && result.data?.borrower_id) {
    await supabase.rpc('complete_referral', { p_referred_id: result.data.borrower_id });
  }

  return result;
}

export async function reportProblem(reservationId, description) {
  return supabase
    .from('reservations')
    .update({ problem_description: description })
    .eq('id', reservationId);
}

export async function fetchRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  const { data: reqs, error } = await supabase
    .from('requests')
    .select('id, user_id, description, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (!reqs) return { data: [], error };
  const userIds = [...new Set(reqs.map((r) => r.user_id))];
  let profiles = [];
  if (userIds.length) {
    const { data: p } = await supabase
      .from('profiles')
      .select('id, nombre, apellido')
      .in('id', userIds);
    profiles = p ?? [];
  }
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  return {
    data: reqs.map((r) => ({
      ...r,
      requester: profileMap[r.user_id] ?? null,
      isOwn: r.user_id === user.id,
    })),
    error,
  };
}

export async function createRequest(description) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('No autenticado') };
  return supabase
    .from('requests')
    .insert({ user_id: user.id, description })
    .select()
    .single();
}

export async function deleteRequest(id) {
  return supabase.from('requests').update({ active: false }).eq('id', id);
}

export async function countPendingOffers(requestId) {
  const { count, error } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('request_id', requestId)
    .eq('offer_status', 'pending');
  return { count: count ?? 0, error };
}

export async function fetchOffersForRequests(requestIds) {
  if (!requestIds.length) return { data: [], error: null };
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('id, request_id, owner_id, offer_status, messages(content, type, created_at)')
    .in('request_id', requestIds)
    .eq('offer_status', 'pending');
  if (!convs) return { data: [], error };
  const offererIds = [...new Set(convs.map((c) => c.owner_id))];
  let profiles = [];
  if (offererIds.length) {
    const { data: p } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, avatar_url, lat, lng')
      .in('id', offererIds);
    profiles = p ?? [];
  }
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  return { data: convs.map((c) => ({ ...c, offerer: profileMap[c.owner_id] ?? null })), error: null };
}

export async function acceptOffer(conversationId, requestId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error('No autenticado') };
  const { data: otherConvs } = await supabase
    .from('conversations')
    .select('id')
    .eq('request_id', requestId)
    .neq('id', conversationId)
    .eq('offer_status', 'pending');
  for (const conv of (otherConvs ?? [])) {
    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: user.id,
      content: '¡El vecino ya consiguió lo que buscaba! Gracias por ofrecer 🎉',
      type: 'system',
    });
    await supabase.from('conversations').update({ offer_status: 'declined' }).eq('id', conv.id);
  }
  await supabase.from('conversations').update({ offer_status: 'accepted' }).eq('id', conversationId);
  await supabase.from('requests').update({ active: false }).eq('id', requestId);
  return { error: null };
}

export async function declineOffer(conversationId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error('No autenticado') };
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: 'Gracias por ofrecer, por ahora voy a seguir buscando.',
    type: 'text',
  });
  const { error } = await supabase
    .from('conversations')
    .update({ offer_status: 'declined' })
    .eq('id', conversationId);
  return { error };
}

export async function createRequestConversation(requestId, requesterId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('No autenticado') };

  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('request_id', requestId)
    .eq('owner_id', user.id)
    .eq('borrower_id', requesterId)
    .maybeSingle();

  if (existing) return { data: existing, error: null };

  return supabase
    .from('conversations')
    .insert({ request_id: requestId, owner_id: user.id, borrower_id: requesterId })
    .select()
    .single();
}

export async function uploadMessageImage(localUri) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { url: null, error: new Error('No autenticado') };

  const ext = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const filename = `messages/${session.user.id}/${Date.now()}.${ext}`;

  const formData = new FormData();
  formData.append('file', { uri: localUri, name: filename.split('/').pop(), type: mime });

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/item-images/${filename}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const body = await response.text();
    return { url: null, error: new Error(body) };
  }

  const { data } = supabase.storage.from('item-images').getPublicUrl(filename);
  return { url: data.publicUrl, error: null };
}

export async function uploadItemImage(localUri) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { url: null, error: new Error('No autenticado') };

  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const filename = `${session.user.id}/${Date.now()}.${ext}`;

  const formData = new FormData();
  formData.append('file', { uri: localUri, name: filename.split('/').pop(), type: mime });

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/item-images/${filename}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const body = await response.text();
    return { url: null, error: new Error(body) };
  }

  const { data } = supabase.storage.from('item-images').getPublicUrl(filename);
  return { url: data.publicUrl, error: null };
}
