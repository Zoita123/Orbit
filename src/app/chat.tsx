import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchConversation, fetchMessages, sendMessage, supabase } from '../lib/supabase';

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

  // Preguntas específicas primero (más contexto gana)
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
  // Sentimiento positivo al final — solo si no hay pregunta específica
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
      { id: '1', content: '¿Tenés disponible el lavarropas para el sábado?', mine: false, created_at: '10:02', type: 'text' },
      { id: '2', content: 'Hola María! Sí, de 10 a 12 perfecto.', mine: true, created_at: '10:15', type: 'text' },
      { id: '3', content: '¿Incluye detergente o traigo el mío?', mine: false, created_at: '10:17', type: 'text' },
      { id: '4', content: 'Incluye detergente y suavizante 😊', mine: true, created_at: '10:20', type: 'text' },
      { id: '5', content: 'Genial! ¿Cómo coordino la entrega?', mine: false, created_at: '10:21', type: 'text' },
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

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Bubbles ──────────────────────────────────────────────────────────────────

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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const isReal = IS_UUID.test(id ?? '');

  const [myId, setMyId] = useState<string | null>(null);
  const [headerName, setHeaderName] = useState('');
  const [headerInitial, setHeaderInitial] = useState('');
  const [headerItem, setHeaderItem] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);

  const listRef = useRef<FlatList>(null);

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReal) {
      const mock = MOCK[id ?? '1'] ?? MOCK['1'];
      setHeaderName(mock.name);
      setHeaderInitial(mock.initial);
      setHeaderItem(mock.item);
      setMessages(mock.msgs);
      // Show quick replies for the last non-mine message
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
        setHeaderItem(conv.item?.name ?? '');
      }
      const { data: msgs } = await fetchMessages(id);
      setMessages(msgs ?? []);
      // Quick replies for last message from the other person
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
            // Update quick replies if new message is from other person
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
    setQuickReplies([]);

    const isPositive = typeof text === 'string' &&
      quickReplies.find((q) => q.label === text)?.positive === true;

    if (!isReal) {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const newMsg = { id: String(Date.now()), content, mine: true, created_at: time, type: 'text' };
      setMessages((prev) => {
        const updated = [...prev, newMsg];
        if (isPositive) {
          updated.push({ id: String(Date.now() + 1), content: '', mine: false, created_at: time, type: 'reservation_prompt' });
        }
        return updated;
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
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
        // Insert reservation_prompt for the other user
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

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={GRAY} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{headerInitial}</Text>
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
              if (msg.type === 'reservation_prompt') {
                return (
                  <ReservationPromptBubble
                    onReserve={() => router.push({ pathname: '/reserve', params: { id: itemId ?? '' } })}
                  />
                );
              }
              const mine = isMine(msg);
              const prevMine = index > 0 ? isMine(messages[index - 1]) : null;
              const showAvatar = !mine && prevMine !== false;
              return (
                <View style={[styles.msgRow, mine && styles.msgRowMine]}>
                  {!mine && (
                    <View style={[styles.msgAvatar, { opacity: showAvatar ? 1 : 0 }]}>
                      <Text style={styles.msgAvatarText}>{headerInitial}</Text>
                    </View>
                  )}
                  <View style={styles.msgCol}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={styles.bubbleText}>{msg.content}</Text>
                    </View>
                    <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>
                      {formatTime(msg.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* Input bar + quick replies anclados abajo */}
          <SafeAreaView edges={['bottom']} style={styles.inputSafe}>
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
          </SafeAreaView>
        </KeyboardAvoidingView>
      )}
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
  headerName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15 },
  headerSub: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },

  messagesList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 4 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(139,92,246,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  msgAvatarText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 11 },
  msgCol: { maxWidth: '72%', gap: 3 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleTheirs: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: PURPLE, borderBottomRightRadius: 4 },
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

  inputSafe: { backgroundColor: CARD_BG, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 10, color: '#FFFFFF', fontFamily: 'Inter_400Regular', fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(139,92,246,0.25)' },
});
