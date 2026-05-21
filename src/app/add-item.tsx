import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { addItem } from '../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

const PRODUCT_TYPES = [
  { icon: 'refresh-cw', label: 'Lavarropas' },
  { icon: 'printer',    label: 'Impresora' },
  { icon: 'tool',       label: 'Herramienta' },
  { icon: 'package',    label: 'Otra' },
];

const PRESET_PROGRAMS = [
  { name: 'Diario',        icon: 'sun' },
  { name: 'Color',         icon: 'droplet' },
  { name: 'Delicado',      icon: 'feather' },
  { name: 'Rápido',        icon: 'zap' },
  { name: 'Sintéticos',    icon: 'layers' },
  { name: 'Centrifugado',  icon: 'rotate-cw' },
  { name: 'Lana',          icon: 'wind' },
];

type Program = { name: string; icon: string; enabled: boolean; duration: string };

export default function AddItemScreen() {
  const [selectedIcon, setSelectedIcon] = useState('refresh-cw');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [includesDetergent, setIncludesDetergent] = useState(true);
  const [programs, setPrograms] = useState<Program[]>(
    PRESET_PROGRAMS.map((p) => ({ ...p, enabled: false, duration: '' }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleProgram = (index: number) => {
    setPrograms((prev) =>
      prev.map((p, i) => (i === index ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const setDuration = (index: number, value: string) => {
    setPrograms((prev) =>
      prev.map((p, i) => (i === index ? { ...p, duration: value } : p))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('La descripción es obligatoria'); return; }
    if (!price.trim()) { setError('El precio es obligatorio'); return; }
    setSaving(true);
    setError('');

    const note = selectedIcon === 'refresh-cw'
      ? (includesDetergent ? 'Con detergente' : 'Sin detergente')
      : null;

    const activePrograms = selectedIcon === 'refresh-cw'
      ? programs
          .filter((p) => p.enabled)
          .map((p) => ({ name: p.name, duration: p.duration.trim() || null }))
      : null;

    const { error: err } = await addItem({
      name: name.trim(),
      price: `$${price.trim()}/h`,
      location: location.trim(),
      icon: selectedIcon,
      available: true,
      note,
      programs: activePrograms ?? [],
    });

    setSaving(false);
    if (err) { setError(err.message); return; }
    router.back();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={GRAY} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Nuevo producto</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Tipo */}
            <Text style={styles.label}>Tipo de producto</Text>
            <View style={styles.typeRow}>
              {PRODUCT_TYPES.map((opt) => (
                <TouchableOpacity
                  key={opt.icon}
                  style={[styles.typeOption, selectedIcon === opt.icon && styles.typeOptionSelected]}
                  onPress={() => setSelectedIcon(opt.icon)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={opt.icon as any}
                    size={24}
                    color={selectedIcon === opt.icon ? '#C4B5FD' : BODY}
                  />
                  <Text style={[styles.typeLabel, selectedIcon === opt.icon && styles.typeLabelSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Descripción */}
            <Text style={styles.label}>Descripción del producto</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Samsung 10kg, muy silencioso"
              placeholderTextColor={BODY}
              value={name}
              onChangeText={setName}
            />

            {/* Precio */}
            <Text style={styles.label}>Precio por hora</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceAffix}>$</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="800"
                placeholderTextColor={BODY}
                value={price}
                onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
              <Text style={styles.priceAffix}>/h</Text>
            </View>

            {/* Ubicación */}
            <Text style={styles.label}>
              Ubicación <Text style={styles.labelOptional}>(opcional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Piso 6 · Depto 6A"
              placeholderTextColor={BODY}
              value={location}
              onChangeText={setLocation}
            />

            {/* Lavarropas extras */}
            {selectedIcon === 'refresh-cw' && (
              <>
                {/* Detergente */}
                <Text style={styles.label}>Extras</Text>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLeft}>
                    <Feather name="droplet" size={16} color={PURPLE} />
                    <Text style={styles.toggleLabel}>¿Incluye detergente?</Text>
                  </View>
                  <Switch
                    value={includesDetergent}
                    onValueChange={setIncludesDetergent}
                    trackColor={{ false: '#1E2040', true: PURPLE }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Programas */}
                <Text style={styles.label}>
                  Programas disponibles <Text style={styles.labelOptional}>(opcional)</Text>
                </Text>
                <View style={styles.programsCard}>
                  {programs.map((program, index) => (
                    <View key={program.name}>
                      {index > 0 && <View style={styles.programDivider} />}
                      <View style={styles.programRow}>
                        <TouchableOpacity
                          style={styles.programLeft}
                          onPress={() => toggleProgram(index)}
                          activeOpacity={0.7}
                        >
                          <View style={[
                            styles.programCheckbox,
                            program.enabled && styles.programCheckboxActive,
                          ]}>
                            {program.enabled && (
                              <Feather name="check" size={11} color="#FFFFFF" />
                            )}
                          </View>
                          <Feather
                            name={program.icon as any}
                            size={15}
                            color={program.enabled ? '#C4B5FD' : BODY}
                          />
                          <Text style={[
                            styles.programName,
                            program.enabled && styles.programNameActive,
                          ]}>
                            {program.name}
                          </Text>
                        </TouchableOpacity>

                        {program.enabled && (
                          <TextInput
                            style={styles.durationInput}
                            placeholder="Ej: 45 min"
                            placeholderTextColor={BODY}
                            value={program.duration}
                            onChangeText={(v) => setDuration(index, v)}
                          />
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

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
                  : <Text style={styles.saveBtnText}>Guardar producto</Text>
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
  safe: { flex: 1 },
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
  label: {
    fontFamily: 'Inter_600SemiBold',
    color: GRAY,
    fontSize: 13,
    marginBottom: 10,
    marginTop: 4,
  },
  labelOptional: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  typeOptionSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderColor: PURPLE,
  },
  typeLabel: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 12,
  },
  typeLabelSelected: {
    fontFamily: 'Inter_600SemiBold',
    color: '#C4B5FD',
  },
  input: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  priceAffix: {
    fontFamily: 'Inter_600SemiBold',
    color: GRAY,
    fontSize: 16,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 8,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 20,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { fontFamily: 'Inter_500Medium', color: '#FFFFFF', fontSize: 15 },

  programsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  programDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  programLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  programCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programCheckboxActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  programName: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 15,
  },
  programNameActive: {
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
  },
  durationInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    width: 90,
    textAlign: 'center',
  },

  error: {
    fontFamily: 'Inter_400Regular',
    color: '#F87171',
    fontSize: 13,
    marginBottom: 16,
  },
  saveWrapper: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  saveBtn: { height: 56, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16 },
});
