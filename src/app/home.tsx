import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AlertsTab from '../components/AlertsTab';
import PlanetRank, { getPlanet, PlanetIcon, PLANETS } from '../components/PlanetRank';
import SearchTab from '../components/SearchTab';
import { fetchItems, fetchProfile, supabase } from '../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

const AVATAR_SIZE = 96;

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

// ─── Planet home card (compact widget) ──────────────────────────────────────

function PlanetHomeCard({ points, onPress }: { points: number; onPress: () => void }) {
  const { planet, index } = getPlanet(points);
  const isLast = index === PLANETS.length - 1;
  const progress = isLast ? 1 : (points - planet.minPts) / (planet.maxPts - planet.minPts);
  const ptsToNext = isLast ? 0 : planet.maxPts - points;
  const nextPlanet = isLast ? null : PLANETS[index + 1];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={{ marginBottom: 20 }}>
      <LinearGradient
        colors={[`${planet.glow}22`, `${planet.glow}06`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={hw.rankCard}
      >
        <PlanetIcon planet={planet} size={44} />
        <View style={{ flex: 1, paddingLeft: 14 }}>
          <View style={hw.rankTop}>
            <Text style={hw.rankLevel}>NIVEL {index + 1} · {planet.name.toUpperCase()}</Text>
            <View style={hw.rankPtsBadge}>
              <Text style={[hw.rankPtsVal, { color: planet.glow }]}>{points}</Text>
              <Text style={hw.rankPtsUnit}> pts</Text>
            </View>
          </View>
          <View style={hw.rankBarTrack}>
            <View style={[hw.rankBarFill, { width: `${Math.min(progress * 100, 100)}%` as any, backgroundColor: planet.glow, shadowColor: planet.glow }]} />
          </View>
          {!isLast && nextPlanet ? (
            <Text style={hw.rankSub}>{ptsToNext} pts para <Text style={{ color: nextPlanet.glow }}>{nextPlanet.name}</Text></Text>
          ) : (
            <Text style={[hw.rankSub, { color: planet.glow }]}>Nivel máximo 🏆</Text>
          )}
        </View>
        <Feather name="chevron-right" size={18} color={planet.glow} style={{ opacity: 0.7, marginLeft: 8 }} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Planet benefits modal ────────────────────────────────────────────────────

function PlanetBenefitsModal({
  visible, onClose, points, profile, user,
}: {
  visible: boolean; onClose: () => void; points: number; profile: any; user: any;
}) {
  const { planet, index } = getPlanet(points);
  const isLast = index === PLANETS.length - 1;
  const nextPlanet = isLast ? null : PLANETS[index + 1];
  const displayName = profile
    ? `${profile.nombre} ${profile.apellido}`
    : (user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Vos');
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
                { label: 'Reputación', value: '4.9 ★' },
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

function ProfileTab({ user, profile }: { user: any; profile: any }) {
  const loading = user === undefined;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={PURPLE} />
      </View>
    );
  }

  const avatarUrl = user?.user_metadata?.avatar_url ?? null;
  const displayName = profile
    ? `${profile.nombre} ${profile.apellido}`
    : (user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Vos');

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

      {/* Planet rank */}
      <PlanetRank points={85} />

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
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [authUser, setAuthUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [atHome, setAtHome] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [schedule, setSchedule] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [planetModalVisible, setPlanetModalVisible] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthUser(data.user);
      const name = data.user?.user_metadata?.full_name?.split(' ')[0]
        ?? data.user?.email?.split('@')[0]
        ?? 'Vos';
      setUserName(name);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchItems().then(({ data }) => {
        setItems(data ?? []);
        setLoadingItems(false);
      });
      fetchProfile().then(({ data }) => {
        setProfile(data);
        setSchedule(data?.schedule ?? null);
      });
    }, [])
  );

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
          <TouchableOpacity style={styles.notifBtn}>
            <Feather name="bell" size={20} color={GRAY} />
          </TouchableOpacity>
        </View>

        {/* ── Home content ── */}
        {activeTab === 'home' && (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.greetingSection}>
              <Text style={styles.greetingSub}>{greeting()},</Text>
              <View style={styles.greetingNameRow}>
                <Text style={styles.greetingName}>{userName}</Text>
                <Feather name="smile" size={26} color="#C4B5FD" />
              </View>
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>Estado actual</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusDot, { backgroundColor: atHome ? '#10B981' : BODY }]} />
                  <Text style={styles.statusText}>{atHome ? 'Estoy en casa' : 'No estoy en casa'}</Text>
                </View>
                <Switch
                  value={atHome}
                  onValueChange={setAtHome}
                  trackColor={{ false: '#1E2040', true: PURPLE }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <Text style={styles.statusSub}>
                {atHome ? 'Tus ítems están disponibles' : 'Tus ítems están en pausa'}
              </Text>
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

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>$4.800</Text>
                <Text style={styles.statLabel}>Este mes</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>7</Text>
                <Text style={styles.statLabel}>Reservas</Text>
              </View>
              <View style={styles.statCard}>
                <View style={styles.statRatingRow}>
                  <Text style={styles.statValue}>4.9</Text>
                  <Feather name="star" size={14} color={PURPLE} style={{ marginTop: 2 }} />
                </View>
                <Text style={styles.statLabel}>Reputación</Text>
              </View>
            </View>

            <PlanetHomeCard points={85} onPress={() => setPlanetModalVisible(true)} />

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
              <TouchableOpacity key={item.id} style={styles.itemCard} activeOpacity={0.75} onPress={() => router.push(`/item/${item.id}`)}>
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
            ))}

            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        {/* ── Profile content ── */}
        {activeTab === 'profile' && <ProfileTab user={authUser} profile={profile} />}

        {/* ── Reserve tab ── */}
        {activeTab === 'search' && <SearchTab />}

        {/* ── Alerts tab ── */}
        {activeTab === 'alerts' && <AlertsTab />}
      </SafeAreaView>

      <PlanetBenefitsModal
        visible={planetModalVisible}
        onClose={() => setPlanetModalVisible(false)}
        points={85}
        profile={profile}
        user={authUser}
      />

      {/* Tab bar */}
      <SafeAreaView style={styles.tabBarSafe} edges={['bottom']}>
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity key={tab.key} style={styles.tab} activeOpacity={0.7} onPress={() => setActiveTab(tab.key)}>
                <Feather name={tab.icon as any} size={22} color={active ? PURPLE : BODY} />
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
  greetingNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greetingName: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 30 },
  statusCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
    marginBottom: 12,
  },
  statusLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, marginBottom: 8 },
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
    marginBottom: 10,
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
});

// Planet home card styles
const hw = StyleSheet.create({
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  rankTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rankLevel: { fontFamily: 'Inter_700Bold', color: GRAY, fontSize: 10, letterSpacing: 1 },
  rankPtsBadge: { flexDirection: 'row', alignItems: 'baseline' },
  rankPtsVal: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  rankPtsUnit: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  rankBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  rankBarFill: {
    height: 4,
    borderRadius: 2,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  rankSub: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
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
