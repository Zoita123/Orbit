import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
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

const ORBIT_SIZE = Math.min(SW * 0.82, 320);
const CENTER_SIZE = 76;
const RING_1 = ORBIT_SIZE * 0.5;
const RING_2 = ORBIT_SIZE * 0.72;
const DOT_SIZE = 10;

function OrbitDot({
  ringSize,
  color,
  duration,
  startAngle = 0,
}: {
  ringSize: number;
  color: string;
  duration: number;
  startAngle?: number;
}) {
  const angle = useSharedValue(startAngle);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(startAngle + 360, { duration, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  const dotOffset = (ORBIT_SIZE - ringSize) / 2 - DOT_SIZE / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: ORBIT_SIZE,
          height: ORBIT_SIZE,
          alignItems: 'center',
        },
        animStyle,
      ]}
    >
      <View
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: color,
          marginTop: dotOffset,
          shadowColor: color,
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 8,
        }}
      />
    </Animated.View>
  );
}

function Ring({ size, opacity = 0.3 }: { size: number; opacity?: number }) {
  const offset = (ORBIT_SIZE - size) / 2;
  return (
    <View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: `rgba(139, 92, 246, ${opacity})`,
        top: offset,
        left: offset,
      }}
    />
  );
}

function NeighborCard({
  name,
  detail,
  style,
}: {
  name: string;
  detail: string;
  style?: object;
}) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.cardName}>{name}</Text>
      <Text style={styles.cardDetail}>{detail}</Text>
    </View>
  );
}

function PaginationDots({ total = 5, active = 0 }: { total?: number; active?: number }) {
  return (
    <View style={styles.pagination}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.paginationDot, i === active && styles.paginationDotActive]}
        />
      ))}
    </View>
  );
}

export default function LandingScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity hitSlop={12}>
            <Text style={styles.skipText}>Saltar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.orbitSection}>
          <View style={{ width: ORBIT_SIZE, height: ORBIT_SIZE }}>
            <Ring size={RING_2} opacity={0.25} />
            <Ring size={RING_1} opacity={0.35} />
            <View style={styles.centerIcon}>
              <Text style={styles.centerEmoji}>🏠</Text>
            </View>
            <OrbitDot ringSize={RING_2} color={BLUE} duration={7000} startAngle={60} />
            <OrbitDot ringSize={RING_1} color={CYAN} duration={4500} startAngle={300} />
          </View>

          <NeighborCard
            name="Martín"
            detail="Piso 8 · Lavarropas libre"
            style={styles.cardLeft}
          />
          <NeighborCard
            name="Sofía"
            detail="Piso 11 · Cochera disponible"
            style={styles.cardRight}
          />
        </View>

        <View style={styles.bottomContent}>
          <PaginationDots total={5} active={0} />
          <Text style={styles.eyebrow}>TU EDIFICIO. TU COMUNIDAD.</Text>
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
  orbitSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerIcon: {
    position: 'absolute',
    top: (ORBIT_SIZE - CENTER_SIZE) / 2,
    left: (ORBIT_SIZE - CENTER_SIZE) / 2,
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: 20,
    backgroundColor: '#1C1040',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerEmoji: {
    fontSize: 34,
  },
  card: {
    position: 'absolute',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardLeft: {
    bottom: '28%',
    left: 20,
  },
  cardRight: {
    bottom: '14%',
    left: '34%',
    zIndex: 1,
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDetail: {
    color: GRAY,
    fontSize: 13,
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  paginationDotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: PURPLE,
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
