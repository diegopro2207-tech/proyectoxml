// Regex patterns para detectar NFolio, VIN, propuestas y limpiar motivos.
//
// Notas de diseño:
// - Se normalizan los textos antes de buscar (strip de acentos, mayúsculas).
//   Esto permite matchear "PROPOSICIÓN" y "PROPOSICION" con la misma regex.
// - Se soportan números con punto como separador de miles: "26.620" → "26620".
// - Los ceros a la izquierda se preservan.
// - El char ° (grado) y º (ordinal) se tratan igual.

export const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/g;

// ─── Normalización ───────────────────────────────────────────────────────────

// Quita acentos (NFD + strip combinators) y convierte a mayúsculas.
// También elimina prefijos del tipo "AUTO@", "A@" que usan algunos emisores.
// El resultado es ASCII plano, apto para regex simples.
export function normalizeForSearch(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar diacríticos (´ ` ~ ^ ¨)
    .replace(/[^\x00-\x7F]/g, ' ')  // reemplazar no-ASCII restantes (ej: Ñ→N ya hecho arriba, pero por si acaso)
    .toUpperCase()
    .replace(/^[A-Z]+@/gm, ' ')     // limpiar prefijos "AUTO@", "A@" al inicio de línea
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Normaliza un número capturado: quita puntos de separación de miles.
// "26.620" → "26620"   "1.234.567" → "1234567"   "0025979" → "0025979"
export function normalizeNFolio(raw: string): string {
  if (!raw) return '';
  // Quitar puntos que actúan como separadores de miles.
  // No tocamos ceros a la izquierda ni otros caracteres.
  return raw.replace(/\./g, '').trim();
}

// ─── Keywords ────────────────────────────────────────────────────────────────

export const PROPUESTA_KEYWORDS = [
  'PROPOSICION',
  'PROPUESTA',
  'PROP',
  'COTIZACION',
  'GARANTIA',
  'ORDEN DE COMPRA',
  'OC',
  'OT',
  'BONO',
  'APORTE',
  'CAMPANA',    // CAMPAÑA normalizada
  'FACTURA',    // para "PROPOSICION DE FACTURA"
];

// ─── Patrones de número ──────────────────────────────────────────────────────
// IMPORTANTE: estos patrones se aplican sobre texto YA NORMALIZADO.
// "°" y "º" sobreviven a normalizeForSearch (no son diacríticos combinados).
// El caracter de reemplazo � queda como defensa adicional.

const NUM_CHARS = '°ºo\\uFFFD';

// Capturan números como: 26.620 / 0025979 / 1.234.567
// El grupo capturado puede tener puntos; usar normalizeNFolio() después.
export const NUMERO_PATTERNS: RegExp[] = [
  // N° 26.620 / Nº 26.620 / No 26.620 / No. 26.620
  new RegExp(`N[${NUM_CHARS}]\\.?\\s*([\\d][\\d.]{1,14})`, 'i'),
  // NRO. 26.620 / NRO 26620
  /\bNRO\.?\s*([\d][\d.]{1,14})/i,
  // #26.620 / # 26620
  /#\s*([\d][\d.]{1,14})/,
];

export const KEYWORD_NUMERO_PATTERNS: RegExp[] = [
  /\bPROPOSICION\s+(?:DE\s+\w+\s+)*\s*([\d][\d.]{1,14})\b/i,
  /\bPROPUESTA\s+([\d][\d.]{1,14})\b/i,
  /\bPROP\.?\s+([\d][\d.]{1,14})\b/i,
  /\bCOTIZACION\s+([\d][\d.]{1,14})\b/i,
  /\bGARANTIA\s+([\d][\d.]{1,14})\b/i,
  /\bORDEN\s+DE\s+COMPRA\s+([\d][\d.]{1,14})\b/i,
  /\bOC\.?\s+([\d][\d.]{1,14})\b/i,
  /\bOT\.?\s+([\d][\d.]{1,14})\b/i,
  /\bBONO\s+([\d][\d.]{1,14})\b/i,
  /\bAPORTE\s+([\d][\d.]{1,14})\b/i,
  /\bCAMPANA\s+([\d][\d.]{1,14})\b/i,
];

// Patrones de limpieza para MotivoLimpio.
// También operan sobre texto normalizado.
export const CLEANUP_PATTERNS: RegExp[] = [
  new RegExp(`N[${NUM_CHARS}]\\.?\\s*[\\d][\\d.]{1,14}`, 'gi'),
  /\bNRO\.?\s*[\d][\d.]{1,14}/gi,
  /#\s*[\d][\d.]{1,14}/g,
  /\bFECHA\b[^.\n]*/gi,
  /\bFEC\.?\b[^.\n]*/gi,
];

// ─── Funciones de detección ──────────────────────────────────────────────────

export function looksGeneric(text: string): boolean {
  if (!text) return false;
  const trimmed = normalizeForSearch(text);
  if (!trimmed) return false;
  if (/\d{3,}/.test(trimmed)) return false;
  return PROPUESTA_KEYWORDS.some((kw) => trimmed.includes(kw));
}

export function detectPropuestaKeyword(text: string): string {
  if (!text) return '';
  const upper = normalizeForSearch(text);
  for (const kw of PROPUESTA_KEYWORDS) {
    if (upper.includes(kw)) {
      // Extraer texto original (con acentos) antes del primer N°/NRO/#
      const splitRegex = new RegExp(
        `N[${NUM_CHARS}]\\.?|NRO\\.?|#`,
        'i'
      );
      const beforeNum = text.split(splitRegex)[0].trim();
      // Limpiar "AUTO@" u otros prefijos de sistema antes de devolver.
      return beforeNum.replace(/^[A-Za-z]+@/, '').trim() || kw;
    }
  }
  return '';
}

export function findNFolioCandidates(text: string): string[] {
  if (!text) return [];
  // Normalizar para que "PROPOSICIÓN" → "PROPOSICION", "N°" queda igual.
  const normalized = normalizeForSearch(text);
  const found: string[] = [];

  const allPatterns = [...NUMERO_PATTERNS, ...KEYWORD_NUMERO_PATTERNS];
  for (const re of allPatterns) {
    const globalRe = new RegExp(
      re.source,
      re.flags.includes('g') ? re.flags : re.flags + 'g'
    );
    let m: RegExpExecArray | null;
    while ((m = globalRe.exec(normalized)) !== null) {
      if (m[1]) {
        const clean = normalizeNFolio(m[1]);
        // Filtrar capturas con menos de 3 dígitos (demasiado corto para ser NFolio).
        if (/\d{3,}/.test(clean)) found.push(clean);
      }
      if (m.index === globalRe.lastIndex) globalRe.lastIndex++;
    }
  }

  return Array.from(new Set(found));
}

export function cleanMotivo(text: string): string {
  if (!text) return '';
  // Limpiar prefijos de sistema antes de mostrar.
  let out = text.replace(/^[A-Za-z]+@/gm, '').trim();
  for (const re of CLEANUP_PATTERNS) {
    out = out.replace(re, ' ');
  }
  return out.replace(/\s{2,}/g, ' ').trim().replace(/[-,;:.]+$/, '').trim();
}

export function findVIN(text: string): string {
  if (!text) return '';
  const matches = text.match(VIN_REGEX);
  if (!matches) return '';
  const valid = matches.filter((v) => /[A-Z]/i.test(v) && /\d/.test(v));
  return valid[0] || '';
}

// ─── CustomerCare ────────────────────────────────────────────────────────────

const CUSTOMER_CARE_REGEX = /customer\s*-?\s*care|\bcare\b/i;

export function detectCustomerCare(text: string): boolean {
  if (!text) return false;
  return CUSTOMER_CARE_REGEX.test(text);
}
