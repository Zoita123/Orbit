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

const FIELDS = [
  { key: 'nombre',    label: 'Nombre',    icon: 'user',       placeholder: 'Ej: Camila',              keyboard: 'default' },
  { key: 'apellido',  label: 'Apellido',  icon: 'user',       placeholder: 'Ej: Migdal',              keyboard: 'default' },
  { key: 'dni',       label: 'DNI',       icon: 'credit-card',placeholder: 'Ej: 40123456',            keyboard: 'numeric' },
  { key: 'telefono',  label: 'Teléfono',  icon: 'phone',      placeholder: 'Ej: 1162345678',          keyboard: 'phone-pad' },
  { key: 'direccion', label: 'Dirección', icon: 'map-pin',    placeholder: 'Ej: Av. Corrientes 1234', keyboard: 'default' },
] as const;

type FormData = { nombre: string; apellido: string; dni: string; telefono: string; direccion: string };

export default function ProfileSetupScreen() {
  const [form, setForm] = useState<FormData>({ nombre: '', apellido: '', dni: '', telefono: '', direccion: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile().then(({ data }) => {
      if (data) setForm({ nombre: data.nombre ?? '', apellido: data.apellido ?? '', dni: data.dni ?? '', telefono: data.telefono ?? '', direccion: data.direccion ?? '' });
      setLoading(false);
    });
  }, []);

  const set = (key: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!form.apellido.trim()) { setError('El apellido es obligatorio'); return; }
    setSaving(true);
    setError('');

    let home_lat: number | null = null;
    let home_lng: number | null = null;
    const addr = form.direccion.trim();
    if (addr) {
      try {
        const Location = await import('expo-location');
        await Location.requestForegroundPermissionsAsync();
        const results = await Location.geocodeAsync(addr);
        if (results.length > 0) {
          home_lat = results[0].latitude;
          home_lng = results[0].longitude;
        }
      } catch {
        // geocoding failed silently — home detection won't work until address is valid
      }
    }

    const { error: err } = await upsertProfile({
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      dni: form.dni.trim(),
      telefono: form.telefono.trim(),
      direccion: addr,
      ...(home_lat !== null && { home_lat, home_lng }),
    });
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
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={GRAY} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Completar perfil</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Intro */}
            <View style={styles.introBanner}>
              <View style={styles.introIconWrap}>
                <Feather name="shield" size={22} color="#C4B5FD" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.introTitle}>Verificá tu identidad</Text>
                <Text style={styles.introSub}>Tu perfil completo genera confianza en la comunidad y desbloquea el badge de verificado.</Text>
              </View>
            </View>

            {/* Fields */}
            {FIELDS.map((field) => (
              <View key={field.key}>
                <Text style={styles.label}>{field.label}</Text>
                <View style={styles.inputWrap}>
                  <Feather name={field.icon as any} size={16} color={BODY} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={field.placeholder}
                    placeholderTextColor={BODY}
                    value={form[field.key]}
                    onChangeText={(v) => set(field.key, v)}
                    keyboardType={field.keyboard as any}
                    autoCapitalize={field.key === 'dni' || field.key === 'telefono' ? 'none' : 'words'}
                  />
                </View>
              </View>
            ))}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveWrapper} activeOpacity={0.85}>
              <LinearGradient colors={['#7C3AED', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
                {saving
                  ? <ActivityIndicator color="#FFF" />
                  : <>
                      <Feather name="check" size={18} color="#FFF" />
                      <Text style={styles.saveBtnText}>Guardar perfil</Text>
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

  introBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
  },
  introIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 14, marginBottom: 4 },
  introSub: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13, lineHeight: 18 },

  label: { fontFamily: 'Inter_600SemiBold', color: GRAY, fontSize: 13, marginBottom: 8, marginTop: 4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },

  error: { fontFamily: 'Inter_400Regular', color: '#F87171', fontSize: 13, marginBottom: 16 },
  saveWrapper: { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  saveBtn: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16 },
});
