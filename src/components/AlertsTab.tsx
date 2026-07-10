import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, LayoutAnimation, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import {
  acceptReservation,
  deleteConversation,
  deleteNotification,
  fetchConversations,
  fetchNotifications,
  fetchReservations,
  fetchUserReviews,
  markNotificationRead,
  rejectReservation,
  sendMessage,
  supabase,
} from '../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';
const GREEN = '#10B981';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDayShort(dateStr: string): string {
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === todayStr) return 'Hoy';
  if (dateStr === tomorrowStr) return 'Mañana';
  const d = new Date(dateStr + 'T12:00:00');
  const weekday = d.toLocaleDateString('es-AR', { weekday: 'long' });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function formatReservationRange(res: any): string {
  if (!res?.date) return '';
  const label = formatDayShort(res.date);
  const isDaily = res.time_to === '23:59';
  if (isDaily) {
    const nextDay = new Date(res.date + 'T12:00:00');
    nextDay.setDate(nextDay.getDate() + 1);
    const nextLabel = formatDayShort(nextDay.toISOString().split('T')[0]);
    return `${label} ${res.time_from} → ${nextLabel} ${res.time_from}`;
  }
  return `${label} · ${res.time_from} – ${res.time_to}`;
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function getWeekDays(base: Date): Date[] {
  const day = base.getDay(); // 0 = Sunday
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

const MONTH_ES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const today = new Date();
const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

const LEND_COLOR    = GREEN;        // prestás → verde
const BORROW_COLOR  = '#3B82F6';    // te prestan → azul

type EventType = 'lending' | 'borrowing';
type DeliveryMethod = 'porteria' | 'espacio_comun' | 'envio' | 'retiro';

type CalEvent = {
  date: Date;
  name: string;
  initial: string;
  item: string;
  from: string;
  to: string;
  type: EventType;
  delivery: DeliveryMethod;
  chatId: string;
  includes?: string[];
  programs?: string[];
  note?: string;
  completed?: boolean;
};


function eventColor(type: EventType) {
  return type === 'lending' ? LEND_COLOR : BORROW_COLOR;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BorrowerProfileModal({ borrowerId, name, initial, currentUserId, onClose }: {
  borrowerId: string;
  name: string;
  initial: string;
  currentUserId: string | null;
  onClose: () => void;
}) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [hasHistory, setHasHistory] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: revs }, histResult] = await Promise.all([
        fetchUserReviews(borrowerId),
        currentUserId
          ? supabase.from('reservations').select('id').eq('borrower_id', borrowerId).eq('owner_id', currentUserId).eq('status', 'confirmed').limit(1)
          : Promise.resolve({ data: [] }),
      ]);
      setReviews(revs ?? []);
      setHasHistory(((histResult as any).data?.length ?? 0) > 0);
      setLoading(false);
    }
    load();
  }, [borrowerId, currentUserId]);

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
    : null;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose} />
      <View style={s.modalSheet}>
        <View style={s.modalHandle} />

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Feather name="x" size={20} color={GRAY} />
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <View style={s.borrowerAvatar}>
            <Text style={s.borrowerAvatarText}>{initial}</Text>
          </View>
          <Text style={s.borrowerName}>{name}</Text>

          {hasHistory && (
            <View style={s.historyBadge}>
              <Feather name="repeat" size={12} color={GREEN} />
              <Text style={s.historyBadgeText}>Ya reservaron juntos antes</Text>
            </View>
          )}

          {avgRating !== null && (
            <View style={s.ratingRow}>
              <Feather name="star" size={14} color="#F59E0B" />
              <Text style={s.ratingText}>{avgRating.toFixed(1)}</Text>
              <Text style={s.ratingCount}>({reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'})</Text>
            </View>
          )}
        </View>

        {loading && <ActivityIndicator color={PURPLE} style={{ marginVertical: 12 }} />}

        {!loading && reviews.length === 0 && (
          <Text style={{ color: BODY, fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
            Todavía no tiene reseñas
          </Text>
        )}

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
          {reviews.map((r, i) => (
            <View key={r.id} style={[s.reviewRow, i > 0 && s.reviewRowBorder]}>
              <View style={s.reviewHeader}>
                <Text style={s.reviewerName}>
                  {r.reviewer ? `${r.reviewer.nombre} ${r.reviewer.apellido ?? ''}`.trim() : 'Vecino'}
                </Text>
                <View style={s.reviewStars}>
                  {Array.from({ length: 5 }, (_, si) => (
                    <Feather key={si} name="star" size={11} color={si < (r.rating ?? 0) ? '#F59E0B' : BODY} />
                  ))}
                </View>
              </View>
              {r.comment ? <Text style={s.reviewComment}>{r.comment}</Text> : null}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function NotifsSection() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [borrowerModal, setBorrowerModal] = useState<{ borrowerId: string; name: string; initial: string } | null>(null);
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    const { data } = await fetchNotifications();
    setNotifs(data ?? []);
    setLoading(false);
  }, []);

  const handleDelete = async (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id);
  };

  const renderRightActions = (id: string) => {
    return (
      <TouchableOpacity onPress={() => handleDelete(id)} activeOpacity={0.8} style={s.swipeDeleteWrap}>
        <View style={s.swipeDelete}>
          <Feather name="trash-2" size={22} color="#FFF" />
        </View>
      </TouchableOpacity>
    );
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAccept = async (notif: any) => {
    const res = notif.reservation;
    if (!res) return;
    setActioningId(notif.id);
    const { data: updated, error } = await acceptReservation(res.id);
    if (error) {
      Alert.alert('Error', 'No se pudo confirmar la reserva.');
      setActioningId(null);
      return;
    }
    if (updated?.conversation_id) {
      const itemName = res.item?.name ?? 'el ítem';
      const msg = `✅ Reserva confirmada\n${itemName} · ${res.date} · ${res.time_from} – ${res.time_to}${res.program ? `\nPrograma: ${res.program}` : ''}\n\nCoordiná la entrega por este chat.`;
      await sendMessage(updated.conversation_id, msg, 'text');
    }
    await markNotificationRead(notif.id);
    setActioningId(null);
    await load();
    if (updated?.conversation_id) {
      router.push({ pathname: '/chat', params: { id: updated.conversation_id } });
    }
  };

  const handleReject = async (notif: any) => {
    const res = notif.reservation;
    if (!res) return;
    setActioningId(notif.id);
    await rejectReservation(res.id);
    await markNotificationRead(notif.id);
    setActioningId(null);
    load();
  };

  const notifMeta = (n: any): { icon: any; color: string } => {
    const isPending = n.reservation?.status === 'pending';
    if (isPending) return { icon: 'clock', color: '#F59E0B' };
    if (n.title?.includes('confirmada') || n.title?.includes('confirmado')) return { icon: 'check-circle', color: GREEN };
    if (n.title?.includes('rechazada') || n.title?.includes('rechazado')) return { icon: 'x-circle', color: '#F87171' };
    return { icon: 'bell', color: PURPLE };
  };

  return (
    <>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
      {loading && <ActivityIndicator color={PURPLE} style={{ marginTop: 32 }} />}

      {!loading && notifs.length === 0 && (
        <View style={s.emptyChats}>
          <Feather name="bell" size={28} color={BODY} />
          <Text style={s.emptyText}>No tenés notificaciones{'\n'}por ahora</Text>
        </View>
      )}

      {notifs.map((n) => {
        const res = n.reservation;
        const isPending = res?.status === 'pending';
        const isActioning = actioningId === n.id;
        const { icon, color } = notifMeta(n);
        const borrowerName = res?.borrower
          ? `${res.borrower.nombre ?? ''} ${res.borrower.apellido ?? ''}`.trim()
          : null;
        const borrowerInitial = res?.borrower?.nombre?.[0]?.toUpperCase() ?? 'V';
        const dateRange = formatReservationRange(res);

        return (
          <View key={n.id} style={{ overflow: 'hidden', borderRadius: 16, marginBottom: 10 }}>
          <Swipeable
            ref={(ref) => { swipeableRefs.current[n.id] = ref; }}
            renderRightActions={isPending ? undefined : () => renderRightActions(n.id)}
            rightThreshold={60}
            enabled={!isPending}
          >
          <View style={[s.notifCard, !n.read && s.notifCardUnread, isPending && s.notifCardPending]}>
            <View style={[s.notifIconWrap, { backgroundColor: `${color}20` }]}>
              <Feather name={icon} size={18} color={color} />
            </View>

            <View style={{ flex: 1, gap: 5 }}>
              {isPending && borrowerName ? (
                <>
                  <View style={s.notifTopRow}>
                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                      <TouchableOpacity
                        onPress={() => setBorrowerModal({ borrowerId: res.borrower_id, name: borrowerName, initial: borrowerInitial })}
                        activeOpacity={0.7}
                      >
                        <Text style={s.notifBorrowerLink}>{borrowerName}</Text>
                      </TouchableOpacity>
                      <Text style={s.notifBorrowerSuffix}>quiere reservar tu ítem</Text>
                    </View>
                    {!n.read && <View style={[s.unreadDot, { backgroundColor: '#F59E0B' }]} />}
                  </View>
                  <Text style={s.notifItemName}>{res.item?.name}</Text>
                  {dateRange ? (
                    <View style={s.notifResRow}>
                      <Feather name="clock" size={11} color={BODY} />
                      <Text style={s.notifResText}>{dateRange}</Text>
                      {res.program ? (
                        <View style={s.notifResPill}><Text style={s.notifResProg}>{res.program}</Text></View>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={s.notifTopRow}>
                    <Text style={s.notifTitle}>{n.title}</Text>
                    {!n.read && <View style={s.unreadDot} />}
                  </View>
                  <Text style={s.notifBody}>{n.body}</Text>
                  {res && dateRange ? (
                    <View style={s.notifResRow}>
                      <Feather name="calendar" size={11} color={BODY} />
                      <Text style={s.notifResText}>{dateRange}</Text>
                      {res.program ? (
                        <View style={s.notifResPill}><Text style={s.notifResProg}>{res.program}</Text></View>
                      ) : null}
                    </View>
                  ) : null}
                </>
              )}

              <Text style={s.notifTime}>{relativeTime(n.created_at)}</Text>

              {isPending && (
                <View style={s.notifActions}>
                  <TouchableOpacity
                    style={s.notifBtnReject}
                    onPress={() => handleReject(n)}
                    disabled={isActioning}
                    activeOpacity={0.75}
                  >
                    <Feather name="x" size={14} color="#F87171" />
                    <Text style={s.notifBtnRejectText}>Rechazar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.notifBtnAcceptWrap}
                    onPress={() => handleAccept(n)}
                    disabled={isActioning}
                    activeOpacity={0.85}
                  >
                    {isActioning ? (
                      <View style={s.notifBtnAcceptLoading}>
                        <ActivityIndicator color="#FFF" size="small" />
                      </View>
                    ) : (
                      <LinearGradient
                        colors={['#059669', '#10B981']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.notifBtnAccept}
                      >
                        <Feather name="check" size={14} color="#FFF" />
                        <Text style={s.notifBtnAcceptText}>Aceptar</Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          </Swipeable>
          </View>
        );
      })}

      <View style={{ height: 24 }} />
    </ScrollView>

    {borrowerModal && (
      <BorrowerProfileModal
        borrowerId={borrowerModal.borrowerId}
        name={borrowerModal.name}
        initial={borrowerModal.initial}
        currentUserId={currentUserId}
        onClose={() => setBorrowerModal(null)}
      />
    )}
    </>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export function ChatsSection({ onUnreadCount }: { onUnreadCount?: (n: number) => void }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  const load = useCallback(async () => {
    const [{ data: { user } }, { data: convs }] = await Promise.all([
      supabase.auth.getUser(),
      fetchConversations(),
    ]);
    const uid = user?.id ?? null;
    setUserId(uid);
    const list = convs ?? [];
    setConversations(list);
    setLoading(false);
    if (onUnreadCount && uid) {
      const total = list.reduce((sum: number, c: any) =>
        sum + (c.messages ?? []).filter((m: any) => !m.read && m.sender_id !== uid).length, 0);
      onUnreadCount(total);
    }
  }, [onUnreadCount]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const getOther = (conv: any) => {
    if (!userId) return { name: '…', initial: '?', avatarUrl: null };
    const p = conv.owner_id === userId ? conv.borrower : conv.owner;
    return {
      name: `${p?.nombre ?? ''} ${p?.apellido ?? ''}`.trim() || 'Vecino',
      initial: p?.nombre?.[0]?.toUpperCase() ?? 'V',
      avatarUrl: p?.avatar_url ?? null,
    };
  };

  const getUnread = (conv: any) =>
    (conv.messages ?? []).filter((m: any) => !m.read && m.sender_id !== userId).length;

  const getLastMsg = (conv: any) => {
    const msgs = conv.messages ?? [];
    return msgs[msgs.length - 1] ?? null;
  };

  const isClosed = (conv: any) =>
    (conv.reservations ?? []).some((r: any) => r.transaction_status === 'completed');

  const handleDelete = async (convId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== convId);
      if (onUnreadCount && userId) {
        const total = next.reduce((sum: number, c: any) =>
          sum + (c.messages ?? []).filter((m: any) => !m.read && m.sender_id !== userId).length, 0);
        onUnreadCount(total);
      }
      return next;
    });
    await deleteConversation(convId);
  };

  const renderRightActions = (convId: string, closed: boolean) => (
    <TouchableOpacity
      onPress={() => {
        if (!closed) {
          swipeableRefs.current[convId]?.close();
          Alert.alert(
            'No podés borrar esta conversación',
            'Solo podés eliminar chats cuya transacción haya finalizado. Esperá a que se complete el intercambio.',
            [{ text: 'Entendido' }]
          );
          return;
        }
        handleDelete(convId);
      }}
      activeOpacity={0.8}
      style={s.swipeDeleteWrap}
    >
      <View style={s.swipeDelete}>
        <Feather name="trash-2" size={22} color="#FFF" />
      </View>
    </TouchableOpacity>
  );

  const q = search.trim().toLowerCase();
  const filtered = q
    ? conversations.filter((conv) => {
        const other = getOther(conv);
        return (
          other.name.toLowerCase().includes(q) ||
          (conv.item?.name ?? '').toLowerCase().includes(q)
        );
      })
    : conversations;

  return (
    <View style={{ flex: 1 }}>
      {/* Search bar */}
      <View style={s.chatSearchWrap}>
        <Feather name="search" size={15} color={BODY} />
        <TextInput
          style={s.chatSearchInput}
          placeholder="Buscar por nombre o producto…"
          placeholderTextColor={BODY}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Feather name="x" size={15} color={BODY} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
        <Text style={s.sectionLabel}>CONVERSACIONES</Text>

        {loading ? (
          <ActivityIndicator color={PURPLE} style={{ marginTop: 16 }} />
        ) : (
          filtered.map((conv) => {
            const other = getOther(conv);
            const unread = getUnread(conv);
            const lastMsg = getLastMsg(conv);
            const lastText = lastMsg?.content ?? '';
            const timeStr = lastMsg?.created_at ? relativeTime(lastMsg.created_at) : '';
            const closed = isClosed(conv);

            return (
              <View key={conv.id} style={{ overflow: 'hidden', borderRadius: 16, marginBottom: 10 }}>
                <Swipeable
                  ref={(ref) => { swipeableRefs.current[conv.id] = ref; }}
                  renderRightActions={() => renderRightActions(conv.id, closed)}
                  rightThreshold={60}
                >
                  <TouchableOpacity
                    style={s.chatCard}
                    activeOpacity={0.75}
                    onPress={() => router.push({ pathname: '/chat', params: { id: conv.id } })}
                  >
                    <View style={s.chatAvatar}>
                      {other.avatarUrl ? (
                        <Image source={{ uri: other.avatarUrl }} style={s.chatAvatarImg} />
                      ) : (
                        <Text style={s.chatAvatarText}>{other.initial}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.chatTopRow}>
                        <Text style={s.chatName}>{other.name}</Text>
                        {timeStr ? <Text style={s.chatTime}>{timeStr}</Text> : null}
                      </View>
                      <Text style={s.chatItem}>{conv.item?.name ?? 'Ítem'}</Text>
                      {lastText ? (
                        <Text style={s.chatLast} numberOfLines={1}>{lastText}</Text>
                      ) : (
                        <Text style={[s.chatLast, { color: BODY, fontStyle: 'italic' }]}>Nueva conversación</Text>
                      )}
                    </View>
                    {unread > 0 && (
                      <View style={s.unreadBadge}>
                        <Text style={s.unreadBadgeText}>{unread}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </Swipeable>
              </View>
            );
          })
        )}

        {!loading && filtered.length === 0 && (
          <View style={s.emptyChats}>
            <Feather name="message-circle" size={28} color={BODY} />
            <Text style={s.emptyText}>
              {q ? 'Sin resultados' : 'Las nuevas conversaciones\naparecerán aquí'}
            </Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const DELIVERY_INFO: Record<DeliveryMethod, { icon: string; label: string; sub: string }> = {
  porteria:      { icon: 'inbox',    label: 'Portería del edificio', sub: 'Dejar/retirar en recepción' },
  espacio_comun: { icon: 'users',    label: 'Espacio común',         sub: 'SUM, hall u otro lugar compartido' },
  envio:         { icon: 'truck',    label: 'Envío a domicilio',     sub: 'Rappi / Uber Envíos' },
  retiro:        { icon: 'package',  label: 'Retiro en persona',     sub: 'Coordinar dirección con el dueño' },
};

function EventDetailModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const color = eventColor(event.type);
  const label = event.type === 'lending' ? 'Prestás' : 'Te prestan';
  const dateStr = `${event.date.getDate()} de ${MONTH_ES[event.date.getMonth()]}`;
  const delivery = DELIVERY_INFO[event.delivery];

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose} />
      <View style={s.modalSheet}>
        {/* Handle */}
        <View style={s.modalHandle} />

        {/* Scrollable content */}
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

          {/* Type pill + close */}
          <View style={s.modalHeader}>
            <View style={[s.modalTypePill, { backgroundColor: `${color}22` }]}>
              <View style={[s.modalTypeDot, { backgroundColor: color }]} />
              <Text style={[s.modalTypeText, { color }]}>{label}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={GRAY} />
            </TouchableOpacity>
          </View>

          {/* Item name */}
          <Text style={s.modalItem}>{event.item}</Text>

          {/* Person row */}
          <View style={s.modalPersonRow}>
            <View style={[s.modalAvatar, { borderColor: color }]}>
              <Text style={[s.modalAvatarText, { color }]}>{event.initial}</Text>
            </View>
            <View>
              <Text style={s.modalPersonLabel}>
                {event.type === 'lending' ? 'Alquilado por' : 'Dueño del ítem'}
              </Text>
              <Text style={s.modalPersonName}>{event.name}</Text>
            </View>
          </View>

          {/* Date / time / status */}
          <View style={s.modalInfoRow}>
            <View style={s.modalInfoCell}>
              <Feather name="calendar" size={14} color={BODY} />
              <Text style={s.modalInfoLabel}>Fecha</Text>
              <Text style={s.modalInfoValue}>{dateStr}</Text>
            </View>
            <View style={s.modalInfoDivider} />
            <View style={s.modalInfoCell}>
              <Feather name="clock" size={14} color={BODY} />
              <Text style={s.modalInfoLabel}>Horario</Text>
              <Text style={s.modalInfoValue}>{event.from} – {event.to}</Text>
            </View>
            <View style={s.modalInfoDivider} />
            <View style={s.modalInfoCell}>
              <Feather name={event.completed ? 'check-circle' : 'check-circle'} size={14} color={event.completed ? BODY : GREEN} />
              <Text style={s.modalInfoLabel}>Estado</Text>
              <Text style={[s.modalInfoValue, { color: event.completed ? BODY : GREEN }]}>{event.completed ? 'Completado' : 'Confirmado'}</Text>
            </View>
          </View>

          {/* Includes / programs */}
          {((event.includes?.length ?? 0) > 0 || (event.programs?.length ?? 0) > 0) && (
            <View style={s.modalSection}>
              <Text style={s.modalSectionTitle}>DETALLES DEL ÍTEM</Text>
              <View style={s.modalDetailCard}>
                {event.includes?.map((inc, i) => (
                  <View key={i} style={[s.modalDetailRow, i > 0 && s.modalDetailRowBorder]}>
                    <Feather name="check" size={14} color={GREEN} />
                    <Text style={s.modalDetailText}>{inc}</Text>
                  </View>
                ))}
                {event.programs && event.programs.length > 0 && (
                  <View style={[s.modalDetailRow, (event.includes?.length ?? 0) > 0 && s.modalDetailRowBorder]}>
                    <Feather name="sliders" size={14} color={PURPLE} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.modalDetailLabel}>Programas disponibles</Text>
                      <View style={s.modalChipRow}>
                        {event.programs.map((p) => (
                          <View key={p} style={s.modalChip}>
                            <Text style={s.modalChipText}>{p}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Delivery method */}
          <View style={s.modalSection}>
            <Text style={s.modalSectionTitle}>MÉTODO DE ENTREGA</Text>
            <View style={s.modalDeliveryCard}>
              <View style={s.modalDeliveryIcon}>
                <Feather name={delivery.icon as any} size={20} color={PURPLE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.modalDeliveryLabel}>{delivery.label}</Text>
                <Text style={s.modalDeliverySub}>{delivery.sub}</Text>
              </View>
            </View>
          </View>

          {/* Note from other party */}
          {event.note && (
            <View style={s.modalSection}>
              <Text style={s.modalSectionTitle}>MENSAJE DE {event.name.split(' ')[0].toUpperCase()}</Text>
              <View style={s.modalNoteCard}>
                <Feather name="message-square" size={14} color={BODY} style={{ marginTop: 1 }} />
                <Text style={s.modalNoteText}>{event.note}</Text>
              </View>
            </View>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>

        {/* Actions — always visible outside scroll */}
        <View style={[s.modalActions, { paddingTop: 16 }]}>
          <TouchableOpacity style={s.modalBtnCancel} activeOpacity={0.75}>
            <Feather name="x-circle" size={16} color="#F87171" />
            <Text style={s.modalBtnCancelText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.modalBtnEdit} activeOpacity={0.75}>
            <Feather name="edit-2" size={16} color={GRAY} />
            <Text style={s.modalBtnEditText}>Modificar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.modalBtnChatWrap}
            activeOpacity={0.85}
            onPress={() => { onClose(); router.push({ pathname: '/chat', params: { id: event.chatId } }); }}
          >
            <LinearGradient
              colors={['#7C3AED', '#3B82F6']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.modalBtnChat}
            >
              <Feather name="message-circle" size={16} color="#FFF" />
              <Text style={s.modalBtnChatText}>Chatear</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function mapReservationToEvent(res: any, userId: string): CalEvent {
  const isOwner = res.owner_id === userId;
  const other = isOwner ? res.borrower : res.owner;
  const name = `${other?.nombre ?? ''} ${other?.apellido ?? ''}`.trim() || 'Vecino';
  const [year, month, day] = (res.date as string).split('-').map(Number);
  return {
    date: new Date(year, month - 1, day),
    name,
    initial: other?.nombre?.[0]?.toUpperCase() ?? 'V',
    item: res.item?.name ?? 'Ítem',
    from: res.time_from,
    to: res.time_to,
    type: isOwner ? 'lending' : 'borrowing',
    delivery: res.delivery_method as DeliveryMethod,
    chatId: res.conversation_id,
    programs: res.program ? [res.program] : [],
    completed: res.transaction_status === 'completed',
  };
}

function CalendarSection() {
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeEvent, setActiveEvent] = useState<CalEvent | null>(null);
  const [weekBase, setWeekBase] = useState(today);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      setUserId(uid);
      const { data } = await fetchReservations();
      if (data && uid) {
        setEvents(data.map((r: any) => mapReservationToEvent(r, uid)));
      }
    }
    load();
  }, []);

  const week = getWeekDays(weekBase);
  const monthLabel = `${MONTH_ES[week[0].getMonth()]} ${week[0].getFullYear()}`;

  const dayEvents = events.filter((e) => sameDay(e.date, selectedDate));

  const prevWeek = () => {
    const d = new Date(weekBase);
    d.setDate(weekBase.getDate() - 7);
    setWeekBase(d);
  };
  const nextWeek = () => {
    const d = new Date(weekBase);
    d.setDate(weekBase.getDate() + 7);
    setWeekBase(d);
  };

  return (
    <>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
      {/* Month header */}
      <View style={s.calMonthRow}>
        <TouchableOpacity onPress={prevWeek} hitSlop={12}>
          <Feather name="chevron-left" size={20} color={GRAY} />
        </TouchableOpacity>
        <Text style={s.calMonthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={nextWeek} hitSlop={12}>
          <Feather name="chevron-right" size={20} color={GRAY} />
        </TouchableOpacity>
      </View>

      {/* Week strip */}
      <View style={s.weekStrip}>
        {week.map((d, i) => {
          const isSelected = sameDay(d, selectedDate);
          const isToday = sameDay(d, today);
          const isPast = !isToday && d < today;
          const hasEvent = events.some((e) => sameDay(e.date, d));
          return (
            <TouchableOpacity
              key={i}
              style={[s.dayCell, isSelected && s.dayCellSelected, isPast && s.dayCellPast]}
              activeOpacity={0.7}
              onPress={() => setSelectedDate(d)}
            >
              <Text style={[s.dayLabel, isSelected && s.dayLabelSelected, isPast && s.dayLabelPast]}>{DAY_LABELS[i]}</Text>
              <Text style={[s.dayNum, isToday && s.dayNumToday, isSelected && s.dayNumSelected, isPast && s.dayNumPast]}>
                {d.getDate()}
              </Text>
              <View style={[s.eventDot, hasEvent ? (isSelected ? s.eventDotSelected : s.eventDotVisible) : s.eventDotHidden]} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Events for selected day */}
      <Text style={s.sectionLabel}>
        {sameDay(selectedDate, today)
          ? 'HOY'
          : sameDay(selectedDate, tomorrow)
            ? 'MAÑANA'
            : `${selectedDate.getDate()} DE ${MONTH_ES[selectedDate.getMonth()].toUpperCase()}`}
      </Text>

      {/* Legend */}
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: LEND_COLOR }]} />
          <Text style={s.legendText}>Prestás</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: BORROW_COLOR }]} />
          <Text style={s.legendText}>Te prestan</Text>
        </View>
      </View>

      {dayEvents.length === 0 ? (
        <View style={s.noEvents}>
          <Feather name="calendar" size={26} color={BODY} />
          <Text style={s.noEventsText}>Sin reservas este día</Text>
        </View>
      ) : (
        dayEvents.map((ev, i) => {
          const color = ev.completed ? BODY : eventColor(ev.type);
          const label = ev.completed ? 'Completado' : ev.type === 'lending' ? 'Prestás' : 'Te prestan';
          return (
            <TouchableOpacity
              key={i}
              style={[s.eventCard, { borderLeftColor: color }, ev.completed && s.eventCardCompleted]}
              activeOpacity={0.75}
              onPress={() => setActiveEvent(ev)}
            >
              <View style={[s.eventStripe, { backgroundColor: color }]} />
              <View style={{ flex: 1, paddingLeft: 6 }}>
                <View style={s.eventTopRow}>
                  <Text style={[s.eventName, ev.completed && s.eventNameCompleted]}>{ev.name}</Text>
                  <View style={[s.eventTypePill, { backgroundColor: `${color}22` }]}>
                    <Text style={[s.eventTypeText, { color }]}>{label}</Text>
                  </View>
                </View>
                <Text style={s.eventItem}>{ev.item}</Text>
              </View>
              <View style={s.eventTime}>
                <Text style={[s.eventTimeText, { color }]}>{ev.from}</Text>
                <Text style={s.eventTimeSep}>–</Text>
                <Text style={[s.eventTimeText, { color }]}>{ev.to}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <View style={{ height: 24 }} />
    </ScrollView>

    {activeEvent && (
      <EventDetailModal event={activeEvent} onClose={() => setActiveEvent(null)} />
    )}
    </>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

type SubTab = 'notifs' | 'cal';

export default function AlertsTab() {
  const [sub, setSub] = useState<SubTab>('notifs');

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tab bar */}
      <View style={s.subBar}>
        {([
          { key: 'notifs', label: 'Notificaciones', badge: 0 },
          { key: 'cal',    label: 'Calendario',     badge: 0 },
        ] as { key: SubTab; label: string; badge: number }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.subTab, sub === t.key && s.subTabActive]}
            activeOpacity={0.7}
            onPress={() => setSub(t.key)}
          >
            <Text style={[s.subTabText, sub === t.key && s.subTabTextActive]}>{t.label}</Text>
            {t.badge > 0 && (
              <View style={s.subTabBadge}>
                <Text style={s.subTabBadgeText}>{t.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {sub === 'notifs' && <NotifsSection />}
      {sub === 'cal'    && <CalendarSection />}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 16 },

  subBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  subTabActive: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderColor: PURPLE,
  },
  subTabText: { fontFamily: 'Inter_500Medium', color: BODY, fontSize: 13 },
  subTabTextActive: { color: '#C4B5FD', fontFamily: 'Inter_600SemiBold' },
  subTabBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabBadgeText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 10 },

  // Notifications
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  notifCardUnread: {
    borderColor: 'rgba(139,92,246,0.3)',
    backgroundColor: 'rgba(139,92,246,0.07)',
  },
  notifCardPending: {
    borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.06)',
  },
  notifBorrowerLink: {
    fontFamily: 'Inter_700Bold',
    color: '#C4B5FD',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  notifBorrowerSuffix: {
    fontFamily: 'Inter_400Regular',
    color: GRAY,
    fontSize: 14,
  },
  notifItemName: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    fontSize: 14,
  },
  borrowerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderWidth: 2,
    borderColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  borrowerAvatarText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 26 },
  borrowerName: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 20, marginBottom: 6 },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    marginTop: 4,
    marginBottom: 4,
  },
  historyBadgeText: { fontFamily: 'Inter_500Medium', color: GREEN, fontSize: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  ratingText: { fontFamily: 'Inter_700Bold', color: '#F59E0B', fontSize: 14 },
  ratingCount: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
  reviewRow: { paddingVertical: 12 },
  reviewRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewerName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 13 },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13, lineHeight: 18 },
  notifResRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  notifResText: {
    fontFamily: 'Inter_500Medium',
    color: GRAY,
    fontSize: 12,
  },
  notifResPill: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  notifResProg: {
    fontFamily: 'Inter_500Medium',
    color: '#C4B5FD',
    fontSize: 11,
  },
  notifActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  notifBtnReject: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(248,113,113,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  notifBtnRejectText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#F87171',
    fontSize: 13,
  },
  notifBtnAcceptWrap: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  notifBtnAccept: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  notifBtnAcceptText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: 13,
  },
  notifBtnAcceptLoading: {
    height: 38,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  swipeDeleteWrap: {
    width: 80,
    paddingLeft: 8,
    alignSelf: 'stretch',
  },
  swipeDelete: {
    flex: 1,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifTitle: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14, flex: 1 },
  notifBody: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13, lineHeight: 18 },
  notifTime: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: PURPLE, marginLeft: 6, marginTop: 2,
  },

  // Chat search
  chatSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chatSearchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
    fontSize: 14,
    padding: 0,
  },

  // Chats
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    color: BODY,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chatAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 18 },
  chatAvatarImg: { width: 46, height: 46, borderRadius: 23 },
  chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  chatName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15 },
  chatTime: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  chatItem: { fontFamily: 'Inter_400Regular', color: PURPLE, fontSize: 12, marginBottom: 3 },
  chatLast: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13 },
  unreadBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center',
  },
  unreadBadgeText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 11 },
  emptyChats: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
    opacity: 0.5,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13,
    textAlign: 'center', lineHeight: 20,
  },

  // Calendar
  calMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calMonthLabel: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    fontSize: 16,
    textTransform: 'capitalize',
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dayCellSelected: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderColor: PURPLE,
  },
  dayCellPast: { opacity: 0.4 },
  dayLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
  dayLabelSelected: { color: '#C4B5FD' },
  dayLabelPast: { color: BODY },
  dayNum: { fontFamily: 'Inter_700Bold', color: GRAY, fontSize: 16 },
  dayNumToday: { color: PURPLE },
  dayNumSelected: { color: '#FFFFFF' },
  dayNumPast: { color: BODY },
  eventDot: {
    width: 5, height: 5, borderRadius: 3,
  },
  eventDotHidden: { backgroundColor: 'transparent' },
  eventDotVisible: { backgroundColor: PURPLE },
  eventDotSelected: { backgroundColor: '#FFFFFF' },
  noEvents: { alignItems: 'center', gap: 10, paddingVertical: 32, opacity: 0.5 },
  noEventsText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  eventStripe: {
    width: 4,
    height: '100%' as any,
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  eventTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  eventName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14, flex: 1 },
  eventTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  eventTypeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  eventCardCompleted: { opacity: 0.55 },
  eventNameCompleted: { color: GRAY },
  eventItem: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13, marginTop: 0 },
  eventTime: { alignItems: 'flex-end', gap: 1, marginLeft: 8 },
  eventTimeText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  eventTimeSep: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },

  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    backgroundColor: '#0F1128',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  modalTypeDot: { width: 7, height: 7, borderRadius: 4 },
  modalTypeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  modalItem: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 24,
    marginBottom: 20,
  },
  modalPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  modalAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(139,92,246,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  modalAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  modalPersonLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, marginBottom: 2 },
  modalPersonName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 16 },
  modalInfoRow: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    marginBottom: 28,
  },
  modalInfoCell: { flex: 1, alignItems: 'center', gap: 5 },
  modalInfoDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  modalInfoLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
  modalInfoValue: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 13, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtnCancel: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(248,113,113,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalBtnCancelText: { fontFamily: 'Inter_600SemiBold', color: '#F87171', fontSize: 14 },
  modalBtnEdit: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: CARD_BG,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalBtnEditText: { fontFamily: 'Inter_600SemiBold', color: GRAY, fontSize: 14 },
  modalBtnChatWrap: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  modalBtnChat: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalBtnChatText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 14 },

  modalSection: { marginBottom: 18 },
  modalSectionTitle: {
    fontFamily: 'Inter_700Bold', color: BODY,
    fontSize: 10, letterSpacing: 1.2, marginBottom: 8,
  },
  modalDetailCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalDetailRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  modalDetailText: { fontFamily: 'Inter_400Regular', color: '#FFFFFF', fontSize: 14, flex: 1 },
  modalDetailLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, marginBottom: 8 },
  modalChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modalChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)',
  },
  modalChipText: { fontFamily: 'Inter_500Medium', color: '#C4B5FD', fontSize: 12 },

  modalDeliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
  },
  modalDeliveryIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalDeliveryLabel: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14, marginBottom: 3 },
  modalDeliverySub: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },

  modalNoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
  },
  modalNoteText: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13, lineHeight: 19, flex: 1 },
});
