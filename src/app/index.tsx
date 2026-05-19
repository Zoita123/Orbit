import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';


const { width: SW } = Dimensions.get('window');

const BG = '#080A1A';
const GRAY = '#94A3B8';
const TITLE_COLOR = '#C4B5FD';
const SUBTITLE_COLOR = '#CBD5E1';

const ORBIT_SIZE = Math.min(SW * 0.9, 370);
const RING_INNER = ORBIT_SIZE * 0.46;
const RING_MID = ORBIT_SIZE * 0.72;
const RING_OUTER = ORBIT_SIZE * 0.95;

const STARS = Array.from({ length: 40 }, (_, i) => ({
  left: `${(i * 37 + 13) % 93}%`,
  top: `${(i * 53 + 7) % 88}%`,
  size: i % 7 === 0 ? 2.5 : i % 3 === 0 ? 2 : 1.5,
  opacity: 0.12 + (i % 5) * 0.07,
}));

const NODE_SIZE = 36;

const DOT_CONFIGS = [
  { ringSize: RING_OUTER, icon: 'tool',       color: '#A78BFA', dotSize: 12, duration: 30000, startAngle: 5,   revealDelay: 800 },
  { ringSize: RING_OUTER, icon: 'book-open',  color: '#60A5FA', dotSize: 10, duration: 24000, startAngle: 118, revealDelay: 3200 },
  { ringSize: RING_OUTER, icon: 'monitor',    color: '#E2E8F0', dotSize: 8,  duration: 36000, startAngle: 225, revealDelay: 5800 },
  { ringSize: RING_MID,   icon: 'music',      color: '#A78BFA', dotSize: 12, duration: 20000, startAngle: 68,  revealDelay: 1800 },
  { ringSize: RING_MID,   icon: 'umbrella',   color: '#22D3EE', dotSize: 10, duration: 16000, startAngle: 178, revealDelay: 4300 },
  { ringSize: RING_MID,   icon: 'headphones', color: '#818CF8', dotSize: 9,  duration: 26000, startAngle: 290, revealDelay: 6500 },
  { ringSize: RING_INNER, icon: 'camera',     color: '#C4B5FD', dotSize: 11, duration: 13000, startAngle: 38,  revealDelay: 2500 },
];

function OrbitDot({
  ringSize,
  icon,
  color,
  dotSize,
  duration,
  startAngle = 0,
  revealDelay = 0,
}: {
  ringSize: number;
  icon: string;
  color: string;
  dotSize: number;
  duration: number;
  startAngle?: number;
  revealDelay?: number;
}) {
  const angle = useSharedValue(startAngle);
  const reveal = useSharedValue(0);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(startAngle + 360, { duration, easing: Easing.linear }),
      -1,
      false
    );
    reveal.value = withDelay(
      revealDelay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) }),
          withDelay(2200, withTiming(0, { duration: 350 })),
          withTiming(0, { duration: 5000 })
        ),
        -1
      )
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `-${angle.value}deg` }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 1 - reveal.value,
    transform: [{ scale: 1 - reveal.value * 0.4 }],
  }));

  const emojiNodeStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ scale: reveal.value }],
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
        <Animated.View
          style={[
            { position: 'absolute', width: dotSize, height: dotSize, borderRadius: dotSize / 2,
              backgroundColor: color, shadowColor: color, shadowOpacity: 0.8, shadowRadius: 8, elevation: 8 },
            dotStyle,
          ]}
        />
        <Animated.View style={[styles.iconNode, emojiNodeStyle]}>
          <Feather name={icon as any} size={16} color={color} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

function Ring({ size, opacity = 0.25 }: { size: number; opacity?: number }) {
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

function Divider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>o</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export default function IntroScreen() {
  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {STARS.map((star, i) => (
          <View
            key={i}
            style={[
              styles.star,
              {
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              } as any,
            ]}
          />
        ))}
      </View>

      <SafeAreaView style={styles.safe}>
        <View style={styles.orbitSection}>
          <View style={{ width: ORBIT_SIZE, height: ORBIT_SIZE }}>
            <Ring size={RING_OUTER} opacity={0.18} />
            <Ring size={RING_MID} opacity={0.25} />
            <Ring size={RING_INNER} opacity={0.32} />

            {DOT_CONFIGS.map((config, i) => (
              <OrbitDot key={i} {...config} />
            ))}

            <View style={styles.orbitCenter}>
              <Text style={styles.orbitTitle}>orbit</Text>
            </View>

          </View>

          <Text style={styles.orbitSubtitle}>
            Todo lo que necesitás{'\n'}ya está{' '}
            <Text style={styles.orbitSubtitleItalic}>girando a tu alrededor.</Text>
            {'\n'}Más cerca de lo que creés.
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.75}
            onPress={() => router.push('/onboarding')}
          >
            <Text style={styles.buttonText}>Unirse a la comunidad</Text>
            <Text style={styles.buttonArrow}>→</Text>
          </TouchableOpacity>

          <Divider />

          <TouchableOpacity activeOpacity={0.6}>
            <Text style={styles.loginText}>Iniciar sesión</Text>
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
  star: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
  },
  orbitSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  orbitTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 72,
    fontWeight: '700',
    color: TITLE_COLOR,
    textAlign: 'center',
    marginBottom: 10,
  },
  orbitSubtitle: {
    fontFamily: 'Inter_400Regular',
    color: SUBTITLE_COLOR,
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
  },
  orbitSubtitleItalic: {
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    color: SUBTITLE_COLOR,
  },
  buttonsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  button: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 14,
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 20, 50, 0.45)',
    gap: 8,
  },
  buttonText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 16,
  },
  buttonArrow: {
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
    fontSize: 18,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    fontFamily: 'Inter_400Regular',
    color: GRAY,
    fontSize: 14,
  },
  loginText: {
    fontFamily: 'Inter_600SemiBold',
    color: GRAY,
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 8,
  },
  iconNode: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    backgroundColor: '#13142A',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  iconEmoji: {
    fontSize: 18,
  },
});
