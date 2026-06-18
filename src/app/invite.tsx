import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ensureReferralCode, fetchReferralStats } from '../lib/supabase';

const BG      = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE  = '#8B5CF6';
const GRAY    = '#9CA3AF';
const BODY    = '#6B7280';
const GREEN   = '#10B981';

const BASE_URL = 'orbit.app/invite';

const STEPS = [
  { icon: 'share-2',     label: 'Compartís tu código con un amigo' },
  { icon: 'user-plus',   label: 'Tu amigo se registra en orbit' },
  { icon: 'check-circle',label: 'Completa su primera reserva' },
  { icon: 'gift',        label: 'Ambos reciben $2.000 en créditos' },
];

export default function InviteScreen() {
  const [code, setCode]             = useState<string | null>(null);
  const [stats, setStats]           = useState({ sent: 0, completed: 0 });
  const [copied, setCopied]         = useState<'code' | 'link' | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([ensureReferralCode(), fetchReferralStats()]).then(([c, s]) => {
      setCode(c);
      setStats(s);
      setLoading(false);
    });
  }, []);

  const link = code ? `${BASE_URL}/${code}` : '';

  const shareText = `Estoy usando Orbit para alquilar cosas con mis vecinos. Registrate con mi link y ambos recibimos $2.000 en créditos para usar en la app.\n\nhttps://${link}`;

  const handleShare = () => {
    Share.share({ message: shareText, url: `https://${link}` });
  };

  const handleCopy = (type: 'code' | 'link') => {
    Clipboard.setString(type === 'code' ? (code ?? '') : `https://${link}`);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <View style={s.container}>
        <SafeAreaView edges={['top']} style={s.headerSafe}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
              <Feather name="arrow-left" size={20} color={GRAY} />
            </TouchableOpacity>
            <Text style={s.title}>Invitá a tus amigos</Text>
            <View style={{ width: 32 }} />
          </View>
        </SafeAreaView>
        <ActivityIndicator color={PURPLE} style={{ marginTop: 60 }} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={GRAY} />
          </TouchableOpacity>
          <Text style={s.title}>Invitá a tus amigos</Text>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* Hero card */}
        <LinearGradient
          colors={['#4C1D95', '#6D28D9', '#1D4ED8']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <Text style={s.heroEmoji}>🎁</Text>
          <Text style={s.heroTitle}>Invitá amigos y ganá créditos</Text>
          <Text style={s.heroSub}>
            Cuando tu amigo se registre y complete su primera reserva, ambos reciben{' '}
            <Text style={s.heroBold}>$2.000 en créditos</Text>.{'\n'}
            Hasta 10 invitaciones exitosas.
          </Text>

          {/* Stats pills */}
          <View style={s.statsRow}>
            <View style={s.statPill}>
              <Text style={s.statNum}>{stats.sent}</Text>
              <Text style={s.statLbl}>enviadas</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statPill}>
              <Text style={s.statNum}>{stats.completed}</Text>
              <Text style={s.statLbl}>completadas</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statPill}>
              <Text style={s.statNum}>${(stats.completed * 2000).toLocaleString('es-AR')}</Text>
              <Text style={s.statLbl}>ganados</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Code */}
        <View style={s.codeSection}>
          <Text style={s.label}>TU CÓDIGO</Text>
          <View style={s.codeRow}>
            <View style={s.codeBox}>
              <Text style={s.codeText}>{code}</Text>
            </View>
            <TouchableOpacity
              style={[s.copyBtn, copied === 'code' && s.copyBtnDone]}
              onPress={() => handleCopy('code')}
              activeOpacity={0.75}
            >
              <Feather name={copied === 'code' ? 'check' : 'copy'} size={16} color={copied === 'code' ? GREEN : PURPLE} />
              <Text style={[s.copyText, copied === 'code' && { color: GREEN }]}>
                {copied === 'code' ? 'Copiado' : 'Copiar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Link */}
        <View style={s.linkSection}>
          <Text style={s.label}>TU LINK</Text>
          <View style={s.linkRow}>
            <Text style={s.linkText} numberOfLines={1}>{link}</Text>
            <TouchableOpacity
              style={[s.copyBtn, copied === 'link' && s.copyBtnDone]}
              onPress={() => handleCopy('link')}
              activeOpacity={0.75}
            >
              <Feather name={copied === 'link' ? 'check' : 'link'} size={16} color={copied === 'link' ? GREEN : PURPLE} />
              <Text style={[s.copyText, copied === 'link' && { color: GREEN }]}>
                {copied === 'link' ? 'Copiado' : 'Copiar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Share button */}
        <TouchableOpacity onPress={handleShare} activeOpacity={0.85} style={s.shareWrap}>
          <LinearGradient
            colors={['#7C3AED', '#3B82F6']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.shareBtn}
          >
            <Feather name="share-2" size={19} color="#FFF" />
            <Text style={s.shareBtnText}>Compartir</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* How it works */}
        <Text style={s.sectionTitle}>CÓMO FUNCIONA</Text>
        <View style={s.stepsCard}>
          {STEPS.map((step, i) => (
            <View key={i}>
              {i > 0 && <View style={s.stepDivider} />}
              <View style={s.stepRow}>
                <View style={s.stepNum}>
                  <Text style={s.stepNumText}>{i + 1}</Text>
                </View>
                <View style={s.stepIconWrap}>
                  <Feather name={step.icon as any} size={16} color={PURPLE} />
                </View>
                <Text style={s.stepLabel}>{step.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Reward breakdown */}
        <Text style={s.sectionTitle}>RECOMPENSAS</Text>
        <View style={s.rewardCard}>
          <View style={s.rewardRow}>
            <View style={s.rewardIcon}>
              <Feather name="user" size={15} color={GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rewardWho}>Tu amigo recibe</Text>
            </View>
            <Text style={s.rewardAmount}>$2.000</Text>
          </View>
          <View style={s.rewardDivider} />
          <View style={s.rewardRow}>
            <View style={[s.rewardIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
              <Feather name="smile" size={15} color={PURPLE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rewardWho}>Vos recibís</Text>
            </View>
            <Text style={s.rewardAmount}>$2.000</Text>
          </View>
          <View style={s.rewardDivider} />
          <View style={s.rewardRow}>
            <View style={[s.rewardIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Feather name="award" size={15} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rewardWho}>Beneficio máximo</Text>
            </View>
            <Text style={s.rewardAmount}>$20.000</Text>
          </View>
        </View>

        {/* Fine print */}
        <Text style={s.finePrint}>
          Los créditos se acreditan cuando tu invitado completa su primera reserva exitosa. Válido hasta 10 invitaciones por usuario.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerSafe: { backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { padding: 4 },
  title: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 17 },

  content: { padding: 20 },

  hero: {
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  heroEmoji: { fontSize: 40, marginBottom: 4 },
  heroTitle: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 22, textAlign: 'center' },
  heroSub: { fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  heroBold: { fontFamily: 'Inter_700Bold', color: '#FFFFFF' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    marginTop: 10,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  statPill: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 18 },
  statLbl: { fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' },

  label: { fontFamily: 'Inter_700Bold', color: BODY, fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },

  codeSection: { marginBottom: 16 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeBox: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  codeText: { fontFamily: 'Inter_700Bold', color: '#C4B5FD', fontSize: 26, letterSpacing: 4 },

  linkSection: { marginBottom: 20 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  linkText: { flex: 1, fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13 },

  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.4)',
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  copyBtnDone: { borderColor: 'rgba(16,185,129,0.4)', backgroundColor: 'rgba(16,185,129,0.08)' },
  copyText: { fontFamily: 'Inter_600SemiBold', color: PURPLE, fontSize: 13 },

  shareWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 28 },
  shareBtn: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  shareBtnText: { fontFamily: 'Inter_700Bold', color: '#FFF', fontSize: 17 },

  sectionTitle: { fontFamily: 'Inter_700Bold', color: BODY, fontSize: 10, letterSpacing: 1.2, marginBottom: 10 },

  stepsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  stepDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontFamily: 'Inter_700Bold', color: PURPLE, fontSize: 11 },
  stepIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(139,92,246,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepLabel: { fontFamily: 'Inter_400Regular', color: '#FFFFFF', fontSize: 14, flex: 1, lineHeight: 20 },

  rewardCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  rewardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rewardIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  rewardWho: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 14 },
  rewardAmount: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16 },

  finePrint: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
