import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Image } from 'expo-image';
import { addItem, fetchItemById, updateItem, uploadItemImage } from '../lib/supabase';

const BG = '#080A1A';
const CARD_BG = '#13142A';
const PURPLE = '#8B5CF6';
const GRAY = '#9CA3AF';
const BODY = '#6B7280';

type Category = 'lavarropas' | 'impresora' | 'herramienta' | 'bicicleta' | 'parlante' | 'otro';
type Program = { name: string; icon: string; enabled: boolean; duration: string };

const CATEGORIES: { key: Category; icon: string; label: string }[] = [
  { key: 'lavarropas',  icon: 'refresh-cw',  label: 'Lavarropas' },
  { key: 'impresora',   icon: 'printer',      label: 'Impresora' },
  { key: 'herramienta', icon: 'tool',         label: 'Herramientas' },
  { key: 'bicicleta',   icon: 'activity',     label: 'Bicicleta' },
  { key: 'parlante',    icon: 'volume-2',     label: 'Parlante' },
  { key: 'otro',        icon: 'help-circle',  label: 'Otro' },
];

const DURATION_MIN = 5;
const DURATION_MAX = 180;
const DURATION_STEP = 5;
const DEFAULT_DURATION = 45;

const PRICE_MIN = 0;
const PRICE_MAX = 9990;
const PRICE_STEP = 50;

const PAPER_SIZES = ['A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0'];
const PAPER_TYPES = ['Bond / Estándar', 'Fotográfico', 'Reciclado', 'Satinado / Couché', 'Kraft', 'Transparente'];

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h}:${String(m).padStart(2, '0')} h`;
}

function DurationStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = parseInt(value) || DEFAULT_DURATION;
  const atMin = current <= DURATION_MIN;
  const atMax = current >= DURATION_MAX;
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={[styles.stepperBtn, atMin && styles.stepperBtnDisabled]}
        onPress={() => !atMin && onChange(String(current - DURATION_STEP))}
        hitSlop={8}
      >
        <Feather name="minus" size={13} color={atMin ? BODY : '#C4B5FD'} />
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{formatDuration(current)}</Text>
      <TouchableOpacity
        style={[styles.stepperBtn, atMax && styles.stepperBtnDisabled]}
        onPress={() => !atMax && onChange(String(current + DURATION_STEP))}
        hitSlop={8}
      >
        <Feather name="plus" size={13} color={atMax ? BODY : '#C4B5FD'} />
      </TouchableOpacity>
    </View>
  );
}

function PriceStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = parseInt(value) || 0;
  const atMin = current <= PRICE_MIN;
  const atMax = current >= PRICE_MAX;
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={[styles.stepperBtn, atMin && styles.stepperBtnDisabled]}
        onPress={() => !atMin && onChange(String(current - PRICE_STEP))}
        hitSlop={8}
      >
        <Feather name="minus" size={13} color={atMin ? BODY : '#C4B5FD'} />
      </TouchableOpacity>
      <Text style={styles.stepperValue}>${current}</Text>
      <TouchableOpacity
        style={[styles.stepperBtn, atMax && styles.stepperBtnDisabled]}
        onPress={() => !atMax && onChange(String(current + PRICE_STEP))}
        hitSlop={8}
      >
        <Feather name="plus" size={13} color={atMax ? BODY : '#C4B5FD'} />
      </TouchableOpacity>
    </View>
  );
}

const PRESET_PROGRAMS = [
  { name: 'Diario',       icon: 'sun' },
  { name: 'Color',        icon: 'droplet' },
  { name: 'Delicado',     icon: 'feather' },
  { name: 'Rápido',       icon: 'zap' },
  { name: 'Sintéticos',   icon: 'layers' },
  { name: 'Centrifugado', icon: 'rotate-cw' },
  { name: 'Lana',         icon: 'wind' },
];

const TOOL_OPTIONS = [
  'Martillo', 'Destornillador', 'Taladro', 'Llave inglesa',
  'Sierra', 'Pinzas', 'Llave de tubo', 'Nivel', 'Cinta métrica',
  'Cortante', 'Otro',
];

const ICON_TO_CATEGORY: Record<string, Category> = {
  'refresh-cw':  'lavarropas',
  'printer':     'impresora',
  'tool':        'herramienta',
  'activity':    'bicicleta',
  'volume-2':    'parlante',
  'help-circle': 'otro',
};

function parseItemForEdit(item: any) {
  const cat: Category = ICON_TO_CATEGORY[item.icon] ?? 'otro';

  let price = '';
  let priceBN = '';
  let priceColor = '';
  let printsBN = true;
  let printsColor = true;
  if (cat === 'impresora') {
    printsBN   = item.price?.includes('/B&N')   ?? true;
    printsColor = item.price?.includes('/color') ?? true;
    priceBN    = item.price?.match(/\$(\d+)\/B&N/)?.[1]   ?? '100';
    priceColor = item.price?.match(/\$(\d+)\/color/)?.[1] ?? '300';
  } else {
    price = item.price?.match(/\$(\d+)/)?.[1] ?? '';
  }

  let name = item.name ?? '';
  let toolType = '';
  let customTool = '';
  if (cat === 'herramienta') {
    if (name.includes(' — ')) {
      const sep = name.indexOf(' — ');
      const tool = name.slice(0, sep);
      name = name.slice(sep + 3);
      toolType = TOOL_OPTIONS.includes(tool) ? tool : 'Otro';
      if (toolType === 'Otro') customTool = tool;
    } else {
      toolType = TOOL_OPTIONS.includes(name) ? name : 'Otro';
      if (toolType === 'Otro') customTool = name;
      name = '';
    }
  }

  const includesDetergent = cat !== 'lavarropas' || item.note !== 'Sin detergente';
  const includesCharger   = cat === 'parlante' && item.note === 'Incluye cargador';

  let paperSize = '';
  let paperType = '';
  if (cat === 'impresora' && item.note) {
    for (const part of item.note.split(' · ')) {
      if (part.startsWith('Hoja ')) paperSize = part.replace('Hoja ', '');
      else paperType = part;
    }
  }

  const programs = PRESET_PROGRAMS.map((p) => {
    const found = Array.isArray(item.programs)
      ? item.programs.find((pp: any) => pp.name === p.name)
      : null;
    return { ...p, enabled: !!found, duration: found?.duration ?? '' };
  });

  return { cat, name, price, priceBN, priceColor, printsBN, printsColor, toolType, customTool, includesDetergent, includesCharger, paperSize, paperType, programs, location: item.location ?? '', imageUrl: item.image_url ?? null };
}

const SUGGESTIONS: Record<Category, string[]> = {
  lavarropas: [
    'Samsung WW10T654 10kg', 'Samsung Ecobubble 8kg', 'Samsung WW8T3040BS 8kg',
    'LG F4WV510S0E 10.5kg', 'LG F4V5RYP2T 9kg', 'LG WT7305CW 4.5kg',
    'Whirlpool WTW5000DW', 'Whirlpool WFW5620HW',
    'Drean Excellent 10.12 10kg', 'Drean 6kg carga frontal',
    'Electrolux EWT1066 10kg', 'Electrolux LBU12D2RSMG 12kg',
    'BGH BW-I906DA 9kg', 'Candy Smart 8kg', 'Bosch Serie 6 9kg',
    'Mabe LMH72112WBBAB 7kg',
  ],
  impresora: [
    'HP LaserJet Pro M404dn', 'HP DeskJet 2755', 'HP OfficeJet Pro 9015',
    'HP Smart Tank 515', 'Canon PIXMA G3110', 'Canon imageCLASS MF445dw',
    'Epson EcoTank L3250', 'Epson EcoTank L4260', 'Epson WorkForce WF-2850',
    'Brother DCP-T520W', 'Brother HL-L2350DW', 'Brother MFC-L2710DW',
    'Samsung Xpress M2020W',
  ],
  herramienta: [
    'En buen estado, uso doméstico', 'Como nueva, poco uso',
    'Mango ergonómico, sin óxido', 'Incluye estuche y accesorios',
    'Marca Stanley', 'Marca Bosch', 'Marca Makita', 'Marca DeWalt',
    'Marca Black+Decker', 'Con batería incluida', 'Eléctrica 220V',
  ],
  bicicleta: [
    'Trek FX 3 rodado 28', 'Giant Talon 3 rodado 29',
    'Specialized Rockhopper 27.5"', 'Vairo XR 3.8 rodado 29',
    'Orbea MX 30 rodado 29', 'Mountain bike rodado 26',
    'Mountain bike rodado 29', 'Bicicleta de ruta 700c',
    'Bici eléctrica plegable', 'Fixie single speed', 'BMX freestyle',
    'Rodado 20 niño', 'Rodado 24 junior',
  ],
  parlante: [
    'JBL Charge 5', 'JBL Flip 6', 'JBL Xtreme 3', 'JBL PartyBox 310',
    'Sony SRS-XB43', 'Sony SRS-XG300',
    'Marshall Emberton II', 'Marshall Stanmore III',
    'Bose SoundLink Flex', 'Bose SoundLink Revolve+',
    'Harman Kardon Aura Studio 3', 'Anker Soundcore 3', 'UE Wonderboom 3',
  ],
  otro: [
    'En buen estado', 'Como nuevo, poco uso',
    'Para préstamo gratuito', 'Incluye accesorios',
  ],
};

const PLACEHOLDER: Record<Category, string> = {
  lavarropas:  'Ej: Samsung 10kg, muy silencioso',
  impresora:   'Ej: HP LaserJet Pro M404dn, hasta 40 pág/min, doble faz automático',
  herramienta: 'Ej: En buen estado, mango ergonómico, sin óxido',
  bicicleta:   'Ej: Mountain bike rodado 26, cambios Shimano, cuadro de aluminio',
  parlante:    'Ej: JBL Charge 5, Bluetooth 5.1, resistente al agua IPX7',
  otro:        'Describí lo que querés ofrecer a tus vecinos',
};

const PRICE_UNIT: Record<Category, string> = {
  lavarropas:  '/uso',
  impresora:   '/hoja',
  herramienta: '/día',
  bicicleta:   '/día',
  parlante:    '/día',
  otro:        '/uso',
};

export default function AddItemScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const [editLoading, setEditLoading] = useState(!!editId);

  const [category, setCategory] = useState<Category>('lavarropas');
  const [name, setName] = useState('');
  const [nameInputFocused, setNameInputFocused] = useState(false);
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Lavarropas
  const [includesDetergent, setIncludesDetergent] = useState(true);
  const [programs, setPrograms] = useState<Program[]>(
    PRESET_PROGRAMS.map((p) => ({ ...p, enabled: false, duration: '' }))
  );

  // Impresora
  const [printsBN, setPrintsBN] = useState(true);
  const [printsColor, setPrintsColor] = useState(true);
  const [priceBN, setPriceBN] = useState('100');
  const [priceColor, setPriceColor] = useState('300');
  const [paperSize, setPaperSize] = useState('');
  const [paperType, setPaperType] = useState('');
  const [paperSizeOpen, setPaperSizeOpen] = useState(false);
  const [paperTypeOpen, setPaperTypeOpen] = useState(false);

  // Image
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  // Category dropdown
  const [categoryOpen, setCategoryOpen] = useState(false);

  // Herramienta
  const [toolType, setToolType] = useState('');
  const [customTool, setCustomTool] = useState('');
  const [toolOpen, setToolOpen] = useState(false);

  // Parlante
  const [includesCharger, setIncludesCharger] = useState(false);

  useEffect(() => {
    if (!editId) return;
    fetchItemById(editId as string).then(({ data }) => {
      if (!data) { setEditLoading(false); return; }
      const p = parseItemForEdit(data);
      setCategory(p.cat);
      setName(p.name);
      setPrice(p.price);
      setPrintsBN(p.printsBN);
      setPrintsColor(p.printsColor);
      setPriceBN(p.priceBN);
      setPriceColor(p.priceColor);
      setLocation(p.location);
      setToolType(p.toolType);
      setCustomTool(p.customTool);
      setIncludesDetergent(p.includesDetergent);
      setIncludesCharger(p.includesCharger);
      setPaperSize(p.paperSize);
      setPaperType(p.paperType);
      setPrograms(p.programs);
      setExistingImageUrl(p.imageUrl);
      setEditLoading(false);
    });
  }, [editId]);

  if (editLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={PURPLE} size="large" />
      </View>
    );
  }

  const handlePickImage = async (source: 'camera' | 'gallery') => {
    try {
      const IP = await import('expo-image-picker');

      if (source === 'camera') {
        const { status } = await IP.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara para sacar la foto.');
          return;
        }
        const result = await IP.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
        if (!result.canceled) setImageUri(result.assets[0].uri);
      } else {
        const { status } = await IP.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería.');
          return;
        }
        const result = await IP.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
        if (!result.canceled) setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(
        'No disponible en Expo Go',
        'Para subir fotos necesitás un build de desarrollo. Por ahora podés guardar el producto sin imagen.'
      );
    }
  };

  const selectCategory = (c: Category) => {
    setCategory(c);
    setCategoryOpen(false);
    setName('');
    setNameInputFocused(false);
    setError('');
    setToolOpen(false);
    setPaperSize('');
    setPaperType('');
    setPaperSizeOpen(false);
    setPaperTypeOpen(false);
    setPrintsBN(true);
    setPrintsColor(true);
    setPriceBN('100');
    setPriceColor('300');
  };

  const filteredSuggestions = name.trim().length > 0
    ? SUGGESTIONS[category]
        .filter((s) => s.toLowerCase().includes(name.toLowerCase().trim()))
        .slice(0, 6)
    : [];
  const showSuggestions = nameInputFocused && filteredSuggestions.length > 0;

  const toggleProgram = (i: number) =>
    setPrograms((prev) => prev.map((p, idx) =>
      idx === i ? { ...p, enabled: !p.enabled, duration: p.duration || String(DEFAULT_DURATION) } : p
    ));

  const setDuration = (i: number, v: string) =>
    setPrograms((prev) => prev.map((p, idx) => idx === i ? { ...p, duration: v } : p));

  const handleSave = async () => {
    if (category === 'herramienta' && !toolType) { setError('Seleccioná el tipo de herramienta'); return; }
    if (category === 'herramienta' && toolType === 'Otro' && !customTool.trim()) { setError('Ingresá el nombre de la herramienta'); return; }
    if (category === 'impresora') {
      const bnOk = printsBN && (parseInt(priceBN) || 0) > 0;
      const colorOk = printsColor && (parseInt(priceColor) || 0) > 0;
      if (!bnOk && !colorOk) { setError('Ingresá al menos un precio de impresión'); return; }
    } else {
      if (!price.trim()) { setError('El precio es obligatorio'); return; }
    }
    if (!name.trim()) { setError('La descripción es obligatoria'); return; }

    setSaving(true);
    setError('');

    let imageUrl: string | null = existingImageUrl;
    if (imageUri) {
      const { url, error: uploadError } = await uploadItemImage(imageUri);
      if (uploadError) { setError('Error al subir la imagen. Intentá de nuevo.'); setSaving(false); return; }
      imageUrl = url;
    }

    const catDef = CATEGORIES.find((c) => c.key === category)!;
    let itemName = name.trim();
    let itemPrice = '';
    let itemNote: string | null = null;

    if (category === 'herramienta') {
      const tool = toolType === 'Otro' ? customTool.trim() : toolType;
      itemName = itemName ? `${tool} — ${itemName}` : tool;
    }

    if (category === 'impresora') {
      const parts: string[] = [];
      if (printsBN) parts.push(`$${parseInt(priceBN) || 0}/B&N`);
      if (printsColor) parts.push(`$${parseInt(priceColor) || 0}/color`);
      itemPrice = parts.join(' · ');
    } else {
      itemPrice = `$${price}${PRICE_UNIT[category]}`;
    }

    if (category === 'lavarropas') itemNote = includesDetergent ? 'Con detergente' : 'Sin detergente';
    else if (category === 'parlante' && includesCharger) itemNote = 'Incluye cargador';
    else if (category === 'otro') itemNote = 'feedback_request';
    else if (category === 'impresora') {
      const parts = [];
      if (paperSize) parts.push(`Hoja ${paperSize}`);
      if (paperType) parts.push(paperType);
      if (parts.length) itemNote = parts.join(' · ');
    }

    const activePrograms = category === 'lavarropas'
      ? programs.filter((p) => p.enabled).map((p) => ({ name: p.name, duration: p.duration.trim() || null }))
      : [];

    const payload = {
      name: itemName,
      price: itemPrice,
      location: location.trim(),
      icon: catDef.icon,
      available: true,
      note: itemNote,
      programs: activePrograms,
      image_url: imageUrl,
    };

    const { error: err } = editId
      ? await updateItem(editId as string, payload)
      : await addItem(payload);

    setSaving(false);
    if (err) { setError(err.message); return; }
    router.back();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={GRAY} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{editId ? 'Modificar producto' : 'Nuevo producto'}</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Categoría ── */}
            <Text style={styles.label}>Tipo de producto</Text>
            {(() => {
              const sel = CATEGORIES.find((c) => c.key === category)!;
              return (
                <View style={styles.categoryDropdownWrap}>
                  <TouchableOpacity
                    style={[styles.dropdownTrigger, { marginBottom: 0 }, categoryOpen && styles.dropdownTriggerOpen]}
                    onPress={() => setCategoryOpen((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Feather name={sel.icon as any} size={17} color="#C4B5FD" />
                      <Text style={styles.dropdownValue}>{sel.label}</Text>
                    </View>
                    <Feather name={categoryOpen ? 'chevron-up' : 'chevron-down'} size={18} color={BODY} />
                  </TouchableOpacity>
                  {categoryOpen && (
                    <View style={styles.categoryDropdownList}>
                      {CATEGORIES.map((c, i) => (
                        <TouchableOpacity
                          key={c.key}
                          style={[styles.dropdownItem, i > 0 && styles.dropdownItemBorder]}
                          onPress={() => selectCategory(c.key)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Feather name={c.icon as any} size={16} color={category === c.key ? '#C4B5FD' : BODY} />
                            <Text style={[styles.dropdownItemText, category === c.key && styles.dropdownItemTextSelected]}>
                              {c.label}
                            </Text>
                          </View>
                          {category === c.key && <Feather name="check" size={15} color={PURPLE} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* ── Foto del producto ── */}
            <Text style={styles.label}>
              Foto <Text style={styles.labelOptional}>(opcional)</Text>
            </Text>
            {(imageUri || existingImageUrl) ? (
              <View style={styles.imagePreviewWrap}>
                <Image
                  source={{ uri: (imageUri || existingImageUrl)! }}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
                <TouchableOpacity
                  style={styles.imageRemoveBtn}
                  onPress={() => imageUri ? setImageUri(null) : setExistingImageUrl(null)}
                >
                  <Feather name="x" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imagePickerRow}>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={() => handlePickImage('camera')} activeOpacity={0.8}>
                  <Feather name="camera" size={20} color={BODY} />
                  <Text style={styles.imagePickerText}>Cámara</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={() => handlePickImage('gallery')} activeOpacity={0.8}>
                  <Feather name="image" size={20} color={BODY} />
                  <Text style={styles.imagePickerText}>Galería</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Herramienta: desplegable ── */}
            {category === 'herramienta' && (
              <>
                <Text style={styles.label}>Tipo de herramienta</Text>
                <View style={styles.categoryDropdownWrap}>
                  <TouchableOpacity
                    style={[styles.dropdownTrigger, { marginBottom: 0 }, toolOpen && styles.dropdownTriggerOpen]}
                    onPress={() => setToolOpen((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dropdownValue, !toolType && { color: BODY }]}>
                      {toolType || 'Seleccioná una herramienta'}
                    </Text>
                    <Feather name={toolOpen ? 'chevron-up' : 'chevron-down'} size={18} color={BODY} />
                  </TouchableOpacity>

                  {toolOpen && (
                    <View style={styles.toolDropdownList}>
                      <ScrollView
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        style={{ maxHeight: 240 }}
                      >
                        {TOOL_OPTIONS.map((t, i) => (
                          <TouchableOpacity
                            key={t}
                            style={[styles.dropdownItem, i > 0 && styles.dropdownItemBorder]}
                            onPress={() => { setToolType(t); setToolOpen(false); if (t !== 'Otro') setCustomTool(''); }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.dropdownItemText, toolType === t && styles.dropdownItemTextSelected]}>
                              {t}
                            </Text>
                            {toolType === t && <Feather name="check" size={15} color={PURPLE} />}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {toolType === 'Otro' && (
                  <TextInput
                    style={[styles.input, { marginTop: 10 }]}
                    placeholder="¿Qué herramienta es?"
                    placeholderTextColor={BODY}
                    value={customTool}
                    onChangeText={setCustomTool}
                  />
                )}
              </>
            )}

            {/* ── Descripción con autocomplete ── */}
            <Text style={styles.label}>
              {category === 'herramienta' ? 'Descripción' : 'Descripción del producto'}
            </Text>
            <View style={styles.acWrap}>
              <TextInput
                style={[
                  styles.input,
                  { marginBottom: 0 },
                  showSuggestions && styles.inputWithSuggestions,
                ]}
                placeholder={PLACEHOLDER[category]}
                placeholderTextColor={BODY}
                value={name}
                onChangeText={setName}
                onFocus={() => setNameInputFocused(true)}
                onBlur={() => setTimeout(() => setNameInputFocused(false), 150)}
                multiline={category === 'otro'}
                numberOfLines={category === 'otro' ? 3 : 1}
                returnKeyType="done"
              />
              {showSuggestions && (
                <View style={styles.suggestionList}>
                  {filteredSuggestions.map((s, i) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.suggestionItem, i > 0 && styles.suggestionBorder]}
                      onPress={() => { setName(s); setNameInputFocused(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionText} numberOfLines={1}>{s}</Text>
                      <Feather name="corner-down-left" size={13} color={BODY} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={{ height: 20 }} />

            {/* ── Impresora: modalidad ── */}
            {category === 'impresora' && (
              <>
                <Text style={styles.label}>Modalidad de impresión</Text>
                <View style={styles.printModeRow}>
                  <TouchableOpacity
                    style={[styles.printModeChip, printsBN && styles.printModeChipActive]}
                    onPress={() => { if (printsColor) setPrintsBN(v => !v); }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.programCheckbox, printsBN && styles.programCheckboxActive]}>
                      {printsBN && <Feather name="check" size={11} color="#FFF" />}
                    </View>
                    <Text style={[styles.printModeText, printsBN && styles.printModeTextActive]}>Blanco y negro</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.printModeChip, printsColor && styles.printModeChipActive]}
                    onPress={() => { if (printsBN) setPrintsColor(v => !v); }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.programCheckbox, printsColor && styles.programCheckboxActive]}>
                      {printsColor && <Feather name="check" size={11} color="#FFF" />}
                    </View>
                    <Text style={[styles.printModeText, printsColor && styles.printModeTextActive]}>Color</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── Impresora: especificaciones de hoja ── */}
            {category === 'impresora' && (
              <>
                <Text style={styles.label}>
                  Especificaciones de hoja <Text style={styles.labelOptional}>(opcional)</Text>
                </Text>

                {/* Tamaño */}
                <TouchableOpacity
                  style={[styles.dropdownTrigger, { marginBottom: 8 }, paperSizeOpen && styles.dropdownTriggerOpen]}
                  onPress={() => { setPaperSizeOpen(v => !v); setPaperTypeOpen(false); }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name="file" size={15} color={paperSize ? '#C4B5FD' : BODY} />
                    <Text style={[styles.dropdownValue, !paperSize && { color: BODY }]}>
                      {paperSize || 'Tamaño de hoja'}
                    </Text>
                  </View>
                  <Feather name={paperSizeOpen ? 'chevron-up' : 'chevron-down'} size={18} color={BODY} />
                </TouchableOpacity>
                {paperSizeOpen && (
                  <View style={[styles.dropdownList, { marginBottom: 8 }]}>
                    {PAPER_SIZES.map((size, i) => (
                      <TouchableOpacity
                        key={size}
                        style={[styles.dropdownItem, i > 0 && styles.dropdownItemBorder]}
                        onPress={() => { setPaperSize(size); setPaperSizeOpen(false); }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={[styles.dropdownItemText, paperSize === size && styles.dropdownItemTextSelected]}>
                            {size}
                          </Text>
                          {size === 'A4' && <Text style={styles.paperRecBadge}>· Recomendado</Text>}
                        </View>
                        {paperSize === size && <Feather name="check" size={15} color={PURPLE} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Tipo */}
                <TouchableOpacity
                  style={[styles.dropdownTrigger, { marginBottom: 20 }, paperTypeOpen && styles.dropdownTriggerOpen]}
                  onPress={() => { setPaperTypeOpen(v => !v); setPaperSizeOpen(false); }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name="layers" size={15} color={paperType ? '#C4B5FD' : BODY} />
                    <Text style={[styles.dropdownValue, !paperType && { color: BODY }]}>
                      {paperType || 'Tipo de hoja'}
                    </Text>
                  </View>
                  <Feather name={paperTypeOpen ? 'chevron-up' : 'chevron-down'} size={18} color={BODY} />
                </TouchableOpacity>
                {paperTypeOpen && (
                  <View style={[styles.dropdownList, { marginTop: -20 }]}>
                    {PAPER_TYPES.map((type, i) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.dropdownItem, i > 0 && styles.dropdownItemBorder]}
                        onPress={() => { setPaperType(type); setPaperTypeOpen(false); }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={[styles.dropdownItemText, paperType === type && styles.dropdownItemTextSelected]}>
                            {type}
                          </Text>
                          {type === 'Bond / Estándar' && <Text style={styles.paperRecBadge}>· Recomendado</Text>}
                        </View>
                        {paperType === type && <Feather name="check" size={15} color={PURPLE} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* ── Precio ── */}
            {category === 'impresora' ? (
              <>
                <Text style={styles.label}>Precio por carilla</Text>
                <View style={styles.dualPriceRow}>
                  {printsBN && (
                    <View style={styles.priceBox}>
                      <LinearGradient
                        colors={['#374151', '#6B7280', '#D1D5DB']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.priceBoxStrip}
                      />
                      <View style={styles.priceBoxContent}>
                        <Text style={[styles.priceBoxLabel, { color: '#D1D5DB' }]}>Blanco y negro</Text>
                        <PriceStepper value={priceBN} onChange={setPriceBN} />
                      </View>
                    </View>
                  )}
                  {printsColor && (
                    <View style={styles.priceBox}>
                      <LinearGradient
                        colors={['#EF4444', '#F97316', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.priceBoxStrip}
                      />
                      <View style={styles.priceBoxContent}>
                        <Text style={[styles.priceBoxLabel, { color: '#C4B5FD' }]}>Color</Text>
                        <PriceStepper value={priceColor} onChange={setPriceColor} />
                      </View>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>Precio</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceAffix}>$</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Sugerencia: 2000-4000"
                    placeholderTextColor={BODY}
                    value={price}
                    onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                  />
                  <Text style={styles.priceAffix}>{PRICE_UNIT[category]}</Text>
                </View>
              </>
            )}

            {/* ── Ubicación ── */}
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

            {/* ── Lavarropas extras ── */}
            {category === 'lavarropas' && (
              <>
                <Text style={styles.label}>Extras</Text>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLeft}>
                    <Feather name="droplet" size={16} color={PURPLE} />
                    <Text style={styles.toggleLabel}>¿Incluye detergente?</Text>
                  </View>
                  <Switch value={includesDetergent} onValueChange={setIncludesDetergent} trackColor={{ false: '#1E2040', true: PURPLE }} thumbColor="#FFF" />
                </View>

                <Text style={styles.label}>
                  Programas disponibles <Text style={styles.labelOptional}>(opcional)</Text>
                </Text>
                <View style={styles.programsCard}>
                  {programs.map((prog, idx) => (
                    <View key={prog.name}>
                      {idx > 0 && <View style={styles.programDivider} />}
                      <View style={styles.programRow}>
                        <TouchableOpacity style={styles.programLeft} onPress={() => toggleProgram(idx)} activeOpacity={0.7}>
                          <View style={[styles.programCheckbox, prog.enabled && styles.programCheckboxActive]}>
                            {prog.enabled && <Feather name="check" size={11} color="#FFF" />}
                          </View>
                          <Feather name={prog.icon as any} size={15} color={prog.enabled ? '#C4B5FD' : BODY} />
                          <Text style={[styles.programName, prog.enabled && styles.programNameActive]}>{prog.name}</Text>
                        </TouchableOpacity>
                        {prog.enabled && (
                          <DurationStepper
                            value={prog.duration}
                            onChange={(v) => setDuration(idx, v)}
                          />
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* ── Parlante extras ── */}
            {category === 'parlante' && (
              <>
                <Text style={styles.label}>Extras</Text>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLeft}>
                    <Feather name="battery-charging" size={16} color={PURPLE} />
                    <Text style={styles.toggleLabel}>¿Incluye cargador?</Text>
                  </View>
                  <Switch value={includesCharger} onValueChange={setIncludesCharger} trackColor={{ false: '#1E2040', true: PURPLE }} thumbColor="#FFF" />
                </View>
              </>
            )}

            {/* ── Otro: banner de feedback ── */}
            {category === 'otro' && (
              <View style={styles.feedbackBanner}>
                <Feather name="info" size={15} color={PURPLE} style={{ marginTop: 1 }} />
                <Text style={styles.feedbackText}>
                  Tu publicación nos ayuda a entender qué quieren ofrecer los vecinos. Aunque sea algo que todavía no está como categoría, ¡sumalo igual!
                </Text>
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveWrapper} activeOpacity={0.85}>
              <LinearGradient colors={['#7C3AED', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{editId ? 'Guardar cambios' : 'Guardar producto'}</Text>}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 18 },
  scrollContent: { paddingHorizontal: 24 },

  label: { fontFamily: 'Inter_600SemiBold', color: GRAY, fontSize: 13, marginBottom: 10, marginTop: 4 },
  labelOptional: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },

  categoryDropdownWrap: {
    marginBottom: 24,
    zIndex: 100,
  },
  categoryDropdownList: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: PURPLE,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
    zIndex: 100,
    elevation: 10,
  },
  toolDropdownList: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: PURPLE,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
    zIndex: 100,
    elevation: 10,
  },

  // Category grid — 3 columns × 2 rows (kept for reference)
  categoryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24,
  },
  categoryItem: {
    width: '30.5%',
    alignItems: 'center', gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  categoryItemSelected: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: PURPLE,
  },
  categoryLabel: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 12 },
  categoryLabelSelected: { fontFamily: 'Inter_600SemiBold', color: '#C4B5FD' },

  // Tool dropdown
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 15,
    marginBottom: 4,
  },
  dropdownTriggerOpen: { borderColor: PURPLE, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  dropdownValue: { fontFamily: 'Inter_400Regular', color: '#FFFFFF', fontSize: 15 },
  dropdownList: {
    backgroundColor: CARD_BG, borderWidth: 1, borderTopWidth: 0,
    borderColor: PURPLE,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    marginBottom: 20, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  dropdownItemBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  dropdownItemText: { fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 15 },
  dropdownItemTextSelected: { fontFamily: 'Inter_600SemiBold', color: '#C4B5FD' },
  paperRecBadge: { fontFamily: 'Inter_500Medium', color: '#22D3EE', fontSize: 13 },

  // Print mode selector
  printModeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  printModeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  printModeChipActive: {
    backgroundColor: 'rgba(139,92,246,0.12)', borderColor: PURPLE,
  },
  printModeText: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 14 },
  printModeTextActive: { fontFamily: 'Inter_500Medium', color: '#C4B5FD' },

  // Inputs
  input: {
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 15,
    color: '#FFFFFF', fontFamily: 'Inter_400Regular', fontSize: 15, marginBottom: 20,
  },
  inputWithSuggestions: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: 'rgba(139,92,246,0.2)',
    borderColor: PURPLE,
  },

  // Autocomplete
  acWrap: { position: 'relative' },
  suggestionList: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: PURPLE,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 8,
  },
  suggestionBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  suggestionText: { fontFamily: 'Inter_400Regular', color: '#FFFFFF', fontSize: 14, flex: 1 },

  // Single price row
  priceRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, marginBottom: 20,
  },
  priceAffix: { fontFamily: 'Inter_600SemiBold', color: GRAY, fontSize: 16 },
  priceInput: {
    flex: 1, paddingVertical: 15, paddingHorizontal: 8,
    color: '#FFFFFF', fontFamily: 'Inter_400Regular', fontSize: 15,
  },

  // Dual price (impresora)
  dualPriceRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  priceBox: {
    flex: 1, backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  priceBoxStrip: { height: 5, width: '100%' },
  priceBoxContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
  priceBoxLabel: { fontFamily: 'Inter_500Medium', color: BODY, fontSize: 11, marginBottom: 8 },
  priceInner: { flexDirection: 'row', alignItems: 'center' },

  // Toggles
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.15)', paddingHorizontal: 16, paddingVertical: 15, marginBottom: 20,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { fontFamily: 'Inter_500Medium', color: '#FFFFFF', fontSize: 15 },

  // Programs (lavarropas)
  programsCard: {
    backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', marginBottom: 24, overflow: 'hidden',
  },
  programDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },
  programRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13, gap: 12,
  },
  programLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  programCheckbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  programCheckboxActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  programName: { fontFamily: 'Inter_400Regular', color: BODY, fontSize: 15 },
  programNameActive: { fontFamily: 'Inter_500Medium', color: '#FFFFFF' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 32,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperValue: {
    fontFamily: 'Inter_600SemiBold',
    color: '#C4B5FD',
    fontSize: 13,
    minWidth: 58,
    textAlign: 'center',
  },

  // Feedback banner (otro)
  feedbackBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(139,92,246,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)',
    padding: 14, marginBottom: 20,
  },
  feedbackText: {
    fontFamily: 'Inter_400Regular', color: GRAY, fontSize: 13, lineHeight: 19, flex: 1,
  },

  // Image picker
  imagePickerRow: {
    flexDirection: 'row', gap: 10, marginBottom: 24,
  },
  imagePickerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 20, backgroundColor: CARD_BG, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderStyle: 'dashed',
  },
  imagePickerText: {
    fontFamily: 'Inter_500Medium', color: BODY, fontSize: 14,
  },
  imagePreviewWrap: {
    marginBottom: 24, borderRadius: 14, overflow: 'hidden',
  },
  imagePreview: {
    width: '100%', height: 180,
  },
  imageRemoveBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },

  error: { fontFamily: 'Inter_400Regular', color: '#F87171', fontSize: 13, marginBottom: 16 },
  saveWrapper: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  saveBtn: { height: 56, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 16 },
});
