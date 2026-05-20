// Regex y heurísticas para detectar propuesta, provisión, VIN, CustomerCare, reembolso.
//
// Notas de diseño:
// - Texto normalizado: NFD + strip diacríticos + uppercase + preserva ° y º.
// - Propuesta: SOLO si hay keyword PROPOSICION/PROPUESTA/PROP en el texto.
//   Sin ese keyword no detectamos nada (evita capturar OT 105 como propuesta).
// - Provision: códigos alfanuméricos con estructura específica (BVN, CXCL, etc.).
// - Ceros a la izquierda se ELIMINAN del número de propuesta.

export const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/g;

// ─── Normalización ───────────────────────────────────────────────────────────

export function normalizeForSearch(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/�/g, '°')
    .toUpperCase()
    .replace(/[^\x00-\x7F°º]/g, ' ')
    .replace(/^[A-Z]+@/gm, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Quita puntos como separador de miles Y ceros a la izquierda.
// "26.620" → "26620"   "1.234.567" → "1234567"   "0025979" → "25979"
export function normalizeNFolio(raw: string): string {
  if (!raw) return '';
  const stripped = raw.replace(/\./g, '').replace(/^0+/, '');
  return stripped || '0'; // si era todo ceros, devolver "0"
}

// ─── Detección de propuesta (numérica) ───────────────────────────────────────
// Solo dispara cuando el texto contiene un keyword de propuesta + número.
// No captura OT, OC, BONO, etc. — esos no son propuestas.

const NUM_CHARS = '°ºo\\uFFFD';
const N_PREFIX = `N[\\s\\-]?(?:[${NUM_CHARS}]\\.?|\\.)`;

// Frases que indican que el número siguiente es una propuesta.
const PROPUESTA_PHRASE = '(?:PROPOSICION|PROPUESTA|PROP)';

// Patrones para extraer el número de propuesta (siempre numérico).
// Aceptamos puntos como separadores de miles dentro del número.
const PROPUESTA_NUM_PATTERNS: RegExp[] = [
  // "PROPOSICION N° 26414", "PROPUESTA N. 3001155", "PROP Nº 12345"
  new RegExp(
    `\\b${PROPUESTA_PHRASE}\\.?\\s+(?:DE\\s+\\w+\\s+)?(?:${N_PREFIX}\\s*)?([\\d][\\d.]{1,14})\\b`,
    'i'
  ),
  // "SEGUN PROPOSICION N° 26414" — variante con conector
  new RegExp(
    `\\bSEGUN\\s+${PROPUESTA_PHRASE}\\.?\\s+(?:${N_PREFIX}\\s*)?([\\d][\\d.]{1,14})\\b`,
    'i'
  ),
];

// Patrones para folio alfanumérico explícitamente marcado: "N° FOLIO X".
const FOLIO_MARCADO_PATTERN = new RegExp(
  `${N_PREFIX}\\s*FOLIO\\s+([A-Z][A-Z0-9]{4,20})`,
  'i'
);

// Busca el código de propuesta en el texto.
// Retorna el valor (numérico con ceros eliminados, o alfanumérico) o "".
export function findPropuestaCode(text: string): string {
  if (!text) return '';
  const normalized = normalizeForSearch(text);

  // Si no hay keyword de propuesta en el texto, no detectamos nada.
  if (!/\b(PROPOSICION|PROPUESTA|PROP)\b/.test(normalized)) return '';

  // 1) Intentar capturar con marcador FOLIO alfanumérico cercano.
  const marcado = normalized.match(FOLIO_MARCADO_PATTERN);
  if (marcado && marcado[1]) return marcado[1];

  // 2) Intentar capturar número después de "PROPOSICION/PROPUESTA".
  for (const re of PROPUESTA_NUM_PATTERNS) {
    const m = normalized.match(re);
    if (m && m[1]) {
      const cleaned = normalizeNFolio(m[1]);
      if (/\d{3,}/.test(cleaned)) return cleaned;
    }
  }

  return '';
}

// ─── Detección de Código de Provisión ────────────────────────────────────────
// Códigos alfanuméricos tipo BVN100012P0326, CXCL000020P0226, PSCL000020P0226P.
// Estructura: [3-5 letras][4-8 dígitos][letra][3-6 dígitos][letra opcional].
// Lista de prefijos conocidos: ABF, ABM, BVN, CXC/CXCL, PAC, PSCL (no exhaustiva).
// El regex captura cualquier código con esa estructura, lo que cubre la lista
// de prefijos y prefijos similares no enumerados.

const CODIGO_PROVISION_REGEX = /\b([A-Z]{3,5}\d{4,8}[A-Z]\d{3,6}[A-Z]?)\b/;

export function findCodigoProvision(text: string): string {
  if (!text) return '';
  const normalized = normalizeForSearch(text);
  const m = normalized.match(CODIGO_PROVISION_REGEX);
  return m ? m[1] : '';
}

// ─── Detección de "PropuestaDetectada" (frase keyword) ───────────────────────

const PROPUESTA_KEYWORDS = [
  'PROPOSICION',
  'PROPUESTA',
  'PROP',
  'COTIZACION',
  'GARANTIA',
  'BONIFICACION',
  'CAMPANA',
];

export function detectPropuestaKeyword(text: string): string {
  if (!text) return '';
  const upper = normalizeForSearch(text);
  for (const kw of PROPUESTA_KEYWORDS) {
    if (upper.includes(kw)) {
      // Devolver el texto original antes del marcador N°/N./NRO/#.
      const splitRegex = new RegExp(
        `N[\\s\\-]?(?:[${NUM_CHARS}]\\.?|\\.)|NRO\\.?|#`,
        'i'
      );
      const beforeNum = text.split(splitRegex)[0].trim();
      return beforeNum.replace(/^[A-Za-z]+@/, '').trim() || kw;
    }
  }
  return '';
}

// ─── VIN ─────────────────────────────────────────────────────────────────────

export function findAllVINs(text: string): string[] {
  if (!text) return [];
  const upper = text.toUpperCase();
  const matches = upper.match(VIN_REGEX);
  if (!matches) return [];
  const valid = matches.filter((v) => /[A-Z]/.test(v) && /\d/.test(v));
  return Array.from(new Set(valid));
}

// ─── CustomerCare (reglas estrictas) ─────────────────────────────────────────
// Marca "Sí" si:
//   1. Aparece "Customer Care" o "CustomerCare" juntos (con o sin espacio/guion).
//   2. Aparece "Care" junto a un "N° de caso" o "N de algo" + número.
// NO marca si solo aparece "Care" o "Flex Care" sin esos contextos.

export function detectCustomerCare(text: string): boolean {
  if (!text) return false;

  // 1) "Customer Care" o "CustomerCare" (con espacios/guiones opcionales).
  if (/customer\s*-?\s*care/i.test(text)) return true;

  // 2) "Care" en el texto Y un marcador "N° X" (N de caso, N de algo) cerca.
  //    Para evitar falsos positivos, requerimos que tanto "Care" como el
  //    marcador "N° número" aparezcan en el mismo texto.
  if (/\bcare\b/i.test(text)) {
    const hasNumeroMarker = /N\s*[°ºo.]\s*\d{3,}|N[°ºo]\s*\d{3,}|N\.\s*\d{3,}/i.test(text);
    if (hasNumeroMarker) return true;
  }

  return false;
}

// ─── Reembolso ───────────────────────────────────────────────────────────────
// Marca "Sí" si aparece: reembolso, reem mant, flex care, mant flex care, o variantes.

export function detectReembolso(text: string): boolean {
  if (!text) return false;
  return /reembolso|\breem\s*\.?\s*mant|\bflex\s*-?\s*care|\bmant\s+flex/i.test(text);
}
