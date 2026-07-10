import { AntDesign, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkConflict, createNotification, createReservation, fetchConversation, fetchMessages, markMessagesRead, sendMessage, supabase } from '../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';
const GREEN = '#10B981';

const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Quick reply logic ────────────────────────────────────────────────────────

type QuickReply = { label: string; positive?: boolean };

function getQuickReplies(text: string): QuickReply[] {
  const t = text.toLowerCase();

  // Confirmar reserva (chequear ANTES que disponible)
  if (t.includes('reservamos') || t.includes('reservar') || t.includes('confirmamos') || t.includes('lo cerramos')) {
    return [
      { label: '¡Sí, reservemos! ✓', positive: true },
      { label: 'Perfecto, lo reservo ✓', positive: true },
      { label: 'Dame un momento' },
    ];
  }
  if (t.includes('disponible') || t.includes('libre') || t.includes('tenés') || t.includes('tenes')) {
    return [
      { label: 'Sí, está disponible ✓', positive: true },
      { label: 'No, en este momento no' },
      { label: '¿Para cuándo lo necesitás?' },
    ];
  }
  if (t.includes('entrega') || t.includes('coordino') || t.includes('busco') || t.includes('retiro') || t.includes('como lo')) {
    return [
      { label: 'Dejalo en portería 📦' },
      { label: 'Pasá a buscarlo vos' },
      { label: 'Lo coordinamos por acá ✓', positive: true },
    ];
  }
  if (t.includes('detergente') || t.includes('incluye') || t.includes('incluido') || t.includes('traigo')) {
    return [
      { label: 'Incluye detergente y suavizante ✓', positive: true },
      { label: 'No, traé el tuyo' },
      { label: 'Sí, incluye todo ✓', positive: true },
    ];
  }
  if (t.includes('precio') || t.includes('cuesta') || t.includes('cobra') || t.includes('cuánto') || t.includes('cuanto')) {
    return [
      { label: 'El precio está en la app' },
      { label: 'Incluye todo lo necesario' },
      { label: '¿Querés reservar?' },
    ];
  }
  if (t.includes('cuando') || t.includes('cuándo') || t.includes('horario') || t.includes('hora')) {
    return [
      { label: 'Hoy de 10 a 12 ✓', positive: true },
      { label: 'Mañana por la tarde' },
      { label: 'Esta semana no puedo' },
    ];
  }
  if (t.includes('programa') || t.includes('lavado') || t.includes('ciclo')) {
    return [
      { label: 'Los programas están en la app' },
      { label: 'Diario y Color disponibles ✓', positive: true },
      { label: '¿Cuál necesitás?' },
    ];
  }
  if ((t.includes('gracias') || t.includes('genial') || t.includes('perfecto') || t.includes('buenísimo')) && !t.includes('?')) {
    return [
      { label: '¡De nada! 😊' },
      { label: '¡Hasta pronto!' },
    ];
  }
  return [];
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

const MOCK: Record<string, { name: string; initial: string; item: string; msgs: any[] }> = {
  '1': {
    name: 'María González', initial: 'M', item: 'Lavarropas',
    msgs: [
      { id: '1', content: 'Hola! Vi tu lavarropas en la app, me interesa alquilarlo 😊', mine: true, created_at: 'ayer 14:10', type: 'text' },
      { id: '2', content: 'Hola! Con gusto. ¿Para cuándo lo necesitás?', mine: false, created_at: 'ayer 14:25', type: 'text' },
      { id: '3', content: '¿Qué programas tiene disponibles?', mine: true, created_at: 'ayer 14:28', type: 'text' },
      { id: '4', content: 'Diario, Color y Delicado. Incluye detergente y suavizante 🧴', mine: false, created_at: 'ayer 14:31', type: 'text' },
    ],
  },
  '2': {
    name: 'Carlos Rodríguez', initial: 'C', item: 'Escalera',
    msgs: [
      { id: '1', content: 'Hola Carlos, ¿la escalera está disponible el martes?', mine: true, created_at: 'ayer 18:30', type: 'text' },
      { id: '2', content: 'Sí, disponible. ¿Para cuánto tiempo?', mine: false, created_at: 'ayer 18:45', type: 'text' },
      { id: '3', content: 'Un par de horas, de 15 a 17.', mine: true, created_at: 'ayer 18:47', type: 'text' },
      { id: '4', content: '¿Cuándo venís a buscarlo?', mine: false, created_at: 'hace 3h', type: 'text' },
    ],
  },
};

// Auto-respuesta de María para el chat demo
function getMockAutoResponse(text: string): string | null {
  const t = text.toLowerCase();
  const hasAvail = t.includes('disponible') || t.includes('libre');
  const hasTime = t.includes('10') || t.includes('am') || t.includes('pm') || t.includes('hora') || t.includes('hoy') || t.includes('mañana');
  if (hasAvail && hasTime) {
    return 'Sí, disponible para las 10 am! ¿Lo reservamos? 🙌';
  }
  if (hasAvail) {
    return 'Sí, está disponible esta semana 😊 ¿Qué día te viene bien?';
  }
  return null;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Reservation confirm modal ────────────────────────────────────────────────

const PROGRAMS = ['Diario', 'Color', 'Delicado', 'Rápido'];
const DELIVERY = [
  { key: 'porteria',     label: 'Portería',      icon: 'inbox'   },
  { key: 'espacio',      label: 'Espacio común', icon: 'home'    },
  { key: 'rappi',        label: 'Rappi/Uber',    icon: 'package' },
  { key: 'mano',         label: 'En mano',       icon: 'user'    },
] as const;

type ConfirmDetails = { program: string; delivery: string; date: string; timeFrom: string; timeTo: string };

function ModalTime({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hh, mm] = value.split(':');
  return (
    <View style={rm.timeBlock}>
      <TextInput
        style={rm.timeDigit}
        value={hh}
        onChangeText={(t) => {
          const n = Math.min(23, parseInt(t.replace(/\D/g, '') || '0', 10));
          onChange(`${String(n).padStart(2, '0')}:${mm}`);
        }}
        keyboardType="numeric" maxLength={2} selectTextOnFocus
      />
      <Text style={rm.timeColon}>:</Text>
      <TextInput
        style={rm.timeDigit}
        value={mm}
        onChangeText={(t) => {
          const n = Math.min(59, parseInt(t.replace(/\D/g, '') || '0', 10));
          onChange(`${hh}:${String(n).padStart(2, '0')}`);
        }}
        keyboardType="numeric" maxLength={2} selectTextOnFocus
      />
    </View>
  );
}

function toDateStr(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function ReservationConfirmModal({
  visible, onClose, onConfirmed, itemId,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirmed: (details: ConfirmDetails) => void;
  itemId: string | null;
}) {
  const [dateOffset, setDateOffset] = useState(0); // 0=hoy, 1=mañana
  const [timeFrom, setTimeFrom] = useState('10:00');
  const [timeTo, setTimeTo]     = useState('12:00');
  const [program, setProgram]   = useState('Diario');
  const [delivery, setDelivery] = useState('porteria');
  const [confirming, setConfirming] = useState(false);
  const [conflictError, setConflictError] = useState('');

  const handleConfirm = async () => {
    setConflictError('');
    setConfirming(true);

    const dateStr = toDateStr(dateOffset);

    if (itemId) {
      const { conflict, slots } = await checkConflict(itemId, dateStr, timeFrom, timeTo);
      if (conflict) {
        const taken = slots[0];
        setConflictError(`Ya hay una reserva de ${taken.time_from} a ${taken.time_to}. Elegí otro horario.`);
        setConfirming(false);
        return;
      }
    }

    setConfirming(false);
    onConfirmed({ program, delivery, date: dateStr, timeFrom, timeTo });
  };

  const DATE_OPTS = [
    { label: 'Hoy',    offset: 0 },
    { label: 'Mañana', offset: 1 },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={rm.overlay}>
        <TouchableOpacity style={rm.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={rm.sheet}>
          <View style={rm.handle} />

          {/* Item header */}
          <View style={rm.itemHeader}>
            <View style={rm.itemIconWrap}>
              <Feather name="refresh-cw" size={22} color="#C4B5FD" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={rm.itemName}>Lavarropas LG 7kg</Text>
              <View style={rm.ownerRow}>
                <Text style={rm.ownerName}>María González</Text>
                <Text style={rm.ownerSep}> · </Text>
                <AntDesign name="star" size={12} color="#F59E0B" />
                <Text style={rm.ownerRating}> 4.8</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={rm.closeBtn} activeOpacity={0.7}>
              <Feather name="x" size={18} color={GRAY} />
            </TouchableOpacity>
          </View>

          {/* Date */}
          <Text style={rm.sectionLabel}>FECHA</Text>
          <View style={rm.dateRow}>
            {DATE_OPTS.map((opt) => (
              <TouchableOpacity
                key={opt.offset}
                style={[rm.dateChip, dateOffset === opt.offset && rm.dateChipActive]}
                onPress={() => { setDateOffset(opt.offset); setConflictError(''); }}
                activeOpacity={0.7}
              >
                <Feather name="calendar" size={13} color={dateOffset === opt.offset ? PURPLE : GRAY} />
                <Text style={[rm.dateChipText, dateOffset === opt.offset && rm.dateChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Time */}
          <Text style={rm.sectionLabel}>HORARIO</Text>
          <View style={rm.timeRow}>
            <View style={rm.timeSection}>
              <Text style={rm.timeSectionLabel}>Desde</Text>
              <ModalTime value={timeFrom} onChange={(v) => { setTimeFrom(v); setConflictError(''); }} />
            </View>
            <Feather name="arrow-right" size={14} color={BODY} style={{ marginTop: 20 }} />
            <View style={rm.timeSection}>
              <Text style={rm.timeSectionLabel}>Hasta</Text>
              <ModalTime value={timeTo} onChange={(v) => { setTimeTo(v); setConflictError(''); }} />
            </View>
          </View>

          {/* Program */}
          <Text style={rm.sectionLabel}>PROGRAMA</Text>
          <View style={rm.programRow}>
            {PROGRAMS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[rm.programChip, program === p && rm.programChipActive]}
                onPress={() => setProgram(p)}
                activeOpacity={0.7}
              >
                <Text style={[rm.programChipText, program === p && rm.programChipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Delivery */}
          <Text style={rm.sectionLabel}>MÉTODO DE ENTREGA</Text>
          <View style={rm.deliveryGrid}>
            {DELIVERY.map((d) => (
              <TouchableOpacity
                key={d.key}
                style={[rm.deliveryItem, delivery === d.key && rm.deliveryItemActive]}
                onPress={() => setDelivery(d.key)}
                activeOpacity={0.7}
              >
                <Feather name={d.icon as any} size={18} color={delivery === d.key ? PURPLE : GRAY} />
                <Text style={[rm.deliveryLabel, delivery === d.key && rm.deliveryLabelActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Conflict error */}
          {conflictError ? (
            <View style={rm.conflictBanner}>
              <Feather name="alert-circle" size={15} color="#F87171" style={{ marginTop: 1 }} />
              <Text style={rm.conflictText}>{conflictError}</Text>
            </View>
          ) : null}

          {/* Confirm */}
          <TouchableOpacity onPress={handleConfirm} disabled={confirming} style={rm.confirmWrap} activeOpacity={0.85}>
            <LinearGradient
              colors={['#7C3AED', '#3B82F6']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={rm.confirmBtn}
            >
              {confirming
                ? <ActivityIndicator color="#FFF" size="small" />
                : <>
                    <Feather name="check-circle" size={18} color="#FFF" />
                    <Text style={rm.confirmText}>Confirmar reserva</Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>

          <Text style={rm.hint}>Incluye detergente y suavizante 🧴</Text>
          <View style={{ height: 28 }} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Reservation prompt bubble ────────────────────────────────────────────────

function ReservationPromptBubble({ onReserve }: { onReserve: () => void }) {
  return (
    <View style={styles.promptWrap}>
      <View style={styles.promptCard}>
        <View style={styles.promptIcon}>
          <Feather name="calendar" size={18} color={GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.promptTitle}>¡Todo listo para reservar!</Text>
          <Text style={styles.promptSub}>El dueño confirmó disponibilidad</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onReserve} activeOpacity={0.85} style={styles.reserveNowWrap}>
        <LinearGradient
          colors={['#7C3AED', '#3B82F6']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.reserveNowBtn}
        >
          <Feather name="zap" size={16} color="#FFF" />
          <Text style={styles.reserveNowText}>Reservar ahora</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Reservation confirmed bubble ─────────────────────────────────────────────

function ReservationConfirmedBubble({ program, delivery, date, timeFrom, timeTo }: {
  program: string; delivery: string; date?: string; timeFrom?: string; timeTo?: string;
}) {
  const deliveryLabel = DELIVERY.find((d) => d.key === delivery)?.label ?? delivery;
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dateLabel = !date || date === todayStr ? 'Hoy'
    : date === tomorrowStr ? 'Mañana'
    : date;
  const timeLabel = timeFrom && timeTo ? `${timeFrom} – ${timeTo}` : '10:00 – 12:00';
  return (
    <View style={styles.confirmedWrap}>
      <View style={styles.confirmedCard}>
        <View style={styles.confirmedIcon}>
          <Feather name="check-circle" size={22} color={GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.confirmedTitle}>¡Reserva confirmada! ✅</Text>
          <Text style={styles.confirmedDetail}>{dateLabel} · {timeLabel} · {program}</Text>
          <Text style={styles.confirmedDetail}>{deliveryLabel} · Lavarropas LG 7kg</Text>
        </View>
      </View>
      <Text style={styles.confirmedHint}>Podés verlo en tu calendario y notificaciones</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const isReal = IS_UUID.test(id ?? '');

  const [myId, setMyId] = useState<string | null>(null);
  const [headerName, setHeaderName] = useState('');
  const [headerInitial, setHeaderInitial] = useState('');
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string | null>(null);
  const [headerItem, setHeaderItem] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [convItemId, setConvItemId] = useState<string | null>(null);
  const [convOwnerId, setConvOwnerId] = useState<string | null>(null);
  const [isClosed, setIsClosed] = useState(false);

  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReal) {
      const mock = MOCK[id ?? '1'] ?? MOCK['1'];
      setHeaderName(mock.name);
      setHeaderInitial(mock.initial);
      setHeaderItem(mock.item);
      setMessages(mock.msgs);
      const lastTheirs = [...mock.msgs].reverse().find((m) => !m.mine && m.type === 'text');
      if (lastTheirs) setQuickReplies(getQuickReplies(lastTheirs.content));
      setLoading(false);
      return;
    }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setMyId(user?.id ?? null);
      const { data: conv } = await fetchConversation(id);
      if (conv) {
        const iAmOwner = user?.id === conv.owner_id;
        const other = iAmOwner ? conv.borrower : conv.owner;
        const name = other ? `${other.nombre} ${other.apellido}` : 'Vecino';
        setHeaderName(name);
        setHeaderInitial(name[0]?.toUpperCase() ?? '?');
        setHeaderAvatarUrl(other?.avatar_url ?? null);
        setHeaderItem(conv.item?.name ?? '');
        setConvItemId(conv.item_id ?? null);
        setConvOwnerId(conv.owner_id ?? null);
      }
      const { data: res } = await supabase
        .from('reservations')
        .select('transaction_status')
        .eq('conversation_id', id)
        .eq('status', 'confirmed')
        .maybeSingle();
      if (res?.transaction_status === 'completed') setIsClosed(true);
      const { data: msgs } = await fetchMessages(id);
      setMessages(msgs ?? []);
      markMessagesRead(id);
      const lastTheirs = [...(msgs ?? [])].reverse().find((m) => m.sender_id !== user?.id && m.type === 'text');
      if (lastTheirs) setQuickReplies(getQuickReplies(lastTheirs.content));
      setLoading(false);
    }
    load();
  }, [id]);

  // ── Real-time ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReal) return;
    const channel = supabase
      .channel(`chat_${id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            const updated = [...prev, payload.new];
            if (payload.new.sender_id !== myId && payload.new.type === 'text') {
              setQuickReplies(getQuickReplies(payload.new.content));
            } else {
              setQuickReplies([]);
            }
            return updated;
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, isReal, myId]);

  useEffect(() => {
    if (!loading && messages.length > 0)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
  }, [loading]);

  // ── Send ──────────────────────────────────────────────────────────────────────
  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput('');

    const isPositive = typeof text === 'string' &&
      quickReplies.find((q) => q.label === text)?.positive === true;

    setQuickReplies([]);

    if (!isReal) {
      const time = nowHHMM();
      const newMsg = { id: String(Date.now()), content, mine: true, created_at: time, type: 'text' };
      setMessages((prev) => {
        const updated = [...prev, newMsg];
        if (isPositive) {
          updated.push({ id: String(Date.now() + 1), content: '', mine: false, created_at: time, type: 'reservation_prompt' });
        }
        return updated;
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

      // Auto-respuesta de María (solo si no es un chip positivo que ya disparó la reserva)
      if (!isPositive) {
        const autoReply = getMockAutoResponse(content);
        if (autoReply) {
          setTimeout(() => {
            const replyTime = nowHHMM();
            const replyMsg = { id: String(Date.now() + 2), content: autoReply, mine: false, created_at: replyTime, type: 'text' };
            setMessages((prev) => [...prev, replyMsg]);
            setQuickReplies(getQuickReplies(autoReply));
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
          }, 1500);
        }
      }
      return;
    }

    setSending(true);
    const optimistic = { id: `opt_${Date.now()}`, content, sender_id: myId, conversation_id: id, created_at: new Date().toISOString(), type: 'text' };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    const { data, error } = await sendMessage(id, content);
    if (data) {
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? data : m));
      if (isPositive) {
        await supabase.from('messages').insert({
          conversation_id: id,
          sender_id: myId,
          content: '',
          type: 'reservation_prompt',
        });
      }
    } else if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(content);
    }
    setSending(false);
  };

  const isMine = (msg: any) => isReal ? msg.sender_id === myId : msg.mine;

  const handleReservationConfirmed = async (details: ConfirmDetails) => {
    setConfirmModalVisible(false);

    if (isReal && convItemId && convOwnerId) {
      const { data: reservation } = await createReservation({
        conversationId: id,
        itemId: convItemId,
        ownerId: convOwnerId,
        date: details.date,
        timeFrom: details.timeFrom,
        timeTo: details.timeTo,
        deliveryMethod: details.delivery,
        program: details.program,
      });
      if (reservation) {
        await createNotification({
          userId: convOwnerId,
          type: 'reservation_created',
          reservationId: reservation.id,
          title: `Nueva reserva para ${headerItem || 'tu ítem'}`,
          body: `Reserva para el ${details.date} de ${details.timeFrom} a ${details.timeTo}`,
        });
      }
      await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: myId,
        content: JSON.stringify({
          program: details.program,
          delivery: details.delivery,
          date: details.date,
          timeFrom: details.timeFrom,
          timeTo: details.timeTo,
        }),
        type: 'reservation_confirmed',
      });
      return;
    }

    // Mock flow
    const time = nowHHMM();
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        content: '',
        mine: false,
        created_at: time,
        type: 'reservation_confirmed',
        program: details.program,
        delivery: details.delivery,
        date: details.date,
        timeFrom: details.timeFrom,
        timeTo: details.timeTo,
      },
    ]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={GRAY} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerAvatar}>
              {headerAvatarUrl ? (
                <Image source={{ uri: headerAvatarUrl }} style={styles.headerAvatarImg} />
              ) : (
                <Text style={styles.headerAvatarText}>{headerInitial}</Text>
              )}
            </View>
            <View>
              <Text style={styles.headerName} numberOfLines={1}>{headerName}</Text>
              {headerItem ? <Text style={styles.headerSub}>{headerItem}</Text> : null}
            </View>
          </View>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={PURPLE} />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            renderItem={({ item: msg, index }) => {
              if (msg.type === 'system') {
                return (
                  <View key={msg.id} style={styles.systemMsgWrap}>
                    <Text style={styles.systemMsgText}>{msg.content}</Text>
                  </View>
                );
              }
              if (msg.type === 'reservation_prompt') {
                return <ReservationPromptBubble onReserve={() => setConfirmModalVisible(true)} />;
              }
              if (msg.type === 'reservation_confirmed') {
                let program = msg.program ?? 'Diario';
                let delivery = msg.delivery ?? 'porteria';
                let date = msg.date;
                let timeFrom = msg.timeFrom;
                let timeTo = msg.timeTo;
                try {
                  const parsed = JSON.parse(msg.content ?? '{}');
                  if (parsed.program)   program  = parsed.program;
                  if (parsed.delivery)  delivery = parsed.delivery;
                  if (parsed.date)      date     = parsed.date;
                  if (parsed.timeFrom)  timeFrom = parsed.timeFrom;
                  if (parsed.timeTo)    timeTo   = parsed.timeTo;
                } catch {}
                return <ReservationConfirmedBubble program={program} delivery={delivery} date={date} timeFrom={timeFrom} timeTo={timeTo} />;
              }
              const mine = isMine(msg);
              const prevMine = index > 0 ? isMine(messages[index - 1]) : null;
              const showAvatar = !mine && prevMine !== false;
              return (
                <View style={[styles.msgRow, mine && styles.msgRowMine]}>
                  {!mine && (
                    <View style={[styles.msgAvatar, { opacity: showAvatar ? 1 : 0 }]}>
                      {headerAvatarUrl ? (
                        <Image source={{ uri: headerAvatarUrl }} style={styles.msgAvatarImg} />
                      ) : (
                        <Text style={styles.msgAvatarText}>{headerInitial}</Text>
                      )}
                    </View>
                  )}
                  <View style={styles.msgCol}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, msg.type === 'image' && styles.bubbleImage]}>
                      {msg.type === 'image' ? (
                        <Image source={{ uri: msg.content }} style={styles.msgImage} resizeMode="cover" />
                      ) : (
                        <Text style={styles.bubbleText}>{msg.content}</Text>
                      )}
                    </View>
                    <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>
                      {formatTime(msg.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          <View style={[styles.inputSafe, { paddingBottom: keyboardVisible ? 0 : insets.bottom }]}>
            {isClosed ? (
              <View style={styles.closedBanner}>
                <Feather name="lock" size={14} color={BODY} />
                <Text style={styles.closedText}>Conversación cerrada · La transacción fue completada</Text>
              </View>
            ) : (
              <>
                {quickReplies.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    {quickReplies.map((qr) => (
                      <TouchableOpacity
                        key={qr.label}
                        style={[styles.quickChip, qr.positive && styles.quickChipPositive]}
                        onPress={() => handleSend(qr.label)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.quickChipText, qr.positive && styles.quickChipTextPositive]}>
                          {qr.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <View style={styles.inputBar}>
                  <TextInput
                    style={styles.input}
                    placeholder="Escribí un mensaje…"
                    placeholderTextColor={BODY}
                    value={input}
                    onChangeText={setInput}
                    multiline
                    blurOnSubmit={false}
                  />
                  <TouchableOpacity
                    onPress={() => handleSend()}
                    disabled={!input.trim() || sending}
                    style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
                    activeOpacity={0.8}
                  >
                    {sending
                      ? <ActivityIndicator color={BODY} size="small" />
                      : <Feather name="send" size={18} color={input.trim() ? '#FFF' : BODY} />
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      <ReservationConfirmModal
        visible={confirmModalVisible}
        onClose={() => setConfirmModalVisible(false)}
        onConfirmed={handleReservationConfirmed}
        itemId={convItemId}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerSafe: { backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { padding: 4 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(139,92,246,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 16 },
  headerAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  headerName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15 },
  headerSub: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },

  messagesList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 4 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(139,92,246,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  msgAvatarText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 11 },
  msgAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  msgCol: { maxWidth: '72%', gap: 3 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleTheirs: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: PURPLE, borderBottomRightRadius: 4 },
  bubbleImage: { padding: 4, overflow: 'hidden' },
  msgImage: { width: 220, height: 180, borderRadius: 14 },
  systemMsgWrap: { alignItems: 'center', marginVertical: 10, paddingHorizontal: 24 },
  systemMsgText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  bubbleText: { fontFamily: 'Inter_400Regular', color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  msgTime: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11, paddingLeft: 4 },
  msgTimeMine: { textAlign: 'right', paddingRight: 4 },

  quickRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 6, alignItems: 'center' },
  quickChip: {
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: CARD_BG,
  },
  quickChipPositive: { borderColor: GREEN, backgroundColor: 'rgba(16,185,129,0.08)' },
  quickChipText: { fontFamily: 'Inter_500Medium', color: GRAY, fontSize: 12 },
  quickChipTextPositive: { color: GREEN, fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  promptWrap: { marginHorizontal: 16, marginVertical: 10 },
  promptCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    padding: 14, marginBottom: 10,
  },
  promptIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center' },
  promptTitle: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14, marginBottom: 2 },
  promptSub: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 12 },
  reserveNowWrap: { borderRadius: 14, overflow: 'hidden' },
  reserveNowBtn: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reserveNowText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 15 },

  confirmedWrap: { marginHorizontal: 16, marginVertical: 10 },
  confirmedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    padding: 14, marginBottom: 6,
  },
  confirmedIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center' },
  confirmedTitle: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 15, marginBottom: 3 },
  confirmedDetail: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 12, lineHeight: 18 },
  confirmedHint: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11, textAlign: 'center' },

  inputSafe: { backgroundColor: CARD_BG, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  closedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16 },
  closedText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13, textAlign: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 10, color: '#FFFFFF', fontFamily: 'Inter_400Regular', fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(139,92,246,0.25)' },
});

// ─── Reservation confirm modal styles ─────────────────────────────────────────

const rm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 10, marginBottom: 18,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  itemIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  itemName: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16, marginBottom: 4 },
  ownerRow: { flexDirection: 'row', alignItems: 'center' },
  ownerName: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
  ownerSep: { color: BODY, fontSize: 13 },
  ownerRating: { fontFamily: 'Inter_600SemiBold', color: '#F59E0B', fontSize: 13, marginLeft: 3 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  detailsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, marginBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, paddingVertical: 12,
  },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { fontFamily: 'Inter_500Medium', color: '#FFF', fontSize: 13 },
  detailDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: BODY },
  sectionLabel: {
    fontFamily: 'Inter_700Bold', color: GRAY, fontSize: 10, letterSpacing: 1.2, marginBottom: 10,
  },
  programRow: { flexDirection: 'row', gap: 7, marginBottom: 20 },
  programChip: {
    flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  programChipActive: { borderColor: PURPLE, backgroundColor: 'rgba(139,92,246,0.15)' },
  programChipText: { fontFamily: 'Inter_500Medium', color: GRAY, fontSize: 12 },
  programChipTextActive: { color: PURPLE, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  deliveryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  deliveryItem: {
    width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  deliveryItemActive: { borderColor: PURPLE, backgroundColor: 'rgba(139,92,246,0.12)' },
  deliveryLabel: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13 },
  deliveryLabelActive: { color: PURPLE, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  // Date selector
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  dateChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dateChipActive: { borderColor: PURPLE, backgroundColor: 'rgba(139,92,246,0.12)' },
  dateChipText: { fontFamily: 'Inter_500Medium', color: GRAY, fontSize: 13 },
  dateChipTextActive: { color: PURPLE, fontFamily: 'Inter_600SemiBold' },

  // Time inputs
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 20, marginBottom: 18 },
  timeSection: { alignItems: 'center', gap: 6 },
  timeSectionLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
  timeBlock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeDigit: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)',
    color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 16, textAlign: 'center',
  },
  timeColon: { fontFamily: 'Inter_700Bold', color: GRAY, fontSize: 18 },

  // Conflict error
  conflictBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)',
    padding: 12, marginBottom: 12,
  },
  conflictText: { fontFamily: 'Inter_400Regular', color: '#F87171', fontSize: 13, flex: 1, lineHeight: 18 },

  confirmWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  confirmBtn: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 },
  hint: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, textAlign: 'center', marginBottom: 4 },
});
