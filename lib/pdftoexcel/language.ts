// Detección del idioma del documento (§3, paso 5).
//
// Determina si la propuesta está en español o en inglés para saber cuál par de
// columnas es el original: en un documento en inglés, Services/Fees son el
// original y Servicios/Honorarios quedan pendientes de traducción, y al revés.

export type Idioma = 'es' | 'en';

// Palabras funcionales, que aparecen en cualquier texto del idioma y casi nunca
// en el otro. Se evitan las que son iguales en ambos ("no", "a", "en"/"in").
const MARCADORES: Record<Idioma, string[]> = {
  es: [
    'de', 'la', 'los', 'las', 'del', 'que', 'para', 'con', 'por', 'una',
    'nuestros', 'nuestra', 'servicios', 'sera', 'segun', 'este', 'sus',
  ],
  en: [
    'the', 'of', 'and', 'to', 'for', 'with', 'our', 'this', 'shall', 'will',
    'services', 'be', 'are', 'from', 'that', 'their', 'its',
  ],
};

function contar(palabras: string[], marcadores: string[]): number {
  const set = new Set(marcadores);
  let total = 0;
  for (const p of palabras) if (set.has(p)) total++;
  return total;
}

export function detectarIdioma(texto: string): Idioma {
  const palabras = texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

  if (palabras.length === 0) return 'es';

  const es = contar(palabras, MARCADORES.es);
  const en = contar(palabras, MARCADORES.en);

  // Empate o texto sin señales claras: se asume español, que es el caso más
  // frecuente en las propuestas de BDO Chile.
  return en > es ? 'en' : 'es';
}
