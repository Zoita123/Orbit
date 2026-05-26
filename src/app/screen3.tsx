import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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

const AVATAR_COLORS = ['#8B5CF6', '#22D3EE', '#3B82F6', '#10B981'];
const TRACK_W = SW - 48;
const THUMB_SIZE = 48;
const TRACK_PAD = 4;
const MAX_SWIPE = TRACK_W - THUMB_SIZE - TRACK_PAD * 2;

function formatARS(n: number): string {
  if (n < 1000) return `$${n}`;
  const t = Math.floor(n / 1000);
  const r = (n % 1000).toString().padStart(3, '0');
  return `$${t}.${r}`;
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

function IncomeCards() {
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const target = 24000;
    const start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCounter(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };

    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <View style={styles.incomeWrap}>
      <View style={styles.mainCard}>
        <Text style={styles.mainCardLabel}>INGRESO MENSUAL PROMEDIO</Text>
        <Text style={styles.mainCardAmount}>{formatARS(counter)}</Text>
        <Text style={styles.mainCardSub}>con lo que ya tenés en casa</Text>
      </View>

<View style={styles.socialPill}>
        <View style={styles.avatarRow}>
          {['M', 'S', 'J', 'C'].map((l, i) => (
            <View
              key={i}
              style={[styles.avatar, { backgroundColor: AVATAR_COLORS[i], marginLeft: i > 0 ? -8 : 0 }]}
            >
              <Text style={styles.avatarText}>{l}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.socialText}>
          <Text style={styles.socialBold}>47 vecinos</Text> ya te estan orbitando
        </Text>
      </View>
    </View>
  );
}

function SwipeButton({ onComplete }: { onComplete: () => void }) {
  const thumbX = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      thumbX.value = Math.max(0, Math.min(e.translationX, MAX_SWIPE));
    })
    .onEnd(() => {
      if (thumbX.value > MAX_SWIPE * 0.78) {
        thumbX.value = withTiming(MAX_SWIPE, { duration: 180 });
        runOnJS(onComplete)();
      } else {
        thumbX.value = withSpring(0, { damping: 18, stiffness: 200 });
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 1 - (thumbX.value / MAX_SWIPE) * 0.85,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.swipeTrack}>
        <Animated.Text style={[styles.swipeLabel, labelStyle]}>
          Crear mi cuenta gratis
        </Animated.Text>
        <Animated.View style={[styles.swipeThumbWrap, thumbStyle]}>
          <LinearGradient
            colors={['#7C3AED', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.swipeThumb}
          >
            <Feather name="arrow-right" size={22} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export default function Screen3() {
  const handleComplete = () => {
    router.push('/signup');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color={GRAY} />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={12} onPress={() => router.replace('/login')}>
            <Text style={styles.skipText}>Saltar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stepLinesWrap}>
          <StepLines total={3} active={2} />
        </View>

        <View style={styles.topSection}>
          <Text style={styles.orbitTitle}>orbit</Text>
          <View style={styles.topMid}>
            <IncomeCards />
          </View>
        </View>

        <View style={styles.bottomContent}>
          <Text style={styles.eyebrow}>INGRESO PASIVO REAL</Text>
          <Text style={styles.headline}>
            Tus cosas trabajan{'\n'}
            <Text style={styles.headlineAccent}>mientras dormís</Text>
          </Text>
          <Text style={styles.body}>
            Publicá lo que ya tenés — lavarropas, cochera, impresora, herramientas — y generá ingresos extra sin esfuerzo.
          </Text>
          <View style={{ flex: 1 }} />
          <SwipeButton onComplete={handleComplete} />
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
  backButton: { padding: 4 },
  skipText: {
    fontFamily: 'Inter_500Medium',
    color: GRAY,
    fontSize: 16,
  },
  stepLinesWrap: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  pagination: { flexDirection: 'row', gap: 6 },
  stepLine: { flex: 1, height: 3, borderRadius: 2 },
  stepLineActive: { backgroundColor: PURPLE },
  stepLineInactive: { backgroundColor: 'rgba(139, 92, 246, 0.18)' },
  topSection: {
    height: ORBIT_H,
    alignItems: 'center',
    paddingTop: 10,
  },
  orbitTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 26,
    color: '#C4B5FD',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  topMid: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  incomeWrap: {
    width: '100%',
    gap: 10,
  },
  mainCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.18)',
  },
  mainCardLabel: {
    fontFamily: 'Inter_600SemiBold',
    color: GRAY,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
  },
  mainCardAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 52,
    color: '#C4B5FD',
    letterSpacing: -1,
    marginBottom: 6,
  },
  mainCardSub: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 14,
  },
  miniRow: {
    flexDirection: 'row',
    gap: 10,
  },
  miniCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.12)',
  },
  miniIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  miniAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#C4B5FD',
    marginBottom: 2,
  },
  miniLabel: {
    fontFamily: 'Inter_400Regular',
    color: GRAY,
    fontSize: 12,
  },
  socialPill: {
    backgroundColor: CARD_BG,
    borderRadius: 40,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.12)',
  },
  avatarRow: {
    flexDirection: 'row',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BG,
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 11,
  },
  socialText: {
    fontFamily: 'Inter_400Regular',
    color: GRAY,
    fontSize: 13,
  },
  socialBold: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  bottomContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
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
  swipeTrack: {
    width: TRACK_W,
    height: 56,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeLabel: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    fontSize: 16,
    position: 'absolute',
  },
  swipeThumbWrap: {
    position: 'absolute',
    left: TRACK_PAD,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
  },
  swipeThumb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
