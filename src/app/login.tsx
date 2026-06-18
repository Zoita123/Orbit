import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { signInWithGoogle } from '../lib/supabase';

const BG = '#080A1A';
const PURPLE = '#8B5CF6';
const CARD_BG = '#13142A';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

const STARS = Array.from({ length: 60 }, (_, i) => ({
  left: `${(i * 37 + 13) % 93}%`,
  top: `${(i * 53 + 7) % 88}%`,
  size: i % 7 === 0 ? 2.5 : i % 3 === 0 ? 2 : 1.5,
  opacity: 0.12 + (i % 5) * 0.07,
}));

const CONTAINER = 172;
const ORBIT_RING = 142;
const LOGO_RING = 108;
const DOT_SIZE = 9;
const DOT_OFFSET = (CONTAINER - ORBIT_RING) / 2 - DOT_SIZE / 2;

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

function AnimatedOrbitLogo() {
  "use no memo";
  const angle = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(360, { duration: 5000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  const armStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.25 + pulse.value * 0.55,
    shadowRadius: 10 + pulse.value * 14,
    borderColor: `rgba(139, 92, 246, ${0.35 + pulse.value * 0.35})`,
  }));

  return (
    <View style={{ width: CONTAINER, height: CONTAINER }}>
      <View style={styles.orbitPath} />
      <Animated.View style={[styles.logoRing, ringStyle]}>
        <Text style={styles.logoText}>orbit</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.dotArm, armStyle]}>
        <View style={[styles.dot, { marginTop: DOT_OFFSET }]} />
      </Animated.View>
    </View>
  );
}

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { data, error } = await signInWithGoogle();
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    if (data?.session) {
      router.replace('/home');
    }
  };

  return (
    <View style={styles.container}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        {STARS.map((star, i) => (
          <View
            key={i}
            style={[
              styles.star,
              { left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.opacity } as any,
            ]}
          />
        ))}
      </View>
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={GRAY} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.heroSection}>
            <AnimatedOrbitLogo />
            <Text style={styles.headline}>Bienvenido de vuelta</Text>
            <Text style={styles.subtext}>
              Tu comunidad te espera.{'\n'}Ingresá para continuar.
            </Text>
          </View>

          <View style={styles.buttonsSection}>
            <TouchableOpacity
              style={styles.googleButton}
              activeOpacity={0.8}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <GoogleLogo size={20} />
                  <Text style={styles.googleText}>Continuar con Google</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity hitSlop={12} onPress={() => router.push('/onboarding')}>
              <Text style={styles.signupText}>¿No tenés cuenta? <Text style={styles.signupLink}>Unite</Text></Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  star: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 20,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    justifyContent: 'center',
    gap: 32,
  },
  heroSection: { alignItems: 'center', gap: 14 },
  orbitPath: {
    position: 'absolute',
    width: ORBIT_RING,
    height: ORBIT_RING,
    borderRadius: ORBIT_RING / 2,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.18)',
    top: (CONTAINER - ORBIT_RING) / 2,
    left: (CONTAINER - ORBIT_RING) / 2,
  },
  logoRing: {
    position: 'absolute',
    width: LOGO_RING,
    height: LOGO_RING,
    borderRadius: LOGO_RING / 2,
    borderWidth: 1.5,
    backgroundColor: '#0D0F22',
    alignItems: 'center',
    justifyContent: 'center',
    top: (CONTAINER - LOGO_RING) / 2,
    left: (CONTAINER - LOGO_RING) / 2,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  logoText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 25,
    color: '#C4B5FD',
    letterSpacing: -0.5,
  },
  dotArm: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CONTAINER,
    height: CONTAINER,
    alignItems: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: PURPLE,
    shadowColor: PURPLE,
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 6,
  },
  headline: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 33,
    textAlign: 'center',
  },
  subtext: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 14,
    lineHeight: 23,
    textAlign: 'center',
  },
  buttonsSection: { gap: 12 },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 56,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  googleText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    fontSize: 16,
  },
  phoneWrapper: { borderRadius: 16, overflow: 'hidden' },
  phoneButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  phoneText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dividerText: {
    fontFamily: 'Inter_400Regular',
    color: GRAY,
    fontSize: 14,
  },
  signupText: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 4,
  },
  signupLink: {
    fontFamily: 'Inter_600SemiBold',
    color: '#C4B5FD',
  },
});
