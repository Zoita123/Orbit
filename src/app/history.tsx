import { AntDesign, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchCompletedTransactions, fetchUserReviews, supabase } from '../lib/supabase';
import { getPlanet } from '../components/PlanetRank';

const BG      = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE  = '#8B5CF6';
const GRAY    = '#9CA3AF';
const BODY    = '#6B7280';
const GREEN   = '#10B981';
const BLUE    = '#3B82F6';

const DELIVERY_LABEL: Record<string, string> = {
  porteria:      'Portería del edificio',
  espacio_comun: 'Espacio común',
  envio:         'Rappi / Uber Envíos',
  retiro:        'Retiro en persona',
  mano:          'En mano',
  rappi:         'Rappi / Uber',
  espacio:       'Espacio común',
};

const DELIVERY_ICON: Record<string, string> = {
  porteria:      'inbox',
  espacio_comun: 'users',
  envio:         'truck',
  retiro:        'package',
  mano:          'user',
  rappi:         'package',
  espacio:       'users',
};

const MONTH_ES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

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

type SubTab = 'lent' | 'borrowed';

// ─── User profile modal ───────────────────────────────────────────────────────

function UserProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [profile, setProfile]   = useState<any>(null);
  const [reviews, setReviews]   = useState<any[]>([]);
  const [items, setItems]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      fetchUserReviews(userId),
      supabase.from('items').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]).then(([{ data: prof }, { data: revs }, { data: itms }]) => {
      setProfile(prof ?? null);
      setReviews(revs ?? []);
      setItems(itms ?? []);
      setLoading(false);
    });
  }, [userId]);

  const displayName = profile
    ? `${profile.nombre ?? ''} ${profile.apellido ?? ''}`.trim() || 'Vecino'
    : '…';
  const initial = displayName[0]?.toUpperCase() ?? '?';
  const isVerified = !!(profile?.nombre && profile?.apellido && profile?.dni && profile?.telefono);
  const points  = profile?.points ?? 0;
  const { planet } = getPlanet(points);
  const avgRating = reviews.length
    ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
    : null;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={up.backdrop} onPress={onClose} />
      <View style={up.sheet}>
        <View style={up.handle} />

        <View style={up.topBar}>
          <Text style={up.sheetTitle}>Perfil</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Feather name="x" size={20} color={GRAY} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={PURPLE} style={{ marginTop: 32, marginBottom: 32 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

            {/* Avatar + name */}
            <View style={up.avatarSection}>
              <View style={[up.avatarWrap, isVerified && { borderColor: PURPLE, borderWidth: 2.5 }]}>
                <Text style={up.avatarInitial}>{initial}</Text>
              </View>
              {isVerified && (
                <View style={up.verifiedBadge}>
                  <Feather name="check" size={10} color="#FFF" />
                </View>
              )}
              <Text style={up.name}>{displayName}</Text>
              {isVerified && (
                <View style={up.verifiedPill}>
                  <Feather name="shield" size={11} color="#10B981" />
                  <Text style={up.verifiedText}>Perfil verificado</Text>
                </View>
              )}
            </View>

            {/* Stats */}
            <View style={up.statsRow}>
              <View style={up.statBox}>
                {avgRating !== null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={up.statVal}>{avgRating.toFixed(1)}</Text>
                    <AntDesign name="star" size={13} color="#F59E0B" />
                  </View>
                ) : (
                  <Text style={up.statVal}>—</Text>
                )}
                <Text style={up.statLabel}>Reputación</Text>
              </View>
              <View style={up.statDivider} />
              <View style={up.statBox}>
                <Text style={up.statVal}>{reviews.length}</Text>
                <Text style={up.statLabel}>Reseñas</Text>
              </View>
              <View style={up.statDivider} />
              <View style={up.statBox}>
                <Text style={[up.statVal, { color: planet.glow }]}>{planet.name}</Text>
                <Text style={up.statLabel}>{points} pts</Text>
              </View>
            </View>

            {/* Availability */}
            {profile?.schedule && scheduleLabel(profile.schedule) !== 'Sin configurar' && (
              <>
                <Text style={up.sectionLabel}>DISPONIBILIDAD HABITUAL</Text>
                <View style={up.scheduleCard}>
                  <View style={up.scheduleIconWrap}>
                    <Feather name="clock" size={15} color={PURPLE} />
                  </View>
                  <Text style={up.scheduleText}>{scheduleLabel(profile.schedule)}</Text>
                </View>
              </>
            )}

            {/* Items */}
            {items.length > 0 && (
              <>
                <Text style={up.sectionLabel}>ÍTEMS DISPONIBLES</Text>
                <View style={up.itemsList}>
                  {items.map((item) => (
                    <View key={item.id} style={up.itemRow}>
                      <View style={up.itemIcon}>
                        <Feather name={(item.icon ?? 'box') as any} size={16} color={PURPLE} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={up.itemName}>{item.name}</Text>
                        {item.price ? <Text style={up.itemPrice}>{item.price}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Reviews */}
            <Text style={up.sectionLabel}>RESEÑAS</Text>
            {reviews.length === 0 ? (
              <Text style={up.noReviews}>Todavía no tiene reseñas</Text>
            ) : (
              <View style={up.reviewsList}>
                {reviews.slice(0, 5).map((r) => {
                  const revName = r.reviewer
                    ? `${r.reviewer.nombre ?? ''} ${r.reviewer.apellido?.[0] ?? ''}.`.trim()
                    : 'Vecino';
                  return (
                    <View key={r.id} style={up.reviewCard}>
                      <View style={up.reviewHeader}>
                        <Text style={up.reviewerName}>{revName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <AntDesign
                              key={i}
                              name={i < r.rating ? 'star' : ('staro' as any)}
                              size={12}
                              color={i < r.rating ? '#F59E0B' : BODY}
                            />
                          ))}
                        </View>
                      </View>
                      {r.comment ? (
                        <Text style={up.reviewComment}>"{r.comment}"</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({ tx, onClose }: { tx: any; onClose: () => void }) {
  const [review, setReview]           = useState<any | null | undefined>(undefined);
  const [showUserProfile, setShowUserProfile] = useState(false);

  useEffect(() => {
    supabase
      .from('reviews')
      .select('rating, comment')
      .eq('reservation_id', tx.id)
      .maybeSingle()
      .then(({ data }) => setReview(data ?? null));
  }, [tx.id]);

  const accentColor = tx.isOwner ? GREEN : BLUE;
  const roleLabel   = tx.isOwner ? 'Prestaste' : 'Te prestaron';
  const otherName   = tx.isOwner
    ? `${tx.borrower?.nombre ?? ''} ${tx.borrower?.apellido ?? ''}`.trim() || 'Vecino'
    : `${tx.owner?.nombre ?? ''} ${tx.owner?.apellido ?? ''}`.trim() || 'Vecino';

  const [year, month, day] = (tx.date as string).split('-').map(Number);
  const dateLabel = `${day} de ${MONTH_ES[month - 1]} ${year}`;

  const deliveryKey = tx.delivery_method ?? '';
  const deliveryLabel = DELIVERY_LABEL[deliveryKey] ?? deliveryKey;
  const deliveryIcon  = (DELIVERY_ICON[deliveryKey] ?? 'package') as any;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={d.backdrop} onPress={onClose} />
      <View style={d.sheet}>
        <View style={d.handle} />

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Header */}
          <View style={d.modalHeader}>
            <View style={[d.rolePill, { backgroundColor: `${accentColor}22` }]}>
              <View style={[d.roleDot, { backgroundColor: accentColor }]} />
              <Text style={[d.roleText, { color: accentColor }]}>{roleLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={GRAY} />
            </TouchableOpacity>
          </View>

          {/* Item */}
          <View style={d.itemRow}>
            <View style={[d.itemIcon, { backgroundColor: `${accentColor}22` }]}>
              <Feather name={(tx.item?.icon ?? 'box') as any} size={24} color={accentColor} />
            </View>
            <Text style={d.itemName}>{tx.item?.name ?? 'Ítem'}</Text>
          </View>

          {/* Person */}
          <TouchableOpacity style={d.personRow} activeOpacity={0.75} onPress={() => setShowUserProfile(true)}>
            <View style={[d.personAvatar, { borderColor: accentColor }]}>
              <Text style={[d.personInitial, { color: accentColor }]}>{otherName[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={d.personLabel}>{tx.isOwner ? 'Lo usó' : 'Dueño del ítem'}</Text>
              <Text style={d.personName}>{otherName}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={BODY} />
          </TouchableOpacity>

          {/* Info grid */}
          <View style={d.infoGrid}>
            <View style={d.infoCell}>
              <Feather name="calendar" size={14} color={BODY} />
              <Text style={d.infoCellLabel}>Fecha</Text>
              <Text style={d.infoCellValue}>{dateLabel}</Text>
            </View>
            <View style={d.infoDivider} />
            <View style={d.infoCell}>
              <Feather name="clock" size={14} color={BODY} />
              <Text style={d.infoCellLabel}>Horario</Text>
              <Text style={d.infoCellValue}>{tx.time_from} – {tx.time_to}</Text>
            </View>
            <View style={d.infoDivider} />
            <View style={d.infoCell}>
              <Feather name="check-circle" size={14} color={GREEN} />
              <Text style={d.infoCellLabel}>Estado</Text>
              <Text style={[d.infoCellValue, { color: GREEN }]}>Completado</Text>
            </View>
          </View>

          {/* Delivery */}
          {deliveryLabel ? (
            <View style={d.section}>
              <Text style={d.sectionLabel}>ENTREGA</Text>
              <View style={d.deliveryCard}>
                <View style={d.deliveryIcon}>
                  <Feather name={deliveryIcon} size={18} color={PURPLE} />
                </View>
                <Text style={d.deliveryText}>{deliveryLabel}</Text>
              </View>
            </View>
          ) : null}

          {/* Program */}
          {tx.program ? (
            <View style={d.section}>
              <Text style={d.sectionLabel}>PROGRAMA</Text>
              <View style={d.chip}>
                <Feather name="sliders" size={13} color={PURPLE} />
                <Text style={d.chipText}>{tx.program}</Text>
              </View>
            </View>
          ) : null}

          {/* Review received */}
          {review !== undefined && (
            <View style={d.section}>
              <Text style={d.sectionLabel}>RESEÑA RECIBIDA</Text>
              {review === null ? (
                <Text style={d.noReview}>Sin reseña todavía</Text>
              ) : (
                <View style={d.reviewCard}>
                  <View style={d.reviewStars}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <AntDesign
                        key={i}
                        name={i < review.rating ? 'star' : ('staro' as any)}
                        size={16}
                        color={i < review.rating ? starColor(review.rating) : BODY}
                      />
                    ))}
                    <Text style={[d.reviewRating, { color: starColor(review.rating) }]}>
                      {review.rating.toFixed(1)}
                    </Text>
                  </View>
                  {review.comment ? (
                    <Text style={d.reviewComment}>"{review.comment}"</Text>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {/* Problem report */}
          {tx.problem_description ? (
            <View style={d.section}>
              <Text style={d.sectionLabel}>PROBLEMA REPORTADO</Text>
              <View style={d.problemCard}>
                <Feather name="alert-triangle" size={14} color="#F87171" style={{ marginTop: 1 }} />
                <Text style={d.problemText}>{tx.problem_description}</Text>
              </View>
            </View>
          ) : null}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>

      {showUserProfile && (
        <UserProfileModal
          userId={tx.isOwner ? tx.borrower_id : tx.owner_id}
          onClose={() => setShowUserProfile(false)}
        />
      )}
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const [sub, setSub]         = useState<SubTab>('lent');
  const [all, setAll]         = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchCompletedTransactions().then(({ data }) => {
        setAll(data ?? []);
        setLoading(false);
      });
    }, [])
  );

  const items = all.filter((tx) => sub === 'lent' ? tx.isOwner : !tx.isOwner);

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={GRAY} />
          </TouchableOpacity>
          <Text style={s.title}>Historial</Text>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      {/* Sub-tabs */}
      <View style={s.subBar}>
        <TouchableOpacity
          style={[s.subTab, sub === 'lent' && s.subTabActive]}
          onPress={() => setSub('lent')}
          activeOpacity={0.75}
        >
          <Feather name="arrow-up-circle" size={15} color={sub === 'lent' ? GREEN : BODY} />
          <Text style={[s.subTabText, sub === 'lent' && s.subTabTextLend]}>Presté</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.subTab, sub === 'borrowed' && s.subTabActive]}
          onPress={() => setSub('borrowed')}
          activeOpacity={0.75}
        >
          <Feather name="arrow-down-circle" size={15} color={sub === 'borrowed' ? BLUE : BODY} />
          <Text style={[s.subTabText, sub === 'borrowed' && s.subTabTextBorrow]}>Me prestaron</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={PURPLE} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Feather name="inbox" size={32} color={BODY} />
          <Text style={s.emptyText}>
            {sub === 'lent'
              ? 'Todavía no prestaste ningún ítem'
              : 'Todavía no te prestaron ningún ítem'}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {items.map((tx) => {
            const otherName = tx.isOwner
              ? `${tx.borrower?.nombre ?? ''} ${tx.borrower?.apellido ?? ''}`.trim() || 'Vecino'
              : `${tx.owner?.nombre ?? ''} ${tx.owner?.apellido ?? ''}`.trim() || 'Vecino';
            const [year, month, day] = (tx.date as string).split('-').map(Number);
            const accentColor = tx.isOwner ? GREEN : BLUE;
            return (
              <TouchableOpacity
                key={tx.id}
                style={s.cardWrap}
                activeOpacity={0.8}
                onPress={() => setSelected(tx)}
              >
                <LinearGradient colors={['#1C1640', '#0F1028']} style={s.card}>
                  <View style={[s.accentStrip, { backgroundColor: accentColor }]} />
                  <View style={s.cardRow}>
                    <View style={[s.iconWrap, { backgroundColor: `${accentColor}22` }]}>
                      <Feather name={(tx.item?.icon ?? 'box') as any} size={20} color={accentColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName} numberOfLines={1}>{tx.item?.name ?? 'Ítem'}</Text>
                      <Text style={s.withText}>Con {otherName}</Text>
                    </View>
                    <View style={s.dateWrap}>
                      <Text style={s.dateText}>{day}/{month}/{year}</Text>
                      <Feather name="chevron-right" size={14} color={BODY} style={{ marginTop: 4 }} />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {selected && <DetailModal tx={selected} onClose={() => setSelected(null)} />}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerSafe: { backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { padding: 4 },
  title: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 17 },

  subBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: CARD_BG,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  subTabActive: { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' },
  subTabText: { fontFamily: 'Inter_600SemiBold', color: BODY, fontSize: 14 },
  subTabTextLend: { color: GREEN },
  subTabTextBorrow: { color: BLUE },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
  emptyText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 14, textAlign: 'center' },

  list: { padding: 20, gap: 10 },
  cardWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.15)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  card: { padding: 14 },
  accentStrip: { height: 2, borderRadius: 1, marginBottom: 12, marginHorizontal: -14, marginTop: -14 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15, marginBottom: 2 },
  withText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
  dateWrap: { alignItems: 'flex-end' },
  dateText: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 12 },
});

const d = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 20,
    maxHeight: '88%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10, marginBottom: 16,
  },

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  roleDot: { width: 7, height: 7, borderRadius: 3.5 },
  roleText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  itemIcon: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 20, flex: 1 },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  personAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  personInitial: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  personLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, marginBottom: 2 },
  personName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15 },

  infoGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 20,
  },
  infoCell: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14 },
  infoCellLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
  infoCellValue: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 13, textAlign: 'center' },
  infoDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 10 },

  section: { marginBottom: 18 },
  sectionLabel: { fontFamily: 'Inter_700Bold', color: BODY, fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },

  deliveryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  deliveryIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(139,92,246,0.15)', alignItems: 'center', justifyContent: 'center' },
  deliveryText: { fontFamily: 'Inter_500Medium', color: '#FFFFFF', fontSize: 14, flex: 1 },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  chipText: { fontFamily: 'Inter_600SemiBold', color: PURPLE, fontSize: 13 },

  noReview: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13, fontStyle: 'italic' },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14, gap: 8,
  },
  reviewStars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewRating: { fontFamily: 'Inter_700Bold', fontSize: 15, marginLeft: 4 },
  reviewComment: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },

  problemCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(248,113,113,0.07)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.2)',
    padding: 12,
  },
  problemText: { fontFamily: 'Inter_400Regular', color: '#F87171', fontSize: 13, flex: 1, lineHeight: 18 },
});

const up = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  sheetTitle: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 17 },

  avatarSection: { alignItems: 'center', paddingVertical: 20, position: 'relative' },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  avatarInitial: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 30 },
  verifiedBadge: {
    position: 'absolute', top: 54, right: '50%',
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#10B981', borderWidth: 2, borderColor: CARD_BG,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ translateX: -22 }],
  },
  name: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 20, marginBottom: 6 },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },
  verifiedText: { fontFamily: 'Inter_600SemiBold', color: '#10B981', fontSize: 12 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 24,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 3 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 10 },
  statVal: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 17 },
  statLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },

  sectionLabel: { fontFamily: 'Inter_700Bold', color: BODY, fontSize: 10, letterSpacing: 1.2, marginBottom: 10 },

  itemsList: { gap: 8, marginBottom: 24 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
  },
  itemIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(139,92,246,0.12)', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14 },
  itemPrice: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, marginTop: 2 },

  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    marginBottom: 24,
  },
  scheduleIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  scheduleText: { fontFamily: 'Inter_500Medium', color: '#FFFFFF', fontSize: 14, flex: 1 },

  noReviews: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13, fontStyle: 'italic', marginBottom: 24 },
  reviewsList: { gap: 8, marginBottom: 24 },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12, gap: 6,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewerName: { fontFamily: 'Inter_600SemiBold', color: GRAY, fontSize: 13 },
  reviewComment: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
});
