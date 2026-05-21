import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchItemById } from '../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
const MONTH_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function buildDays(count = 14): Date[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

type DeliveryMethod = 'porteria' | 'espacio_comun' | 'envio' | 'retiro';
const DELIVERY_OPTIONS: { key: DeliveryMethod; icon: string; label: string }[] = [
  { key: 'porteria',      icon: 'inbox',   label: 'Portería' },
  { key: 'espacio_comun', icon: 'users',   label: 'Espacio común' },
  { key: 'envio',         icon: 'truck',   label: 'Envío (Rappi / Uber)' },
  { key: 'retiro',        icon: 'package', label: 'Retiro en persona' },
];

// ─── TimeBlock ────────────────────────────────────────────────────────────────

function TimeBlock({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hh, mm] = value.split(':');
  const setHH = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 2);
    const num = Math.min(23, parseInt(clean || '0', 10));
    onChange(`${String(num).padStart(2, '0')}:${mm}`);
  };
  const setMM = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 2);
    const num = Math.min(59, parseInt(clean || '0', 10));
    onChange(`${hh}:${String(num).padStart(2, '0')}`);
  };
  return (
    <View style={styles.timeBlock}>
      <TextInput style={styles.timeInput} value={hh} onChangeText={setHH}
        keyboardType="numeric" maxLength={2} selectTextOnFocus />
      <Text style={styles.timeColon}>:</Text>
      <TextInput style={styles.timeInput} value={mm} onChangeText={setMM}
        keyboardType="numeric" maxLength={2} selectTextOnFocus />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReserveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const days = buildDays(14);
  const [selectedDay, setSelectedDay] = useState(0);
  const [fromTime, setFromTime] = useState('10:00');
  const [toTime, setToTime] = useState('12:00');
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryMethod | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchItemById(id).then(({ data }) => {
      setItem(data);
      setLoading(false);
    });
  }, [id]);

  const isLavarropas = item?.icon === 'refresh-cw';
  const programs: { name: string; duration: string }[] = item?.programs ?? [];

  const canConfirm = delivery !== null && (!isLavarropas || selectedProgram !== null);

  const handleConfirm = async () => {
    setSaving(true);
    // TODO: persist reservation to supabase
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    router.back();
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
        <Text style={{ color: GRAY }}>Ítem no encontrado</Text>
      </View>
    );
  }

  const chosenDay = days[selectedDay];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={GRAY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reservar</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* Item summary */}
          <View style={styles.itemCard}>
            <View style={styles.itemIconWrap}>
              <Feather name={item.icon} size={24} color="#C4B5FD" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.price ? <Text style={styles.itemPrice}>{item.price}</Text> : null}
            </View>
          </View>

          {/* Date */}
          <Text style={styles.sectionLabel}>ELEGÍ EL DÍA</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysRow}
          >
            {days.map((d, i) => {
              const isToday = i === 0;
              const sel = selectedDay === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dayChip, sel && styles.dayChipSelected]}
                  onPress={() => setSelectedDay(i)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayChipLabel, sel && styles.dayChipLabelSelected]}>
                    {isToday ? 'Hoy' : DAY_SHORT[d.getDay()]}
                  </Text>
                  <Text style={[styles.dayChipNum, sel && styles.dayChipNumSelected]}>
                    {d.getDate()}
                  </Text>
                  <Text style={[styles.dayChipMonth, sel && styles.dayChipMonthSelected]}>
                    {MONTH_ES[d.getMonth()]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time */}
          <Text style={styles.sectionLabel}>HORARIO</Text>
          <View style={styles.timeCard}>
            <View style={styles.timeSection}>
              <Text style={styles.timeLabel}>Desde</Text>
              <TimeBlock value={fromTime} onChange={setFromTime} />
            </View>
            <Feather name="arrow-right" size={16} color={BODY} style={{ marginTop: 22 }} />
            <View style={styles.timeSection}>
              <Text style={styles.timeLabel}>Hasta</Text>
              <TimeBlock value={toTime} onChange={setToTime} />
            </View>
          </View>

          {/* Programs — solo lavarropas */}
          {isLavarropas && programs.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>PROGRAMA DE LAVADO</Text>
              <View style={styles.programsCard}>
                {programs.map((p, i) => {
                  const sel = selectedProgram === p.name;
                  return (
                    <TouchableOpacity
                      key={p.name}
                      style={[styles.programRow, i > 0 && styles.programRowBorder, sel && styles.programRowSelected]}
                      onPress={() => setSelectedProgram(p.name)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.programRadio, sel && styles.programRadioSelected]}>
                        {sel && <View style={styles.programRadioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.programName, sel && styles.programNameSelected]}>{p.name}</Text>
                        {p.duration ? (
                          <Text style={styles.programDuration}>{p.duration} min</Text>
                        ) : null}
                      </View>
                      {sel && <Feather name="check" size={16} color={PURPLE} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Delivery */}
          <Text style={styles.sectionLabel}>MÉTODO DE ENTREGA</Text>
          <View style={styles.deliveryGrid}>
            {DELIVERY_OPTIONS.map((opt) => {
              const sel = delivery === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.deliveryCard, sel && styles.deliveryCardSelected]}
                  onPress={() => setDelivery(opt.key)}
                  activeOpacity={0.75}
                >
                  <Feather name={opt.icon as any} size={20} color={sel ? '#C4B5FD' : BODY} />
                  <Text style={[styles.deliveryLabel, sel && styles.deliveryLabelSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Note */}
          <Text style={styles.sectionLabel}>NOTA PARA EL DUEÑO (opcional)</Text>
          <View style={styles.noteWrap}>
            <TextInput
              style={styles.noteInput}
              placeholder="Ej: tengo ropa delicada, prefiero horario de mañana…"
              placeholderTextColor={BODY}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <Feather name="info" size={14} color={BODY} />
            <Text style={styles.summaryText}>
              Reserva para el {chosenDay.getDate()} de {MONTH_ES[chosenDay.getMonth()]}
              {' '}de {fromTime} a {toTime}
              {selectedProgram ? ` · ${selectedProgram}` : ''}
            </Text>
          </View>

          {/* Confirm */}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!canConfirm || saving}
            style={[styles.confirmWrapper, !canConfirm && { opacity: 0.45 }]}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#7C3AED', '#3B82F6']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.confirmBtn}
            >
              {saving
                ? <ActivityIndicator color="#FFF" />
                : <>
                    <Feather name="check" size={18} color="#FFF" />
                    <Text style={styles.confirmBtnText}>Confirmar reserva</Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>

          {!canConfirm && (
            <Text style={styles.hintText}>
              {isLavarropas && !selectedProgram
                ? 'Elegí un programa de lavado y un método de entrega para continuar'
                : 'Elegí un método de entrega para continuar'}
            </Text>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 18 },
  scroll: { paddingHorizontal: 24, paddingTop: 4 },

  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CARD_BG,
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.15)',
    padding: 16, marginBottom: 28,
  },
  itemIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  itemName: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 16, marginBottom: 3 },
  itemPrice: { fontFamily: 'Inter_400Regular', color: '#C4B5FD', fontSize: 14 },

  sectionLabel: {
    fontFamily: 'Inter_700Bold', color: BODY,
    fontSize: 11, letterSpacing: 1.2, marginBottom: 12,
  },

  daysRow: { gap: 8, paddingRight: 4, marginBottom: 28 },
  dayChip: {
    width: 58, paddingVertical: 12, borderRadius: 14,
    backgroundColor: CARD_BG, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', gap: 3,
  },
  dayChipSelected: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderColor: PURPLE,
  },
  dayChipLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
  dayChipLabelSelected: { color: '#C4B5FD' },
  dayChipNum: { fontFamily: 'Inter_700Bold', color: GRAY, fontSize: 20 },
  dayChipNumSelected: { color: '#FFFFFF' },
  dayChipMonth: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 10 },
  dayChipMonthSelected: { color: '#C4B5FD' },

  timeCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'center', gap: 24,
    backgroundColor: CARD_BG, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 20, marginBottom: 28,
  },
  timeSection: { alignItems: 'center', gap: 6 },
  timeLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  timeBlock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeInput: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)',
    color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 18,
    textAlign: 'center',
  },
  timeColon: { fontFamily: 'Inter_700Bold', color: GRAY, fontSize: 20 },

  programsCard: {
    backgroundColor: CARD_BG, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 28, overflow: 'hidden',
  },
  programRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, paddingHorizontal: 16, paddingVertical: 16,
  },
  programRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  programRowSelected: { backgroundColor: 'rgba(139,92,246,0.08)' },
  programRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: BODY,
    alignItems: 'center', justifyContent: 'center',
  },
  programRadioSelected: { borderColor: PURPLE },
  programRadioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: PURPLE,
  },
  programName: { fontFamily: 'Inter_500Medium', color: GRAY, fontSize: 15 },
  programNameSelected: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },
  programDuration: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, marginTop: 2 },

  deliveryGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 28,
  },
  deliveryCard: {
    width: '47.5%',
    backgroundColor: CARD_BG,
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 16, paddingHorizontal: 14,
    gap: 8,
  },
  deliveryCardSelected: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderColor: PURPLE,
  },
  deliveryLabel: { fontFamily: 'Inter_500Medium', color: BODY, fontSize: 13 },
  deliveryLabelSelected: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },

  noteWrap: {
    backgroundColor: CARD_BG, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14, paddingVertical: 4,
    marginBottom: 20,
  },
  noteInput: {
    color: '#FFFFFF', fontFamily: 'Inter_400Regular',
    fontSize: 14, paddingVertical: 12, minHeight: 70,
    textAlignVertical: 'top',
  },

  summaryCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    padding: 12, marginBottom: 16,
  },
  summaryText: {
    flex: 1, fontFamily: 'Inter_400Regular',
    color: GRAY, fontSize: 13, lineHeight: 18,
  },

  confirmWrapper: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  confirmBtn: {
    height: 56, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  confirmBtnText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16 },
  hintText: {
    fontFamily: 'Inter_400Regular', color: BODY,
    fontSize: 12, textAlign: 'center', lineHeight: 18,
  },
});
