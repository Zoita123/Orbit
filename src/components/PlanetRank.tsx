import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

const CARD_BG = '#13142A';
const BODY = '#6B7280';
const GRAY = '#9CA3AF';

// ─── Planet definitions ───────────────────────────────────────────────────────

export const PLANETS = [
  {
    name: 'Mercurio',
    emoji: '🪨',
    colors: ['#8C8C8C', '#5A5A5A'] as [string, string],
    glow: '#9B9B9B',
    minPts: 0,
    maxPts: 50,
    desc: 'Recién arrancás',
    benefits: ['Acceso básico a la comunidad', 'Publicar hasta 2 ítems'],
  },
  {
    name: 'Marte',
    emoji: '🔴',
    colors: ['#E05A2B', '#8B2500'] as [string, string],
    glow: '#FF5722',
    minPts: 50,
    maxPts: 150,
    desc: 'Vecino activo',
    benefits: ['Publicar hasta 5 ítems', 'Historial de reservas visible'],
  },
  {
    name: 'Venus',
    emoji: '🌕',
    colors: ['#F0C040', '#B8860B'] as [string, string],
    glow: '#FFC107',
    minPts: 150,
    maxPts: 300,
    desc: 'Colaborador frecuente',
    benefits: ['Hasta 10 ítems publicados', 'Badge "Colaborador frecuente"'],
  },
  {
    name: 'Tierra',
    emoji: '🌍',
    colors: ['#2563EB', '#15803D'] as [string, string],
    glow: '#3B82F6',
    minPts: 300,
    maxPts: 500,
    desc: 'Referente del barrio',
    benefits: ['Ítems ilimitados', 'Verificación prioritaria', 'Badge "Referente del barrio"'],
  },
  {
    name: 'Neptuno',
    emoji: '💠',
    colors: ['#1E3A8A', '#3730A3'] as [string, string],
    glow: '#6366F1',
    minPts: 500,
    maxPts: 750,
    desc: 'Vecino de confianza',
    benefits: ['Prioridad en búsquedas', 'Descuento 5% en comisiones', 'Badge "Vecino de confianza"'],
  },
  {
    name: 'Urano',
    emoji: '🩵',
    colors: ['#67E8F9', '#0891B2'] as [string, string],
    glow: '#22D3EE',
    minPts: 750,
    maxPts: 1000,
    desc: 'Pilar de la comunidad',
    benefits: ['Descuento 10% en comisiones', 'Acceso anticipado a features', 'Badge especial en perfil'],
  },
  {
    name: 'Saturno',
    emoji: '🪐',
    colors: ['#F59E0B', '#92400E'] as [string, string],
    glow: '#FBBF24',
    minPts: 1000,
    maxPts: 1500,
    desc: 'Leyenda del edificio',
    hasRing: true,
    benefits: ['Sin comisiones en préstamos', 'Perfil destacado en búsquedas', 'Badge "Leyenda del edificio"'],
  },
  {
    name: 'Júpiter',
    emoji: '🌐',
    colors: ['#D97706', '#7C2D12'] as [string, string],
    glow: '#F59E0B',
    minPts: 1500,
    maxPts: 99999,
    desc: 'El grande de orbit',
    benefits: ['Comisiones 0% permanentes', 'Soporte prioritario', 'Acceso a funciones beta', 'Badge "El grande de orbit"'],
  },
] as const;

export type Planet = typeof PLANETS[number];

export function getPlanet(points: number): { planet: Planet; index: number } {
  let index = 0;
  for (let i = PLANETS.length - 1; i >= 0; i--) {
    if (points >= PLANETS[i].minPts) { index = i; break; }
  }
  return { planet: PLANETS[index], index };
}

// ─── Planet visual ────────────────────────────────────────────────────────────

export function PlanetIcon({ planet, size = 72 }: { planet: Planet; size?: number }) {
  const r = size / 2;
  const hasRing = 'hasRing' in planet && planet.hasRing;

  return (
    <View style={{ width: size + (hasRing ? 28 : 0), height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Saturn ring behind */}
      {hasRing && (
        <View style={[
          s.ring,
          {
            width: size + 28,
            height: size * 0.28,
            borderRadius: (size + 28) / 2,
            borderColor: `${planet.glow}80`,
            position: 'absolute',
            zIndex: 0,
          },
        ]} />
      )}
      {/* Planet body */}
      <LinearGradient
        colors={planet.colors}
        start={{ x: 0.25, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size, height: size, borderRadius: r,
          shadowColor: planet.glow,
          shadowOpacity: 0.7,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
          zIndex: 1,
        }}
      >
        {/* Jupiter bands */}
        {'name' in planet && planet.name === 'Júpiter' && (
          <>
            <View style={[s.band, { top: size * 0.28, opacity: 0.35 }]} />
            <View style={[s.band, { top: size * 0.45, height: size * 0.08, opacity: 0.25 }]} />
            <View style={[s.band, { top: size * 0.62, opacity: 0.3 }]} />
          </>
        )}
        {/* Earth continents hint */}
        {'name' in planet && planet.name === 'Tierra' && (
          <View style={[s.continent, { width: size * 0.3, height: size * 0.25, top: size * 0.2, left: size * 0.15 }]} />
        )}
      </LinearGradient>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  points: number;
}

export default function PlanetRank({ points }: Props) {
  const { planet, index } = getPlanet(points);
  const isLast = index === PLANETS.length - 1;
  const nextPlanet = isLast ? null : PLANETS[index + 1];

  const progress = isLast
    ? 1
    : (points - planet.minPts) / (planet.maxPts - planet.minPts);

  const ptsToNext = isLast ? 0 : planet.maxPts - points;

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.levelLabel}>NIVEL {index + 1} DE {PLANETS.length}</Text>
          <Text style={[s.planetName, { color: planet.glow }]}>{planet.name}</Text>
          <Text style={s.desc}>{planet.desc}</Text>
        </View>
        <PlanetIcon planet={planet} size={64} />
      </View>

      {/* Progress bar */}
      <View style={s.barTrack}>
        <View
          style={[
            s.barFill,
            {
              width: `${Math.min(progress * 100, 100)}%` as any,
              backgroundColor: planet.glow,
              shadowColor: planet.glow,
            },
          ]}
        />
      </View>

      {/* Points row */}
      <View style={s.pointsRow}>
        <View style={s.pointsBadge}>
          <Text style={s.pointsValue}>{points}</Text>
          <Text style={s.pointsUnit}> pts</Text>
        </View>

        {!isLast && nextPlanet && (
          <View style={s.nextRow}>
            <Text style={s.nextLabel}>Próximo: </Text>
            <Text style={[s.nextName, { color: nextPlanet.glow }]}>{nextPlanet.name}</Text>
            <Text style={s.nextPts}> · {ptsToNext} pts más</Text>
          </View>
        )}
        {isLast && (
          <Text style={[s.nextLabel, { color: planet.glow }]}>Nivel máximo 🏆</Text>
        )}
      </View>

      {/* Mini planet ladder */}
      <View style={s.ladder}>
        {PLANETS.map((p, i) => (
          <View key={p.name} style={s.ladderItem}>
            <View style={[
              s.ladderDot,
              { backgroundColor: i <= index ? p.glow : 'rgba(255,255,255,0.08)' },
              i === index && { width: 10, height: 10, borderRadius: 5, shadowColor: p.glow, shadowOpacity: 0.9, shadowRadius: 6 },
            ]} />
            {i < PLANETS.length - 1 && (
              <View style={[s.ladderLine, { backgroundColor: i < index ? p.glow : 'rgba(255,255,255,0.06)' }]} />
            )}
          </View>
        ))}
      </View>

      {/* Labels below ladder */}
      <View style={s.ladderLabels}>
        <Text style={[s.ladderLabelText, { color: PLANETS[0].glow }]}>{PLANETS[0].name}</Text>
        <Text style={[s.ladderLabelText, { color: PLANETS[PLANETS.length - 1].glow }]}>{PLANETS[PLANETS.length - 1].name}</Text>
      </View>

      {/* How to earn */}
      <View style={s.earnRow}>
        <View style={s.earnItem}>
          <Text style={s.earnIcon}>📤</Text>
          <Text style={s.earnText}>+10 pts por prestar</Text>
        </View>
        <View style={s.earnItem}>
          <Text style={s.earnIcon}>📥</Text>
          <Text style={s.earnText}>+5 pts por tomar prestado</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 20,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  levelLabel: {
    fontFamily: 'Inter_700Bold',
    color: BODY,
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  planetName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    marginBottom: 4,
  },
  desc: {
    fontFamily: 'Inter_400Regular',
    color: GRAY,
    fontSize: 13,
  },

  ring: {
    borderWidth: 3,
    transform: [{ scaleY: 0.35 }],
  },
  band: {
    position: 'absolute',
    left: 0, right: 0,
    height: '10%' as any,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 4,
  },
  continent: {
    position: 'absolute',
    backgroundColor: 'rgba(21,128,61,0.5)',
    borderRadius: 8,
  },

  barTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pointsValue: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 22,
  },
  pointsUnit: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 14,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  nextName: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  nextPts: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },

  ladder: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ladderItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ladderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  ladderLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  ladderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ladderLabelText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
  },

  earnRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 14,
  },
  earnItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 10,
  },
  earnIcon: { fontSize: 16 },
  earnText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11, flex: 1 },
});
