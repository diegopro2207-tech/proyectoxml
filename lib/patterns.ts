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
// IMPORTANTE: preserva ° y º porque son significativos para los patrones de
// número (ej: "N° 26.620"). El bug anterior los borraba como "no-ASCII".
// También elimina prefijos del tipo "AUTO@", "A@" que usan algunos emisores.
export function normalizeForSearch(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')      // quitar diacríticos combinantes
    .replace(/�/g, '°')              // si quedó un � de mala decodificación, asumir que era °
    .toUpperCase()
    .replace(/[^\x00-\x7F°º]/g, ' ')      // quitar otros no-ASCII PERO preservar ° y º
    .replace(/^[A-Z]+@/gm, ' ')           // limpiar prefijos "AUTO@", "A@"
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

// "N°", "N-°", "N °", "Nº", "N o", "No.", "No ".
// Permitimos guion o espacio entre N y el siguiente char.
const N_PREFIX = `N[\\s\\-]?[${NUM_CHARS}]\\.?`;

// Capturan números como: 26.620 / 0025979 / 1.234.567
// El grupo capturado puede tener puntos; usar normalizeNFolio() después.
export const NUMERO_PATTERNS: RegExp[] = [
  // N° 26.620 / N-° 26.620 / Nº 26.620 / No. 26.620
  new RegExp(`${N_PREFIX}\\s*([\\d][\\d.]{1,14})`, 'i'),
  // NRO. 26.620 / NRO 26620
  /\bNRO\.?\s*([\d][\d.]{1,14})/i,
  // #26.620 / # 26620
  /#\s*([\d][\d.]{1,14})/,
];

// Patrones para folios ALFANUMÉRICOS.
//
// 1) Con marcador explícito tipo "N° FOLIO X".
// 2) Códigos "sueltos" con estructura típica de Stellantis/Peugeot:
//    [3-5 letras] + [4-8 dígitos] + [letra] + [3-6 dígitos] + [letra opcional]
//    Ejemplos reales: BVN100012P0326, CXCL000020P0226, PSCL000020P0226P,
//                     PSCL000007C0226P, CXCL000005P0226.
//    Esta estructura es lo bastante específica para no producir falsos
//    positivos en RUTs (12345678-K), montos (84687500), fechas, ni
//    palabras sueltas (STELLANTIS, MARZO 2026, etc.).
export const FOLIO_ALFANUM_PATTERNS: RegExp[] = [
  // "N° FOLIO BVN100012P0326", "N-° FOLIO BVN..."
  new RegExp(`${N_PREFIX}\\s*FOLIO\\s+([A-Z][A-Z0-9]{4,20})`, 'i'),
  // Código suelto con estructura LETRAS-DIGITOS-LETRA-DIGITOS-LETRA?.
  // Lookbehind no es seguro en todos los navegadores viejos, por eso usamos \b.
  /\b([A-Z]{3,5}\d{4,8}[A-Z]\d{3,6}[A-Z]?)\b/,
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
// El más específico (con FOLIO alfanumérico) va primero.
export const CLEANUP_PATTERNS: RegExp[] = [
  new RegExp(`${N_PREFIX}\\s*FOLIO\\s+[A-Z][A-Z0-9]{4,20}`, 'gi'),
  new RegExp(`${N_PREFIX}\\s*[\\d][\\d.]{1,14}`, 'gi'),
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

  // Probamos alfanuméricos PRIMERO porque son más específicos. Si captura
  // "N° FOLIO BVN..." → no queremos que el patrón numérico de N° intente
  // capturar el "FOLIO" como número (no lo haría, pero por orden semántico).
  const allPatterns = [
    ...FOLIO_ALFANUM_PATTERNS,
    ...NUMERO_PATTERNS,
    ...KEYWORD_NUMERO_PATTERNS,
  ];
  for (const re of allPatterns) {
    const globalRe = new RegExp(
      re.source,
      re.flags.includes('g') ? re.flags : re.flags + 'g'
    );
    let m: RegExpExecArray | null;
    while ((m = globalRe.exec(normalized)) !== null) {
      if (m[1]) {
        const clean = normalizeNFolio(m[1]);
        // Para folios numéricos: filtrar con menos de 3 dígitos.
        // Para alfanuméricos: la captura ya empieza con letra, pasa si tiene 3+ dígitos.
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

// Devuelve TODOS los VINs encontrados en el texto, deduplicados.
// Un VIN válido tiene letras Y dígitos (no solo dígitos, no solo letras).
export function findAllVINs(text: string): string[] {
  if (!text) return [];
  // Convertir a mayúsculas porque algunos emisores los escriben en minúsculas
  // (raro, pero por defensa).
  const upper = text.toUpperCase();
  const matches = upper.match(VIN_REGEX);
  if (!matches) return [];
  const valid = matches.filter((v) => /[A-Z]/.test(v) && /\d/.test(v));
  return Array.from(new Set(valid));
}

// Compat: mantiene la firma vieja por si algún caller la usa.
// Retorna el primer VIN o vacío.
export function findVIN(text: string): string {
  const all = findAllVINs(text);
  return all[0] || '';
}

// ─── CustomerCare ────────────────────────────────────────────────────────────

const CUSTOMER_CARE_REGEX = /customer\s*-?\s*care|\bcare\b/i;

export function detectCustomerCare(text: string): boolean {
  if (!text) return false;
  return CUSTOMER_CARE_REGEX.test(text);
}
