import { Feather } from '@expo/vector-icons';
import { parseRequestDesc } from '../lib/requestUtils';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Coords } from '../hooks/useLocation';
import {
  acceptOffer,
  checkConflict,
  createMPPreference,
  createReservation,
  declineOffer,
  deleteRequest,
  fetchItemDayReservations,
  fetchNeighborItems,
  fetchOffersForRequests,
  fetchOrCreateConversation,
  fetchRequests,
  fetchItemReviews,
  fetchUserReviews,
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

function generateHourlySlots(durationMin: number): { from: string; to: string }[] {
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const slots = [];
  for (let t = 8 * 60; t + durationMin <= 22 * 60; t += 60) {
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

function reqRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Hoy';
  if (dateStr === tomorrow) return 'Mañana';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
}



export default function SearchTab({ userCoords, onCatBarLayout }: { userCoords?: Coords | null; onCatBarLayout?: (top: number, bottom: number) => void }) {
  const catWrapRef = useRef<View>(null);
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
  const [showPayment, setShowPayment] = useState(false);
  const [showOwnerProfile, setShowOwnerProfile] = useState(false);
  const [itemReviews, setItemReviews] = useState<any[]>([]);
  const [ownerReviews, setOwnerReviews] = useState<any[]>([]);
  const [detailImageFullscreen, setDetailImageFullscreen] = useState(false);
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<'items' | 'pedir' | 'ofrecer'>('items');
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [offersMap, setOffersMap] = useState<Record<string, any[]>>({});

  const loadOffersForRequests = useCallback(async (reqs: any[]) => {
    const ownIds = reqs.filter((r) => r.isOwn).map((r) => r.id);
    if (!ownIds.length) { setOffersMap({}); return; }
    const { data } = await fetchOffersForRequests(ownIds);
    const map: Record<string, any[]> = {};
    for (const offer of (data ?? [])) {
      if (!map[offer.request_id]) map[offer.request_id] = [];
      map[offer.request_id].push(offer);
    }
    setOffersMap(map);
  }, []);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    const { data, error } = await fetchRequests();
    if (error) console.error('[fetchRequests] error:', JSON.stringify(error));
    const reqs = data ?? [];
    setRequests(reqs);
    await loadOffersForRequests(reqs);
    setRequestsLoading(false);
  }, [loadOffersForRequests]);

  const handleAcceptOffer = useCallback(async (convId: string, reqId: string) => {
    const { error } = await acceptOffer(convId, reqId);
    if (error) { Alert.alert('Error', 'No se pudo aceptar la oferta.'); return; }
    setRequests((prev) => prev.filter((r) => r.id !== reqId));
    setOffersMap((prev) => { const next = { ...prev }; delete next[reqId]; return next; });
    router.push(`/chat?id=${convId}`);
  }, []);

  const handleDeclineOffer = useCallback(async (convId: string, reqId: string) => {
    const { error } = await declineOffer(convId);
    if (error) { Alert.alert('Error', 'No se pudo rechazar.'); return; }
    setOffersMap((prev) => ({
      ...prev,
      [reqId]: (prev[reqId] ?? []).filter((o) => o.id !== convId),
    }));
  }, []);

  useEffect(() => {
    if (viewMode === 'pedir' || viewMode === 'ofrecer') loadRequests();
  }, [viewMode, loadRequests]);

  useFocusEffect(
    useCallback(() => {
      if (viewMode === 'pedir' || viewMode === 'ofrecer') loadRequests();
    }, [viewMode, loadRequests])
  );

  useEffect(() => {
    if (detailItem?.id) {
      fetchItemReviews(detailItem.id).then(({ data }) => setItemReviews(data ?? []));
    } else {
      setItemReviews([]);
    }
  }, [detailItem?.id]);

  useEffect(() => {
    if (showOwnerProfile && detailItem?.user_id) {
      fetchUserReviews(detailItem.user_id).then(({ data }) => setOwnerReviews(data ?? []));
    } else {
      setOwnerReviews([]);
    }
  }, [showOwnerProfile, detailItem?.user_id]);

  const handleDeleteRequest = async (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    await deleteRequest(id);
  };

  useEffect(() => {
    setSelectedProgram(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setBusySlots([]);
  }, [detailItem]);

  useEffect(() => {
    setSelectedSlot(null);
    if (!detailItem?.id || !selectedDate) { setBusySlots([]); return; }

    setSlotsLoading(true);
    fetchItemDayReservations(detailItem.id, selectedDate).then(({ data }) => {
      setBusySlots(data ?? []);
      setSlotsLoading(false);
    });
  }, [detailItem?.id, selectedDate, selectedProgram?.name]);

  useEffect(() => {
    if (detailItem?.price?.includes('/día') && selectedDate) {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const startHour = selectedDate === todayStr
        ? `${String(now.getHours()).padStart(2, '0')}:00`
        : '08:00';
      setSelectedSlot({ from: startHour, to: '23:59' });
    }
  }, [detailItem?.price, selectedDate]);

  useEffect(() => {
    import('react-native-maps')
      .then((mod) => setMapComponents(mod))
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNeighborItems(query).then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
    }, [query])
  );

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

  const filtered = withDist
    .filter((item) => category === 'all' || item.icon === category)
    .sort((a, b) => {
      if (a.distKm == null && b.distKm == null) return 0;
      if (a.distKm == null) return 1;
      if (b.distKm == null) return -1;
      return a.distKm - b.distKm;
    });
  const recommended = filtered.filter((i) => i.available !== false).slice(0, 5);
  const allMapItems = filtered.filter(
    (i) => i.owner?.lat != null && i.owner?.lng != null && i.available !== false
  );

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

  const doCreateReservation = async (skipPayment = false) => {
    if (!detailItem || !selectedDate || !selectedSlot) return;

    setShowPayment(false);
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

      // If item has a price, open Mercado Pago checkout first (unless skipped)
      const rawPrice = parseFloat(String(detailItem.price ?? '0').replace(/[^\d.]/g, ''));
      if (rawPrice > 0 && !skipPayment) {
        const mp = await createMPPreference({
          itemId: detailItem.id,
          itemName: detailItem.name,
          price: rawPrice,
          borrowerId: detailItem.user_id,
        });
        if (mp?.url) {
          const result = await WebBrowser.openBrowserAsync(mp.url);
          if (result.type === 'cancel') {
            setReservingId(null);
            return;
          }
        } else {
          setReservingId(null);
          Alert.alert('Error MP', JSON.stringify(mp));
          return;
        }
      }

      const ownerId = detailItem.owner?.id ?? detailItem.user_id;
      const { data: conv } = await fetchOrCreateConversation(detailItem.id, ownerId);
      if (!conv) { setReservingId(null); return; }

      await createReservation({
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

      {/* View mode toggle */}
      <View style={s.viewToggle}>
        {([
          { key: 'items',   icon: 'grid',    label: 'Disponibles', color: '#8B5CF6' },
          { key: 'pedir',   icon: 'inbox',   label: 'Pedir',       color: '#3B82F6' },
          { key: 'ofrecer', icon: 'gift',    label: 'Ofrecer',     color: '#10B981' },
        ] as { key: 'items' | 'pedir' | 'ofrecer'; icon: any; label: string; color: string }[]).map((tab) => {
          const active = viewMode === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.toggleBtn, active && { borderColor: tab.color }]}
              onPress={() => setViewMode(tab.key)}
              activeOpacity={0.8}
            >
              {active ? (
                <LinearGradient
                  colors={[`${tab.color}30`, `${tab.color}10`]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              ) : null}
              <View style={[s.toggleIconWrap, active && { backgroundColor: `${tab.color}25` }]}>
                <Feather name={tab.icon} size={20} color={active ? tab.color : BODY} />
              </View>
              <Text style={[s.toggleText, active && { color: '#FFFFFF', fontFamily: 'Inter_700Bold' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {viewMode === 'items' && (
        <>
      {/* Category chips */}
      <View
        ref={catWrapRef}
        style={s.catWrap}
        onLayout={() => {
          catWrapRef.current?.measureInWindow((_, y, __, h) => {
            onCatBarLayout?.(y, y + h);
          });
        }}
      >
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
                    <View style={s.markerDot}>
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
                          colors={['#7C3AED', '#3B82F6']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={s.recBtnInner}
                        >
                          <Text style={s.recBtnText}>Ver detalle</Text>
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
                        {item.owner?.avatar_url ? (
                          <Image source={{ uri: item.owner.avatar_url }} style={s.ownerAvatarImg} />
                        ) : (
                          <View style={s.ownerAvatar}>
                            <Text style={s.ownerInitial}>{ownerInitial(item)}</Text>
                          </View>
                        )}
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
        </>
      )}

      {(viewMode === 'pedir' || viewMode === 'ofrecer') && (
        <View style={{ flex: 1 }}>
          {viewMode === 'pedir' && (
            <TouchableOpacity
              style={s.newReqBtnWrap}
              onPress={() => router.push('/new-request')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#7C3AED', '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.newReqBtn}
              >
                <Feather name="plus" size={18} color="#FFF" />
                <Text style={s.newReqBtnText}>Pedir algo</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {requestsLoading ? (
            <ActivityIndicator color={PURPLE} style={{ marginTop: 32 }} />
          ) : (() => {
            const filtered = requests.filter((r) => viewMode === 'pedir' ? r.isOwn : !r.isOwn);
            const emptyText = viewMode === 'pedir'
              ? 'Todavía no publicaste\nningún pedido'
              : 'Ningún vecino publicó\nun pedido por ahora';
            return (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.reqList}>
                {filtered.length === 0 ? (
                  <View style={s.empty}>
                    <Feather name="inbox" size={32} color={BODY} />
                    <Text style={s.emptyText}>{emptyText}</Text>
                  </View>
                ) : (
                  filtered.map((req) => {
                    const name = req.isOwn
                      ? 'Vos'
                      : `${req.requester?.nombre ?? ''} ${req.requester?.apellido ?? ''}`.trim() || 'Vecino';
                    const initial = req.isOwn ? 'V' : (req.requester?.nombre?.[0]?.toUpperCase() ?? 'V');
                    const { cat, text: reqText } = parseRequestDesc(req.description);
                    const onPress = !req.isOwn
                      ? () => router.push({ pathname: '/respond-request', params: { requestId: req.id, requesterId: req.user_id, description: req.description } })
                      : undefined;
                    const reqOffers = req.isOwn ? (offersMap[req.id] ?? []) : [];
                    return (
                      <View key={req.id}>
                      <TouchableOpacity style={s.reqCard} onPress={onPress} activeOpacity={onPress ? 0.75 : 1} disabled={!onPress}>
                        <View style={s.reqAvatar}>
                          <Text style={s.reqAvatarText}>{initial}</Text>
                        </View>
                        <View style={{ flex: 1, gap: 6 }}>
                          {cat && (
                            <View style={[s.reqCatChip, { backgroundColor: `${cat.color}18`, borderColor: `${cat.color}40` }]}>
                              <Feather name={cat.icon as any} size={11} color={cat.color} />
                              <Text style={[s.reqCatChipText, { color: cat.color }]}>{cat.label}</Text>
                            </View>
                          )}
                          <Text style={s.reqDescription}>{reqText}</Text>
                          <View style={s.reqMetaRow}>
                            <Text style={s.reqName}>{name}</Text>
                            <Text style={s.reqDot}>·</Text>
                            <Text style={s.reqTime}>{reqRelativeTime(req.created_at)}</Text>
                            {reqOffers.length > 0 && (
                              <View style={s.offerBadge}>
                                <Text style={s.offerBadgeText}>{reqOffers.length} oferta{reqOffers.length > 1 ? 's' : ''}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        {req.isOwn && (
                          <TouchableOpacity
                            onPress={() => handleDeleteRequest(req.id)}
                            hitSlop={12}
                            activeOpacity={0.7}
                          >
                            <Feather name="trash-2" size={16} color={BODY} />
                          </TouchableOpacity>
                        )}
                        {!req.isOwn && (
                          <Feather name="chevron-right" size={16} color={BODY} />
                        )}
                      </TouchableOpacity>

                      {reqOffers.map((offer) => {
                        const offerer = offer.offerer;
                        const offererName = `${offerer?.nombre ?? ''} ${offerer?.apellido ?? ''}`.trim() || 'Vecino';
                        const offererInitial = offerer?.nombre?.[0]?.toUpperCase() ?? 'V';
                        const msgs = (offer.messages ?? []).sort((a: any, b: any) => a.created_at > b.created_at ? 1 : -1);
                        const textMsg = msgs.find((m: any) => m.type === 'text' || !m.type)?.content;
                        const imgUrl = msgs.find((m: any) => m.type === 'image')?.content;
                        const dist = userCoords && offerer?.lat && offerer?.lng
                          ? haversineKm(userCoords.latitude, userCoords.longitude, offerer.lat, offerer.lng)
                          : null;
                        return (
                          <View key={offer.id} style={s.offerCard}>
                            <View style={s.offerHeader}>
                              <View style={s.offerAvatar}>
                                {offerer?.avatar_url ? (
                                  <Image source={{ uri: offerer.avatar_url }} style={s.offerAvatarImg} />
                                ) : (
                                  <Text style={s.offerAvatarText}>{offererInitial}</Text>
                                )}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={s.offerName}>{offererName} puede ayudarte</Text>
                                {dist !== null && (
                                  <Text style={s.offerDist}>
                                    <Feather name="map-pin" size={11} color={BODY} /> {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                                  </Text>
                                )}
                              </View>
                            </View>
                            {textMsg ? <Text style={s.offerText} numberOfLines={3}>{textMsg}</Text> : null}
                            {imgUrl ? <Image source={{ uri: imgUrl }} style={s.offerImg} resizeMode="cover" /> : null}
                            <View style={s.offerActions}>
                              <TouchableOpacity style={s.offerDeclineBtn} onPress={() => handleDeclineOffer(offer.id, req.id)} activeOpacity={0.8}>
                                <Text style={s.offerDeclineText}>Rechazar</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={s.offerAcceptWrap} onPress={() => handleAcceptOffer(offer.id, req.id)} activeOpacity={0.85}>
                                <LinearGradient colors={['#7C3AED', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.offerAcceptBtn}>
                                  <Text style={s.offerAcceptText}>Aceptar</Text>
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                      </View>
                    );
                  })
                )}
                <View style={{ height: 24 }} />
              </ScrollView>
            );
          })()}
        </View>
      )}

      {/* ── Item detail modal (full screen) ── */}
      <Modal
        visible={!!detailItem}
        animationType="slide"
        onRequestClose={() => { setDetailItem(null); setShowPayment(false); setShowOwnerProfile(false); }}
      >
        <View style={dm.container}>

          {/* Payment panel — absolute overlay */}
          {showPayment && (
            <View style={[StyleSheet.absoluteFill, pay.panel]}>
              <View style={[pay.sheet, { paddingBottom: insets.bottom + 20 }]}>
                <View style={pay.handle} />
                <View style={pay.header}>
                  <TouchableOpacity onPress={() => setShowPayment(false)} hitSlop={12} style={{ padding: 4 }}>
                    <Feather name="arrow-left" size={20} color={GRAY} />
                  </TouchableOpacity>
                  <Text style={pay.title}>Confirmá tu reserva</Text>
                  <View style={{ width: 28 }} />
                </View>

                <View style={pay.summaryCard}>
                  <View style={pay.summaryIconWrap}>
                    <Feather name={detailItem?.icon as any ?? 'box'} size={22} color="#C4B5FD" />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={pay.summaryName}>{detailItem?.name}</Text>
                    {detailItem?.note && (
                      <Text style={pay.summaryNote}>{detailItem.note}</Text>
                    )}
                    {selectedProgram && (
                      <Text style={pay.summaryProgram}>{selectedProgram.name}</Text>
                    )}
                  </View>
                  <View style={pay.pricePill}>
                    <Text style={pay.priceText}>{detailItem?.price ?? 'Gratis'}</Text>
                  </View>
                </View>

                {selectedDate && selectedSlot && (() => {
                  const isDaily = detailItem?.price?.includes('/día');
                  if (isDaily) {
                    const startLabel = formatDateLabel(selectedDate);
                    const endDate = new Date(selectedDate + 'T12:00:00');
                    endDate.setDate(endDate.getDate() + 1);
                    const endLabel = formatDateLabel(endDate.toISOString().split('T')[0]);
                    return (
                      <Text style={pay.dateRangeText}>
                        {`desde ${startLabel} ${selectedSlot.from} hasta ${endLabel} ${selectedSlot.from}`}
                      </Text>
                    );
                  }
                  return (
                    <Text style={pay.dateRangeText}>
                      {`${formatDateLabel(selectedDate)} · ${selectedSlot.from} – ${selectedSlot.to}`}
                    </Text>
                  );
                })()}

                <View style={pay.reminderBanner}>
                  <Feather name="message-circle" size={16} color="#7C3AED" />
                  <Text style={pay.reminderText}>
                    {`¡Recordá acordar con ${detailItem?.owner?.nombre ?? 'el dueño'} el punto y horario de entrega por chat!`}
                  </Text>
                </View>

                <Text style={pay.sectionLabel}>MÉTODO DE PAGO</Text>
                <View style={pay.methodCard}>
                  <View style={pay.mpLogo}>
                    <Text style={pay.mpLogoText}>MP</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={pay.methodName}>Mercado Pago</Text>
                    <Text style={pay.methodSub}>Pago seguro en 1 tap</Text>
                  </View>
                  <View style={pay.selectedDot}>
                    <View style={pay.selectedDotInner} />
                  </View>
                </View>

                <TouchableOpacity
                  style={pay.confirmWrapper}
                  activeOpacity={0.85}
                  onPress={() => doCreateReservation(false)}
                  disabled={!!reservingId}
                >
                  <LinearGradient
                    colors={['#009EE3', '#00B4D8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={pay.confirmBtn}
                  >
                    {reservingId ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Text style={pay.confirmText}>Confirmar reserva</Text>
                        <Feather name="arrow-right" size={18} color="#FFF" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => doCreateReservation(true)}
                  disabled={!!reservingId}
                  activeOpacity={0.6}
                  style={pay.payLaterBtn}
                >
                  <Text style={pay.payLaterText}>Pagar después</Text>
                </TouchableOpacity>

                <Text style={pay.disclaimer}>
                  Al confirmar aceptás los términos de uso de Orbit y Mercado Pago.
                </Text>
              </View>
            </View>
          )}

          {/* Owner profile panel — absolute overlay */}
          {showOwnerProfile && (
            <View style={[StyleSheet.absoluteFill, op.panel]}>
              <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowOwnerProfile(false)} activeOpacity={1} />
              <View style={[op.sheet, { paddingBottom: insets.bottom + 24 }]}>
                <View style={op.handle} />
                <View style={op.header}>
                  <TouchableOpacity onPress={() => setShowOwnerProfile(false)} hitSlop={12} style={{ padding: 4 }}>
                    <Feather name="arrow-left" size={20} color={GRAY} />
                  </TouchableOpacity>
                  <Text style={op.title}>Perfil del vecino</Text>
                  <View style={{ width: 28 }} />
                </View>

                <View style={op.avatarSection}>
                  {detailItem?.owner?.avatar_url ? (
                    <Image source={{ uri: detailItem.owner.avatar_url }} style={op.avatarLargeImg} />
                  ) : (
                    <View style={op.avatarLarge}>
                      <Text style={op.avatarLargeText}>{detailItem?.owner?.nombre?.[0]?.toUpperCase() ?? 'V'}</Text>
                    </View>
                  )}
                  <Text style={op.ownerNameLarge}>{ownerName(detailItem ?? {})}</Text>
                  <View style={op.starsRow}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Feather key={i} name="star" size={14} color={i <= 4 ? '#FCD34D' : 'rgba(255,255,255,0.12)'} />
                    ))}
                    <Text style={op.ratingText}>4.8 · 12 préstamos</Text>
                  </View>
                </View>

                <View style={op.statsRow}>
                  <View style={op.statCard}>
                    <Feather name="package" size={18} color={PURPLE} />
                    <Text style={op.statValue}>5</Text>
                    <Text style={op.statLabel}>Ítems</Text>
                  </View>
                  <View style={op.statCard}>
                    <Feather name="repeat" size={18} color="#10B981" />
                    <Text style={op.statValue}>12</Text>
                    <Text style={op.statLabel}>Préstamos</Text>
                  </View>
                  <View style={op.statCard}>
                    <Feather name="clock" size={18} color="#F59E0B" />
                    <Text style={op.statValue}>~1 h</Text>
                    <Text style={op.statLabel}>Respuesta</Text>
                  </View>
                </View>

                <Text style={op.reviewsLabel}>OPINIONES DEL VECINO</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {ownerReviews.length === 0 ? (
                    <Text style={{ fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13, paddingVertical: 8 }}>
                      Todavía no hay opiniones
                    </Text>
                  ) : ownerReviews.map((r) => {
                    const firstName = r.reviewer?.nombre ?? '?';
                    const lastInitial = r.reviewer?.apellido?.[0] ?? '';
                    const displayName = `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`;
                    return (
                      <View key={r.id} style={op.reviewCard}>
                        <View style={op.reviewTop}>
                          <View style={op.reviewAvatar}>
                            <Text style={op.reviewAvatarText}>{firstName[0]?.toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={op.reviewName}>{displayName}</Text>
                            <View style={{ flexDirection: 'row', gap: 2 }}>
                              {[1, 2, 3, 4, 5].map((i) => (
                                <Feather key={i} name="star" size={10} color={i <= r.rating ? '#FCD34D' : 'rgba(255,255,255,0.12)'} />
                              ))}
                            </View>
                          </View>
                          <Text style={op.reviewDate}>{reqRelativeTime(r.created_at)}</Text>
                        </View>
                        {r.comment ? <Text style={op.reviewComment}>{r.comment}</Text> : null}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          >
            {/* Hero */}
            {detailItem?.image_url ? (
              <TouchableOpacity activeOpacity={0.92} onPress={() => setDetailImageFullscreen(true)}>
                <Image source={{ uri: detailItem.image_url }} style={dm.heroImage} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <LinearGradient colors={['#1C1040', '#0D0E22']} style={dm.hero}>
                <View style={dm.heroGlow} />
                <View style={dm.heroIconWrap}>
                  <Feather name={detailItem?.icon as any} size={56} color="#C4B5FD" />
                </View>
              </LinearGradient>
            )}

            {/* Content card */}
            <View style={dm.contentCard}>
            <View style={dm.scrollContent}>

            {/* Name + price + badges */}
            <View style={dm.namePriceBlock}>
              <Text style={dm.itemNameLarge}>{detailItem?.name}</Text>
              <View style={dm.headerMeta}>
                {detailItem?.price ? (
                  <Text style={dm.priceSubtext}>{detailItem?.price}</Text>
                ) : null}
                {detailItem?.price && detailItem?.note ? (
                  <Text style={dm.metaDot}>·</Text>
                ) : null}
                {detailItem?.note ? (
                  <Text style={dm.noteSubtext}>{detailItem.note}</Text>
                ) : null}
              </View>
            </View>

            {/* Owner row — tappable to see profile */}
            <TouchableOpacity style={dm.ownerRow} onPress={() => setShowOwnerProfile(true)} activeOpacity={0.75}>
              {detailItem?.owner?.avatar_url ? (
                <Image source={{ uri: detailItem.owner.avatar_url }} style={dm.ownerAvatarImg} />
              ) : (
                <View style={dm.ownerAvatar}>
                  <Text style={dm.ownerInitial}>{detailItem?.owner?.nombre?.[0]?.toUpperCase() ?? 'V'}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={dm.ownerName}>{ownerName(detailItem ?? {})}</Text>
                {detailItem?.distKm != null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <Feather name="map-pin" size={10} color={PURPLE} />
                    <Text style={dm.distText}>{formatDist(detailItem.distKm)}</Text>
                  </View>
                ) : detailItem?.location ? (
                  <Text style={dm.locationText} numberOfLines={1}>{detailItem.location}</Text>
                ) : null}
              </View>
              <View style={dm.ownerStatsPreview}>
                <Feather name="star" size={12} color="#FCD34D" />
                <Text style={dm.ownerRating}>4.8</Text>
                <Feather name="chevron-right" size={14} color="rgba(196,181,253,0.4)" />
              </View>
            </TouchableOpacity>

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

            {/* Características */}
            {detailItem?.note && detailItem?.icon !== 'refresh-cw' ? (
              <>
                <Text style={dm.sectionLabel}>CARACTERÍSTICAS</Text>
                <View style={dm.noteWrap}>
                  <Feather name="info" size={14} color={BODY} style={{ marginTop: 1 }} />
                  <Text style={dm.noteText}>{detailItem.note}</Text>
                </View>
              </>
            ) : null}

            {/* Reseñas — siempre visibles */}
            <Text style={dm.sectionLabel}>RESEÑAS</Text>
            <View style={dm.reviewsList}>
              {itemReviews.length === 0 ? (
                <Text style={{ fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13, paddingVertical: 8 }}>
                  Todavía no hay reseñas
                </Text>
              ) : itemReviews.map((r, i) => {
                const firstName = r.reviewer?.nombre ?? '?';
                const lastInitial = r.reviewer?.apellido?.[0] ?? '';
                const displayName = `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`;
                return (
                  <View key={r.id} style={[dm.reviewCard, i > 0 && dm.reviewCardBorder]}>
                    <View style={dm.reviewTop}>
                      <View style={dm.reviewAvatar}>
                        <Text style={dm.reviewAvatarText}>{firstName[0]?.toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={dm.reviewName}>{displayName}</Text>
                        <Text style={dm.reviewWhen}>{reqRelativeTime(r.created_at)}</Text>
                      </View>
                      <View style={dm.starsRow}>
                        {Array.from({ length: 5 }, (_, si) => (
                          <Feather key={si} name="star" size={11} color={si < r.rating ? '#FCD34D' : 'rgba(255,255,255,0.15)'} />
                        ))}
                      </View>
                    </View>
                    {r.comment ? <Text style={dm.reviewComment}>{r.comment}</Text> : null}
                  </View>
                );
              })}
            </View>

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
                    {getNextDays(3).map((day) => {
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
                    <TouchableOpacity
                      style={dm.dateChipMore}
                      activeOpacity={0.75}
                      onPress={() => Alert.alert('Más fechas', 'Por ahora solo podés reservar hasta 2 días a futuro.')}
                    >
                      <Feather name="calendar" size={13} color={BODY} />
                      <Text style={dm.dateChipMoreText}>Más fechas</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              );
            })()}

            {/* Time slots — visible once a date is chosen */}
            {detailItem?.available !== false && (() => {
              const hasPrograms = (detailItem?.programs ?? []).length > 0;
              if (hasPrograms && !selectedProgram) return null;
              if (!selectedDate) return null;
              const isDaily = detailItem?.price?.includes('/día');
              if (isDaily) {
                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];
                const startHour = selectedDate === todayStr
                  ? `${String(now.getHours()).padStart(2, '0')}:00`
                  : '08:00';
                const endDate = new Date(selectedDate + 'T12:00:00');
                endDate.setDate(endDate.getDate() + 1);
                const endDateStr = endDate.toISOString().split('T')[0];
                const endLabel = formatDateLabel(endDateStr);
                const busy = isSlotBusy({ from: startHour, to: '23:59' }, busySlots);
                return (
                  <>
                    <Text style={dm.sectionLabel}>DURACIÓN</Text>
                    <View style={[dm.fullDayRow, busy && { backgroundColor: 'rgba(107,114,128,0.08)', borderColor: 'rgba(107,114,128,0.2)' }]}>
                      <Feather name="clock" size={15} color={busy ? BODY : GREEN} />
                      <Text style={[dm.fullDayText, busy && { color: BODY }]}>
                        {busy
                          ? 'No disponible este día'
                          : `${startHour} → ${endLabel} ${startHour}`}
                      </Text>
                      {!busy && <Feather name="check-circle" size={15} color={GREEN} />}
                    </View>
                  </>
                );
              }
              const durationMin = selectedProgram ? parseInt(String(selectedProgram.duration)) : 60;
              const slots = generateHourlySlots(durationMin);
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

            </View>{/* /scrollContent */}
            </View>{/* /contentCard */}
          </ScrollView>

          {/* Fixed bottom reserve button */}
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
              : 'Confirmar';
            return (
              <View style={[dm.reserveBar, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity
                  style={dm.reserveWrapper}
                  activeOpacity={ready ? 0.85 : 1}
                  onPress={() => { if (ready) setShowPayment(true); }}
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
              </View>
            );
          })()}

          {/* Fullscreen image modal */}
          {detailItem?.image_url ? (
            <Modal visible={detailImageFullscreen} transparent animationType="fade" onRequestClose={() => setDetailImageFullscreen(false)}>
              <TouchableOpacity style={dm.fullscreenOverlay} activeOpacity={1} onPress={() => setDetailImageFullscreen(false)}>
                <Image source={{ uri: detailItem.image_url }} style={dm.fullscreenImage} resizeMode="contain" />
                <View style={[dm.fullscreenBottom, { paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none">
                  <TouchableOpacity style={dm.fullscreenCloseBtn} onPress={() => setDetailImageFullscreen(false)} activeOpacity={0.8}>
                    <Feather name="x" size={20} color="#FFFFFF" />
                    <Text style={dm.fullscreenCloseText}>Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          ) : null}

          {/* Overlay back button */}
          <View style={[dm.heroOverlaySafe, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <View style={dm.heroOverlayRow} pointerEvents="box-none">
              <TouchableOpacity
                onPress={() => { setDetailItem(null); setShowPayment(false); setShowOwnerProfile(false); setDetailImageFullscreen(false); }}
                style={dm.overlayBtn}
              >
                <Feather name="arrow-left" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
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
                  <View style={[s.markerDot, selectedItem?.id === item.id && s.markerDotSelected]}>
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

              <View style={m.itemRow}>
                <View style={m.itemIcon}>
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
  ownerAvatarImg: { width: 18, height: 18, borderRadius: 9 },
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

  chevronWrap: { justifyContent: 'center', paddingLeft: 4 },

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

  viewToggle: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: CARD_BG,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  toggleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  toggleText: { fontFamily: 'Inter_600SemiBold', color: BODY, fontSize: 13 },

  newReqBtnWrap: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  newReqBtn: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  newReqBtnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 15 },

  reqList: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  reqCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
    marginBottom: 10,
  },
  reqAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139,92,246,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reqAvatarText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 16 },
  reqDescription: {
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  reqCatChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  reqCatChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  reqMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  reqName: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  reqDot: { color: BODY, fontSize: 12 },
  reqTime: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  myReqPill: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  myReqPillText: { fontFamily: 'Inter_600SemiBold', color: '#C4B5FD', fontSize: 10 },

  newReqSheet: {
    backgroundColor: '#0F1128',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  newReqHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  newReqTitle: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 20,
    marginBottom: 6,
  },
  newReqSub: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 14,
    marginBottom: 20,
  },
  newReqInput: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  newReqCount: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 20,
  },
  newReqSubmitWrap: { borderRadius: 16, overflow: 'hidden' },
  newReqSubmitBtn: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  newReqSubmitText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 },

  offerBadge: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  offerBadgeText: { fontFamily: 'Inter_600SemiBold', color: '#C4B5FD', fontSize: 11 },

  offerCard: {
    backgroundColor: '#0F1022',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  offerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  offerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139,92,246,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  offerAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  offerAvatarText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 14 },
  offerName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 13 },
  offerDist: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, marginTop: 1 },
  offerText: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13, lineHeight: 19 },
  offerImg: { width: '100%', height: 160, borderRadius: 10 },
  offerActions: { flexDirection: 'row', gap: 10 },
  offerDeclineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  offerDeclineText: { fontFamily: 'Inter_600SemiBold', color: GRAY, fontSize: 14 },
  offerAcceptWrap: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  offerAcceptBtn: { paddingVertical: 10, alignItems: 'center' },
  offerAcceptText: { fontFamily: 'Inter_600SemiBold', color: '#FFF', fontSize: 14 },
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
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  itemIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
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

  reserveWrapper: { borderRadius: 16, overflow: 'hidden' },
  reserveBtn: {
    height: 52, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  reserveBtnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 15 },
});

// ─── Detail modal styles ──────────────────────────────────────────────────────

const dm = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  hero: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 300,
  },
  heroGlow: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  heroIconWrap: {
    width: 120, height: 120, borderRadius: 34,
    backgroundColor: 'rgba(139,92,246,0.14)',
    borderWidth: 1, borderColor: 'rgba(196,181,253,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  contentCard: {
    backgroundColor: BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  heroOverlaySafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  heroOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  overlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fullscreenCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fullscreenCloseText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    fontSize: 15,
  },

  namePriceBlock: { marginBottom: 14, alignItems: 'center' },
  itemNameLarge: {
    fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 22,
    lineHeight: 28, marginBottom: 6, textAlign: 'center',
  },
  headerMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6 },
  priceSubtext: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 14 },
  metaDot: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
  noteSubtext: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13 },
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 20,
  },
  ownerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  ownerAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  ownerInitial: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 15 },
  ownerName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14 },
  ownerStatsPreview: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownerRating: { fontFamily: 'Inter_600SemiBold', color: '#FCD34D', fontSize: 13 },
  distText: { fontFamily: 'Inter_600SemiBold', color: '#8B5CF6', fontSize: 11 },
  locationText: { fontFamily: 'Inter_400Regular', color: '#6B7280', fontSize: 12 },

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
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 12,
    marginBottom: 16,
  },
  noteText: { flex: 1, fontFamily: 'Inter_400Regular', color: '#9CA3AF', fontSize: 13, lineHeight: 20 },

  reserveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  reserveWrapper: { borderRadius: 16, overflow: 'hidden' },
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
  dateChipMore: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderStyle: 'dashed',
  },
  dateChipMoreText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, justifyContent: 'center' },
  fullDayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    borderRadius: 14, padding: 14, marginBottom: 16,
  },
  fullDayText: { fontFamily: 'Inter_600SemiBold', color: GREEN, fontSize: 14, flex: 1 },
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

// ─── Payment modal styles ─────────────────────────────────────────────────────

const pay = StyleSheet.create({
  panel: {
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  sheet: {
    backgroundColor: '#0F1128',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 18 },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#13142A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    padding: 16,
    marginBottom: 24,
  },
  summaryIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  summaryName: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 15 },
  summaryNote: { fontFamily: 'Inter_400Regular', color: '#6B7280', fontSize: 12 },
  summaryMeta: { fontFamily: 'Inter_400Regular', color: '#9CA3AF', fontSize: 13 },
  summaryProgram: {
    fontFamily: 'Inter_500Medium', color: '#C4B5FD', fontSize: 12,
    backgroundColor: 'rgba(139,92,246,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    marginTop: 2,
  },
  pricePill: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
  },
  priceText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 14 },

  sectionLabel: {
    fontFamily: 'Inter_700Bold', color: '#6B7280',
    fontSize: 11, letterSpacing: 1.2, marginBottom: 10,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#13142A',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#009EE3',
    padding: 16,
    marginBottom: 24,
  },
  mpLogo: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#009EE3',
    alignItems: 'center', justifyContent: 'center',
  },
  mpLogoText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 17, letterSpacing: 0.5 },
  methodName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15 },
  methodSub: { fontFamily: 'Inter_400Regular', color: '#6B7280', fontSize: 12, marginTop: 2 },
  selectedDot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#009EE3',
    alignItems: 'center', justifyContent: 'center',
  },
  selectedDotInner: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#009EE3',
  },

  confirmWrapper: { borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  confirmBtn: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  confirmText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16 },

  disclaimer: {
    fontFamily: 'Inter_400Regular',
    color: '#4B5563',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  payLaterBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  payLaterText: {
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  dateRangeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#E2E8F0',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2D2D4E',
    paddingVertical: 14,
    marginBottom: 14,
  },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#1E1040',
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  reminderText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#C4B5FD',
    lineHeight: 18,
  },
});

// ─── Owner profile styles ─────────────────────────────────────────────────────

const op = StyleSheet.create({
  panel: {
    justifyContent: 'flex-end',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#0F1128',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 18 },

  avatarSection: { alignItems: 'center', marginBottom: 20, gap: 6 },
  avatarLarge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderWidth: 2, borderColor: 'rgba(196,181,253,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  avatarLargeText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 28 },
  avatarLargeImg: { width: 72, height: 72, borderRadius: 36, marginBottom: 4 },
  ownerNameLarge: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 18 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontFamily: 'Inter_500Medium', color: '#9CA3AF', fontSize: 13, marginLeft: 4 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: '#13142A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.12)',
  },
  statValue: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 15 },
  statLabel: { fontFamily: 'Inter_400Regular', color: '#6B7280', fontSize: 11, textAlign: 'center' },

  reviewsLabel: {
    fontFamily: 'Inter_700Bold', color: '#6B7280',
    fontSize: 11, letterSpacing: 1.2, marginBottom: 8,
  },
  reviewCard: {
    paddingVertical: 12, gap: 6,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 11 },
  reviewName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 13 },
  reviewDate: { fontFamily: 'Inter_400Regular', color: '#6B7280', fontSize: 11 },
  reviewComment: {
    fontFamily: 'Inter_400Regular', color: '#9CA3AF',
    fontSize: 13, lineHeight: 18, marginLeft: 38,
  },
});
