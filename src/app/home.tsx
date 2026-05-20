import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

const MOCK_ITEMS = [
  { id: 1, name: 'Lavarropas Samsung 10kg', location: 'Piso 6 · Depto 6A', price: '$800/h', icon: 'refresh-cw', reservations: 3 },
  { id: 2, name: 'Impresora HP LaserJet', location: 'Piso 6 · Depto 6A', price: '$250/doc', icon: 'printer', reservations: 0 },
];

export default function HomeScreen() {
  const [userName, setUserName] = useState('');
  const [atHome, setAtHome] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.full_name?.split(' ')[0]
        ?? data.user?.email?.split('@')[0]
        ?? 'Vos';
      setUserName(name);
    });
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 13) return 'Buen día';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>orbit</Text>
          <TouchableOpacity style={styles.notifBtn}>
            <Feather name="bell" size={20} color={GRAY} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Greeting */}
          <View style={styles.greetingSection}>
            <Text style={styles.greetingSub}>{greeting()},</Text>
            <View style={styles.greetingNameRow}>
              <Text style={styles.greetingName}>{userName}</Text>
              <Feather name="smile" size={26} color="#C4B5FD" />
            </View>
          </View>

          {/* Status card */}
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Estado actual</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusDot, { backgroundColor: atHome ? '#10B981' : BODY }]} />
                <Text style={styles.statusText}>{atHome ? 'Estoy en casa' : 'No estoy en casa'}</Text>
              </View>
              <Switch
                value={atHome}
                onValueChange={setAtHome}
                trackColor={{ false: '#1E2040', true: PURPLE }}
                thumbColor="#FFFFFF"
              />
            </View>
            <Text style={styles.statusSub}>
              {atHome ? 'Tus ítems están disponibles' : 'Tus ítems están en pausa'}
            </Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>$4.800</Text>
              <Text style={styles.statLabel}>Este mes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>7</Text>
              <Text style={styles.statLabel}>Reservas</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statRatingRow}>
                <Text style={styles.statValue}>4.9</Text>
                <Feather name="star" size={14} color={PURPLE} style={{ marginTop: 2 }} />
              </View>
              <Text style={styles.statLabel}>Reputación</Text>
            </View>
          </View>

          {/* Items section */}
          <Text style={styles.sectionTitle}>MIS ÍTEMS</Text>

          <TouchableOpacity style={styles.addBtn} activeOpacity={0.7}>
            <Feather name="plus" size={18} color={PURPLE} />
            <Text style={styles.addBtnText}>Agregar otro producto</Text>
          </TouchableOpacity>

          {MOCK_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemCard}
              activeOpacity={0.75}
            >
              <View style={[styles.itemCardInner, !atHome && styles.itemCardPaused]}>
                <View style={[styles.itemIconWrap, !atHome && styles.itemIconWrapPaused]}>
                  <Feather name={item.icon as any} size={22} color={atHome ? '#C4B5FD' : BODY} />
                </View>
                <View style={styles.itemInfo}>
                  <View style={styles.itemTopRow}>
                    <Text style={[styles.itemName, !atHome && styles.textPaused]}>{item.name}</Text>
                    <View style={[styles.priceBadge, !atHome && styles.priceBadgePaused]}>
                      <Text style={[styles.priceText, !atHome && styles.textPaused]}>{item.price}</Text>
                    </View>
                  </View>
                  <Text style={styles.itemLocation}>{item.location}</Text>
                  <View style={styles.itemTags}>
                    {atHome ? (
                      <View style={styles.availableTag}>
                        <Text style={styles.availableText}>Disponible</Text>
                      </View>
                    ) : (
                      <View style={styles.pausedTag}>
                        <Text style={styles.pausedText}>En pausa</Text>
                      </View>
                    )}
                    {atHome && item.reservations > 0 && (
                      <View style={styles.reservTag}>
                        <Text style={styles.reservText}>{item.reservations} activas</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={BODY} />
              </View>
            </TouchableOpacity>
          ))}

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Bottom tab bar */}
      <SafeAreaView style={styles.tabBarSafe} edges={['bottom']}>
        <View style={styles.tabBar}>
          {[
            { icon: 'home', label: 'Inicio', active: true },
            { icon: 'search', label: 'Buscar', active: false },
            { icon: 'bell', label: 'Alertas', active: false },
            { icon: 'user', label: 'Perfil', active: false },
          ].map((tab) => (
            <TouchableOpacity key={tab.label} style={styles.tab} activeOpacity={0.7}>
              <Feather name={tab.icon as any} size={22} color={tab.active ? PURPLE : BODY} />
              <Text style={[styles.tabLabel, tab.active && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  logo: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: '#C4B5FD',
    letterSpacing: -0.5,
  },
  notifBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  greetingSection: { marginBottom: 20 },
  greetingSub: {
    fontFamily: 'Inter_400Regular',
    color: GRAY,
    fontSize: 15,
    marginBottom: 2,
  },
  greetingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  greetingName: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 30,
  },
  statusCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
    marginBottom: 12,
  },
  statusLabel: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 12,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    fontSize: 16,
  },
  statusSub: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.12)',
  },
  statRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statValue: {
    fontFamily: 'Inter_700Bold',
    color: '#C4B5FD',
    fontSize: 20,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 12,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    color: GRAY,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderStyle: 'dashed',
    marginBottom: 10,
  },
  addBtnText: {
    fontFamily: 'Inter_600SemiBold',
    color: PURPLE,
    fontSize: 15,
  },
  itemCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.12)',
    marginBottom: 10,
  },
  itemIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: { fontSize: 26 },
  itemInfo: { flex: 1 },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  itemName: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    fontSize: 15,
    flex: 1,
  },
  priceBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priceText: {
    fontFamily: 'Inter_700Bold',
    color: '#C4B5FD',
    fontSize: 13,
  },
  itemLocation: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 13,
    marginBottom: 8,
  },
  itemTags: { flexDirection: 'row', gap: 6 },
  itemCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemCardPaused: {
    opacity: 0.5,
  },
  itemIconWrapPaused: {
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
  },
  priceBadgePaused: {
    backgroundColor: 'rgba(107, 114, 128, 0.15)',
  },
  textPaused: {
    color: BODY,
  },
  pausedTag: {
    backgroundColor: 'rgba(107, 114, 128, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pausedText: {
    fontFamily: 'Inter_600SemiBold',
    color: BODY,
    fontSize: 12,
  },
  availableTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  availableText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#10B981',
    fontSize: 12,
  },
  reservTag: {
    backgroundColor: CARD_BG,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  reservText: {
    fontFamily: 'Inter_400Regular',
    color: GRAY,
    fontSize: 12,
  },
  chevron: { marginLeft: 'auto' },
  tabBarSafe: { backgroundColor: CARD_BG },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 10,
    paddingBottom: 4,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabLabel: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 11,
  },
  tabLabelActive: {
    fontFamily: 'Inter_600SemiBold',
    color: PURPLE,
  },
});
