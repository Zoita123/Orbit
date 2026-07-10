import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { countPendingOffers, createRequestConversation, sendMessage, uploadMessageImage } from '../lib/supabase';
import { parseRequestDesc, REQ_CATEGORIES } from '../lib/requestUtils';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

export default function RespondRequestScreen() {
  const insets = useSafeAreaInsets();
  const { requestId, requesterId, description } = useLocalSearchParams<{
    requestId: string;
    requesterId: string;
    description: string;
  }>();

  const { cat, text: reqText } = parseRequestDesc(description ?? '');

  const [message, setMessage] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handlePickImage = async () => {
    try {
      const IP = await import('expo-image-picker');
      const { status } = await IP.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería.');
        return;
      }
      const result = await IP.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled) setImageUri(result.assets[0].uri);
    } catch {
      Alert.alert('No disponible', 'Para subir fotos necesitás un build de desarrollo.');
    }
  };

  const handleCamera = async () => {
    try {
      const IP = await import('expo-image-picker');
      const { status } = await IP.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara.');
        return;
      }
      const result = await IP.launchCameraAsync({ allowsEditing: true, quality: 0.85 });
      if (!result.canceled) setImageUri(result.assets[0].uri);
    } catch {
      Alert.alert('No disponible', 'Para usar la cámara necesitás un build de desarrollo.');
    }
  };

  const canSend = message.trim().length > 0 || !!imageUri;

  const handleSend = async () => {
    if (!canSend || !requestId || !requesterId) return;
    setSending(true);

    const { count } = await countPendingOffers(requestId);
    if (count >= 3) {
      setSending(false);
      Alert.alert('Pedido completo', 'Este pedido ya tiene 3 ofertas activas. Intentá de nuevo si alguna es rechazada.');
      return;
    }

    const { data: conv, error: convErr } = await createRequestConversation(requestId, requesterId);
    if (convErr || !conv) {
      setSending(false);
      Alert.alert('Error', 'No se pudo iniciar la conversación.');
      return;
    }

    if (message.trim()) {
      await sendMessage(conv.id, message.trim());
    }

    if (imageUri) {
      const { url, error: uploadErr } = await uploadMessageImage(imageUri);
      if (uploadErr || !url) {
        setSending(false);
        Alert.alert('Error', 'No se pudo subir la foto.');
        return;
      }
      await sendMessage(conv.id, url, 'image');
    }

    setSending(false);
    router.replace(`/chat?id=${conv.id}`);
  };

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
              <Feather name="arrow-left" size={20} color={GRAY} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Ofrecer ayuda</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Request context card */}
            <View style={s.reqContext}>
              <View style={s.reqContextHeader}>
                <Feather name="inbox" size={13} color={BODY} />
                <Text style={s.reqContextLabel}>Pedido del vecino</Text>
              </View>
              {cat && (
                <View style={[s.reqCatChip, { backgroundColor: `${cat.color}18`, borderColor: `${cat.color}40` }]}>
                  <Feather name={cat.icon as any} size={11} color={cat.color} />
                  <Text style={[s.reqCatChipText, { color: cat.color }]}>{cat.label}</Text>
                </View>
              )}
              <Text style={s.reqContextText}>{reqText}</Text>
            </View>

            {/* Message input */}
            <Text style={s.label}>Tu mensaje</Text>
            <View style={s.inputCard}>
              <TextInput
                style={s.textInput}
                placeholder="Contale que tenés lo que busca..."
                placeholderTextColor={BODY}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
            </View>

            {/* Photo section */}
            <Text style={s.label}>
              Foto de tu producto <Text style={s.labelOptional}>(opcional)</Text>
            </Text>

            {imageUri ? (
              <View style={s.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={s.imagePreview} resizeMode="cover" />
                <TouchableOpacity style={s.imageRemoveBtn} onPress={() => setImageUri(null)}>
                  <Feather name="x" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.photoRow}>
                <TouchableOpacity style={s.photoBtn} onPress={handleCamera} activeOpacity={0.8}>
                  <Feather name="camera" size={20} color={BODY} />
                  <Text style={s.photoBtnText}>Cámara</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.photoBtn} onPress={handlePickImage} activeOpacity={0.8}>
                  <Feather name="image" size={20} color={BODY} />
                  <Text style={s.photoBtnText}>Galería</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Footer */}
          <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[s.submitWrap, !canSend && { opacity: 0.4 }]}
              onPress={handleSend}
              disabled={sending || !canSend}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#7C3AED', '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.submitBtn}
              >
                {sending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#FFF" />
                    <Text style={s.submitText}>Enviar y chatear</Text>
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

  reqContext: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    gap: 10,
    marginBottom: 28,
  },
  reqContextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reqContextLabel: {
    fontFamily: 'Inter_500Medium',
    color: BODY,
    fontSize: 12,
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
  reqContextText: {
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
  },

  label: {
    fontFamily: 'Inter_600SemiBold',
    color: GRAY,
    fontSize: 13,
    marginBottom: 10,
  },
  labelOptional: {
    fontFamily: 'Inter_400Regular',
    color: BODY,
    fontSize: 12,
  },

  inputCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    padding: 16,
    marginBottom: 28,
    minHeight: 110,
  },
  textInput: {
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
  },

  photoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  photoBtnText: {
    fontFamily: 'Inter_500Medium',
    color: BODY,
    fontSize: 14,
  },

  imagePreviewWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 6,
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
  submitText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 16 },
});
