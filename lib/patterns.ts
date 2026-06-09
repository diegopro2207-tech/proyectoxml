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
// - PROPOSIC* y PROPUEST* cubren la palabra completa y errores de tipeo
//   frecuentes (PROPOSICIOIN, PROPOCISION, PROPUESTAS, etc.).
// - PROP suelto solo si va seguido de espacio/punto/°/#/guion o dígito
//   (evita capturar PROPIEDAD, PROPORCIONAL, etc.).
// - PF para el formato corto ("PF 26414" o "PF26414").
const PROPUESTA_PHRASE =
  `(?:PROPOSIC[A-Z]*|PROPOPOSIC[A-Z]*|PROPOSC[A-Z]*|PROPOSIS[A-Z]*|PREPOSIC[A-Z]*|PROPUEST[A-Z]*|PROP(?=[\\s.:#°º\\-]|\\d)|PF)`;

// Conector flexible entre la palabra clave y el número de propuesta.
// Permite letras, espacios, N°/N./Nº, dos puntos, #, guiones y el separador "|"
// (las glosas de NmbItem y DscItem se unen con " | ", y la keyword puede quedar
// en un campo y el número en el siguiente) — pero NO comas ni otros números
// (clase sin dígitos), para no saltar a un número distinto.
// Lazy ({0,40}?) para capturar el PRIMER número que aparece tras la keyword.
// Cubre: "DE FACTURA N 3002461", "DE LA FACTURA N. 3001058", "FACTURA N°3000871",
//        "DE FACTURA:3000816", "PROPOSICION | FACTURA N°26535", "PF26414".
const PROP_FILLER = `[A-Z\\s.:#°º|${'\\uFFFD'}\\-]{0,40}?`;

// Patrones para extraer el número de propuesta (siempre numérico).
// Aceptamos puntos como separadores de miles dentro del número.
const PROPUESTA_NUM_PATTERNS: RegExp[] = [
  // Patrón principal flexible: keyword + conector + número.
  new RegExp(`\\b${PROPUESTA_PHRASE}${PROP_FILLER}(\\d[\\d.]{2,14})\\b`, 'i'),
];

// Patrones para folio alfanumérico explícitamente marcado: "N° FOLIO X".
const FOLIO_MARCADO_PATTERN = new RegExp(
  `${N_PREFIX}\\s*FOLIO\\s+([A-Z][A-Z0-9]{4,20})`,
  'i'
);

// Un código de propuesta válido es NUMÉRICO y empieza con 2 o 3
// (tras eliminar ceros a la izquierda). Cualquier otro inicio se descarta.
function isValidPropuestaNumber(code: string): boolean {
  return /^[23]\d{2,}$/.test(code);
}

// "Operacion leasing <numero>" — el número adyacente ES el código de propuesta.
const LEASING_PATTERN = /\bOPERACION\s+LEASING\b[^\d]{0,25}?(\d[\d.]{2,14})\b/;

// Busca el código de propuesta en el texto.
// Retorna el valor numérico (ceros a la izquierda eliminados) o "".
export function findPropuestaCode(text: string): string {
  if (!text) return '';
  const normalized = normalizeForSearch(text);

  // 0) "Operacion leasing N° X": el número adyacente es el código (sin filtro 2/3).
  const leasing = normalized.match(LEASING_PATTERN);
  if (leasing && leasing[1]) {
    const c = normalizeNFolio(leasing[1]);
    if (/\d{3,}/.test(c)) return c;
  }

  // Si no hay indicio de propuesta en el texto, no detectamos nada.
  // (El patrón estricto de PROPUESTA_PHRASE hace el filtrado fino.)
  if (!/\bPROP/.test(normalized) && !/\bPREPOSIC/.test(normalized) && !/\bPF/.test(normalized)) return '';

  // 1) Marcador FOLIO alfanumérico (solo si resulta ser numérico 2/3 válido).
  const marcado = normalized.match(FOLIO_MARCADO_PATTERN);
  if (marcado && marcado[1]) {
    const c = normalizeNFolio(marcado[1]);
    if (isValidPropuestaNumber(c)) return c;
  }

  // 2) Número después de "PROPOSICION/PROPUESTA". Debe empezar con 2 o 3.
  for (const re of PROPUESTA_NUM_PATTERNS) {
    const m = normalized.match(re);
    if (m && m[1]) {
      const cleaned = normalizeNFolio(m[1]);
      if (isValidPropuestaNumber(cleaned)) return cleaned;
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

// Códigos con prefijo conocido de provisión: ABF, ABM, BVN, CXC/CXCL, PSC/PSCL,
// PAC. Captura el prefijo + dígitos + resto alfanumérico, SIN exigir una letra
// intermedia. Así cubre variantes que el patrón clásico (que exige letra en el
// medio) no toma:
//   - PAC100034FQ126        (dos letras intermedias)
//   - CXCL07000010326F      (sin letra intermedia, solo letra final)
//   - PSCL07000510226F
// y también las clásicas: BVN100012P0326, CXCL000020P0226, ABM100060R0126.
const CODIGO_PROVISION_PREFIX_REGEX =
  /\b((?:ABF|ABM|BVN|CXCL|CXC|PSCL|PSC|PAC)\d{4,}[A-Z0-9]{1,12})\b/;

// Variante para códigos que TERMINAN en BVN (o cuyo segmento BVN aparece al final
// con dígitos detrás), p.ej. "100012P0326BVN", "20P0226BVN". Cuentan como provisión.
const CODIGO_PROVISION_BVN_END_REGEX =
  /\b([A-Z]{0,5}\d{4,10}[A-Z]\d{2,8}BVN[A-Z0-9]*)\b/;

// Variante general: cualquier token alfanumérico que contenga "BVN" rodeado por
// dígitos suficientes para parecer un código de provisión.
const CODIGO_PROVISION_BVN_ANY_REGEX = /\b([A-Z0-9]*\d{3,}[A-Z0-9]*BVN[A-Z0-9]*)\b/;

export function findCodigoProvision(text: string): string {
  if (!text) return '';
  const normalized = normalizeForSearch(text);

  // 0) Prefijo conocido (ABF, ABM, BVN, CXC/CXCL, PSC/PSCL, PAC). Toma también
  //    los códigos sin letra intermedia (CXCL…F) que el clásico no captura.
  const mPref = normalized.match(CODIGO_PROVISION_PREFIX_REGEX);
  if (mPref) return mPref[1];

  // 1) Patrón clásico (cualquier prefijo de 3-5 letras con estructura completa).
  const m = normalized.match(CODIGO_PROVISION_REGEX);
  if (m) return m[1];

  // 2) Códigos que terminan en BVN con estructura compatible.
  const mEnd = normalized.match(CODIGO_PROVISION_BVN_END_REGEX);
  if (mEnd) return mEnd[1];

  // 3) Fallback: cualquier token con BVN + dígitos suficientes.
  const mAny = normalized.match(CODIGO_PROVISION_BVN_ANY_REGEX);
  if (mAny) return mAny[1];

  return '';
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

// ─── Concepto (clasificación por glosa) ──────────────────────────────────────
// Devuelve la categoría de Concepto basándose SOLO en el texto de la glosa.
// Las reglas que dependen de otras columnas (CustomerCare, Reembolso,
// Codigo de Propuesta) se aplican en el analizador, con mayor prioridad.

// Marcas de vehículo: una bonificación de marca cuenta como "BONIFICACION VN".
const MARCA_REGEX =
  /\b(OPEL|PEUGEOT|CITROEN|JEEP|RAM|FIAT|LEAP\s?MOTOR|DS)\b/;

export function detectConceptoFromGlosa(text: string): string {
  if (!text) return '';
  const t = normalizeForSearch(text);

  // Hay contexto de "bono" si aparece BONO, BONOS, BONIFICACION o BONIFICACIONES.
  const hasBono = /\bBONOS?\b/.test(t) || /\bBONIFICAC/.test(t);

  // 1) "Bono(s)/Bonificación (de) marca" literal → APORTE BONO MARCA.
  //    Gana incluso si trae código BVN
  //    (ej. "BONO MARCA STELLANTIS - OC 100060FI202601BVN").
  if (/\b(?:BONOS?|BONIFICAC[A-Z]*)\s+(?:DE\s+)?MARCA\b/.test(t)) {
    return 'APORTE BONO MARCA';
  }

  // 2) "Aporte PAC" → APORTE PAC
  if (/\bAPORTE\s+PAC\b/.test(t)) return 'APORTE PAC';

  // El resto aplica tanto a "BONIFICACION..." como a "BONO/BONOS..." (equivalentes).
  if (hasBono) {
    // 3) Calidad — incluye "meta de calidad".
    if (/\bCALIDAD\b/.test(t)) return 'BONIFICACION CALIDAD';

    // 4) Financiamiento ("financiamiento" / "de financiamiento"). Gana sobre
    //    marca/VN: "Bonos de Financiamiento VN Ram" → FINANCIAMIENTO.
    if (/\bFINANCIAM/.test(t)) return 'BONIFICACION FINANCIAMIENTO';

    // 5) Comercial / P&S / cumplimiento de objetivos.
    if (
      /\bCOMERCIAL\b/.test(t) ||
      /P\s*&\s*S/.test(t) ||
      /CUMPLIMIENTO\s+DE\s+OBJETIVOS/.test(t)
    ) {
      return 'BONIFICACION COMERCIAL';
    }

    // 6) "Bono TMP" / "Bonos TMP" → APORTE BONO MARCA.
    if (/\bTMP\b/.test(t)) return 'APORTE BONO MARCA';

    // 7) "VN" literal → BONIFICACION VN. Gana sobre la marca cuando no hay BVN
    //    (ej. "Bonificación VN Fiat" → BONIFICACION VN).
    if (/\bVN\b/.test(t)) return 'BONIFICACION VN';

    // 8) Marca de vehículo (Opel, Peugeot, Citroën, Jeep, Ram, Fiat,
    //    Leap Motor, DS):
    //      - con código BVN  → BONIFICACION VN
    //      - sin código BVN  → APORTE BONO MARCA
    if (MARCA_REGEX.test(t)) {
      return /BVN/.test(t) ? 'BONIFICACION VN' : 'APORTE BONO MARCA';
    }

    // 9) Código BVN sin marca ni "VN" → BONIFICACION VN.
    if (/BVN/.test(t)) return 'BONIFICACION VN';
  }

  return '';
}
