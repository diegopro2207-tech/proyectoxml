// Regex patterns para detectar NFolio, VIN, propuestas y limpiar motivos.
// Centralizado aquí para facilitar mantenimiento y futura sustitución por IA.
//
// Notas de diseño:
// - Se PRESERVAN ceros a la izquierda en NFolio (ej: "0025979" no "25979"),
//   porque ese código es un identificador interno y los ceros son significativos.
// - El character class incluye � como fallback por si llega un XML con
//   encoding corrupto donde "°" se transformó en "�" (caracter de reemplazo).
//   La capa de lectura debería evitar esto, pero la regex tolerante es
//   defensa en profundidad.

export const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/g;

// Caracteres válidos después de "N" para indicar "Número": °, º, o, �.
const NUM_PREFIX_CHARS = '°ºo\\uFFFD';

// Keywords que sugieren una "propuesta administrativa".
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
  'CAMPAÑA',
  'CAMPANA',
];

// Patrones tipo "N° 12345", "Nº 12345", "NRO 12345", "No. 12345", "#12345".
// Capturan el número COMPLETO (con ceros a la izquierda).
export const NUMERO_PATTERNS: RegExp[] = [
  new RegExp(`N[${NUM_PREFIX_CHARS}]\\.?\\s*(\\d{3,10})`, 'i'),
  /\bNRO\.?\s*(\d{3,10})/i,
  /#\s*(\d{3,10})/,
];

// Patrones tipo "PROP 12345", "PROPUESTA 12345", "GARANTIA 12345", "OC 12345".
export const KEYWORD_NUMERO_PATTERNS: RegExp[] = [
  /\bPROPOSICION\s+(?:DE\s+\w+\s+)*\s*(\d{3,10})\b/i,
  /\bPROPUESTA\s+(\d{3,10})\b/i,
  /\bPROP\.?\s+(\d{3,10})\b/i,
  /\bCOTIZACION\s+(\d{3,10})\b/i,
  /\bGARANTIA\s+(\d{3,10})\b/i,
  /\bORDEN\s+DE\s+COMPRA\s+(\d{3,10})\b/i,
  /\bOC\.?\s+(\d{3,10})\b/i,
  /\bOT\.?\s+(\d{3,10})\b/i,
  /\bBONO\s+(\d{3,10})\b/i,
  /\bAPORTE\s+(\d{3,10})\b/i,
  /\bCAMPA(?:Ñ|N)A\s+(\d{3,10})\b/i,
];

// Patrones que deben ser eliminados de RazonRef para producir MotivoLimpio.
export const CLEANUP_PATTERNS: RegExp[] = [
  new RegExp(`N[${NUM_PREFIX_CHARS}]\\.?\\s*\\d{3,10}`, 'gi'),
  /\bNRO\.?\s*\d{3,10}/gi,
  /#\s*\d{3,10}/g,
  /\bFECHA\b[^.\n]*/gi,
  /\bFEC\.?\b[^.\n]*/gi,
];

// Indica si un texto luce como un placeholder/genérico sin número.
export function looksGeneric(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/\d{3,}/.test(trimmed)) return false;
  const upper = trimmed.toUpperCase();
  return PROPUESTA_KEYWORDS.some((kw) => upper.includes(kw));
}

// Detecta si un texto contiene alguna palabra de propuesta.
export function detectPropuestaKeyword(text: string): string {
  if (!text) return '';
  const upper = text.toUpperCase();
  for (const kw of PROPUESTA_KEYWORDS) {
    if (upper.includes(kw)) {
      // Devolver el texto hasta el "N°" (o N�/NRO/#) si existe.
      const splitRegex = new RegExp(
        `N[${NUM_PREFIX_CHARS}]\\.?|NRO\\.?|#`,
        'i'
      );
      const beforeNum = text.split(splitRegex)[0].trim();
      return beforeNum || kw;
    }
  }
  return '';
}

// Busca todos los candidatos a NFolio en un texto.
// Retorna lista de números preservando ceros a la izquierda.
export function findNFolioCandidates(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];

  const allPatterns = [...NUMERO_PATTERNS, ...KEYWORD_NUMERO_PATTERNS];
  for (const re of allPatterns) {
    const globalRe = new RegExp(
      re.source,
      re.flags.includes('g') ? re.flags : re.flags + 'g'
    );
    let m: RegExpExecArray | null;
    while ((m = globalRe.exec(text)) !== null) {
      if (m[1]) found.push(m[1]);
      // Protección contra loops si el regex matchea string vacío.
      if (m.index === globalRe.lastIndex) globalRe.lastIndex++;
    }
  }

  return Array.from(new Set(found));
}

// Limpia el motivo: elimina los patrones de número y de fecha.
export function cleanMotivo(text: string): string {
  if (!text) return '';
  let out = text;
  for (const re of CLEANUP_PATTERNS) {
    out = out.replace(re, ' ');
  }
  return out.replace(/\s{2,}/g, ' ').trim().replace(/[-,;:]+$/, '').trim();
}

// Extrae VIN de un texto si existe.
export function findVIN(text: string): string {
  if (!text) return '';
  const matches = text.match(VIN_REGEX);
  if (!matches) return '';
  // Filtrar falsos positivos: VIN no debería ser solo dígitos.
  const valid = matches.filter((v) => /[A-Z]/i.test(v) && /\d/.test(v));
  return valid[0] || '';
}

// Detecta si el texto contiene "CustomerCare", "Customer Care", "Care" o
// variantes. Usamos \b para evitar matchear "carecer", "carencia", etc.
const CUSTOMER_CARE_REGEX = /customer\s*-?\s*care|\bcare\b/i;

export function detectCustomerCare(text: string): boolean {
  if (!text) return false;
  return CUSTOMER_CARE_REGEX.test(text);
}
