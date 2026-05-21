import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteItem, fetchItemById } from '../../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

const ICON_LABELS: Record<string, string> = {
  'refresh-cw': 'Lavarropas',
  'printer': 'Impresora',
  'tool': 'Herramienta',
  'package': 'Otra',
};

const MOCK_REVIEWS = [
  { id: 1, name: 'Martina G.', rating: 5, comment: 'Excelente! Muy buen estado, Camila muy amable. Lo recomiendo.', date: 'hace 3 días' },
  { id: 2, name: 'Santiago R.', rating: 5, comment: 'Todo perfecto, el producto tal como lo describe. Volvería a alquilarlo.', date: 'hace 1 semana' },
  { id: 3, name: 'Julia M.', rating: 4, comment: 'Muy buena experiencia, súper fácil la coordinación.', date: 'hace 2 semanas' },
];

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Feather key={i} name="star" size={12} color={i <= rating ? '#FCD34D' : 'rgba(255,255,255,0.12)'} />
      ))}
    </View>
  );
}

const DRUM = 110;
const BAFFLE_W = 8;
const BAFFLE_H = 30;

function WashingMachineHero() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(spin, {
      toValue: 1000,
      duration: 1000 * 3000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, []);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  return (
    <View style={wm.body}>
      {/* Top strip */}
      <View style={wm.topStrip}>
        <View style={wm.knob} />
        <View style={wm.display}>
          <Text style={wm.displayText}>AUTO</Text>
        </View>
      </View>

      {/* Door */}
      <View style={wm.doorOuter}>
        <View style={wm.doorInner}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
            {[0, 120, 240].map((deg) => (
              <View
                key={deg}
                style={[wm.baffle, { transform: [{ rotate: `${deg}deg` }, { translateY: -28 }] }]}
              />
            ))}
          </Animated.View>
          <View style={wm.axis} />
        </View>
      </View>
    </View>
  );
}

const wm = StyleSheet.create({
  body: {
    width: 160,
    backgroundColor: '#0D0E20',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },
  topStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PURPLE,
    borderWidth: 2.5,
    borderColor: 'rgba(196,181,253,0.3)',
  },
  display: {
    backgroundColor: '#05060E',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  displayText: {
    fontFamily: 'Inter_700Bold',
    color: '#C4B5FD',
    fontSize: 10,
    letterSpacing: 1.5,
  },
  doorOuter: {
    alignSelf: 'center',
    width: DRUM + 16,
    height: DRUM + 16,
    borderRadius: (DRUM + 16) / 2,
    backgroundColor: '#07081A',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorInner: {
    width: DRUM,
    height: DRUM,
    borderRadius: DRUM / 2,
    backgroundColor: '#03030A',
    borderWidth: 2,
    borderColor: 'rgba(139,92,246,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  baffle: {
    position: 'absolute',
    width: BAFFLE_W,
    height: BAFFLE_H,
    top: (DRUM - BAFFLE_H) / 2,
    left: (DRUM - BAFFLE_W) / 2,
    borderRadius: BAFFLE_W / 2,
    backgroundColor: 'rgba(139, 92, 246, 0.35)',
  },
  axis: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(196,181,253,0.5)',
  },
});

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchItemById(id).then(({ data }) => {
      setItem(data);
      setLoading(false);
    });
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      'Eliminar producto',
      '¿Seguro que querés eliminar este producto? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            await deleteItem(id);
            router.back();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PURPLE} size="large" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: GRAY }}>Producto no encontrado</Text>
      </View>
    );
  }

  const avgRating = (MOCK_REVIEWS.reduce((a, r) => a + r.rating, 0) / MOCK_REVIEWS.length).toFixed(1);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mi producto</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <LinearGradient colors={['#1C1040', '#0D0E22']} style={styles.hero}>
          {item.icon === 'refresh-cw' ? (
            <WashingMachineHero />
          ) : (
            <>
              <View style={styles.heroGlow} />
              <View style={styles.heroIconWrap}>
                <Feather name={item.icon as any} size={72} color="#C4B5FD" />
              </View>
            </>
          )}
        </LinearGradient>

        <View style={styles.content}>

          {/* Badges */}
          <View style={styles.badgesRow}>
            <View style={[styles.badge, item.available ? styles.badgeAvailable : styles.badgePaused]}>
              <View style={[styles.badgeDot, { backgroundColor: item.available ? '#10B981' : BODY }]} />
              <Text style={[styles.badgeText, { color: item.available ? '#10B981' : BODY }]}>
                {item.available ? 'Disponible' : 'En pausa'}
              </Text>
            </View>
            <View style={styles.badgeRating}>
              <Feather name="star" size={12} color="#FCD34D" />
              <Text style={styles.badgeRatingText}>{avgRating} · {MOCK_REVIEWS.length} reseñas</Text>
            </View>
          </View>

          {/* Name + price */}
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemPrice}>{item.price}</Text>

          {/* Spec chips */}
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Feather name={item.icon as any} size={13} color={PURPLE} />
              <Text style={styles.chipText}>{ICON_LABELS[item.icon] ?? 'Producto'}</Text>
            </View>
            {item.location ? (
              <View style={styles.chip}>
                <Feather name="map-pin" size={13} color={PURPLE} />
                <Text style={styles.chipText}>{item.location}</Text>
              </View>
            ) : null}
            {item.note ? (
              <View style={[styles.chip, styles.chipCyan]}>
                <Feather name="droplet" size={13} color="#22D3EE" />
                <Text style={[styles.chipText, { color: '#22D3EE' }]}>{item.note}</Text>
              </View>
            ) : null}
          </View>

          {/* Stats */}
          <Text style={styles.sectionTitle}>ESTADÍSTICAS</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Feather name="repeat" size={18} color={PURPLE} />
              <Text style={styles.statValue}>12</Text>
              <Text style={styles.statLabel}>Usos totales</Text>
            </View>
            <View style={styles.statCard}>
              <Feather name="dollar-sign" size={18} color="#10B981" />
              <Text style={styles.statValue}>$9.600</Text>
              <Text style={styles.statLabel}>Generado</Text>
            </View>
            <View style={styles.statCard}>
              <Feather name="clock" size={18} color="#F59E0B" />
              <Text style={styles.statValue}>8 hs</Text>
              <Text style={styles.statLabel}>Tiempo total</Text>
            </View>
          </View>

          {/* Programas — solo lavarropas */}
          {item.icon === 'refresh-cw' && Array.isArray(item.programs) && item.programs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>PROGRAMAS DISPONIBLES</Text>
              <View style={styles.programsCard}>
                {item.programs.map((p: { name: string; duration?: string }, i: number) => (
                  <View key={p.name}>
                    {i > 0 && <View style={styles.programDivider} />}
                    <View style={styles.programRow}>
                      <View style={styles.programDot} />
                      <Text style={styles.programName}>{p.name}</Text>
                      {p.duration ? (
                        <View style={styles.durationBadge}>
                          <Feather name="clock" size={11} color={PURPLE} />
                          <Text style={styles.durationText}>{p.duration}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Reviews */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RESEÑAS</Text>
            <View style={styles.ratingPill}>
              <Feather name="star" size={11} color="#FCD34D" />
              <Text style={styles.ratingPillText}>{avgRating} · {MOCK_REVIEWS.length} reseñas</Text>
            </View>
          </View>

          {MOCK_REVIEWS.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAvatar}>
                  <Text style={styles.reviewAvatarText}>{review.name[0]}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.reviewName}>{review.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Stars rating={review.rating} />
                    <Text style={styles.reviewDate}>{review.date}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.reviewComment}>{review.comment}</Text>
            </View>
          ))}

          <View style={{ height: 16 }} />
        </View>
      </ScrollView>

      {/* Fixed bottom bar */}
      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.editWrapper}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/add-item', params: { editId: id } })}
          >
            <LinearGradient
              colors={['#7C3AED', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.editBtn}
            >
              <Feather name="edit-2" size={18} color="#FFFFFF" />
              <Text style={styles.editBtnText}>Modificar</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            disabled={deleting}
            activeOpacity={0.75}
          >
            {deleting
              ? <ActivityIndicator color="#F87171" size="small" />
              : <>
                  <Feather name="trash-2" size={18} color="#F87171" />
                  <Text style={styles.deleteBtnText}>Eliminar</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  headerSafe: { backgroundColor: 'transparent', zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 17 },

  hero: {
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  heroIconWrap: {
    width: 130,
    height: 130,
    borderRadius: 36,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {},
  content: { paddingHorizontal: 24, paddingTop: 20 },

  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeAvailable: { backgroundColor: 'rgba(16, 185, 129, 0.12)' },
  badgePaused: { backgroundColor: 'rgba(107, 114, 128, 0.12)' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  badgeRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(252, 211, 77, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeRatingText: { fontFamily: 'Inter_600SemiBold', color: '#FCD34D', fontSize: 12 },

  itemName: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 24, lineHeight: 30, marginBottom: 6 },
  itemPrice: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 20, marginBottom: 18 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  chipCyan: { borderColor: 'rgba(34, 211, 238, 0.2)', backgroundColor: 'rgba(34, 211, 238, 0.06)' },
  chipText: { fontFamily: 'Inter_500Medium', color: GRAY, fontSize: 13 },

  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    color: BODY,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(252, 211, 77, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  ratingPillText: { fontFamily: 'Inter_600SemiBold', color: '#FCD34D', fontSize: 11 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  statValue: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16 },
  statLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11, textAlign: 'center' },

  reviewCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 15 },
  reviewName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14 },
  reviewDate: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
  reviewComment: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 14, lineHeight: 20 },

  programsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 28,
    overflow: 'hidden',
  },
  programDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  programDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PURPLE,
    opacity: 0.7,
  },
  programName: { fontFamily: 'Inter_500Medium', color: '#FFFFFF', fontSize: 15, flex: 1 },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  durationText: { fontFamily: 'Inter_600SemiBold', color: '#C4B5FD', fontSize: 12 },

  bottomSafe: { backgroundColor: CARD_BG, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  editWrapper: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  editBtn: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editBtnText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16 },
  deleteBtn: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteBtnText: { fontFamily: 'Inter_600SemiBold', color: '#F87171', fontSize: 10 },
});
