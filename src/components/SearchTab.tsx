import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';
const GREEN = '#10B981';

// ─── Mock data ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all',        label: 'Todo',         icon: 'grid' },
  { key: 'lavarropas', label: 'Lavarropas',   icon: 'refresh-cw' },
  { key: 'tools',      label: 'Herramientas', icon: 'tool' },
  { key: 'impresora',  label: 'Impresoras',   icon: 'printer' },
  { key: 'otros',      label: 'Otros',        icon: 'package' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

const ITEMS = [
  {
    id: 'n1',
    icon: 'refresh-cw',
    category: 'lavarropas',
    name: 'Lavarropas Samsung 8kg',
    owner: 'Juan Torres',
    ownerInitial: 'J',
    distance: '2do piso · Edif. A',
    price: '$800/uso',
    rating: 4.9,
    reviews: 12,
    available: true,
    programs: ['Diario', 'Color', 'Delicado', 'Rápido'],
  },
  {
    id: 'n2',
    icon: 'tool',
    category: 'tools',
    name: 'Taladro Bosch',
    owner: 'Laura Pérez',
    ownerInitial: 'L',
    distance: '5to piso · Edif. B',
    price: '$400/día',
    rating: 5.0,
    reviews: 7,
    available: true,
    programs: [],
  },
  {
    id: 'n3',
    icon: 'refresh-cw',
    category: 'lavarropas',
    name: 'Lavarropas Whirlpool 7kg',
    owner: 'Carlos Rodríguez',
    ownerInitial: 'C',
    distance: '1er piso · Edif. A',
    price: '$600/uso',
    rating: 4.7,
    reviews: 5,
    available: false,
    programs: ['Diario', 'Lana', 'Centrifugado'],
  },
  {
    id: 'n4',
    icon: 'printer',
    category: 'impresora',
    name: 'Impresora HP LaserJet',
    owner: 'Sofía Méndez',
    ownerInitial: 'S',
    distance: '3er piso · Edif. A',
    price: '$200/hora',
    rating: 4.8,
    reviews: 9,
    available: true,
    programs: [],
  },
  {
    id: 'n5',
    icon: 'tool',
    category: 'tools',
    name: 'Escalera 3 metros',
    owner: 'Martín López',
    ownerInitial: 'M',
    distance: '7mo piso · Edif. B',
    price: 'Gratis',
    rating: 5.0,
    reviews: 3,
    available: true,
    programs: [],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchTab() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryKey>('all');

  const filtered = ITEMS.filter((item) => {
    const matchCat = category === 'all' || item.category === category;
    const matchQ = query.length === 0 ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.owner.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <View style={{ flex: 1 }}>
      {/* Search bar */}
      <View style={s.searchWrap}>
        <Feather name="search" size={16} color={BODY} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar ítem o vecino…"
          placeholderTextColor={BODY}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
            <Feather name="x" size={16} color={BODY} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.catRow}
      >
        {CATEGORIES.map((cat) => {
          const active = category === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[s.catChip, active && s.catChipActive]}
              onPress={() => setCategory(cat.key)}
              activeOpacity={0.7}
            >
              <Feather name={cat.icon as any} size={13} color={active ? '#C4B5FD' : BODY} />
              <Text style={[s.catChipText, active && s.catChipTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
      >
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Feather name="search" size={32} color={BODY} />
            <Text style={s.emptyText}>No encontramos ítems{'\n'}con esa búsqueda</Text>
          </View>
        ) : (
          filtered.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[s.card, !item.available && s.cardUnavailable]}
              activeOpacity={0.8}
              onPress={() => item.available && router.push({ pathname: '/reserve', params: { id: item.id } })}
            >
              {/* Icon + availability */}
              <View style={s.cardLeft}>
                <View style={[s.iconWrap, !item.available && s.iconWrapOff]}>
                  <Feather name={item.icon as any} size={24} color={item.available ? '#C4B5FD' : BODY} />
                </View>
                {item.available
                  ? <View style={s.availDot} />
                  : <View style={s.unavailDot} />
                }
              </View>

              <View style={{ flex: 1 }}>
                {/* Name + price */}
                <View style={s.topRow}>
                  <Text style={[s.itemName, !item.available && s.textOff]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={[s.pricePill, !item.available && s.pricePillOff]}>
                    <Text style={[s.priceText, !item.available && s.textOff]}>{item.price}</Text>
                  </View>
                </View>

                {/* Owner + distance */}
                <View style={s.ownerRow}>
                  <View style={s.ownerAvatar}>
                    <Text style={s.ownerInitial}>{item.ownerInitial}</Text>
                  </View>
                  <Text style={s.ownerName}>{item.owner}</Text>
                  <Text style={s.dot}>·</Text>
                  <Text style={s.distance}>{item.distance}</Text>
                </View>

                {/* Rating + programs */}
                <View style={s.bottomRow}>
                  <View style={s.ratingRow}>
                    <Feather name="star" size={11} color="#FCD34D" />
                    <Text style={s.ratingText}>{item.rating.toFixed(1)} · {item.reviews} reseñas</Text>
                  </View>
                  {item.programs.length > 0 && (
                    <View style={s.programsBadge}>
                      <Feather name="sliders" size={10} color={PURPLE} />
                      <Text style={s.programsBadgeText}>{item.programs.length} programas</Text>
                    </View>
                  )}
                  {!item.available && (
                    <View style={s.unavailPill}>
                      <Text style={s.unavailText}>No disponible</Text>
                    </View>
                  )}
                </View>
              </View>

              {item.available && (
                <TouchableOpacity
                  style={s.reserveBtn}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/reserve', params: { id: item.id } })}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#3B82F6']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.reserveBtnInner}
                  >
                    <Text style={s.reserveBtnText}>Reservar</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },

  catRow: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
    paddingRight: 20,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  catChipActive: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderColor: PURPLE,
  },
  catChipText: { fontFamily: 'Inter_500Medium', color: BODY, fontSize: 13 },
  catChipTextActive: { color: '#C4B5FD', fontFamily: 'Inter_600SemiBold' },

  list: { paddingHorizontal: 20 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 48, opacity: 0.5 },
  emptyText: {
    fontFamily: 'Inter_400Regular', color: BODY,
    fontSize: 14, textAlign: 'center', lineHeight: 22,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.12)',
    padding: 16,
    marginBottom: 12,
  },
  cardUnavailable: { opacity: 0.55 },
  cardLeft: { alignItems: 'center', gap: 6 },
  iconWrap: {
    width: 52, height: 52, borderRadius: 15,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapOff: { backgroundColor: 'rgba(107,114,128,0.1)' },
  availDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  unavailDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BODY },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  itemName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15, flex: 1 },
  textOff: { color: BODY },
  pricePill: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  pricePillOff: { backgroundColor: 'rgba(107,114,128,0.12)' },
  priceText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 12 },

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  ownerAvatar: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  ownerInitial: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 9 },
  ownerName: { fontFamily: 'Inter_500Medium', color: GRAY, fontSize: 12 },
  dot: { color: BODY, fontSize: 12 },
  distance: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, flex: 1 },

  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: 'Inter_500Medium', color: GRAY, fontSize: 12 },
  programsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(139,92,246,0.1)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  programsBadgeText: { fontFamily: 'Inter_500Medium', color: PURPLE, fontSize: 11 },
  unavailPill: {
    backgroundColor: 'rgba(107,114,128,0.15)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  unavailText: { fontFamily: 'Inter_500Medium', color: BODY, fontSize: 11 },

  reserveBtn: { borderRadius: 12, overflow: 'hidden', marginLeft: 4 },
  reserveBtnInner: {
    paddingHorizontal: 14, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  reserveBtnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 13 },
});
