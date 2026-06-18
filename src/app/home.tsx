import { AntDesign, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { Swipeable } from 'react-native-gesture-handler';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import AlertsTab from '../components/AlertsTab';
import PlanetRank, { getPlanet, PLANETS } from '../components/PlanetRank';
import SearchTab from '../components/SearchTab';
import { useLocation } from '../hooks/useLocation';
import { fetchItems, fetchProfile, fetchUnreadNotifCount, markAllNotificationsRead, upsertProfile, syncAvatarUrl, supabase, fetchActiveTransactions, advanceTransactionStatus, reportProblem, markOwnerReviewed, markBorrowerReviewed, submitReview, addPoints, fetchMyAverageRating, fetchMonthlyEarnings, fetchReferralStats, deleteItem } from '../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';

const HOME_RADIUS_M = 100;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

const AVATAR_SIZE = 96;


function starColor(r: number) {
  if (r >= 4) return '#F59E0B';
  if (r >= 3) return '#F97316';
  return '#EF4444';
}

const DAY_ORDER = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
const DAY_SHORT: Record<string, string> = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb', dom: 'Dom' };

function scheduleLabel(schedule: any): string {
  if (!schedule) return 'Sin configurar';

  const enabled: string[] = [];
  for (const key of DAY_ORDER) {
    if (schedule[key]?.enabled) enabled.push(key);
  }
  if (enabled.length === 0) return 'Sin configurar';

  const firstFrom = schedule[enabled[0]]?.from ?? '09:00';
  const firstTo   = schedule[enabled[0]]?.to   ?? '18:00';
  const allSameTime = enabled.every(
    (d) => schedule[d]?.from === firstFrom && schedule[d]?.to === firstTo
  );
  const timeStr = allSameTime ? `${firstFrom} – ${firstTo}` : 'Personalizado';

  let consecutive = enabled.length > 1;
  for (let i = 1; i < enabled.length; i++) {
    if (DAY_ORDER.indexOf(enabled[i]) !== DAY_ORDER.indexOf(enabled[i - 1]) + 1) {
      consecutive = false;
      break;
    }
  }

  const daysStr = consecutive
    ? `${DAY_SHORT[enabled[0]]} – ${DAY_SHORT[enabled[enabled.length - 1]]}`
    : enabled.length <= 4
      ? enabled.map((d) => DAY_SHORT[d]).join(', ')
      : `${enabled.slice(0, 2).map((d) => DAY_SHORT[d]).join(', ')} +${enabled.length - 2}`;

  return `${daysStr} · ${timeStr}`;
}

// ─── Low rating modal ─────────────────────────────────────────────────────────

function LowRatingModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const tips = [
    { icon: 'message-circle', text: 'Respondé rápido a los mensajes de tus vecinos' },
    { icon: 'clock',          text: 'Cumplí con los horarios acordados en cada reserva' },
    { icon: 'package',        text: 'Entregá tus ítems en buen estado y limpios' },
    { icon: 'star',           text: 'Pedí reseñas a quienes ya te prestaron algo' },
    { icon: 'user-check',     text: 'Completá tu perfil con toda la información' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={lm.overlay}>
        <TouchableOpacity style={lm.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={lm.sheet}>
          <View style={lm.handle} />
          <View style={lm.header}>
            <View>
              <Text style={lm.title}>Mejorá tu reputación</Text>
              <Text style={lm.sub}>Seguí estos consejos para subir tu calificación</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={lm.closeBtn} activeOpacity={0.7}>
              <Feather name="x" size={18} color={GRAY} />
            </TouchableOpacity>
          </View>
          {tips.map((t, i) => (
            <View key={i} style={[lm.tipRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
              <View style={lm.tipIconWrap}>
                <Feather name={t.icon as any} size={16} color="#EF4444" />
              </View>
              <Text style={lm.tipText}>{t.text}</Text>
            </View>
          ))}
          <View style={{ height: 24 }} />
        </View>
      </View>
    </Modal>
  );
}


// ─── Planet benefits modal ────────────────────────────────────────────────────

function PlanetBenefitsModal({
  visible, onClose, points, profile, user, myRating,
}: {
  visible: boolean; onClose: () => void; points: number; profile: any; user: any; myRating: number | null;
}) {
  const { planet, index } = getPlanet(points);
  const isLast = index === PLANETS.length - 1;
  const nextPlanet = isLast ? null : PLANETS[index + 1];
  const displayName = (profile?.nombre && profile?.apellido)
    ? `${profile.nombre} ${profile.apellido}`
    : (profile?.nombre || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Vos');
  const avatarUrl = user?.user_metadata?.avatar_url ?? null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={bm.container}>
        <View style={bm.handle} />
        <View style={bm.topBar}>
          <Text style={bm.title}>Tu rango en orbit</Text>
          <TouchableOpacity onPress={onClose} style={bm.closeBtn} activeOpacity={0.7}>
            <Feather name="x" size={20} color={GRAY} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={bm.scroll}>
          <PlanetRank points={points} />

          <Text style={bm.sectionLabel}>BENEFICIOS ACTUALES</Text>
          <View style={bm.benefitsCard}>
            {(planet.benefits as readonly string[]).map((b, i) => (
              <View key={i} style={[bm.benefitRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
                <View style={[bm.benefitDot, { backgroundColor: planet.glow }]} />
                <Text style={bm.benefitText}>{b}</Text>
              </View>
            ))}
          </View>

          {nextPlanet && (
            <>
              <Text style={bm.sectionLabel}>PRÓXIMOS BENEFICIOS · {nextPlanet.name.toUpperCase()}</Text>
              <View style={[bm.benefitsCard, { opacity: 0.4 }]}>
                {(nextPlanet.benefits as readonly string[]).map((b, i) => (
                  <View key={i} style={[bm.benefitRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
                    <View style={[bm.benefitDot, { backgroundColor: nextPlanet.glow }]} />
                    <Text style={bm.benefitText}>{b}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={bm.sectionLabel}>TU PERFIL PÚBLICO</Text>
          <View style={bm.publicCard}>
            <View style={bm.publicRow}>
              <View style={bm.publicAvatar}>
                {avatarUrl
                  ? <Image source={{ uri: avatarUrl }} style={bm.publicAvatarImg} />
                  : <Text style={bm.publicAvatarInitial}>{displayName[0]?.toUpperCase()}</Text>
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={bm.publicName}>{displayName}</Text>
                <View style={bm.publicPlanetRow}>
                  <Text style={[bm.publicPlanetName, { color: planet.glow }]}>{planet.name}</Text>
                  <Text style={bm.publicPlanetSep}> · </Text>
                  <Text style={bm.publicPlanetDesc}>{planet.desc}</Text>
                </View>
              </View>
            </View>
            <View style={bm.publicDivider} />
            <View style={bm.publicStatsRow}>
              {[
                { label: 'Puntos', value: String(points) },
                { label: 'Nivel', value: `${index + 1} / ${PLANETS.length}` },
                { label: 'Reputación', value: myRating !== null ? `${myRating.toFixed(1)} ★` : '— ★' },
              ].map((s) => (
                <View key={s.label} style={bm.publicStat}>
                  <Text style={bm.publicStatVal}>{s.value}</Text>
                  <Text style={bm.publicStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
            <View style={bm.publicVisibleHint}>
              <Feather name="eye" size={12} color={BODY} />
              <Text style={bm.publicVisibleText}>Visible para todos tus vecinos</Text>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Profile tab ────────────────────────────────────────────────────────────

function ProfileTab({ user, profile, itemCount, onPlanetPress, myRating, monthlyEarnings, referralStats }: { user: any; profile: any; itemCount: number; onPlanetPress: () => void; myRating: number | null; monthlyEarnings: number; referralStats: { sent: number; completed: number } }) {
  const loading = user === undefined;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={PURPLE} />
      </View>
    );
  }

  const avatarUrl = user?.user_metadata?.avatar_url ?? null;
  const displayName = (profile?.nombre && profile?.apellido)
    ? `${profile.nombre} ${profile.apellido}`
    : (profile?.nombre || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Vos');

  const isVerified = !!(profile?.nombre && profile?.apellido && profile?.dni && profile?.telefono);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={pf.scrollContent}>

      {/* Avatar */}
      <View style={pf.avatarSection}>
        {isVerified ? (
          <View style={pf.glowWrap}>
            <View style={pf.glowRing}>
              <View style={pf.avatarWrap}>
                {avatarUrl
                  ? <Image source={{ uri: avatarUrl }} style={pf.avatar} />
                  : <View style={pf.avatarFallback}><Text style={pf.avatarInitial}>{displayName[0].toUpperCase()}</Text></View>
                }
              </View>
            </View>
            {/* Verified badge */}
            <View style={pf.verifiedBadge}>
              <Feather name="check" size={11} color="#FFFFFF" />
            </View>
          </View>
        ) : (
          <View style={pf.avatarWrapPlain}>
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={pf.avatar} />
              : <View style={pf.avatarFallback}><Text style={pf.avatarInitial}>{displayName[0].toUpperCase()}</Text></View>
            }
          </View>
        )}

        <Text style={pf.displayName}>{displayName}</Text>
        <Text style={pf.email}>{user?.email}</Text>

        {isVerified && (
          <View style={pf.verifiedPill}>
            <Feather name="shield" size={12} color="#10B981" />
            <Text style={pf.verifiedPillText}>Perfil verificado</Text>
          </View>
        )}
      </View>

      {/* Completar perfil (solo si no está completo) */}
      {!isVerified && (
        <View style={pf.incompleteCard}>
          <View style={pf.incompleteLeft}>
            <Feather name="alert-circle" size={18} color="#F59E0B" />
            <View>
              <Text style={pf.incompleteTitle}>Perfil incompleto</Text>
              <Text style={pf.incompleteSub}>Completalo para ganar confianza</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/profile-setup')}
            style={pf.completeWrapper}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#7C3AED', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={pf.completeBtn}>
              <Text style={pf.completeBtnText}>Completar perfil</Text>
              <Feather name="arrow-right" size={15} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats */}
      <View style={pf.statsRow}>
        <View style={pf.statCard}>
          <Text style={pf.statValue}>${monthlyEarnings.toLocaleString('es-AR')}</Text>
          <Text style={pf.statLabel}>Este mes</Text>
        </View>
        <View style={pf.statCard}>
          <Text style={pf.statValue}>{itemCount}</Text>
          <Text style={pf.statLabel}>Productos</Text>
        </View>
        <View style={pf.statCard}>
          {myRating !== null ? (
            <View style={pf.statRatingRow}>
              <Text style={pf.statValue}>{myRating.toFixed(1)}</Text>
              <AntDesign name="star" size={14} color={starColor(myRating)} style={{ marginTop: 2 }} />
            </View>
          ) : (
            <Text style={pf.statValue}>—</Text>
          )}
          <Text style={pf.statLabel}>Reputación</Text>
        </View>
      </View>

      {/* Invite card — hidden once user has maxed out 10 referrals */}
      {referralStats.completed < 10 && (
        <TouchableOpacity onPress={() => router.push('/invite')} activeOpacity={0.88} style={pf.inviteWrap}>
          <LinearGradient colors={['#6D28D9', '#7C3AED', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={pf.inviteCard}>
            <View style={pf.inviteLeft}>
              <View style={pf.inviteIconWrap}>
                <Text style={pf.inviteEmoji}>🎁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={pf.inviteTitle}>Invitá a tus amigos</Text>
                <Text style={pf.inviteSub}>Vos y tu amigo reciben{'\n'}$2.000 en créditos</Text>
              </View>
            </View>
            <View style={pf.inviteArrow}>
              <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.8)" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Planet rank */}
      <TouchableOpacity activeOpacity={0.85} onPress={onPlanetPress}>
        <PlanetRank points={profile?.points ?? 0} />
      </TouchableOpacity>

      {/* Info cards (solo si verificado) */}
      {isVerified && (
        <>
          <Text style={pf.sectionTitle}>INFORMACIÓN PERSONAL</Text>
          <View style={pf.infoCard}>
            {[
              { icon: 'user',        label: 'Nombre completo', value: `${profile.nombre} ${profile.apellido}` },
              { icon: 'credit-card', label: 'DNI',             value: profile.dni },
              { icon: 'phone',       label: 'Teléfono',        value: profile.telefono },
              { icon: 'map-pin',     label: 'Dirección',       value: profile.direccion || '—' },
            ].map((row, i, arr) => (
              <View key={row.label}>
                <View style={pf.infoRow}>
                  <View style={pf.infoIconWrap}>
                    <Feather name={row.icon as any} size={14} color={PURPLE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={pf.infoLabel}>{row.label}</Text>
                    <Text style={pf.infoValue}>{row.value}</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={pf.infoDivider} />}
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => router.push('/profile-setup')}
            style={pf.editBtn}
            activeOpacity={0.75}
          >
            <Feather name="edit-2" size={15} color={PURPLE} />
            <Text style={pf.editBtnText}>Editar información</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Historial button */}
      <TouchableOpacity onPress={() => router.push('/history')} style={pf.histBtn} activeOpacity={0.75}>
        <Feather name="clock" size={16} color={PURPLE} />
        <Text style={pf.histBtnText}>Historial de transacciones</Text>
        <Feather name="chevron-right" size={16} color={PURPLE} />
      </TouchableOpacity>

      {/* Ayuda button */}
      <TouchableOpacity onPress={() => router.push('/help')} style={pf.helpBtn} activeOpacity={0.75}>
        <Feather name="help-circle" size={16} color={GRAY} />
        <Text style={pf.helpBtnText}>Ayuda y preguntas frecuentes</Text>
        <Feather name="chevron-right" size={16} color={GRAY} />
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity onPress={handleLogout} style={pf.logoutBtn} activeOpacity={0.75}>
        <Feather name="log-out" size={16} color="#F87171" />
        <Text style={pf.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Home screen ─────────────────────────────────────────────────────────────

const TABS = [
  { key: 'home',    icon: 'home',   label: 'Inicio' },
  { key: 'search',  icon: 'search', label: 'Reservar' },
  { key: 'alerts',  icon: 'bell',   label: 'Alertas' },
  { key: 'profile', icon: 'user',   label: 'Perfil' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function HomeScreen() {
  const userCoords = useLocation();
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [authUser, setAuthUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [atHome, setAtHome] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [schedule, setSchedule] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [planetModalVisible, setPlanetModalVisible] = useState(false);
  const [lowRatingVisible, setLowRatingVisible] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReservationId, setReportReservationId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [ratingTx, setRatingTx] = useState<any | null>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [referralStats, setReferralStats] = useState({ sent: 0, completed: 0 });
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const itemSwipeRefs = useRef<Record<string, Swipeable | null>>({});
  const tabOffsetX = useRef(new Animated.Value(0)).current;
  const currentTabIdxRef = useRef(0);

  const switchTab = useCallback((key: TabKey) => {
    const idx = TABS.findIndex((t) => t.key === key);
    currentTabIdxRef.current = idx;
    setActiveTab(key);
    Animated.spring(tabOffsetX, {
      toValue: -idx * SCREEN_WIDTH,
      useNativeDriver: true,
      tension: 110,
      friction: 14,
    }).start();
  }, [tabOffsetX]);

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2.5,
      onPanResponderGrant: () => {
        tabOffsetX.stopAnimation();
      },
      onPanResponderMove: (_, gs) => {
        const base = -currentTabIdxRef.current * SCREEN_WIDTH;
        const raw  = base + gs.dx;
        const min  = -(TABS.length - 1) * SCREEN_WIDTH;
        tabOffsetX.setValue(Math.max(min, Math.min(0, raw)));
      },
      onPanResponderRelease: (_, gs) => {
        const idx = currentTabIdxRef.current;
        let newIdx = idx;
        if ((gs.dx < -40 || gs.vx < -0.4) && idx < TABS.length - 1) newIdx = idx + 1;
        else if ((gs.dx > 40 || gs.vx > 0.4) && idx > 0) newIdx = idx - 1;
        currentTabIdxRef.current = newIdx;
        setActiveTab(TABS[newIdx].key);
        Animated.spring(tabOffsetX, {
          toValue: -newIdx * SCREEN_WIDTH,
          useNativeDriver: true,
          tension: 110,
          friction: 14,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(tabOffsetX, {
          toValue: -currentTabIdxRef.current * SCREEN_WIDTH,
          useNativeDriver: true,
          tension: 110,
          friction: 14,
        }).start();
      },
    })
  ).current;

  const handleDeleteItem = async (id: string) => {
    const { count } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('item_id', id)
      .in('status', ['pending', 'confirmed']);

    if ((count ?? 0) > 0) {
      itemSwipeRefs.current[id]?.close();
      Alert.alert(
        '⚠️ No podés eliminar este producto',
        'Tiene reservas activas o pendientes. Esperá a que se completen antes de eliminarlo.',
        [{ text: 'Entendido', style: 'default' }]
      );
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems((prev) => prev.filter((item) => item.id !== id));
    deleteItem(id);
  };

  const loadTransactions = useCallback(async () => {
    const { data } = await fetchActiveTransactions();
    setTransactions(data ?? []);
  }, []);

  const handleAdvanceStatus = async (id: string, status: string) => {
    await advanceTransactionStatus(id, status);
    setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, transaction_status: status } : t));
  };

  const handleReviewOk = async (tx: any) => {
    if (tx.isOwner) await markOwnerReviewed(tx.id);
    else await markBorrowerReviewed(tx.id);
    const delta = tx.isOwner ? 10 : 5;
    await addPoints(delta);
    setProfile((prev: any) => prev ? { ...prev, points: (prev.points ?? 0) + delta } : prev);
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    setRatingTx(tx);
    setRatingStars(5);
    setRatingComment('');
  };

  const handleSubmitRating = async () => {
    if (!ratingTx) return;
    setSubmittingRating(true);
    const reviewedUserId = ratingTx.isOwner ? ratingTx.borrower_id : ratingTx.owner_id;
    await submitReview({ reservationId: ratingTx.id, reviewedUserId, rating: ratingStars, comment: ratingComment.trim() || null });
    setSubmittingRating(false);
    setRatingTx(null);
    setRatingComment('');
    setRatingStars(5);
  };

  const handleSubmitReport = async () => {
    if (!reportText.trim() || !reportReservationId) return;
    setSubmittingReport(true);
    const tx = transactions.find((t) => t.id === reportReservationId);
    await reportProblem(reportReservationId, reportText.trim());
    if (tx?.isOwner) await markOwnerReviewed(reportReservationId);
    else await markBorrowerReviewed(reportReservationId);
    setSubmittingReport(false);
    setTransactions((prev) => prev.filter((t) => t.id !== reportReservationId));
    setReportText('');
    setReportReservationId(null);
    setShowReportModal(false);
    Alert.alert('Reporte enviado', 'Revisaremos tu reporte a la brevedad.');
  };

  useEffect(() => {
    if (activeTab === 'alerts') {
      setUnreadNotifCount(0);
      markAllNotificationsRead();
    } else {
      fetchUnreadNotifCount().then(setUnreadNotifCount);
    }
  }, [activeTab]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthUser(data.user);
      const name = data.user?.user_metadata?.full_name?.split(' ')[0]
        ?? data.user?.email?.split('@')[0]
        ?? 'Vos';
      setUserName(name);
      if (data.user) {
        fetchUnreadNotifCount().then(setUnreadNotifCount);
        syncAvatarUrl();
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchItems().then(({ data }) => {
        setItems(data ?? []);
        setLoadingItems(false);
      });
      if (activeTab !== 'alerts') {
        fetchUnreadNotifCount().then(setUnreadNotifCount);
      }
      loadTransactions();
      fetchMyAverageRating().then(setMyRating);
      fetchMonthlyEarnings().then(setMonthlyEarnings);
      fetchReferralStats().then(setReferralStats);
      fetchProfile().then(async ({ data }) => {
        if (!data) {
          // Auto-create profile from Google metadata for new users
          const { data: { user } } = await supabase.auth.getUser();
          const meta = user?.user_metadata ?? {};
          const fullName: string = meta.full_name ?? meta.name ?? '';
          const parts = fullName.trim().split(' ');
          const nombre = parts[0] ?? '';
          const apellido = parts.slice(1).join(' ') || '';
          if (nombre) {
            const { data: created } = await upsertProfile({ nombre, apellido });
            setProfile(created);
            setSchedule(created?.schedule ?? null);
            return;
          }
        }
        setProfile(data);
        setSchedule(data?.schedule ?? null);
      });
    }, [])
  );

  useEffect(() => {
    if (!userCoords || !profile?.home_lat || !profile?.home_lng) return;
    const dist = haversineDistance(userCoords.latitude, userCoords.longitude, profile.home_lat, profile.home_lng);
    const isNearHome = dist <= HOME_RADIUS_M;
    setAtHome(isNearHome);
    setAutoDetected(true);
  }, [userCoords, profile?.home_lat, profile?.home_lng]);

  useEffect(() => {
    if (!userCoords) return;
    (async () => {
      try {
        const Location = await import('expo-location');
        const [result] = await Location.reverseGeocodeAsync(userCoords);
        if (!result) return;
        const parts = [
          result.street && result.streetNumber
            ? `${result.street} ${result.streetNumber}`
            : result.street ?? null,
          result.district ?? result.subregion ?? result.city ?? null,
        ].filter(Boolean);
        setLocationLabel(parts.join(', ') || null);
      } catch {
        // silently ignore if unavailable
      }
    })();
  }, [userCoords?.latitude, userCoords?.longitude]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 13) return 'Buen día';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.logo}>orbit</Text>
          {activeTab !== 'alerts' && (
            <TouchableOpacity style={styles.notifBtn} onPress={() => switchTab('alerts')}>
              <Feather name="bell" size={20} color={GRAY} />
            </TouchableOpacity>
          )}
          {activeTab === 'alerts' && <View style={{ width: 28 }} />}
        </View>

        <View style={{ flex: 1, overflow: 'hidden' }} {...swipePan.panHandlers}>
          <Animated.View style={{ flexDirection: 'row', width: SCREEN_WIDTH * TABS.length, flex: 1, transform: [{ translateX: tabOffsetX }] }}>

        {/* ── Home tab ── */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.greetingSection}>
              <Text style={styles.greetingSub}>{greeting()},</Text>
              <View style={styles.greetingNameRow}>
                <Text style={styles.greetingName}>{userName}</Text>
                {myRating !== null && (
                  <TouchableOpacity
                    style={styles.starBadge}
                    activeOpacity={myRating < 3 ? 0.7 : 1}
                    onPress={() => myRating < 3 && setLowRatingVisible(true)}
                  >
                    <Text style={[styles.starValue, { color: starColor(myRating) }]}>
                      {myRating.toFixed(1)}
                    </Text>
                    <AntDesign
                      name={(myRating >= 3 ? 'star' : 'staro') as any}
                      size={20}
                      color={starColor(myRating)}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.statusCard}>
              <View style={styles.statusLabelRow}>
                <Text style={styles.statusLabel}>Estado actual</Text>
                {autoDetected && (
                  <View style={styles.autoBadge}>
                    <Feather name="zap" size={10} color="#10B981" />
                    <Text style={styles.autoBadgeText}>auto</Text>
                  </View>
                )}
              </View>
              <View style={styles.statusRow}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusDot, { backgroundColor: atHome ? '#10B981' : BODY }]} />
                  <Text style={styles.statusText}>{atHome ? 'Estoy en casa' : 'No estoy en casa'}</Text>
                </View>
                <Switch
                  value={atHome}
                  onValueChange={(v) => { setAtHome(v); setAutoDetected(false); }}
                  trackColor={{ false: '#1E2040', true: PURPLE }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <Text style={styles.statusSub}>
                {autoDetected
                  ? `Detectado por tu ubicación · radio ${HOME_RADIUS_M}m`
                  : atHome ? 'Tus ítems están disponibles' : 'Tus ítems están en pausa'}
              </Text>
              {locationLabel && (
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={11} color={BODY} />
                  <Text style={styles.locationText}>{locationLabel}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.scheduleCard}
              activeOpacity={0.75}
              onPress={() => router.push('/availability')}
            >
              <View style={styles.scheduleLeft}>
                <View style={styles.scheduleIconWrap}>
                  <Feather name="clock" size={16} color={PURPLE} />
                </View>
                <View>
                  <Text style={styles.scheduleTitle}>Disponibilidad habitual</Text>
                  <Text style={styles.scheduleValue}>{scheduleLabel(schedule)}</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={BODY} />
            </TouchableOpacity>

            {transactions.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.sectionTitle}>EN CURSO</Text>
                {transactions.map((tx) => {
                  const otherName = tx.isOwner
                    ? `${tx.borrower?.nombre ?? ''} ${tx.borrower?.apellido ?? ''}`.trim() || 'Vecino'
                    : `${tx.owner?.nombre ?? ''} ${tx.owner?.apellido ?? ''}`.trim() || 'Vecino';
                  const txStatus = tx.transaction_status ?? 'awaiting_delivery';

                  const stepLabels = tx.isOwner
                    ? ['Entregué', 'Devuelta', 'Listo']
                    : ['Recibí', 'Devolví', 'Listo'];
                  const stepIndex = tx.isOwner
                    ? (txStatus === 'awaiting_delivery' ? 0 : (txStatus === 'delivered' || txStatus === 'borrower_confirmed') ? 1 : txStatus === 'returned' ? 2 : 3)
                    : ((txStatus === 'awaiting_delivery' || txStatus === 'delivered') ? 0 : txStatus === 'borrower_confirmed' ? 1 : 2);

                  const showOwnerDeliverBtn = tx.isOwner && txStatus === 'awaiting_delivery';
                  const showBorrowerConfirmBtn = !tx.isOwner && txStatus === 'delivered';
                  const showBorrowerReturnBtn = !tx.isOwner && txStatus === 'borrower_confirmed';
                  const showOwnerConfirmReturnBtn = tx.isOwner && txStatus === 'returned';
                  const needsReview = tx.isOwner
                    ? txStatus === 'completed'
                    : (txStatus === 'returned' || txStatus === 'completed');
                  const isWaiting = !showOwnerDeliverBtn && !showBorrowerConfirmBtn && !showBorrowerReturnBtn && !showOwnerConfirmReturnBtn && !needsReview;

                  const accentColor = needsReview ? '#10B981' : isWaiting ? '#F59E0B' : PURPLE;
                  const statusLabel = needsReview ? '¡Listo!' : isWaiting ? 'Esperando' : 'Tu turno';

                  return (
                    <View key={tx.id} style={tr.cardWrap}>
                      <LinearGradient
                        colors={['#1C1640', '#0F1028']}
                        style={tr.card}
                      >
                        {/* Accent strip */}
                        <LinearGradient
                          colors={[accentColor, `${accentColor}55`]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={tr.accentStrip}
                        />

                        {/* Header */}
                        <View style={tr.cardHeader}>
                          <LinearGradient
                            colors={['rgba(139,92,246,0.3)', 'rgba(139,92,246,0.12)']}
                            style={tr.itemIcon}
                          >
                            <Feather name={tx.item?.icon ?? 'box'} size={22} color="#C4B5FD" />
                          </LinearGradient>
                          <View style={{ flex: 1 }}>
                            <Text style={tr.itemName} numberOfLines={1}>{tx.item?.name ?? 'Ítem'}</Text>
                            <Text style={tr.otherName}>Con {otherName}</Text>
                          </View>
                          <View style={[tr.statusPill, { borderColor: `${accentColor}55` }]}>
                            <View style={[tr.statusDot, { backgroundColor: accentColor }]} />
                            <Text style={[tr.statusText, { color: accentColor }]}>{statusLabel}</Text>
                          </View>
                        </View>

                        <View style={tr.divider} />

                        {/* Progress */}
                        {(() => {
                          const n = stepLabels.length;
                          const pct = (v: number) => `${v}%`;
                          const edgePct = 100 / (n * 2);
                          const donePct = stepIndex > 0
                            ? Math.min(stepIndex / (n - 1), 1) * (100 - 100 / n)
                            : 0;
                          return (
                            <View style={tr.stepsRow}>
                              {/* Gray track */}
                              <View style={[tr.stepsTrack, { left: pct(edgePct), right: pct(edgePct) } as any]} />
                              {/* Purple progress */}
                              {stepIndex > 0 && (
                                <View style={[tr.stepsTrackDone, { left: pct(edgePct), width: pct(donePct) } as any]} />
                              )}
                              {stepLabels.map((label, i) => {
                                const done = stepIndex > i;
                                const active = stepIndex === i;
                                return (
                                  <View key={i} style={tr.stepWrap}>
                                    <View style={[tr.stepDot, done && tr.stepDotDone, active && tr.stepDotActive]}>
                                      {done && <Feather name="check" size={11} color="#FFF" />}
                                    </View>
                                    <Text style={[tr.stepLabel, (done || active) && tr.stepLabelActive]}>{label}</Text>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })()}

                        {showOwnerDeliverBtn && (
                          <TouchableOpacity style={tr.actionWrap} activeOpacity={0.85} onPress={() => handleAdvanceStatus(tx.id, 'delivered')}>
                            <LinearGradient colors={['#7C3AED', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tr.actionBtn}>
                              <Text style={tr.actionText}>Entregué el ítem</Text>
                              <Feather name="arrow-right" size={16} color="#FFF" />
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                        {showBorrowerConfirmBtn && (
                          <TouchableOpacity style={tr.actionWrap} activeOpacity={0.85} onPress={() => handleAdvanceStatus(tx.id, 'borrower_confirmed')}>
                            <LinearGradient colors={['#0369A1', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tr.actionBtn}>
                              <Text style={tr.actionText}>Recibí el ítem</Text>
                              <Feather name="arrow-right" size={16} color="#FFF" />
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                        {showBorrowerReturnBtn && (
                          <TouchableOpacity style={tr.actionWrap} activeOpacity={0.85} onPress={() => handleAdvanceStatus(tx.id, 'returned')}>
                            <LinearGradient colors={['#059669', '#10B981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tr.actionBtn}>
                              <Text style={tr.actionText}>Lo devolví</Text>
                              <Feather name="arrow-right" size={16} color="#FFF" />
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                        {showOwnerConfirmReturnBtn && (
                          <TouchableOpacity style={tr.actionWrap} activeOpacity={0.85} onPress={() => handleAdvanceStatus(tx.id, 'completed')}>
                            <LinearGradient colors={['#7C3AED', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tr.actionBtn}>
                              <Text style={tr.actionText}>Recibí de vuelta el ítem</Text>
                              <Feather name="arrow-right" size={16} color="#FFF" />
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                        {needsReview && (
                          <View>
                            <Text style={tr.reviewLabel}>¿Cómo salió?</Text>
                            <View style={tr.reviewRow}>
                              <TouchableOpacity style={tr.okBtn} activeOpacity={0.75} onPress={() => handleReviewOk(tx)}>
                                <Feather name="thumbs-up" size={14} color="#10B981" />
                                <Text style={tr.okBtnText}>Todo bien</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={tr.problemBtn} activeOpacity={0.75} onPress={() => { setReportReservationId(tx.id); setShowReportModal(true); }}>
                                <Feather name="alert-circle" size={14} color="#F59E0B" />
                                <Text style={tr.problemBtnText}>Tuve un problema</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                        {isWaiting && (
                          <View style={tr.waitingRow}>
                            <View style={tr.waitingDot} />
                            <Text style={tr.waitingText}>
                              {tx.isOwner
                                ? `Esperando que ${otherName} te devuelva el ítem`
                                : txStatus === 'awaiting_delivery'
                                  ? `Esperando que ${otherName} te entregue el ítem`
                                  : `Esperando confirmación de ${otherName}`}
                            </Text>
                          </View>
                        )}
                      </LinearGradient>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.sectionTitle}>MIS ÍTEMS</Text>

            <TouchableOpacity style={styles.addBtn} activeOpacity={0.7} onPress={() => router.push('/add-item')}>
              <Feather name="plus" size={18} color={PURPLE} />
              <Text style={styles.addBtnText}>Agregar otro producto</Text>
            </TouchableOpacity>

            {loadingItems ? (
              <ActivityIndicator color={PURPLE} style={{ marginTop: 16 }} />
            ) : items.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="package" size={32} color={BODY} />
                <Text style={styles.emptyText}>Todavía no tenés productos{'\n'}Agregá uno para empezar</Text>
              </View>
            ) : null}

            {items.map((item) => (
              <View key={item.id} style={styles.itemSwipeWrap}>
                <Swipeable
                  ref={(ref) => { itemSwipeRefs.current[item.id] = ref; }}
                  renderRightActions={() => (
                    <TouchableOpacity
                      onPress={() => handleDeleteItem(item.id)}
                      activeOpacity={0.8}
                      style={styles.swipeDeleteWrap}
                    >
                      <View style={styles.swipeDelete}>
                        <Feather name="trash-2" size={22} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  )}
                  rightThreshold={60}
                >
                  <TouchableOpacity style={styles.itemCard} activeOpacity={0.75} onPress={() => router.push(`/item/${item.id}`)}>
                    <View style={[styles.itemCardInner, !atHome && styles.itemCardPaused]}>
                      <View style={[styles.itemIconWrap, !atHome && styles.itemIconWrapPaused]}>
                        <Feather name={item.icon as any} size={22} color={atHome ? '#C4B5FD' : BODY} />
                      </View>
                      <View style={styles.itemInfo}>
                        <View style={styles.itemTopRow}>
                          <Text style={[styles.itemName, !atHome && styles.textPaused]}>{item.name}</Text>
                          <View style={[styles.priceBadge, !atHome && styles.priceBadgePaused]}>
                            <Text style={[styles.priceText, !atHome && styles.textPaused]}>{item.price}</Text>
                          </View>
                        </View>
                        {item.location ? <Text style={styles.itemLocation}>{item.location}</Text> : null}
                        <View style={styles.itemTags}>
                          {atHome ? (
                            <View style={styles.availableTag}><Text style={styles.availableText}>Disponible</Text></View>
                          ) : (
                            <View style={styles.pausedTag}><Text style={styles.pausedText}>En pausa</Text></View>
                          )}
                          {item.note ? (
                            <View style={styles.noteTag}><Text style={styles.noteText}>{item.note}</Text></View>
                          ) : null}
                        </View>
                      </View>
                      <Feather name="chevron-right" size={18} color={BODY} />
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              </View>
            ))}

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>

        {/* ── Search tab ── */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <SearchTab userCoords={userCoords} />
        </View>

        {/* ── Alerts tab ── */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <AlertsTab />
        </View>

        {/* ── Profile tab ── */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <ProfileTab user={authUser} profile={profile} itemCount={items.length} onPlanetPress={() => setPlanetModalVisible(true)} myRating={myRating} monthlyEarnings={monthlyEarnings} referralStats={referralStats} />
        </View>

          </Animated.View>
        </View>
      </SafeAreaView>

      {/* Report modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowReportModal(false)} />
          <View style={tr.reportSheet}>
            <View style={tr.reportHandle} />
            <Text style={tr.reportTitle}>¿Qué pasó?</Text>
            <Text style={tr.reportSub}>Contanos el problema para poder ayudarte</Text>
            <TextInput
              style={tr.reportInput}
              placeholder="Describí el problema..."
              placeholderTextColor="#6B7280"
              value={reportText}
              onChangeText={setReportText}
              multiline
              maxLength={500}
              autoFocus
            />
            <TouchableOpacity
              style={[tr.reportSubmitWrap, !reportText.trim() && { opacity: 0.4 }]}
              onPress={handleSubmitReport}
              disabled={submittingReport || !reportText.trim()}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#DC2626', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={tr.reportSubmitBtn}
              >
                {submittingReport
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={tr.reportSubmitText}>Enviar reporte</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rating modal */}
      <Modal visible={!!ratingTx} transparent animationType="slide" onRequestClose={() => setRatingTx(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setRatingTx(null)} />
          <View style={tr.ratingSheet}>
            <View style={tr.reportHandle} />
            <Text style={tr.reportTitle}>
              Calificar a {ratingTx?.isOwner ? ratingTx?.borrower?.nombre : ratingTx?.owner?.nombre}
            </Text>
            <Text style={tr.reportSub}>¿Cómo fue tu experiencia?</Text>
            <View style={tr.starRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} activeOpacity={0.7} onPress={() => setRatingStars(s)}>
                  <AntDesign name={s <= ratingStars ? 'star' : 'staro' as any} size={38} color={s <= ratingStars ? '#F59E0B' : '#374151'} />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={tr.reportInput}
              placeholder="Dejá un comentario (opcional)..."
              placeholderTextColor="#6B7280"
              value={ratingComment}
              onChangeText={setRatingComment}
              multiline
              maxLength={300}
            />
            <TouchableOpacity style={tr.reportSubmitWrap} onPress={handleSubmitRating} disabled={submittingRating} activeOpacity={0.85}>
              <LinearGradient colors={['#7C3AED', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tr.reportSubmitBtn}>
                {submittingRating
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={tr.reportSubmitText}>Enviar calificación</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PlanetBenefitsModal
        visible={planetModalVisible}
        onClose={() => setPlanetModalVisible(false)}
        points={profile?.points ?? 0}
        profile={profile}
        user={authUser}
        myRating={myRating}
      />
      <LowRatingModal visible={lowRatingVisible} onClose={() => setLowRatingVisible(false)} />

      {/* Tab bar */}
      <SafeAreaView style={styles.tabBarSafe} edges={['bottom']}>
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            const badge = tab.key === 'alerts' && unreadNotifCount > 0 ? unreadNotifCount : 0;
            return (
              <TouchableOpacity key={tab.key} style={styles.tab} activeOpacity={0.7} onPress={() => switchTab(tab.key)}>
                <View style={{ position: 'relative' }}>
                  <Feather name={tab.icon as any} size={22} color={active ? PURPLE : BODY} />
                  {badge > 0 && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  logo: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#C4B5FD', letterSpacing: -0.5 },
  notifBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  greetingSection: { marginBottom: 20 },
  greetingSub: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 15, marginBottom: 2 },
  greetingNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetingName: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 30 },
  statusCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
    marginBottom: 12,
  },
  statusLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  autoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  autoBadgeText: { fontFamily: 'Inter_600SemiBold', color: '#10B981', fontSize: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 16 },
  statusSub: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.12)',
  },
  statRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statValue: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 20, marginBottom: 2 },
  statLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  sectionTitle: { fontFamily: 'Inter_700Bold', color: GRAY, fontSize: 11, letterSpacing: 1.2, marginBottom: 12 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderStyle: 'dashed',
    marginBottom: 10,
  },
  addBtnText: { fontFamily: 'Inter_600SemiBold', color: PURPLE, fontSize: 15 },
  itemCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.12)',
  },
  itemCardInner: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  itemCardPaused: { opacity: 0.5 },
  itemIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconWrapPaused: { backgroundColor: 'rgba(107, 114, 128, 0.1)' },
  itemInfo: { flex: 1 },
  itemTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  itemName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15, flex: 1 },
  textPaused: { color: BODY },
  priceBadge: { backgroundColor: 'rgba(139, 92, 246, 0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  priceBadgePaused: { backgroundColor: 'rgba(107, 114, 128, 0.15)' },
  priceText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 13 },
  itemLocation: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13, marginBottom: 8 },
  itemTags: { flexDirection: 'row', gap: 6 },
  availableTag: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  availableText: { fontFamily: 'Inter_600SemiBold', color: '#10B981', fontSize: 12 },
  pausedTag: { backgroundColor: 'rgba(107, 114, 128, 0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pausedText: { fontFamily: 'Inter_600SemiBold', color: BODY, fontSize: 12 },
  noteTag: { backgroundColor: 'rgba(34, 211, 238, 0.1)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  noteText: { fontFamily: 'Inter_400Regular', color: '#22D3EE', fontSize: 12 },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
    marginBottom: 12,
  },
  scheduleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scheduleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleTitle: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, marginBottom: 2 },
  scheduleValue: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14 },
  emptyState: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  emptyText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  tabBarSafe: { backgroundColor: CARD_BG },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 10,
    paddingBottom: 4,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
  tabLabelActive: { fontFamily: 'Inter_600SemiBold', color: PURPLE },
  tabBadge: {
    position: 'absolute', top: -5, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: PURPLE,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 9 },
  starBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  starValue: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  locationText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  itemSwipeWrap: { overflow: 'hidden', borderRadius: 16, marginBottom: 10 },
  swipeDeleteWrap: { width: 80, paddingLeft: 8, alignSelf: 'stretch' },
  swipeDelete: { flex: 1, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
});

// Profile tab styles
const pf = StyleSheet.create({
  scrollContent: { paddingHorizontal: 24, paddingTop: 8 },

  avatarSection: { alignItems: 'center', paddingVertical: 28 },

  // Verified: glowing ring
  glowWrap: { position: 'relative', marginBottom: 14 },
  glowRing: {
    padding: 3,
    borderRadius: (AVATAR_SIZE + 12) / 2,
    borderWidth: 2,
    borderColor: PURPLE,
    shadowColor: PURPLE,
    shadowOpacity: 0.7,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(139,92,246,0.2)',
  },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(139,92,246,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 36 },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Not verified: plain avatar
  avatarWrapPlain: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(139,92,246,0.2)',
    marginBottom: 14,
  },

  displayName: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 22, marginBottom: 4 },
  email: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 14, marginBottom: 10 },

  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  verifiedPillText: { fontFamily: 'Inter_600SemiBold', color: '#10B981', fontSize: 12 },

  incompleteCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    padding: 16,
    gap: 14,
    marginBottom: 28,
  },
  incompleteLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  incompleteTitle: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14, marginBottom: 2 },
  incompleteSub: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
  completeWrapper: { borderRadius: 14, overflow: 'hidden' },
  completeBtn: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  completeBtnText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 15 },

  sectionTitle: { fontFamily: 'Inter_700Bold', color: BODY, fontSize: 11, letterSpacing: 1.2, marginBottom: 12 },

  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.12)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, marginBottom: 2 },
  infoValue: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15 },
  infoDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },

  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    marginBottom: 32,
  },
  editBtnText: { fontFamily: 'Inter_600SemiBold', color: PURPLE, fontSize: 15 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: CARD_BG, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.12)',
  },
  statRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statValue: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 18, marginBottom: 2 },
  statLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
    backgroundColor: 'rgba(248,113,113,0.06)',
  },
  logoutText: { fontFamily: 'Inter_600SemiBold', color: '#F87171', fontSize: 15 },

  histBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    backgroundColor: 'rgba(139,92,246,0.07)',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  histBtnText: { fontFamily: 'Inter_600SemiBold', color: PURPLE, fontSize: 15, flex: 1 },

  inviteWrap: { borderRadius: 18, overflow: 'hidden', marginBottom: 16, shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  inviteCard: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  inviteLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  inviteIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  inviteEmoji: { fontSize: 24 },
  inviteTitle: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16, marginBottom: 3 },
  inviteSub: { fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 17 },
  inviteArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  helpBtnText: { fontFamily: 'Inter_600SemiBold', color: GRAY, fontSize: 15, flex: 1 },
  histEmpty: { alignItems: 'center', gap: 8, paddingVertical: 20, marginBottom: 24 },
  histEmptyText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  histList: { gap: 8, marginBottom: 24 },
  histCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  histIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  histItem: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14, marginBottom: 2 },
  histWith: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  histRolePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  histRoleLend: { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' },
  histRoleBorrow: { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' },
  histRoleText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  histRoleTextLend: { color: '#10B981' },
  histRoleTextBorrow: { color: '#3B82F6' },
});


// Planet benefits modal styles
const bm = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080A1A' },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 14,
  },
  title: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 18 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 24 },
  sectionLabel: {
    fontFamily: 'Inter_700Bold', color: GRAY, fontSize: 11, letterSpacing: 1.2,
    marginBottom: 10, marginTop: 4,
  },
  benefitsCard: {
    backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', marginBottom: 20, overflow: 'hidden',
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  benefitDot: { width: 8, height: 8, borderRadius: 4 },
  benefitText: { fontFamily: 'Inter_400Regular', color: '#FFFFFF', fontSize: 14 },
  publicCard: {
    backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 4,
  },
  publicRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  publicAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(139,92,246,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  publicAvatarImg: { width: 52, height: 52, borderRadius: 26 },
  publicAvatarInitial: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 22 },
  publicName: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16, marginBottom: 4 },
  publicPlanetRow: { flexDirection: 'row', alignItems: 'center' },
  publicPlanetName: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  publicPlanetSep: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
  publicPlanetDesc: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
  publicDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },
  publicStatsRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16 },
  publicStat: { flex: 1, alignItems: 'center' },
  publicStatVal: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 18, marginBottom: 2 },
  publicStatLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  publicVisibleHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  publicVisibleText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
});

// Low rating modal styles
const lm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 10, marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 17, marginBottom: 3 },
  sub: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  tipIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  tipText: { fontFamily: 'Inter_400Regular', color: '#FFFFFF', fontSize: 14, flex: 1, lineHeight: 20 },
});

// Transaction card styles
const tr = StyleSheet.create({
  cardWrap: {
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  card: {
    borderRadius: 18,
    padding: 16,
  },
  accentStrip: {
    height: 3,
    borderRadius: 2,
    marginBottom: 14,
    marginHorizontal: -16,
    marginTop: -16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  itemIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 15, marginBottom: 2 },
  otherName: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  dateLabel: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 11 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 14, marginHorizontal: -16 },
  stepsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, position: 'relative' },
  stepsTrack: { position: 'absolute', height: 1.5, backgroundColor: 'rgba(255,255,255,0.08)', top: 11 },
  stepsTrackDone: { position: 'absolute', height: 1.5, backgroundColor: PURPLE, top: 11 },
  stepWrap: { flex: 1, alignItems: 'center', gap: 5 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1C1640',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: PURPLE, borderColor: PURPLE },
  stepDotActive: {
    borderColor: PURPLE,
    backgroundColor: 'rgba(139,92,246,0.3)',
    shadowColor: PURPLE,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  stepLabel: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 10, textAlign: 'center' },
  stepLabelActive: { color: '#C4B5FD', fontFamily: 'Inter_600SemiBold' },
  actionWrap: { borderRadius: 14, overflow: 'hidden' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 15 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  waitingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  waitingText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
  reviewLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, marginBottom: 8 },
  reviewRow: { flexDirection: 'row', gap: 8 },
  okBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  okBtnText: { fontFamily: 'Inter_600SemiBold', color: '#10B981', fontSize: 13 },
  problemBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  problemBtnText: { fontFamily: 'Inter_600SemiBold', color: '#F59E0B', fontSize: 13 },
  reportSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  reportHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 10, marginBottom: 20,
  },
  reportTitle: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 18, marginBottom: 6 },
  reportSub: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13, marginBottom: 16 },
  reportInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    padding: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  ratingSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.15)',
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  starRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 10,
    marginBottom: 20,
  },
  reportSubmitWrap: { borderRadius: 14, overflow: 'hidden' },
  reportSubmitBtn: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportSubmitText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16 },
});
