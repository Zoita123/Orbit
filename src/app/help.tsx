import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const BG      = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE  = '#8B5CF6';
const GRAY    = '#9CA3AF';
const BODY    = '#6B7280';
const GREEN   = '#10B981';

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    title: 'Cómo funciona orbit',
    icon: 'zap' as const,
    color: PURPLE,
    items: [
      {
        q: '¿Qué es orbit?',
        a: 'orbit es una app para prestar y pedir prestado ítems con tus vecinos del edificio. Podés publicar lo que tenés disponible y reservar lo que necesitás, todo de forma segura y sin salir de tu edificio.',
      },
      {
        q: '¿Cómo reservo un ítem?',
        a: 'Andá a la pestaña "Reservar", buscá el ítem que necesitás y tocá para ver los detalles. Desde ahí podés iniciar una conversación con el dueño y coordinar la reserva.',
      },
      {
        q: '¿Quién puede ver mis ítems?',
        a: 'Solo los vecinos de tu edificio pueden ver y reservar tus ítems. Tu información personal (DNI, teléfono) nunca es visible para otros usuarios.',
      },
    ],
  },
  {
    title: 'Transacciones',
    icon: 'repeat' as const,
    color: GREEN,
    items: [
      {
        q: '¿Cómo funciona el flow de entrega?',
        a: 'Una vez confirmada la reserva, aparece una tarjeta "En curso" en tu inicio. El dueño marca cuando entregó el ítem, el que lo recibe confirma que lo tiene, y al devolverlo ambos confirman. Al finalizar, cada uno puede calificar al otro.',
      },
      {
        q: '¿Qué pasa si hay un problema con el ítem?',
        a: 'En cualquier paso del flow podés tocar "Tuve un problema" para reportarlo. El equipo de orbit revisará el reporte y se pondrá en contacto con ambas partes.',
      },
      {
        q: '¿Cómo se cierra una conversación?',
        a: 'El chat se cierra automáticamente una vez que la transacción es completada por ambas partes. El historial queda guardado en tu perfil.',
      },
      {
        q: '¿Puedo cancelar una reserva?',
        a: 'Sí. Antes de que comience el flow de entrega podés cancelar desde el chat. Si ya comenzó la entrega, contactate con soporte desde esta sección.',
      },
    ],
  },
  {
    title: 'Puntos y reputación',
    icon: 'award' as const,
    color: '#F59E0B',
    items: [
      {
        q: '¿Cómo gano puntos?',
        a: 'Ganás 10 puntos por cada ítem que prestás y 5 puntos por cada vez que pedís prestado, siempre que la transacción se complete sin problemas y dejes tu calificación.',
      },
      {
        q: '¿Para qué sirven los puntos?',
        a: 'Los puntos determinan tu planeta en orbit (Mercurio, Venus, Tierra, etc.). A mayor planeta, más beneficios y mayor visibilidad como usuario confiable en tu edificio.',
      },
      {
        q: '¿Cómo se calcula mi reputación?',
        a: 'Tu reputación es el promedio de las calificaciones que te dejaron los usuarios con los que interactuaste. Varía de 1 a 5 estrellas.',
      },
    ],
  },
  {
    title: 'Mi perfil',
    icon: 'user' as const,
    color: '#3B82F6',
    items: [
      {
        q: '¿Por qué verificar mi perfil?',
        a: 'Un perfil verificado genera más confianza en tus vecinos. Para verificarlo necesitás completar tu nombre, DNI, teléfono y dirección en "Editar información".',
      },
      {
        q: '¿Puedo publicar desde mi perfil?',
        a: 'Sí. En la pestaña de inicio tocá "Agregar otro producto" para publicar un nuevo ítem. Podés agregar nombre, foto, precio y descripción.',
      },
      {
        q: '¿Cómo activo o pauso mis ítems?',
        a: 'Usá el switch "Estoy en casa" en el inicio para pausar o activar todos tus ítems a la vez. También podés gestionar cada ítem individualmente desde tu lista.',
      },
    ],
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={s.faqItem}>
      <TouchableOpacity style={s.faqQuestion} onPress={toggle} activeOpacity={0.75}>
        <Text style={s.faqQ}>{q}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={BODY} />
      </TouchableOpacity>
      {open && <Text style={s.faqA}>{a}</Text>}
    </View>
  );
}

function Section({ title, icon, color, items }: typeof SECTIONS[number]) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIcon, { backgroundColor: `${color}22` }]}>
          <Feather name={icon} size={15} color={color} />
        </View>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <View style={s.faqCard}>
        {items.map((item, i) => (
          <View key={i}>
            {i > 0 && <View style={s.faqDivider} />}
            <FAQItem q={item.q} a={item.a} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HelpScreen() {
  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={GRAY} />
          </TouchableOpacity>
          <Text style={s.title}>Ayuda</Text>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <Text style={s.subtitle}>¿En qué te podemos ayudar?</Text>

        {SECTIONS.map((sec) => (
          <Section key={sec.title} {...sec} />
        ))}

        {/* Contact */}
        <View style={s.contactCard}>
          <View style={s.contactIcon}>
            <Feather name="mail" size={20} color={PURPLE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.contactTitle}>¿No encontraste lo que buscabas?</Text>
            <Text style={s.contactSub}>Escribinos a hola@orbitapp.com.ar</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerSafe: { backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { padding: 4 },
  title: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 17 },

  content: { paddingHorizontal: 20, paddingTop: 24 },
  subtitle: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 14, marginBottom: 24 },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 15 },

  faqCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  faqDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  faqItem: { paddingHorizontal: 16, paddingVertical: 14 },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqQ: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14, flex: 1, lineHeight: 20 },
  faqA: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13, lineHeight: 20, marginTop: 10 },

  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    padding: 16,
    marginTop: 4,
  },
  contactIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(139,92,246,0.12)', alignItems: 'center', justifyContent: 'center' },
  contactTitle: { fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', fontSize: 14, marginBottom: 3 },
  contactSub: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 13 },
});
