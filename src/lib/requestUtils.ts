export const REQ_CATEGORIES: Record<string, { icon: string; label: string; color: string }> = {
  herramienta: { icon: 'tool',        label: 'Herramienta', color: '#F59E0B' },
  lavarropas:  { icon: 'refresh-cw',  label: 'Lavarropas',  color: '#3B82F6' },
  impresora:   { icon: 'printer',     label: 'Impresora',   color: '#8B5CF6' },
  bicicleta:   { icon: 'activity',    label: 'Bicicleta',   color: '#10B981' },
  parlante:    { icon: 'volume-2',    label: 'Parlante',    color: '#EC4899' },
  otro:        { icon: 'help-circle', label: 'Otro',        color: '#9CA3AF' },
};

export function parseRequestDesc(description: string): {
  cat: typeof REQ_CATEGORIES[string] | null;
  text: string;
} {
  const match = description.match(/^\[([^\]]+)\]\s*/);
  if (!match) return { cat: null, text: description };
  const key = match[1];
  return { cat: REQ_CATEGORIES[key] ?? null, text: description.slice(match[0].length) };
}
