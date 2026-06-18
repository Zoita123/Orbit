import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { deleteItem, fetchItemById, fetchItemReservations, fetchItemReviews } from '../../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

function getDateOffset(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function generateSlots(durationMin = 60) {
  const slots: { from: string; to: string }[] = [];
  let h = 8, m = 0;
  while (true) {
    const eMin = m + durationMin;
    const eH = h + Math.floor(eMin / 60);
    const eM = eMin % 60;
    if (eH > 22 || (eH === 22 && eM > 0)) break;
    slots.push({
      from: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`,
      to:   `${String(eH).padStart(2,'0')}:${String(eM).padStart(2,'0')}`,
    });
    h = eH; m = eM;
  }
  return slots;
}

const DAY_LABELS = ['Hoy', 'Mañana', 'Pasado'];

function formatDuration(raw: string): string {
  const min = parseInt(raw);
  if (isNaN(min)) return raw;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h}:${String(m).padStart(2, '0')} h`;
}

const ICON_LABELS: Record<string, string> = {
  'refresh-cw': 'Lavarropas',
  'printer': 'Impresora',
  'tool': 'Herramienta',
  'package': 'Otra',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days} día${days > 1 ? 's' : ''}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `hace ${weeks} semana${weeks > 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? 'es' : ''}`;
}

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

function PrinterHero() {
  const paperSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(paperSlide, {
          toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(paperSlide, {
          toValue: 0, duration: 120, useNativeDriver: true,
        }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = paperSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [-55, 0],
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={pr.body}>
        <View style={pr.topRow}>
          <View style={pr.powerBtn} />
          <View style={pr.screen}>
            <Text style={pr.screenText}>PRINT</Text>
          </View>
          <View style={pr.btnGroup}>
            <View style={pr.smallBtn} />
            <View style={pr.smallBtn} />
          </View>
        </View>
        <View style={pr.midRow}>
          <View style={pr.feedSlot} />
          <View style={pr.inkGroup}>
            <View style={[pr.ink, { backgroundColor: '#38BDF8' }]} />
            <View style={[pr.ink, { backgroundColor: '#F472B6' }]} />
            <View style={[pr.ink, { backgroundColor: '#FBBF24' }]} />
          </View>
        </View>
        <View style={pr.outputSlot} />
      </View>
      <View style={pr.paperClip}>
        <Animated.View style={[pr.paper, { transform: [{ translateY }] }]}>
          <View style={pr.paperSquare} />
          <View style={pr.paperLine} />
          <View style={[pr.paperLine, { width: '55%' }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const pr = StyleSheet.create({
  body: {
    width: 175,
    backgroundColor: '#0D0E20',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  powerBtn: {
    width: 15, height: 15, borderRadius: 7.5,
    backgroundColor: PURPLE, borderWidth: 2.5,
    borderColor: 'rgba(196,181,253,0.3)',
  },
  screen: {
    flex: 1, backgroundColor: '#05060E', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)', alignItems: 'center',
  },
  screenText: {
    fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 9, letterSpacing: 1.5,
  },
  btnGroup: { gap: 4 },
  smallBtn: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(139,92,246,0.35)',
  },
  midRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  feedSlot: {
    flex: 1, height: 30, backgroundColor: '#03030A',
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  inkGroup: { flexDirection: 'row', gap: 4, alignItems: 'flex-end' },
  ink: { width: 10, height: 30, borderRadius: 3 },
  outputSlot: {
    height: 7, backgroundColor: '#03030A', borderRadius: 3,
    marginHorizontal: 6, borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)',
  },
  paperClip: { width: 130, height: 55, overflow: 'hidden', marginTop: -4 },
  paper: {
    width: '100%', height: 55, backgroundColor: '#EEEEF5',
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    paddingHorizontal: 10, paddingTop: 8, gap: 6,
  },
  paperSquare: { width: 20, height: 20, borderRadius: 4, backgroundColor: '#4ADE80' },
  paperLine: {
    height: 4, backgroundColor: 'rgba(80,80,110,0.4)', borderRadius: 2, width: '80%',
  },
});

function buildGearPath(outerR: number, innerR: number, teeth: number): string {
  const step = (2 * Math.PI) / teeth;
  const frac = 0.38;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const base = i * step - Math.PI / 2;
    const a0 = base - step * (0.5 - frac / 2);
    const a1 = base - step * frac / 2;
    const a2 = base + step * frac / 2;
    const a3 = base + step * (0.5 - frac / 2);
    const pts = [
      [innerR * Math.cos(a0), innerR * Math.sin(a0)],
      [outerR * Math.cos(a1), outerR * Math.sin(a1)],
      [outerR * Math.cos(a2), outerR * Math.sin(a2)],
      [innerR * Math.cos(a3), innerR * Math.sin(a3)],
    ];
    const cmd = i === 0 ? 'M' : 'L';
    d += ` ${cmd} ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    d += ` L ${pts[1][0].toFixed(2)} ${pts[1][1].toFixed(2)}`;
    d += ` L ${pts[2][0].toFixed(2)} ${pts[2][1].toFixed(2)}`;
    d += ` L ${pts[3][0].toFixed(2)} ${pts[3][1].toFixed(2)}`;
  }
  return d.trim() + ' Z';
}

function GearHero() {
  const largeSpin = useRef(new Animated.Value(0)).current;
  const smallSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const large = Animated.loop(
      Animated.timing(largeSpin, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })
    );
    const small = Animated.loop(
      Animated.timing(smallSpin, { toValue: 1, duration: 3334, easing: Easing.linear, useNativeDriver: true })
    );
    large.start();
    small.start();
    return () => { large.stop(); small.stop(); };
  }, []);

  const largeRotate = largeSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const smallRotate = smallSpin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const largePath = buildGearPath(52, 38, 9);
  const smallPath = buildGearPath(33, 24, 6);

  return (
    <View style={{ width: 210, height: 130 }}>
      <Animated.View style={{
        position: 'absolute', left: 0, top: 0,
        transform: [{ rotate: largeRotate }],
        shadowColor: '#8B5CF6', shadowOpacity: 0.95, shadowRadius: 24, shadowOffset: { width: 6, height: 0 },
      }}>
        <Svg width={120} height={120} viewBox="-60 -60 120 120">
          <Circle r={56} fill="rgba(139,92,246,0.1)" />
          <Path d={largePath} fill={PURPLE} opacity={0.92} />
          <Circle r={15} fill="#080A1A" />
          <Circle r={5} fill="rgba(196,181,253,0.6)" />
        </Svg>
      </Animated.View>
      <Animated.View style={{
        position: 'absolute', left: 102, top: 22,
        transform: [{ rotate: smallRotate }],
        shadowColor: '#8B5CF6', shadowOpacity: 0.8, shadowRadius: 18, shadowOffset: { width: 6, height: 0 },
      }}>
        <Svg width={80} height={80} viewBox="-40 -40 80 80">
          <Circle r={36} fill="rgba(139,92,246,0.08)" />
          <Path d={smallPath} fill="#C4B5FD" opacity={0.97} />
          <Circle r={9} fill="#080A1A" />
          <Circle r={3.5} fill="rgba(139,92,246,0.7)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const SPK = 185;
const SPK_C = SPK / 2; // 92.5

function SpeakerHero() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const beat = Animated.loop(
      Animated.sequence([
        // Kick 1 — sharp hit
        Animated.timing(pulse, { toValue: 1, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 120, useNativeDriver: true }),
        // Kick 2 — quick double
        Animated.timing(pulse, { toValue: 0.85, duration: 90, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(320),
        // Kick 3 — hard beat
        Animated.timing(pulse, { toValue: 1, duration: 95, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(200),
      ])
    );
    beat.start();
    return () => beat.stop();
  }, []);

  const capScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.85] });
  const glowScale  = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });

  const dustSize = 54;
  const dustOff  = SPK_C - dustSize / 2;
  const glowSize = 80;
  const glowOff  = SPK_C - glowSize / 2;

  return (
    <View style={{ width: SPK, height: SPK }}>
      {/* Static speaker body */}
      <Svg width={SPK} height={SPK} viewBox={`0 0 ${SPK} ${SPK}`}>
        {/* Cabinet */}
        <Rect x={0} y={0} width={SPK} height={SPK} rx={24} ry={24} fill="#0C0D20" />
        <Rect x={1} y={1} width={SPK - 2} height={SPK - 2} rx={23} ry={23} fill="none" stroke="rgba(139,92,246,0.45)" strokeWidth={1.5} />
        {/* Mount ring / bezel */}
        <Circle cx={SPK_C} cy={SPK_C} r={84} fill="#080916" />
        <Circle cx={SPK_C} cy={SPK_C} r={84} fill="none" stroke="rgba(139,92,246,0.55)" strokeWidth={2} />
        {/* Surround — thick rubber ring */}
        <Circle cx={SPK_C} cy={SPK_C} r={77} fill="none" stroke="#17183A" strokeWidth={13} />
        <Circle cx={SPK_C} cy={SPK_C} r={83} fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth={1} />
        <Circle cx={SPK_C} cy={SPK_C} r={70} fill="none" stroke="rgba(139,92,246,0.12)" strokeWidth={1} />
        {/* Cone face */}
        <Circle cx={SPK_C} cy={SPK_C} r={64} fill="#0E0F26" />
        {/* Cone concentric rings */}
        <Circle cx={SPK_C} cy={SPK_C} r={56} fill="none" stroke="rgba(139,92,246,0.13)" strokeWidth={1} />
        <Circle cx={SPK_C} cy={SPK_C} r={48} fill="none" stroke="rgba(139,92,246,0.11)" strokeWidth={1} />
        <Circle cx={SPK_C} cy={SPK_C} r={40} fill="none" stroke="rgba(139,92,246,0.09)" strokeWidth={1} />
        {/* Voice coil collar */}
        <Circle cx={SPK_C} cy={SPK_C} r={29} fill="#08091A" />
        <Circle cx={SPK_C} cy={SPK_C} r={29} fill="none" stroke="rgba(139,92,246,0.4)" strokeWidth={1.5} />
      </Svg>

      {/* Glow pulse behind dust cap */}
      <Animated.View
        style={{
          position: 'absolute',
          left: glowOff, top: glowOff,
          width: glowSize, height: glowSize,
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }}
      >
        <Svg width={glowSize} height={glowSize} viewBox={`${-glowSize / 2} ${-glowSize / 2} ${glowSize} ${glowSize}`}>
          <Circle r={glowSize / 2 - 2} fill="rgba(139,92,246,0.35)" />
        </Svg>
      </Animated.View>

      {/* Animated dust cap */}
      <Animated.View
        style={{
          position: 'absolute',
          left: dustOff, top: dustOff,
          width: dustSize, height: dustSize,
          transform: [{ scale: capScale }],
        }}
      >
        <Svg width={dustSize} height={dustSize} viewBox={`${-dustSize / 2} ${-dustSize / 2} ${dustSize} ${dustSize}`}>
          <Circle r={25} fill="#5B21B6" />
          <Circle r={18} fill="#7C3AED" />
          <Circle r={11} fill="#8B5CF6" />
          <Circle r={5.5} fill="#C4B5FD" />
          <Circle r={2} fill="#EDE9FE" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const gr = StyleSheet.create({
  body: {
    backgroundColor: '#0D0E20',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    padding: 16,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },
});

// Canvas: 240px wide, wheels centered symmetrically at x=56 and x=184 (midpoint=120)
const BIKE_W = 240;
const BIKE_H = 148;
const BIKE_WLX = 56, BIKE_WLY = 100;   // rear axle
const BIKE_WRX = 184, BIKE_WRY = 100;  // front axle
const BIKE_WHEEL_R = 40;
const BIKE_RIM_R = 30;
const BIKE_SPOKES = 14;

function BikeWheel({ spin }: { spin: Animated.Value }) {
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const size = BIKE_WHEEL_R * 2 + 10;
  const c = BIKE_WHEEL_R + 5;
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox={`${-c} ${-c} ${size} ${size}`}>
        <Circle r={BIKE_WHEEL_R + 3} fill="rgba(139,92,246,0.1)" />
        <Circle r={BIKE_WHEEL_R} fill="none" stroke="#C4B5FD" strokeWidth={7} opacity={0.95} />
        <Circle r={BIKE_WHEEL_R - 5} fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth={1} />
        <Circle r={BIKE_RIM_R} fill="none" stroke="rgba(196,181,253,0.5)" strokeWidth={2} />
        {Array.from({ length: BIKE_SPOKES }, (_, i) => {
          const a = (i * Math.PI * 2) / BIKE_SPOKES;
          return (
            <Path
              key={i}
              d={`M 0 0 L ${(BIKE_RIM_R * Math.cos(a)).toFixed(2)} ${(BIKE_RIM_R * Math.sin(a)).toFixed(2)}`}
              stroke="rgba(196,181,253,0.55)"
              strokeWidth={1.2}
            />
          );
        })}
        <Circle r={6.5} fill="#8B5CF6" />
        <Circle r={2.8} fill="#C4B5FD" />
      </Svg>
    </Animated.View>
  );
}

function BikeHero() {
  const wheelSpin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(wheelSpin, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const ws = BIKE_WHEEL_R * 2 + 10;
  const wOff = ws / 2;

  return (
    <View style={{ width: BIKE_W, height: BIKE_H }}>
      <View style={{ position: 'absolute', left: BIKE_WLX - wOff, top: BIKE_WLY - wOff }}>
        <BikeWheel spin={wheelSpin} />
      </View>
      <View style={{ position: 'absolute', left: BIKE_WRX - wOff, top: BIKE_WRY - wOff }}>
        <BikeWheel spin={wheelSpin} />
      </View>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width={BIKE_W} height={BIKE_H} viewBox={`0 0 ${BIKE_W} ${BIKE_H}`}>
          {/* Rear triangle: chain stays, seat stays, seat tube */}
          <Path d={`M ${BIKE_WLX} ${BIKE_WLY} L 114 106`} stroke="#8B5CF6" strokeWidth={4} strokeLinecap="round" />
          <Path d={`M ${BIKE_WLX} ${BIKE_WLY} L 108 40`} stroke="#8B5CF6" strokeWidth={3.5} strokeLinecap="round" />
          <Path d="M 114 106 L 108 40" stroke="#8B5CF6" strokeWidth={4} strokeLinecap="round" />
          {/* Front diamond: top tube, down tube, fork */}
          <Path d="M 108 40 L 163 45" stroke="#8B5CF6" strokeWidth={3.5} strokeLinecap="round" />
          <Path d="M 114 106 L 168 58" stroke="#8B5CF6" strokeWidth={4.5} strokeLinecap="round" />
          <Path d={`M 168 58 L ${BIKE_WRX} ${BIKE_WRY}`} stroke="#8B5CF6" strokeWidth={3.5} strokeLinecap="round" />
          {/* Head tube */}
          <Path d="M 163 45 L 168 58" stroke="#C4B5FD" strokeWidth={6.5} strokeLinecap="round" />
          {/* Seat post */}
          <Path d="M 109 44 L 108 26" stroke="#C4B5FD" strokeWidth={4} strokeLinecap="round" />
          {/* Saddle — curved */}
          <Path d="M 97 25 Q 108 19 122 25" stroke="#C4B5FD" strokeWidth={5} strokeLinecap="round" fill="none" />
          {/* Stem */}
          <Path d="M 164 47 L 172 31" stroke="#C4B5FD" strokeWidth={3.5} strokeLinecap="round" />
          {/* Handlebars — upright city style */}
          <Path d="M 163 30 L 182 30" stroke="#C4B5FD" strokeWidth={5} strokeLinecap="round" />
          <Path d="M 163 30 L 161 37" stroke="#C4B5FD" strokeWidth={3} strokeLinecap="round" />
          <Path d="M 182 30 L 184 37" stroke="#C4B5FD" strokeWidth={3} strokeLinecap="round" />
          {/* Chainring */}
          <Circle cx={114} cy={106} r={13} fill="none" stroke="rgba(196,181,253,0.65)" strokeWidth={2.5} />
          <Circle cx={114} cy={106} r={5} fill="rgba(139,92,246,0.85)" />
        </Svg>
      </View>
    </View>
  );
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDay, setCalendarDay] = useState(0);
  const [selectedRes, setSelectedRes] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([fetchItemById(id), fetchItemReservations(id), fetchItemReviews(id)]).then(
        ([{ data: itemData }, { data: resData }, { data: revData }]) => {
          setItem(itemData);
          setReservations(resData ?? []);
          setReviews(revData ?? []);
          setLoading(false);
        }
      );
    }, [id])
  );

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

  const avgRating = reviews.length
    ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
    : null;

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
          ) : item.icon === 'printer' ? (
            <PrinterHero />
          ) : item.icon === 'tool' ? (
            <GearHero />
          ) : item.icon === 'activity' ? (
            <BikeHero />
          ) : item.icon === 'volume-2' ? (
            <SpeakerHero />
          ) : (
            <>
              <View style={styles.heroGlow} />
              <View style={styles.heroIconWrap}>
                <Feather name={item.icon as any} size={72} color="#C4B5FD" />
              </View>
            </>
          )}
        </LinearGradient>

        {/* Calendar toggle button */}
        <View style={styles.calendarToggleWrap}>
          <TouchableOpacity
            style={styles.calendarToggleBtn}
            activeOpacity={0.75}
            onPress={() => setShowCalendar(v => !v)}
          >
            <Feather name="calendar" size={15} color={PURPLE} />
            <Text style={styles.calendarToggleText}>
              {showCalendar ? 'Ocultar disponibilidad' : 'Ver disponibilidad'}
            </Text>
            <Feather name={showCalendar ? 'chevron-up' : 'chevron-down'} size={15} color={PURPLE} />
          </TouchableOpacity>
        </View>

        {/* Inline calendar */}
        {showCalendar && (() => {
          const durationMin = item?.programs?.length > 0
            ? parseInt(String(item.programs[0].duration ?? 60))
            : 60;
          const slots = generateSlots(isNaN(durationMin) ? 60 : durationMin);
          const selectedDate = getDateOffset(calendarDay);
          const now = new Date();
          const nowTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
          const realReservations = reservations.filter(r => r.date === selectedDate);

          // Inject mock examples when no real reservations exist for this day
          const mockReservations = realReservations.length === 0 ? (() => {
            const future = calendarDay === 0 ? slots.filter(s => s.from > nowTime) : slots;
            return [
              future[1] && { id: 'mock-1', date: selectedDate, time_from: future[1].from, time_to: future[1].to, status: 'confirmed', program: item?.programs?.[0]?.name ?? '', borrower: { nombre: 'Martín', apellido: 'G.' } },
              future[3] && { id: 'mock-2', date: selectedDate, time_from: future[3].from, time_to: future[3].to, status: 'pending',   program: '',                                                                            borrower: { nombre: 'Sofía',  apellido: 'R.' } },
            ].filter(Boolean);
          })() : [];

          const dayReservations = [...realReservations, ...mockReservations];
          const visibleSlots = calendarDay === 0 ? slots.filter(s => s.from > nowTime) : slots;

          return (
            <View style={styles.calendarCard}>
              {/* Day tabs */}
              <View style={styles.calendarDayRow}>
                {DAY_LABELS.map((label, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.calendarDayTab, calendarDay === i && styles.calendarDayTabActive]}
                    onPress={() => setCalendarDay(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.calendarDayText, calendarDay === i && styles.calendarDayTextActive]}>
                      {label}
                    </Text>
                    <Text style={[styles.calendarDateText, calendarDay === i && styles.calendarDateTextActive]}>
                      {getDateOffset(i).slice(5).replace('-','/')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Slots grid */}
              {visibleSlots.length === 0 ? (
                <Text style={styles.calendarEmpty}>No quedan turnos disponibles hoy</Text>
              ) : (
                <View style={styles.slotsGrid}>
                  {visibleSlots.map((slot) => {
                    const res = dayReservations.find(r => r.time_from === slot.from);
                    const busy = !!res;
                    return (
                      <TouchableOpacity
                        key={slot.from}
                        style={[styles.slotCell, busy && styles.slotCellBusy]}
                        activeOpacity={busy ? 0.7 : 1}
                        onPress={() => busy && setSelectedRes(res)}
                      >
                        <Text style={[styles.slotTime, busy && styles.slotTimeBusy]}>
                          {slot.from}
                        </Text>
                        <Text style={[styles.slotStatus, busy && styles.slotStatusBusy]}>
                          {busy ? (res.borrower?.nombre ?? 'Ocupado') : 'Libre'}
                        </Text>
                        {busy && (
                          <View style={[styles.slotStatusDot, { backgroundColor: res.status === 'confirmed' ? '#10B981' : '#F59E0B' }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })()}

        {/* Reservation detail modal */}
        <Modal visible={!!selectedRes} transparent animationType="slide" onRequestClose={() => setSelectedRes(null)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedRes(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Detalle de reserva</Text>

              <View style={styles.modalRow}>
                <Feather name="user" size={15} color={PURPLE} />
                <Text style={styles.modalLabel}>Vecino</Text>
                <Text style={styles.modalValue}>
                  {selectedRes?.borrower?.nombre} {selectedRes?.borrower?.apellido}
                </Text>
              </View>

              <View style={styles.modalRow}>
                <Feather name="calendar" size={15} color={PURPLE} />
                <Text style={styles.modalLabel}>Fecha</Text>
                <Text style={styles.modalValue}>
                  {selectedRes?.date ? new Date(selectedRes.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}
                </Text>
              </View>

              <View style={styles.modalRow}>
                <Feather name="clock" size={15} color={PURPLE} />
                <Text style={styles.modalLabel}>Horario</Text>
                <Text style={styles.modalValue}>{selectedRes?.time_from} – {selectedRes?.time_to}</Text>
              </View>

              {selectedRes?.program ? (
                <View style={styles.modalRow}>
                  <Feather name="layers" size={15} color={PURPLE} />
                  <Text style={styles.modalLabel}>Programa</Text>
                  <Text style={styles.modalValue}>{selectedRes.program}</Text>
                </View>
              ) : null}

              <View style={styles.modalRow}>
                <Feather name="check-circle" size={15} color={selectedRes?.status === 'confirmed' ? '#10B981' : '#F59E0B'} />
                <Text style={styles.modalLabel}>Estado</Text>
                <View style={[styles.modalStatusPill, { backgroundColor: selectedRes?.status === 'confirmed' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }]}>
                  <Text style={[styles.modalStatusText, { color: selectedRes?.status === 'confirmed' ? '#10B981' : '#F59E0B' }]}>
                    {selectedRes?.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedRes(null)} activeOpacity={0.8}>
                <Text style={styles.modalCloseBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <View style={styles.content}>

          {/* Badges */}
          <View style={styles.badgesRow}>
            <View style={[styles.badge, item.available ? styles.badgeAvailable : styles.badgePaused]}>
              <View style={[styles.badgeDot, { backgroundColor: item.available ? '#10B981' : BODY }]} />
              <Text style={[styles.badgeText, { color: item.available ? '#10B981' : BODY }]}>
                {item.available ? 'Disponible' : 'En pausa'}
              </Text>
            </View>
            {avgRating && (
              <View style={styles.badgeRating}>
                <Feather name="star" size={12} color="#FCD34D" />
                <Text style={styles.badgeRatingText}>{avgRating} · {reviews.length} reseña{reviews.length !== 1 ? 's' : ''}</Text>
              </View>
            )}
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
                          <Text style={styles.durationText}>{formatDuration(p.duration)}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Upcoming reservations */}
          {reservations.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>PRÓXIMAS RESERVAS</Text>
              <View style={styles.reservationsCard}>
                {reservations.map((r: any, i: number) => {
                  const today = new Date().toISOString().split('T')[0];
                  const d = new Date(r.date + 'T12:00:00');
                  const dateLabel =
                    r.date === today
                      ? 'Hoy'
                      : d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <View key={r.id}>
                      {i > 0 && <View style={styles.resDivider} />}
                      <View style={styles.resRow}>
                        <View style={styles.resDateBadge}>
                          <Text style={styles.resDateText}>{dateLabel}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resTime}>{r.time_from} – {r.time_to}</Text>
                          {r.program ? <Text style={styles.resProg}>{r.program}</Text> : null}
                        </View>
                        <Text style={styles.resBorrower} numberOfLines={1}>
                          {r.borrower?.nombre} {r.borrower?.apellido ?? ''}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Reviews */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RESEÑAS</Text>
            {avgRating && (
              <View style={styles.ratingPill}>
                <Feather name="star" size={11} color="#FCD34D" />
                <Text style={styles.ratingPillText}>{avgRating} · {reviews.length} reseña{reviews.length !== 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>

          {reviews.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_400Regular', color: BODY, fontSize: 14 }}>
                Todavía no hay reseñas
              </Text>
            </View>
          ) : reviews.map((review) => {
            const firstName = review.reviewer?.nombre ?? '?';
            const lastInitial = review.reviewer?.apellido?.[0] ?? '';
            const displayName = `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`;
            return (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{firstName[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.reviewName}>{displayName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Stars rating={review.rating} />
                      <Text style={styles.reviewDate}>{relativeTime(review.created_at)}</Text>
                    </View>
                  </View>
                </View>
                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
              </View>
            );
          })}

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
              : <Feather name="trash-2" size={20} color="#F87171" />
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

  reservationsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 28,
    overflow: 'hidden',
  },
  resDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },
  resRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  resDateBadge: {
    backgroundColor: 'rgba(139,92,246,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 52,
    alignItems: 'center',
  },
  resDateText: { fontFamily: 'Inter_600SemiBold', color: '#C4B5FD', fontSize: 11, textAlign: 'center' },
  resTime: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 14 },
  resProg: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, marginTop: 2 },
  resBorrower: { fontFamily: 'Inter_500Medium', color: GRAY, fontSize: 12, maxWidth: 80, textAlign: 'right' },

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
  },
  deleteBtnText: { fontFamily: 'Inter_600SemiBold', color: '#F87171', fontSize: 10 },

  calendarToggleWrap: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 },
  calendarToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  calendarToggleText: { fontFamily: 'Inter_600SemiBold', color: PURPLE, fontSize: 14 },

  calendarCard: {
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.18)',
    overflow: 'hidden',
  },
  calendarDayRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  calendarDayTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 2,
  },
  calendarDayTabActive: {
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderBottomWidth: 2,
    borderBottomColor: PURPLE,
  },
  calendarDayText: { fontFamily: 'Inter_600SemiBold', color: BODY, fontSize: 13 },
  calendarDayTextActive: { color: '#C4B5FD' },
  calendarDateText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
  calendarDateTextActive: { color: PURPLE },

  calendarEmpty: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 13,
    textAlign: 'center',
    padding: 20,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  slotCell: {
    width: '30%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 10,
    alignItems: 'center',
    gap: 3,
  },
  slotCellBusy: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  slotTime: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 13 },
  slotTimeBusy: { color: '#F87171' },
  slotStatus: { fontFamily: 'Inter_400Regular', color: '#10B981', fontSize: 11 },
  slotStatusBusy: { color: '#F87171' },
  slotStatusDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#13142A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 0,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 18,
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 14, flex: 1 },
  modalValue: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14 },
  modalStatusPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modalStatusText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  modalCloseBtn: {
    marginTop: 24,
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  modalCloseBtnText: { fontFamily: 'Inter_600SemiBold', color: '#C4B5FD', fontSize: 15 },
});
