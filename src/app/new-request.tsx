import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createRequest } from '../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

const CATEGORIES = [
  { key: 'herramienta', icon: 'tool',       label: 'Herramienta' },
  { key: 'lavarropas',  icon: 'refresh-cw', label: 'Lavarropas' },
  { key: 'impresora',   icon: 'printer',    label: 'Impresora' },
  { key: 'bicicleta',   icon: 'activity',   label: 'Bicicleta' },
  { key: 'parlante',    icon: 'volume-2',   label: 'Parlante' },
  { key: 'otro',        icon: 'help-circle',label: 'Otro' },
] as const;

export default function NewRequestScreen() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    const finalDesc = category ? `[${category}] ${text.trim()}` : text.trim();
    const { error } = await createRequest(finalDesc);
    setSubmitting(false);
    if (error) {
      Alert.alert('Error', 'No se pudo publicar el pedido.');
      return;
    }
    router.back();
  };

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
              <Feather name="arrow-left" size={20} color={GRAY} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>¿Qué necesitás?</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Subtitle */}
            <View style={s.subtitleRow}>
              <Feather name="zap" size={14} color={PURPLE} />
              <Text style={s.subtitle}>Tu pedido llega a todos tus vecinos del barrio</Text>
            </View>

            {/* Main input */}
            <View style={s.inputCard}>
              <TextInput
                style={s.textInput}
                placeholder={"Contale a tus vecinos lo que necesitás...\n\nEj: Busco un taladro para esta tarde, tengo que colgar unos cuadros."}
                placeholderTextColor={BODY}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />
              <Text style={s.charCount}>{text.length}/200</Text>
            </View>

            {/* Category chips */}
            <Text style={s.label}>
              Categoría <Text style={s.labelOptional}>(opcional)</Text>
            </Text>
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
                    onPress={() => setCategory(active ? null : cat.key)}
                    activeOpacity={0.7}
                  >
                    <Feather name={cat.icon as any} size={13} color={active ? '#C4B5FD' : BODY} />
                    <Text style={[s.catChipText, active && s.catChipTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Footer button */}
          <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[s.submitWrap, !text.trim() && { opacity: 0.4 }]}
              onPress={handleSubmit}
              disabled={submitting || !text.trim()}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#7C3AED', '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.submitBtn}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#FFF" />
                    <Text style={s.submitText}>Publicar pedido</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
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

  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 13,
  },

  inputCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    padding: 16,
    marginBottom: 28,
    minHeight: 160,
  },
  textInput: {
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
  },
  charCount: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 8,
  },

  label: {
    fontFamily: 'Inter_600SemiBold',
    color: GRAY,
    fontSize: 13,
    marginBottom: 12,
  },
  labelOptional: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 12,
  },

  catRow: { paddingBottom: 4 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: PURPLE,
  },
  catChipText: {
    fontFamily: 'Inter_500Medium',
    color: BODY,
    fontSize: 13,
  },
  catChipTextActive: {
    color: '#C4B5FD',
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: BG,
  },
  submitWrap: { borderRadius: 14, overflow: 'hidden' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  submitText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: 16,
  },
});
