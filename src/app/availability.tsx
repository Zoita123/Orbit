import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchProfile, upsertProfile } from '../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

const DAYS = [
  { key: 'lun', label: 'Lunes',     short: 'L' },
  { key: 'mar', label: 'Martes',    short: 'M' },
  { key: 'mie', label: 'Miércoles', short: 'X' },
  { key: 'jue', label: 'Jueves',    short: 'J' },
  { key: 'vie', label: 'Viernes',   short: 'V' },
  { key: 'sab', label: 'Sábado',    short: 'S' },
  { key: 'dom', label: 'Domingo',   short: 'D' },
];

type DaySchedule = { enabled: boolean; from: string; to: string };
type Schedule = Record<string, DaySchedule>;

const DEFAULT_DAY: DaySchedule = { enabled: false, from: '09:00', to: '18:00' };

function buildDefault(): Schedule {
  return Object.fromEntries(DAYS.map((d) => [d.key, { ...DEFAULT_DAY }]));
}

function TimeBlock({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
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
      <TextInput
        style={styles.timeInput}
        value={hh}
        onChangeText={setHH}
        keyboardType="numeric"
        maxLength={2}
        selectTextOnFocus
      />
      <Text style={styles.timeColon}>:</Text>
      <TextInput
        style={styles.timeInput}
        value={mm}
        onChangeText={setMM}
        keyboardType="numeric"
        maxLength={2}
        selectTextOnFocus
      />
    </View>
  );
}

export default function AvailabilityScreen() {
  const [schedule, setSchedule] = useState<Schedule>(buildDefault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile().then(({ data }) => {
      if (data?.schedule && Object.keys(data.schedule).length > 0) {
        setSchedule({ ...buildDefault(), ...data.schedule });
      }
      setLoading(false);
    });
  }, []);

  const toggleDay = (key: string) =>
    setSchedule((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));

  const setTime = (key: string, field: 'from' | 'to', value: string) =>
    setSchedule((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const { error: err } = await upsertProfile({ schedule });
    setSaving(false);
    if (err) { setError(err.message); return; }
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PURPLE} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={GRAY} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Disponibilidad habitual</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Intro */}
            <View style={styles.intro}>
              <Feather name="info" size={14} color={BODY} />
              <Text style={styles.introText}>
                Configurá tu horario típico para que tus vecinos sepan cuándo pueden coordinar con vos.
              </Text>
            </View>

            {/* Quick presets */}
            <View style={styles.presetsHeader}>
              <Text style={styles.presetsLabel}>PRESETS RÁPIDOS</Text>
              <TouchableOpacity
                onPress={() => setSchedule(buildDefault())}
                hitSlop={10}
              >
                <Text style={styles.clearBtn}>Limpiar todo</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.presetsRow}>
              {[
                { label: 'Lun – Vie', days: ['lun','mar','mie','jue','vie'], from: '09:00', to: '18:00' },
                { label: 'Todos los días', days: ['lun','mar','mie','jue','vie','sab','dom'], from: '09:00', to: '20:00' },
                { label: 'Fines de semana', days: ['sab','dom'], from: '10:00', to: '20:00' },
              ].map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={styles.presetBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    const next = buildDefault();
                    preset.days.forEach((k) => {
                      next[k] = { enabled: true, from: preset.from, to: preset.to };
                    });
                    setSchedule(next);
                  }}
                >
                  <Text style={styles.presetBtnText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Day selectors — quick toggle chips */}
            <View style={styles.chipRow}>
              {DAYS.map((d) => (
                <TouchableOpacity
                  key={d.key}
                  onPress={() => toggleDay(d.key)}
                  style={[styles.dayChip, schedule[d.key].enabled && styles.dayChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayChipText, schedule[d.key].enabled && styles.dayChipTextActive]}>
                    {d.short}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Day rows */}
            <View style={styles.daysCard}>
              {DAYS.map((d, i) => {
                const day = schedule[d.key];
                return (
                  <View key={d.key}>
                    {i > 0 && <View style={styles.divider} />}

                    <View style={styles.dayRow}>
                      {/* Name + toggle */}
                      <View style={styles.dayHeader}>
                        <View style={styles.dayLabelWrap}>
                          <View style={[styles.dayDot, day.enabled && styles.dayDotActive]} />
                          <Text style={[styles.dayLabel, !day.enabled && styles.dayLabelOff]}>
                            {d.label}
                          </Text>
                        </View>
                        <Switch
                          value={day.enabled}
                          onValueChange={() => toggleDay(d.key)}
                          trackColor={{ false: '#1E2040', true: PURPLE }}
                          thumbColor="#FFFFFF"
                          style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                        />
                      </View>

                      {/* Time range — only when enabled */}
                      {day.enabled && (
                        <View style={styles.timeRow}>
                          <View style={styles.timeSection}>
                            <Text style={styles.timeLabel}>Desde</Text>
                            <TimeBlock
                              value={day.from}
                              onChange={(v) => setTime(d.key, 'from', v)}
                            />
                          </View>
                          <View style={styles.timeArrow}>
                            <Feather name="arrow-right" size={14} color={BODY} />
                          </View>
                          <View style={styles.timeSection}>
                            <Text style={styles.timeLabel}>Hasta</Text>
                            <TimeBlock
                              value={day.to}
                              onChange={(v) => setTime(d.key, 'to', v)}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={styles.saveWrapper}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#7C3AED', '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                {saving
                  ? <ActivityIndicator color="#FFF" />
                  : <>
                      <Feather name="check" size={18} color="#FFF" />
                      <Text style={styles.saveBtnText}>Guardar disponibilidad</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 18 },
  scrollContent: { paddingHorizontal: 24 },

  intro: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  introText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 13,
    lineHeight: 19,
  },

  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  dayChip: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderColor: PURPLE,
  },
  dayChipText: {
    fontFamily: 'Inter_700Bold',
    color: BODY,
    fontSize: 12,
  },
  dayChipTextActive: {
    color: '#C4B5FD',
  },

  daysCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  dayRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dayDotActive: { backgroundColor: PURPLE },
  dayLabel: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 15 },
  dayLabelOff: { color: BODY },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 18,
  },
  timeSection: { alignItems: 'flex-start', gap: 4 },
  timeLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 11 },
  timeBlock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeInput: {
    width: 36,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    textAlign: 'center',
  },
  timeColon: { fontFamily: 'Inter_700Bold', color: GRAY, fontSize: 16 },
  timeArrow: { marginTop: 18 },

  presetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  presetsLabel: {
    fontFamily: 'Inter_700Bold',
    color: BODY,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  clearBtn: {
    fontFamily: 'Inter_500Medium',
    color: '#F87171',
    fontSize: 12,
  },
  presetsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  presetBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  presetBtnText: { fontFamily: 'Inter_500Medium', color: '#C4B5FD', fontSize: 11, textAlign: 'center' },

  error: { fontFamily: 'Inter_400Regular', color: '#F87171', fontSize: 13, marginBottom: 12 },
  saveWrapper: { borderRadius: 16, overflow: 'hidden' },
  saveBtn: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16 },
});
