import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
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

const { width: SW, height: SH } = Dimensions.get('window');
const ORBIT_H = Math.round(SH * 0.44);

const BG = '#080A1A';
const PURPLE = '#8B5CF6';
const CARD_BG = '#13142A';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

const ORBIT_SIZE = Math.min(SW * 0.64, 250);
const RING_1 = ORBIT_SIZE * 0.46;
const RING_2 = ORBIT_SIZE * 0.82;
const NODE_SIZE = 42;
const CENTER_SIZE = 52;

const ICON_CONFIGS = [
  { ringSize: RING_2, icon: 'truck',        color: '#60A5FA', duration: 24000, startAngle: 30  },
  { ringSize: RING_2, icon: 'printer',      color: '#A78BFA', duration: 19000, startAngle: 155 },
  { ringSize: RING_1, icon: 'shopping-bag', color: '#22D3EE', duration: 14000, startAngle: 200 },
  { ringSize: RING_2, icon: 'tool',         color: '#C4B5FD', duration: 30000, startAngle: 285 },
];

function OrbitIcon({
  ringSize,
  icon,
  color,
  duration,
  startAngle = 0,
}: {
  ringSize: number;
  icon: string;
  color: string;
  duration: number;
  startAngle?: number;
}) {
  const angle = useSharedValue(startAngle);

  useEffect(() => {
    cancelAnimation(angle);
    angle.value = startAngle;
    angle.value = withRepeat(
      withTiming(startAngle + 360, { duration, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `-${angle.value}deg` }],
  }));

  const nodeOffset = (ORBIT_SIZE - ringSize) / 2 - NODE_SIZE / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: 0, left: 0, width: ORBIT_SIZE, height: ORBIT_SIZE, alignItems: 'center' },
        outerStyle,
      ]}
    >
      <Animated.View
        style={[
          { width: NODE_SIZE, height: NODE_SIZE, marginTop: nodeOffset, alignItems: 'center', justifyContent: 'center' },
          innerStyle,
        ]}
      >
        <View style={[styles.iconNode, { shadowColor: color }]}>
          <Feather name={icon as any} size={18} color={color} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function Ring({ size, opacity = 0.28 }: { size: number; opacity?: number }) {
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

export default function Screen2() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={12}>
            <Text style={styles.skipText}>Saltar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stepLinesWrap}>
          <StepLines total={3} active={1} />
        </View>

        <View style={styles.orbitSection}>
          <Text style={styles.orbitTitle}>orbit</Text>
          <View style={styles.orbitMid}>
            <View style={{ width: ORBIT_SIZE, height: ORBIT_SIZE }}>
              <Ring size={RING_2} opacity={0.2} />
              <Ring size={RING_1} opacity={0.3} />

              {ICON_CONFIGS.map((cfg, i) => (
                <OrbitIcon key={i} {...cfg} />
              ))}

              <View style={styles.centerIcon}>
                <Feather name="home" size={24} color={PURPLE} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bottomContent}>
          <Text style={styles.eyebrow}>CÓMO FUNCIONA ORBIT</Text>
          <Text style={styles.headline}>
            Todo lo que necesitás,{'\n'}
            <Text style={styles.headlineAccent}>en tu zona</Text>
          </Text>
          <Text style={styles.body}>
            Reservá lo que necesitás en segundos — o publicá lo que tenés y convertilo en ingresos pasivos. Pago, reputación y coordinación incluidos.
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity activeOpacity={0.85} style={styles.ctaWrapper} onPress={() => router.push('/screen3')}>
            <LinearGradient
              colors={['#7C3AED', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>¿Y yo qué gano? →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 4,
  },
  backButton: {
    padding: 4,
  },
  skipText: {
    fontFamily: 'Inter_500Medium',
    color: GRAY,
    fontSize: 16,
  },
  orbitSection: {
    height: ORBIT_H,
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
  orbitMid: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    top: (ORBIT_SIZE - CENTER_SIZE) / 2,
    left: (ORBIT_SIZE - CENTER_SIZE) / 2,
    shadowColor: PURPLE,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  iconNode: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepLinesWrap: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  pagination: {
    flexDirection: 'row',
    gap: 6,
  },
  stepLine: { flex: 1, height: 3, borderRadius: 2 },
  stepLineActive: { backgroundColor: PURPLE },
  stepLineInactive: { backgroundColor: 'rgba(139, 92, 246, 0.18)' },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    color: PURPLE,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 10,
  },
  headline: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 42,
    marginBottom: 14,
  },
  headlineAccent: {
    fontFamily: 'Inter_700Bold',
    color: PURPLE,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 15,
    lineHeight: 23,
  },
  ctaWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaButton: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 17,
  },
});
