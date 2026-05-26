import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Coords } from '../hooks/useLocation';
import {
  checkConflict,
  createNotification,
  createReservation,
  fetchItemDayReservations,
  fetchNeighborItems,
  fetchOrCreateConversation,
} from '../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';
const GREEN = '#10B981';

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#13142A' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#080A1A' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a1b2e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e1f35' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#080A1A' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#4B5563' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#252641' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#080A1A' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#374151' }] },
];

const DEFAULT_REGION = {
  latitude: -34.6037,
  longitude: -58.3816,
  latitudeDelta: 0.018,
  longitudeDelta: 0.018,
};

const CATEGORIES = [
  { key: 'all',        label: 'Todo',         icon: 'grid' },
  { key: 'refresh-cw', label: 'Lavarropas',   icon: 'refresh-cw' },
  { key: 'tool',       label: 'Herramientas', icon: 'tool' },
  { key: 'printer',    label: 'Impresoras',   icon: 'printer' },
  { key: 'activity',   label: 'Bicicletas',   icon: 'activity' },
  { key: 'volume-2',   label: 'Parlantes',    icon: 'volume-2' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function formatDuration(raw: string): string {
  const min = parseInt(raw);
  if (isNaN(min)) return raw;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h}:${String(m).padStart(2, '0')} h`;
}

const MOCK_REVIEWS = [
  { name: 'Ana M.', rating: 5, comment: 'Lavarropas en perfectas condiciones, muy limpio. ¡Lo recomiendo!', when: 'hace 2 días' },
  { name: 'Carlos R.', rating: 4, comment: 'Funciona muy bien, María súper amable y puntual.', when: 'hace 1 semana' },
  { name: 'Laura P.', rating: 5, comment: 'Todo perfecto, me prestó detergente extra sin problema.', when: 'hace 2 semanas' },
];

function getNextDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = d.toISOString().split('T')[0];
    const label = i === 0 ? 'Hoy' : i === 1 ? 'Mañana'
      : d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
    return { label, value };
  });
}

function generateSlots(durationMin: number): { from: string; to: string }[] {
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const slots = [];
  for (let t = 8 * 60; t + durationMin <= 22 * 60; t += durationMin) {
    slots.push({ from: fmt(t), to: fmt(t + durationMin) });
  }
  return slots;
}

function isSlotBusy(
  slot: { from: string; to: string },
  busy: { time_from: string; time_to: string }[]
): boolean {
  return busy.some(b => b.time_from < slot.to && b.time_to > slot.from);
}

function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Hoy';
  if (dateStr === tomorrow) return 'Mañana';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
}

function makeMockItem(centerLat: number, centerLng: number) {
  return {
    id: '__mock__',
    name: 'Lavarropas Samsung 8kg',
    icon: 'refresh-cw',
    price: '$500/turno',
    available: true,
    isMock: true,
    distKm: 0.18,
    programs: [
      { name: 'Rápido', duration: '30' },
      { name: 'Delicado', duration: '45' },
      { name: 'Normal', duration: '60' },
      { name: 'Intensivo', duration: '90' },
    ],
    reviews: MOCK_REVIEWS,
    owner: { nombre: 'María', apellido: 'G.', lat: centerLat + 0.0012, lng: centerLng - 0.0018 },
  };
}

export default function SearchTab({ userCoords }: { userCoords?: Coords | null }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryKey>('all');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ from: string; to: string } | null>(null);
  const [busySlots, setBusySlots] = useState<{ time_from: string; time_to: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setSelectedProgram(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setBusySlots([]);
  }, [detailItem]);

  useEffect(() => {
    setSelectedSlot(null);
    if (!detailItem?.id || !selectedDate) { setBusySlots([]); return; }

    if (detailItem.isMock) {
      const durationMin = selectedProgram ? parseInt(String(selectedProgram.duration)) : 60;
      const allSlots = generateSlots(durationMin);
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const future = selectedDate === todayStr ? allSlots.filter(s => s.from > nowTime) : allSlots;
      const fakeSlots = [future[1], future[3]].filter(Boolean).map(s => ({ time_from: s.from, time_to: s.to }));
      setBusySlots(fakeSlots);
      return;
    }

    setSlotsLoading(true);
    fetchItemDayReservations(detailItem.id, selectedDate).then(({ data }) => {
      setBusySlots(data ?? []);
      setSlotsLoading(false);
    });
  }, [detailItem?.id, selectedDate, selectedProgram?.name]);

  useEffect(() => {
    import('react-native-maps')
      .then((mod) => setMapComponents(mod))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchNeighborItems(query).then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  }, [query]);

  const withDist = items
    .map((item) => {
      const ownerLat = item.owner?.lat;
      const ownerLng = item.owner?.lng;
      const distKm =
        userCoords && ownerLat != null && ownerLng != null
          ? haversineKm(userCoords.latitude, userCoords.longitude, ownerLat, ownerLng)
          : null;
      return { ...item, distKm };
    })
    .sort((a, b) => {
      if (a.distKm == null && b.distKm == null) return 0;
      if (a.distKm == null) return 1;
      if (b.distKm == null) return -1;
      return a.distKm - b.distKm;
    });

  const mapRegion = userCoords
    ? { latitude: userCoords.latitude, longitude: userCoords.longitude, latitudeDelta: 0.018, longitudeDelta: 0.018 }
    : DEFAULT_REGION;

  const mockItem = makeMockItem(mapRegion.latitude, mapRegion.longitude);

  const mockEntry = (category === 'all' || category === 'refresh-cw') ? [mockItem] : [];
  const filtered = [
    ...withDist.filter((item) => category === 'all' || item.icon === category),
    ...mockEntry,
  ].sort((a, b) => {
    if (a.distKm == null && b.distKm == null) return 0;
    if (a.distKm == null) return 1;
    if (b.distKm == null) return -1;
    return a.distKm - b.distKm;
  });
  const recommended = filtered.filter((i) => i.available !== false).slice(0, 5);
  const mapItems = filtered.filter(
    (i) => i.owner?.lat != null && i.owner?.lng != null && i.available !== false && !i.isMock
  );

  const allMapItems = [...mapItems, mockItem];

  const handleReserve = async (item: any) => {
    if (reservingId) return;
    setReservingId(item.id);
    const ownerId = item.owner?.id ?? item.user_id;
    const { data: conv } = await fetchOrCreateConversation(item.id, ownerId);
    setReservingId(null);
    if (conv) router.push({ pathname: '/chat', params: { id: conv.id } });
  };

  const ownerName = (item: any) =>
    item.owner?.nombre ? `${item.owner.nombre} ${item.owner.apellido ?? ''}`.trim() : 'Vecino';

  const ownerInitial = (item: any) => item.owner?.nombre?.[0]?.toUpperCase() ?? 'V';

  const handleConfirmReservation = async () => {
    if (!detailItem || !selectedDate || !selectedSlot) return;

    if (detailItem.isMock) {
      Alert.alert(
        '¡Así funciona!',
        `Se reservaría "${selectedProgram?.name ?? 'Turno'}" para el ${formatDateLabel(selectedDate)} de ${selectedSlot.from} a ${selectedSlot.to}.\n\nEsa franja quedaría bloqueada para otros vecinos.`,
        [{ text: 'Entendido', onPress: () => setDetailItem(null) }]
      );
      return;
    }

    setReservingId(detailItem.id);
    try {
      const { conflict } = await checkConflict(detailItem.id, selectedDate, selectedSlot.from, selectedSlot.to);
      if (conflict) {
        Alert.alert('Turno ocupado', 'Ese horario acaba de ser reservado. Elegí otro.');
        const { data } = await fetchItemDayReservations(detailItem.id, selectedDate);
        setBusySlots(data ?? []);
        setSelectedSlot(null);
        setReservingId(null);
        return;
      }

      const ownerId = detailItem.owner?.id ?? detailItem.user_id;
      const { data: conv } = await fetchOrCreateConversation(detailItem.id, ownerId);
      if (!conv) { setReservingId(null); return; }

      const { data: res } = await createReservation({
        conversationId: conv.id,
        itemId: detailItem.id,
        ownerId,
        date: selectedDate,
        timeFrom: selectedSlot.from,
        timeTo: selectedSlot.to,
        program: selectedProgram?.name ?? '',
        deliveryMethod: 'pickup',
        status: 'pending',
      });

      if (res && ownerId) {
        await createNotification({
          userId: ownerId,
          type: 'reservation',
          reservationId: res.id,
          title: 'Nueva solicitud de reserva',
          body: `${detailItem.name} · ${formatDateLabel(selectedDate)} · ${selectedSlot.from}`,
        });
      }

      const ownerFirstName = detailItem.owner?.nombre ?? 'El dueño';
      const convId = conv.id;
      setReservingId(null);
      setDetailItem(null);
      Alert.alert(
        '¡Solicitud enviada!',
        `${ownerFirstName} recibirá tu pedido y confirmará el turno. Te avisamos cuando lo acepte.`,
        [
          { text: 'OK' },
          { text: 'Ver chat', onPress: () => router.push({ pathname: '/chat', params: { id: convId } }) },
        ]
      );
    } catch {
      setReservingId(null);
      Alert.alert('Error', 'No se pudo confirmar. Intentá de nuevo.');
    }
  };

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
      <View style={s.catWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
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
        <LinearGradient
          colors={['transparent', BG]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.catFade}
          pointerEvents="none"
        />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={PURPLE} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

          {/* ── Map ── */}
          <View style={s.mapWrap}>
            {MapComponents ? (
              <MapComponents.default
                style={s.map}
                initialRegion={mapRegion}
                customMapStyle={DARK_MAP_STYLE}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                showsUserLocation={!!userCoords}
                showsMyLocationButton={false}
                showsPointsOfInterests={false}
                showsBuildings={false}
                showsCompass={false}
              >
                {allMapItems.map((item) => (
                  <MapComponents.Marker
                    key={item.id}
                    coordinate={{ latitude: item.owner.lat, longitude: item.owner.lng }}
                  >
                    <View style={[s.markerDot, item.isMock && s.markerDotMock]}>
                      <Feather name={item.icon as any} size={11} color="#FFF" />
                    </View>
                  </MapComponents.Marker>
                ))}
              </MapComponents.default>
            ) : (
              <View style={s.mapPlaceholder}>
                <Feather name="map" size={22} color={BODY} />
                <Text style={s.mapPlaceholderText}>Mapa disponible tras compilar la app</Text>
              </View>
            )}

            {/* Tap overlay to expand */}
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={0.85}
              onPress={() => { setSelectedItem(null); setMapExpanded(true); }}
            />

            <View style={s.mapBadge}>
              <Feather name="map-pin" size={11} color={PURPLE} />
              <Text style={s.mapBadgeText}>
                {allMapItems.length > 0 ? `${allMapItems.length} ítems en tu zona` : 'Tu zona'}
              </Text>
            </View>
            <View style={s.mapExpandHint}>
              <Feather name="maximize-2" size={11} color="#C4B5FD" />
              <Text style={s.mapExpandText}>Tocar para explorar</Text>
            </View>
          </View>

          {/* ── Recommended ── */}
          {recommended.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>
                {userCoords ? 'CERCA DE VOS' : 'DISPONIBLES AHORA'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.recRow}
              >
                {recommended.map((item) => {
                  const isReserving = reservingId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={s.recCard}
                      activeOpacity={0.8}
                      onPress={() => setDetailItem(item)}
                    >
                      <View style={s.recIconWrap}>
                        <Feather name={item.icon as any} size={20} color="#C4B5FD" />
                      </View>
                      <Text style={s.recName} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.recOwner} numberOfLines={1}>{ownerName(item)}</Text>
                      {item.distKm != null && (
                        <View style={s.recDistPill}>
                          <Feather name="map-pin" size={9} color={PURPLE} />
                          <Text style={s.recDistText}>{formatDist(item.distKm)}</Text>
                        </View>
                      )}
                      <View style={[s.recBtn, { borderRadius: 10, overflow: 'hidden', marginTop: 6 }]}>
                        <LinearGradient
                          colors={item.isMock ? ['#78350F', '#92400E'] : ['#7C3AED', '#3B82F6']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={s.recBtnInner}
                        >
                          <Text style={s.recBtnText}>{item.isMock ? 'Ver ejemplo' : 'Ver detalle'}</Text>
                        </LinearGradient>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── Full list ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>TODOS LOS ÍTEMS</Text>

            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Feather name="search" size={32} color={BODY} />
                <Text style={s.emptyText}>
                  {items.length === 0
                    ? 'Todavía no hay ítems de tus vecinos'
                    : 'No encontramos ítems\ncon esa búsqueda'}
                </Text>
              </View>
            ) : (
              filtered.map((item) => {
                const isReserving = reservingId === item.id;
                const isAvail = item.available !== false;
                const programs: any[] = item.programs ?? [];

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.card, !isAvail && s.cardUnavailable]}
                    activeOpacity={0.8}
                    onPress={() => setDetailItem(item)}
                  >
                    <View style={s.cardLeft}>
                      <View style={[s.iconWrap, !isAvail && s.iconWrapOff]}>
                        <Feather name={item.icon as any} size={24} color={isAvail ? '#C4B5FD' : BODY} />
                      </View>
                      {isAvail ? <View style={s.availDot} /> : <View style={s.unavailDot} />}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={s.topRow}>
                        <Text style={[s.itemName, !isAvail && s.textOff]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.price ? (
                          <View style={[s.pricePill, !isAvail && s.pricePillOff]}>
                            <Text style={[s.priceText, !isAvail && s.textOff]}>{item.price}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={s.ownerRow}>
                        <View style={s.ownerAvatar}>
                          <Text style={s.ownerInitial}>{ownerInitial(item)}</Text>
                        </View>
                        <Text style={s.ownerName}>{ownerName(item)}</Text>
                        {item.distKm != null ? (
                          <>
                            <Text style={s.dot}>·</Text>
                            <View style={s.distPill}>
                              <Feather name="map-pin" size={9} color={PURPLE} />
                              <Text style={s.distText}>{formatDist(item.distKm)}</Text>
                            </View>
                          </>
                        ) : item.location ? (
                          <>
                            <Text style={s.dot}>·</Text>
                            <Text style={s.distance} numberOfLines={1}>{item.location}</Text>
                          </>
                        ) : null}
                      </View>

                      <View style={s.bottomRow}>
                        {programs.length > 0 && (
                          <View style={s.programsBadge}>
                            <Feather name="sliders" size={10} color={PURPLE} />
                            <Text style={s.programsBadgeText}>{programs.length} programas</Text>
                          </View>
                        )}
                        {item.isMock && (
                          <View style={s.mockPill}>
                            <Feather name="eye" size={9} color="#F59E0B" />
                            <Text style={s.mockPillText}>EJEMPLO</Text>
                          </View>
                        )}
                        {item.busyUntil ? (
                          <View style={s.busyPill}>
                            <Feather name="clock" size={10} color="#F97316" />
                            <Text style={s.busyText}>Ocupado hasta {item.busyUntil}</Text>
                          </View>
                        ) : item.nextBusy ? (
                          <View style={s.nextBusyPill}>
                            <Feather name="calendar" size={10} color={BODY} />
                            <Text style={s.nextBusyText}>Reservado a las {item.nextBusy}</Text>
                          </View>
                        ) : null}
                        {!isAvail && (
                          <View style={s.unavailPill}>
                            <Text style={s.unavailText}>No disponible</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={s.chevronWrap}>
                      <Feather name="chevron-right" size={18} color="rgba(196,181,253,0.4)" />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* ── Item detail modal ── */}
      <Modal
        visible={!!detailItem}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailItem(null)}
      >
        <View style={dm.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setDetailItem(null)} activeOpacity={1} />
          <View style={dm.sheet}>
            <View style={dm.handle} />
            <TouchableOpacity style={dm.closeBtn} onPress={() => setDetailItem(null)} hitSlop={12}>
              <Feather name="x" size={18} color={GRAY} />
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[dm.scrollContent, { paddingBottom: insets.bottom + 28 }]}
            >
              {/* Header */}
              <View style={dm.header}>
                <View style={[dm.iconWrap, detailItem?.isMock && dm.iconWrapMock]}>
                  <Feather name={detailItem?.icon as any} size={30} color="#C4B5FD" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={dm.itemName}>{detailItem?.name}</Text>
                  <View style={dm.headerMeta}>
                    {detailItem?.price ? (
                      <View style={dm.pricePill}>
                        <Text style={dm.priceText}>{detailItem?.price}</Text>
                      </View>
                    ) : null}
                    {detailItem?.icon === 'refresh-cw' && (
                      <View style={[dm.detergentBadge, detailItem?.note === 'Sin detergente' && dm.detergentBadgeNo]}>
                        <Feather
                          name={detailItem?.note === 'Sin detergente' ? 'x-circle' : 'check-circle'}
                          size={11}
                          color={detailItem?.note === 'Sin detergente' ? BODY : '#10B981'}
                        />
                        <Text style={[dm.detergentText, detailItem?.note === 'Sin detergente' && dm.detergentTextNo]}>
                          {detailItem?.note === 'Sin detergente' ? 'Sin detergente' : 'Incluye detergente'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Owner + distance */}
              <View style={dm.ownerRow}>
                <View style={dm.ownerAvatar}>
                  <Text style={dm.ownerInitial}>
                    {detailItem?.owner?.nombre?.[0]?.toUpperCase() ?? 'V'}
                  </Text>
                </View>
                <Text style={dm.ownerName}>{ownerName(detailItem ?? {})}</Text>
                {detailItem?.distKm != null && (
                  <>
                    <Text style={dm.dot}>·</Text>
                    <View style={dm.distPill}>
                      <Feather name="map-pin" size={9} color={PURPLE} />
                      <Text style={dm.distText}>{formatDist(detailItem.distKm)}</Text>
                    </View>
                  </>
                )}
                {detailItem?.location && detailItem?.distKm == null && (
                  <>
                    <Text style={dm.dot}>·</Text>
                    <Text style={dm.locationText}>{detailItem.location}</Text>
                  </>
                )}
              </View>

              {/* Availability */}
              <Text style={dm.sectionLabel}>DISPONIBILIDAD</Text>
              <View style={dm.availRow}>
                {detailItem?.available === false ? (
                  <>
                    <View style={[dm.statusDot, { backgroundColor: BODY }]} />
                    <Text style={[dm.statusText, { color: BODY }]}>No disponible</Text>
                  </>
                ) : detailItem?.busyUntil ? (
                  <>
                    <View style={[dm.statusDot, { backgroundColor: '#F97316' }]} />
                    <Text style={[dm.statusText, { color: '#F97316' }]}>Ocupado hasta {detailItem.busyUntil}</Text>
                  </>
                ) : (
                  <>
                    <View style={[dm.statusDot, { backgroundColor: GREEN }]} />
                    <Text style={[dm.statusText, { color: GREEN }]}>Disponible ahora</Text>
                    {detailItem?.nextBusy ? (
                      <Text style={dm.nextBusyNote}> · Reservado a las {detailItem.nextBusy}</Text>
                    ) : null}
                  </>
                )}
              </View>

              {/* Programs */}
              {(detailItem?.programs ?? []).length > 0 && (
                <>
                  <Text style={dm.sectionLabel}>PROGRAMAS</Text>
                  <View style={dm.programsRow}>
                    {(detailItem?.programs ?? []).map((p: any, i: number) => {
                      const isSel = selectedProgram?.name === p.name;
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[dm.programChip, isSel && dm.programChipSelected]}
                          onPress={() => setSelectedProgram(isSel ? null : p)}
                          activeOpacity={0.75}
                        >
                          {isSel && <Feather name="check" size={11} color="#C4B5FD" />}
                          <Text style={[dm.programName, isSel && dm.programNameSel]}>{p.name}</Text>
                          {p.duration ? (
                            <>
                              <View style={dm.programDivider} />
                              <Feather name="clock" size={10} color={isSel ? '#A78BFA' : BODY} />
                              <Text style={[dm.programDur, isSel && { color: '#A78BFA' }]}>
                                {formatDuration(String(p.duration))}
                              </Text>
                            </>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Specs note (non-lavarropas) */}
              {detailItem?.note && detailItem?.icon !== 'refresh-cw' ? (
                <>
                  <Text style={dm.sectionLabel}>ESPECIFICACIONES</Text>
                  <View style={dm.noteWrap}>
                    <Text style={dm.noteText}>{detailItem.note}</Text>
                  </View>
                </>
              ) : null}

              {/* Reviews */}
              {(detailItem?.reviews ?? MOCK_REVIEWS).length > 0 && (
                <>
                  <Text style={dm.sectionLabel}>RESEÑAS</Text>
                  <View style={dm.reviewsList}>
                    {(detailItem?.reviews ?? MOCK_REVIEWS).map((r: any, i: number) => (
                      <View key={i} style={[dm.reviewCard, i > 0 && dm.reviewCardBorder]}>
                        <View style={dm.reviewTop}>
                          <View style={dm.reviewAvatar}>
                            <Text style={dm.reviewAvatarText}>{r.name[0]}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={dm.reviewName}>{r.name}</Text>
                            <Text style={dm.reviewWhen}>{r.when}</Text>
                          </View>
                          <View style={dm.starsRow}>
                            {Array.from({ length: 5 }, (_, si) => (
                              <Feather
                                key={si}
                                name="star"
                                size={11}
                                color={si < r.rating ? '#FCD34D' : 'rgba(255,255,255,0.15)'}
                              />
                            ))}
                          </View>
                        </View>
                        <Text style={dm.reviewComment}>{r.comment}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Date selection — visible once program is chosen (or if no programs) */}
              {detailItem?.available !== false && (() => {
                const hasPrograms = (detailItem?.programs ?? []).length > 0;
                if (hasPrograms && !selectedProgram) return null;
                return (
                  <>
                    <Text style={dm.sectionLabel}>FECHA</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={dm.dateRow}
                      style={{ marginBottom: 16 }}
                    >
                      {getNextDays(7).map((day) => {
                        const isSel = selectedDate === day.value;
                        return (
                          <TouchableOpacity
                            key={day.value}
                            style={[dm.dateChip, isSel && dm.dateChipSelected]}
                            onPress={() => setSelectedDate(isSel ? null : day.value)}
                            activeOpacity={0.75}
                          >
                            <Text style={[dm.dateChipText, isSel && dm.dateChipTextSel]}>{day.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                );
              })()}

              {/* Time slots — visible once a date is chosen */}
              {detailItem?.available !== false && (() => {
                const hasPrograms = (detailItem?.programs ?? []).length > 0;
                if (hasPrograms && !selectedProgram) return null;
                if (!selectedDate) return null;
                const durationMin = selectedProgram ? parseInt(String(selectedProgram.duration)) : 60;
                const slots = generateSlots(durationMin);
                const todayStr = new Date().toISOString().split('T')[0];
                const now = new Date();
                const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                const visibleSlots = selectedDate === todayStr ? slots.filter(s => s.from > nowTime) : slots;
                return (
                  <>
                    <Text style={dm.sectionLabel}>HORARIO</Text>
                    {slotsLoading ? (
                      <ActivityIndicator color={PURPLE} style={{ marginBottom: 16 }} />
                    ) : (
                      <View style={dm.slotsGrid}>
                        {visibleSlots.map((slot) => {
                          const busy = isSlotBusy(slot, busySlots);
                          const isSel = selectedSlot?.from === slot.from;
                          return (
                            <TouchableOpacity
                              key={slot.from}
                              style={[dm.slotChip, isSel && dm.slotChipSelected, busy && dm.slotChipBusy]}
                              onPress={() => { if (!busy) setSelectedSlot(isSel ? null : slot); }}
                              activeOpacity={busy ? 1 : 0.75}
                              disabled={busy}
                            >
                              {busy && <Feather name="lock" size={9} color={BODY} />}
                              <Text style={[dm.slotText, isSel && dm.slotTextSel, busy && dm.slotTextBusy]}>
                                {slot.from}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </>
                );
              })()}

              {/* Reserve button */}
              {detailItem?.available !== false && (() => {
                const hasPrograms = (detailItem?.programs ?? []).length > 0;
                const programOk = !hasPrograms || !!selectedProgram;
                const ready = programOk && !!selectedDate && !!selectedSlot;
                const label = !programOk
                  ? 'Seleccioná un programa'
                  : !selectedDate
                  ? 'Elegí una fecha'
                  : !selectedSlot
                  ? 'Elegí un horario'
                  : `Confirmar · ${formatDateLabel(selectedDate)} · ${selectedSlot.from}`;
                return (
                  <TouchableOpacity
                    style={dm.reserveWrapper}
                    activeOpacity={ready ? 0.85 : 1}
                    onPress={() => { if (ready) handleConfirmReservation(); }}
                    disabled={!!reservingId || !ready}
                  >
                    <LinearGradient
                      colors={ready ? ['#7C3AED', '#3B82F6'] : ['#1C1D35', '#1C1D35']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[dm.reserveBtn, !ready && dm.reserveBtnDisabled]}
                    >
                      {reservingId === detailItem?.id ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <>
                          <Feather name="calendar" size={16} color={ready ? '#FFF' : BODY} />
                          <Text style={[dm.reserveBtnText, !ready && { color: BODY }]}>{label}</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Full-screen map modal ── */}
      <Modal
        visible={mapExpanded}
        animationType="slide"
        onRequestClose={() => { setMapExpanded(false); setSelectedItem(null); }}
      >
        <View style={m.container}>
          <View style={[m.header, { paddingTop: insets.top + 10 }]}>
            <Text style={m.title}>Mapa de tu zona</Text>
            <TouchableOpacity
              onPress={() => { setMapExpanded(false); setSelectedItem(null); }}
              style={m.closeBtn}
              hitSlop={12}
            >
              <Feather name="x" size={20} color={GRAY} />
            </TouchableOpacity>
          </View>

          {MapComponents ? (
            <MapComponents.default
              style={{ flex: 1 }}
              initialRegion={mapRegion}
              customMapStyle={DARK_MAP_STYLE}
              showsUserLocation={!!userCoords}
              showsMyLocationButton={false}
              showsPointsOfInterests={false}
              showsBuildings={false}
              showsCompass={false}
            >
              {allMapItems.map((item) => (
                <MapComponents.Marker
                  key={item.id}
                  coordinate={{ latitude: item.owner.lat, longitude: item.owner.lng }}
                  onPress={() => setSelectedItem(item)}
                >
                  <View style={[s.markerDot, item.isMock && s.markerDotMock, selectedItem?.id === item.id && s.markerDotSelected]}>
                    <Feather name={item.icon as any} size={11} color="#FFF" />
                  </View>
                </MapComponents.Marker>
              ))}
            </MapComponents.default>
          ) : (
            <View style={m.noMap}>
              <Feather name="map" size={32} color={BODY} />
              <Text style={m.noMapText}>Compilá la app para ver el mapa</Text>
            </View>
          )}

          {/* Selected item card */}
          {selectedItem && (
            <View style={m.itemCard}>
              <TouchableOpacity
                style={m.itemCardClose}
                onPress={() => setSelectedItem(null)}
                hitSlop={10}
              >
                <Feather name="x" size={16} color={BODY} />
              </TouchableOpacity>

              {selectedItem.isMock && (
                <View style={m.exampleBadge}>
                  <Feather name="eye" size={10} color="#F59E0B" />
                  <Text style={m.exampleText}>EJEMPLO</Text>
                </View>
              )}

              <View style={m.itemRow}>
                <View style={[m.itemIcon, selectedItem.isMock && m.itemIconMock]}>
                  <Feather name={selectedItem.icon as any} size={24} color="#C4B5FD" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.itemName}>{selectedItem.name}</Text>
                  <View style={m.itemMeta}>
                    <View style={m.ownerAvatar}>
                      <Text style={m.ownerInitialText}>
                        {selectedItem.owner?.nombre?.[0]?.toUpperCase() ?? 'V'}
                      </Text>
                    </View>
                    <Text style={m.itemOwner}>
                      {selectedItem.owner?.nombre} {selectedItem.owner?.apellido ?? ''}
                    </Text>
                    {selectedItem.distKm != null && (
                      <>
                        <Text style={m.metaDot}>·</Text>
                        <View style={m.distPill}>
                          <Feather name="map-pin" size={9} color={PURPLE} />
                          <Text style={m.distText}>{formatDist(selectedItem.distKm)}</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
                {selectedItem.price && (
                  <View style={m.pricePill}>
                    <Text style={m.priceText}>{selectedItem.price}</Text>
                  </View>
                )}
              </View>

              {selectedItem.isMock ? (
                <View style={m.exampleNote}>
                  <Feather name="info" size={13} color={BODY} />
                  <Text style={m.exampleNoteText}>
                    Así se vería un ítem de un vecino. Cuando alguien cargue productos cerca, aparecen acá.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={m.reserveWrapper}
                  activeOpacity={0.85}
                  onPress={() => { setMapExpanded(false); setSelectedItem(null); handleReserve(selectedItem); }}
                  disabled={!!reservingId}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#3B82F6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={m.reserveBtn}
                  >
                    {reservingId === selectedItem.id
                      ? <ActivityIndicator color="#FFF" />
                      : <>
                          <Feather name="calendar" size={16} color="#FFF" />
                          <Text style={m.reserveBtnText}>Reservar este ítem</Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Modal>
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

  catWrap: { position: 'relative' },
  catRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 16,
    alignItems: 'center',
  },
  catFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  scrollContent: { paddingBottom: 8 },

  // ── Map ──
  mapWrap: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.15)',
  },
  map: { height: 210 },
  mapPlaceholder: {
    height: 210,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapPlaceholderText: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 13,
  },
  mapBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(19,20,42,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  mapBadgeText: { fontFamily: 'Inter_600SemiBold', color: '#C4B5FD', fontSize: 12 },

  markerDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PURPLE,
    borderWidth: 2,
    borderColor: '#C4B5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callout: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.4)',
    minWidth: 80,
  },
  calloutName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 13 },
  calloutDist: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11, marginTop: 2 },

  // ── Sections ──
  section: { marginBottom: 24 },
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    color: BODY,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 12,
    paddingHorizontal: 20,
  },

  // ── Recommended cards ──
  recRow: { paddingHorizontal: 20, gap: 10 },
  recCard: {
    width: 152,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.15)',
    padding: 14,
    gap: 6,
  },
  recIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  recName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 13 },
  recOwner: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
  recDistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139,92,246,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recDistText: { fontFamily: 'Inter_600SemiBold', color: PURPLE, fontSize: 10 },
  recBtn: { borderRadius: 10, overflow: 'hidden', marginTop: 6 },
  recBtnInner: { height: 32, alignItems: 'center', justifyContent: 'center' },
  recBtnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 12 },

  // ── Full list cards ──
  empty: { alignItems: 'center', gap: 12, paddingVertical: 48, opacity: 0.5 },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
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
    marginBottom: 10,
    marginHorizontal: 20,
  },
  cardUnavailable: { opacity: 0.55 },
  cardLeft: { alignItems: 'center', gap: 6 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOff: { backgroundColor: 'rgba(107,114,128,0.1)' },
  availDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  unavailDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BODY },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  itemName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15, flex: 1 },
  textOff: { color: BODY },
  pricePill: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pricePillOff: { backgroundColor: 'rgba(107,114,128,0.12)' },
  priceText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 12 },

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  ownerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerInitial: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 9 },
  ownerName: { fontFamily: 'Inter_500Medium', color: GRAY, fontSize: 12 },
  dot: { color: BODY, fontSize: 12 },
  distance: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, flex: 1 },
  distPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(139,92,246,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  distText: { fontFamily: 'Inter_600SemiBold', color: PURPLE, fontSize: 11 },

  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  programsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139,92,246,0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  programsBadgeText: { fontFamily: 'Inter_500Medium', color: PURPLE, fontSize: 11 },
  busyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249,115,22,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
  },
  busyText: { fontFamily: 'Inter_600SemiBold', color: '#F97316', fontSize: 11 },
  nextBusyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(107,114,128,0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nextBusyText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
  unavailPill: {
    backgroundColor: 'rgba(107,114,128,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unavailText: { fontFamily: 'Inter_500Medium', color: BODY, fontSize: 11 },

  reserveBtn: { borderRadius: 12, overflow: 'hidden', marginLeft: 4 },
  reserveBtnInner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  reserveBtnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 13 },

  mockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mockPillText: { fontFamily: 'Inter_700Bold', color: '#F59E0B', fontSize: 10, letterSpacing: 0.6 },

  recMockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 32,
    borderRadius: 10,
    marginTop: 6,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  recMockBtnText: { fontFamily: 'Inter_700Bold', color: '#F59E0B', fontSize: 11 },

  chevronWrap: { justifyContent: 'center', paddingLeft: 4 },

  markerDotMock: { backgroundColor: '#F59E0B', borderColor: '#FDE68A' },
  markerDotSelected: { transform: [{ scale: 1.25 }] },

  mapExpandHint: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(19,20,42,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mapExpandText: { fontFamily: 'Inter_500Medium', color: '#C4B5FD', fontSize: 11 },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 17 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  noMap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noMapText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 14 },

  // Selected item card
  itemCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    padding: 20,
    paddingBottom: 32,
    gap: 14,
  },
  itemCardClose: {
    position: 'absolute',
    top: 16,
    right: 18,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  exampleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  exampleText: { fontFamily: 'Inter_700Bold', color: '#F59E0B', fontSize: 11, letterSpacing: 0.8 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  itemIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  itemIconMock: { backgroundColor: 'rgba(245,158,11,0.12)' },
  itemName: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16, marginBottom: 6 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownerAvatar: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  ownerInitialText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 9 },
  itemOwner: { fontFamily: 'Inter_500Medium', color: GRAY, fontSize: 12 },
  metaDot: { color: BODY, fontSize: 12 },
  distPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(139,92,246,0.1)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  distText: { fontFamily: 'Inter_600SemiBold', color: PURPLE, fontSize: 11 },
  pricePill: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  priceText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 13 },

  exampleNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(107,114,128,0.08)',
    borderRadius: 12,
    padding: 12,
  },
  exampleNoteText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 13,
    lineHeight: 19,
  },

  reserveWrapper: { borderRadius: 16, overflow: 'hidden' },
  reserveBtn: {
    height: 52, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  reserveBtnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 15 },
});

// ─── Detail modal styles ──────────────────────────────────────────────────────

const dm = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#13142A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    paddingTop: 12,
    maxHeight: '88%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 0,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute', top: 18, right: 20,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginBottom: 14,
  },
  iconWrap: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: 'rgba(139,92,246,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapMock: { backgroundColor: 'rgba(245,158,11,0.12)' },
  itemName: {
    fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 18,
    marginBottom: 6,
  },
  headerMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pricePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139,92,246,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  priceText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 13 },
  detergentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  detergentBadgeNo: { backgroundColor: 'rgba(107,114,128,0.1)', borderColor: 'rgba(107,114,128,0.2)' },
  detergentText: { fontFamily: 'Inter_500Medium', color: '#10B981', fontSize: 11 },
  detergentTextNo: { color: BODY },

  ownerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 20,
  },
  ownerAvatar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  ownerInitial: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 10 },
  ownerName: { fontFamily: 'Inter_500Medium', color: '#9CA3AF', fontSize: 13 },
  dot: { color: '#6B7280', fontSize: 13 },
  distPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(139,92,246,0.1)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  distText: { fontFamily: 'Inter_600SemiBold', color: '#8B5CF6', fontSize: 11 },
  locationText: { fontFamily: 'Inter_400Regular', color: '#6B7280', fontSize: 12, flex: 1 },

  sectionLabel: {
    fontFamily: 'Inter_700Bold', color: '#6B7280',
    fontSize: 11, letterSpacing: 1.2,
    marginBottom: 8, marginTop: 4,
  },

  availRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 12,
    marginBottom: 16,
  },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  nextBusyNote: { fontFamily: 'Inter_400Regular', color: '#6B7280', fontSize: 13 },

  programsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 16,
  },
  programChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.18)',
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
  },
  programChipSelected: {
    backgroundColor: 'rgba(139,92,246,0.22)',
    borderColor: '#8B5CF6',
  },
  programName: { fontFamily: 'Inter_600SemiBold', color: '#9CA3AF', fontSize: 13 },
  programNameSel: { color: '#C4B5FD' },
  programDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 2 },
  programDur: { fontFamily: 'Inter_400Regular', color: '#9CA3AF', fontSize: 12 },

  reviewsList: { gap: 0, marginBottom: 16 },
  reviewCard: { paddingVertical: 12, gap: 6 },
  reviewCardBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 11 },
  reviewName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 13 },
  reviewWhen: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11, marginTop: 1 },
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontFamily: 'Inter_400Regular', color: '#9CA3AF', fontSize: 13, lineHeight: 19, marginLeft: 38 },

  noteWrap: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 12,
    marginBottom: 16,
  },
  noteText: { fontFamily: 'Inter_400Regular', color: '#9CA3AF', fontSize: 13, lineHeight: 20 },

  exampleNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(107,114,128,0.08)',
    borderRadius: 12, padding: 14,
    marginTop: 8,
  },
  exampleNoteText: {
    flex: 1, fontFamily: 'Inter_400Regular',
    color: '#6B7280', fontSize: 13, lineHeight: 19,
  },

  reserveWrapper: { borderRadius: 16, overflow: 'hidden', marginTop: 12 },
  reserveBtn: {
    height: 54, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  reserveBtnDisabled: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  reserveBtnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 },

  dateRow: { gap: 8, paddingRight: 4, paddingBottom: 2 },
  dateChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dateChipSelected: { backgroundColor: 'rgba(139,92,246,0.22)', borderColor: '#8B5CF6' },
  dateChipText: { fontFamily: 'Inter_500Medium', color: GRAY, fontSize: 13 },
  dateChipTextSel: { fontFamily: 'Inter_600SemiBold', color: '#C4B5FD' },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  slotChip: {
    width: 68, paddingVertical: 9, borderRadius: 10,
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.18)',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  slotChipSelected: { backgroundColor: 'rgba(139,92,246,0.3)', borderColor: '#8B5CF6' },
  slotChipBusy: {
    backgroundColor: 'rgba(107,114,128,0.06)',
    borderColor: 'rgba(107,114,128,0.15)',
    opacity: 0.55,
  },
  slotText: { fontFamily: 'Inter_600SemiBold', color: GRAY, fontSize: 13 },
  slotTextSel: { color: '#C4B5FD' },
  slotTextBusy: { fontFamily: 'Inter_400Regular', color: BODY, textDecorationLine: 'line-through' },
});
