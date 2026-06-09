import { XMLParser } from 'fast-xml-parser';
import type { RawInvoiceData } from '@/types/invoice';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
});

// ---------- Lectura de archivo con detección de encoding ----------

function normalizeEncoding(enc: string): string {
  const lower = enc.toLowerCase().trim().replace(/_/g, '-');
  const map: Record<string, string> = {
    latin1: 'iso-8859-1',
    'latin-1': 'iso-8859-1',
    'iso8859-1': 'iso-8859-1',
    'iso-8859-1': 'iso-8859-1',
    'utf-8': 'utf-8',
    utf8: 'utf-8',
    'windows-1252': 'windows-1252',
    cp1252: 'windows-1252',
  };
  return map[lower] || lower;
}

function detectXmlEncoding(bytes: Uint8Array): string {
  const head = new TextDecoder('ascii', { fatal: false }).decode(
    bytes.slice(0, 256)
  );
  const m = head.match(/encoding\s*=\s*["']([^"']+)["']/i);
  return m ? normalizeEncoding(m[1]) : 'utf-8';
}

export async function readXmlFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const encoding = detectXmlEncoding(bytes);
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

export function hasEncodingArtifacts(text: string): boolean {
  if (!text) return false;
  const count = (text.match(/�/g) || []).length;
  return count >= 3;
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function toStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function locateDocumento(parsed: any): any | null {
  if (!parsed || typeof parsed !== 'object') return null;

  if (parsed.DTE?.Documento) return parsed.DTE.Documento;
  if (parsed.Documento) return parsed.Documento;

  const envio = parsed.EnvioDTE ?? parsed.EnvioBOLETA;
  if (envio) {
    const setDTE = envio.SetDTE;
    if (setDTE) {
      const dtes = toArray<any>(setDTE.DTE);
      if (dtes.length && dtes[0].Documento) return dtes[0].Documento;
    }
    if (envio.DTE?.Documento) return envio.DTE.Documento;
  }

  const queue: any[] = [parsed];
  const seen = new Set<any>();
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (node.Documento && node.Documento.Encabezado) return node.Documento;
    for (const k of Object.keys(node)) {
      const v = (node as any)[k];
      if (v && typeof v === 'object') queue.push(v);
    }
  }
  return null;
}

// Extrae LA referencia 801 (Orden de Compra) si existe. Solo retorna la primera.
// Si hay más de una con TpoDocRef=801 (raro), tomamos la primera.
function findRef801(referencias: any[]): {
  folioRef: string;
  razonRef: string;
} {
  for (const ref of referencias) {
    const tipo = toStr(ref?.TpoDocRef);
    if (tipo === '801') {
      return {
        folioRef: toStr(ref?.FolioRef),
        razonRef: toStr(ref?.RazonRef),
      };
    }
  }
  return { folioRef: '', razonRef: '' };
}

// Recolecta TODO el texto útil de referencias cuyo TpoDocRef NO es 801.
// Incluye TpoDocRef, FolioRef y RazonRef de cada una. Útil cuando la factura
// referencia documentos tipo 1 (factura), 802 (HES), etc.
function collectRefsNo801(referencias: any[]): string {
  const parts: string[] = [];
  for (const ref of referencias) {
    const tipo = toStr(ref?.TpoDocRef);
    if (tipo === '801') continue;
    const folio = toStr(ref?.FolioRef);
    const razon = toStr(ref?.RazonRef);
    const piezas = [
      tipo ? `TpoDocRef=${tipo}` : '',
      folio ? `FolioRef=${folio}` : '',
      razon ? `RazonRef=${razon}` : '',
    ].filter(Boolean);
    if (piezas.length) parts.push(piezas.join(' '));
  }
  return parts.join(' | ');
}

// Primera referencia cuyo TpoDocRef NO es 801. Útil para Notas de Crédito
// (TipoDTE 61), donde apunta a la factura original (ej. TpoDocRef=33).
function firstRefNo801(referencias: any[]): {
  tipo: string;
  folio: string;
  razon: string;
} {
  for (const ref of referencias) {
    const tipo = toStr(ref?.TpoDocRef);
    if (tipo && tipo !== '801') {
      return {
        tipo,
        folio: toStr(ref?.FolioRef),
        razon: toStr(ref?.RazonRef),
      };
    }
  }
  return { tipo: '', folio: '', razon: '' };
}

// Elimina prefijos del tipo "AUTO@", "A@" del texto del ítem.
function stripSystemPrefix(text: string): string {
  return text.replace(/^[A-Za-z]{1,6}@/, '').trim();
}

function collectDetalleTexts(detalles: any[]): {
  nmbItem: string[];
  dscItem: string[];
  glosasPorItem: string;
  glosasFlat: string;
} {
  const nmbItem: string[] = [];
  const dscItem: string[] = [];
  const perItem: string[] = [];
  for (const det of detalles) {
    const n = stripSystemPrefix(toStr(det?.NmbItem));
    const d = stripSystemPrefix(toStr(det?.DscItem));
    if (n) nmbItem.push(n);
    if (d) dscItem.push(d);
    const combined = [n, d].filter(Boolean).join(' — ');
    if (combined) perItem.push(combined);
  }
  return {
    nmbItem,
    dscItem,
    glosasPorItem: perItem.join(' | '),
    glosasFlat: [...nmbItem, ...dscItem].join(' | '),
  };
}

export interface ParsedXmlPayload {
  raw: RawInvoiceData;
  // Textos por fuente que el analizador usa para detectar propuesta/provision/VIN/etc.
  fuentes: {
    // Solo de la referencia 801 (Orden de Compra).
    folioRef801: string;
    razonRef801: string;
    // Glosas de todos los detalles.
    nmbItem: string;
    dscItem: string;
    // Texto concatenado de las referencias que no son 801.
    referencias1: string;
    // RazonRef de la primera referencia no-801 (motivo de la NC en TipoDTE 61).
    razonRefNC: string;
  };
}

export function parseInvoiceXml(
  xmlContent: string,
  fileName: string
): ParsedXmlPayload {
  const parsed = parser.parse(xmlContent);
  const doc = locateDocumento(parsed);

  if (!doc) {
    return {
      raw: emptyRaw(fileName),
      fuentes: {
        folioRef801: '',
        razonRef801: '',
        nmbItem: '',
        dscItem: '',
        referencias1: '',
        razonRefNC: '',
      },
    };
  }

  const enc = doc.Encabezado ?? {};
  const idDoc = enc.IdDoc ?? {};
  const emisor = enc.Emisor ?? {};
  const receptor = enc.Receptor ?? {};
  const totales = enc.Totales ?? {};

  const referencias = toArray<any>(doc.Referencia);
  const detalles = toArray<any>(doc.Detalle);

  const ref801 = findRef801(referencias);
  const referencias1 = collectRefsNo801(referencias);
  const refNC = firstRefNo801(referencias);
  const dets = collectDetalleTexts(detalles);

  const tipoDTE = toStr(idDoc.TipoDTE);
  const folioFactura = toStr(idDoc.Folio);
  // Folio-SAP: concat de TipoDTE-FolioFactura, ej: "33-100729".
  const folioSAP =
    tipoDTE && folioFactura ? `${tipoDTE}-${folioFactura}` : '';

  // Factura De NC: "TpoDocRef-FolioRef" de la primera referencia no-801,
  // ej: "33-21626". Solo aplica a Notas de Crédito (TipoDTE 61).
  const facturaNC =
    tipoDTE === '61' && refNC.tipo && refNC.folio
      ? `${refNC.tipo}-${refNC.folio}`
      : '';

  const rutEmisor = toStr(emisor.RUTEmisor);
  // RUT+Folio: concat directo rutEmisor + folioFactura, ej: "96928530-41024136".
  const rutFolio =
    rutEmisor && folioFactura ? `${rutEmisor}${folioFactura}` : '';

  const raw: RawInvoiceData = {
    archivo: fileName,
    tipoDTE,
    folioFactura,
    folioSAP,
    fechaEmision: toStr(idDoc.FchEmis),
    rutEmisor,
    rutFolio,
    razonSocialEmisor: toStr(emisor.RznSoc ?? emisor.RznSocEmisor),
    rutReceptor: toStr(receptor.RUTRecep),
    razonSocialReceptor: toStr(receptor.RznSocRecep),
    montoExento: toNumber(totales.MntExe),
    montoNeto: toNumber(totales.MntNeto),
    iva: toNumber(totales.IVA),
    montoTotal: toNumber(totales.MntTotal),
    numeroOC: ref801.folioRef,
    motivoOriginal: ref801.razonRef,
    descripcionItemsOriginal: dets.glosasPorItem,
    facturaNC,
    referencias1,
  };

  return {
    raw,
    fuentes: {
      folioRef801: ref801.folioRef,
      razonRef801: ref801.razonRef,
      nmbItem: dets.nmbItem.join(' | '),
      dscItem: dets.dscItem.join(' | '),
      referencias1,
      razonRefNC: refNC.razon,
    },
  };
}

function emptyRaw(fileName: string): RawInvoiceData {
  return {
    archivo: fileName,
    tipoDTE: '',
    folioFactura: '',
    folioSAP: '',
    fechaEmision: '',
    rutEmisor: '',
    rutFolio: '',
    razonSocialEmisor: '',
    rutReceptor: '',
    razonSocialReceptor: '',
    montoExento: null,
    montoNeto: null,
    iva: null,
    montoTotal: null,
    numeroOC: '',
    motivoOriginal: '',
    descripcionItemsOriginal: '',
    facturaNC: '',
    referencias1: '',
  };
}
