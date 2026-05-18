import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SW } = Dimensions.get('window');

const BG = '#080A1A';
const PURPLE = '#8B5CF6';
const CYAN = '#22D3EE';
const BLUE = '#60A5FA';
const CARD_BG = '#13142A';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

const SCENE_W = SW - 40;
const SCENE_H = 230;
const RING_SIZE = SCENE_W * 0.46;
const CENTER_SIZE = 50;
const CARD_W = Math.round(SCENE_W * 0.52);
const DOT_SIZE = 8;

// Angles where the dot passes "behind" each card (0 = top, clockwise)
const MARTIN_ANGLE = 50;
const SOFIA_ANGLE = 230;
const GLOW_RANGE = 52;

function NeighborCard({
  address,
  name,
  icon,
  iconColor,
  item,
}: {
  address: string;
  name: string;
  icon: string;
  iconColor: string;
  item: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardAddress}>{address}</Text>
      <Text style={styles.cardName}>{name}</Text>
      <View style={styles.cardItemRow}>
        <Feather name={icon as any} size={12} color={iconColor} style={{ marginRight: 5 }} />
        <Text style={styles.cardDetail}>{item}</Text>
      </View>
    </View>
  );
}

function StepLines({ total = 3, active = 0 }: { total?: number; active?: number }) {
  return (
    <View style={styles.pagination}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.stepLine, i === active ? styles.stepLineActive : styles.stepLineInactive]}
        />
      ))}
    </View>
  );
}

export default function LandingScreen() {
  const angle = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(angle);
    angle.value = 0;
    angle.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const dotArmStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  const martinGlowStyle = useAnimatedStyle(() => {
    'worklet';
    const a = ((angle.value % 360) + 360) % 360;
    let diff = Math.abs(a - MARTIN_ANGLE);
    if (diff > 180) diff = 360 - diff;
    return { shadowOpacity: Math.max(0, 1 - diff / GLOW_RANGE) * 0.9 };
  });

  const sofiaGlowStyle = useAnimatedStyle(() => {
    'worklet';
    const a = ((angle.value % 360) + 360) % 360;
    let diff = Math.abs(a - SOFIA_ANGLE);
    if (diff > 180) diff = 360 - diff;
    return { shadowOpacity: Math.max(0, 1 - diff / GLOW_RANGE) * 0.9 };
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity hitSlop={12}>
            <Text style={styles.skipText}>Saltar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          <Text style={styles.orbitTitle}>orbit</Text>
          <View style={styles.heroMid}>
          <View style={{ width: SCENE_W, height: SCENE_H }}>
            {/* Static ring */}
            <View style={styles.ring} />

            {/* Orbiting dot — rendered before cards so it's behind them */}
            <Animated.View pointerEvents="none" style={[styles.dotArm, dotArmStyle]}>
              <View style={styles.dot} />
            </Animated.View>

            {/* Center house icon */}
            <View style={styles.centerIcon}>
              <Feather name="home" size={22} color={PURPLE} />
            </View>

            {/* Martín — upper right, glows when dot passes behind */}
            <Animated.View style={[styles.floatCard, { right: 0, top: 5 }, martinGlowStyle]}>
              <NeighborCard
                address="Piso 8"
                name="Martín"
                icon="tool"
                iconColor={BLUE}
                item="Lavarropas libre"
              />
            </Animated.View>

            {/* Sofía — lower left, glows when dot passes behind */}
            <Animated.View style={[styles.floatCard, { left: 0, bottom: 5 }, sofiaGlowStyle]}>
              <NeighborCard
                address="Piso 11"
                name="Sofía"
                icon="home"
                iconColor={CYAN}
                item="Cochera disponible"
              />
            </Animated.View>
          </View>
          </View>
        </View>

        <View style={styles.bottomContent}>
          <StepLines total={3} active={0} />
          <Text style={styles.eyebrow}>TU CERCANÍA. TU COMUNIDAD.</Text>
          <Text style={styles.headline}>
            La ayuda estaba{' '}
            <Text style={styles.headlineAccent}>más cerca</Text>
            {' '}de lo que creías
          </Text>
          <Text style={styles.body}>
            Tus vecinos tienen exactamente lo que necesitás. Orbit conecta a todos en el
            mismo edificio para compartir, alquilar y apoyarse — a metros de tu puerta.
          </Text>
          <TouchableOpacity activeOpacity={0.85} style={styles.ctaWrapper}>
            <LinearGradient
              colors={['#7C3AED', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Descubrir cómo →</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.loginText}>Ya tengo cuenta</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  safe: {
    flex: 1,
  },
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 4,
  },
  skipText: {
    color: GRAY,
    fontSize: 16,
    fontWeight: '500',
  },
  heroSection: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
  },
  orbitTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 26,
    color: '#C4B5FD',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroMid: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    top: (SCENE_H - RING_SIZE) / 2,
    left: (SCENE_W - RING_SIZE) / 2,
  },
  dotArm: {
    position: 'absolute',
    top: (SCENE_H - RING_SIZE) / 2,
    left: (SCENE_W - RING_SIZE) / 2,
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: PURPLE,
    marginTop: -DOT_SIZE / 2,
    shadowColor: PURPLE,
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 6,
  },
  centerIcon: {
    position: 'absolute',
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    backgroundColor: '#1C1040',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    top: (SCENE_H - CENTER_SIZE) / 2,
    left: (SCENE_W - CENTER_SIZE) / 2,
    shadowColor: PURPLE,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  floatCard: {
    position: 'absolute',
    width: CARD_W,
    shadowColor: PURPLE,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  cardAddress: {
    color: PURPLE,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
  },
  cardItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDetail: {
    color: GRAY,
    fontSize: 12,
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  stepLine: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  stepLineActive: {
    backgroundColor: PURPLE,
  },
  stepLineInactive: {
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
  },
  bottomContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  eyebrow: {
    color: PURPLE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 42,
    marginBottom: 14,
  },
  headlineAccent: {
    color: PURPLE,
  },
  body: {
    color: BODY,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 24,
  },
  ctaWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  ctaButton: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  loginText: {
    color: GRAY,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 6,
  },
});
