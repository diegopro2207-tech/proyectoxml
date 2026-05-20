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
  const dets = collectDetalleTexts(detalles);

  const tipoDTE = toStr(idDoc.TipoDTE);
  const folioFactura = toStr(idDoc.Folio);
  // Folio-SAP: concat de TipoDTE-FolioFactura, ej: "33-100729".
  const folioSAP =
    tipoDTE && folioFactura ? `${tipoDTE}-${folioFactura}` : '';

  const raw: RawInvoiceData = {
    archivo: fileName,
    tipoDTE,
    folioFactura,
    folioSAP,
    fechaEmision: toStr(idDoc.FchEmis),
    rutEmisor: toStr(emisor.RUTEmisor),
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
  };

  return {
    raw,
    fuentes: {
      folioRef801: ref801.folioRef,
      razonRef801: ref801.razonRef,
      nmbItem: dets.nmbItem.join(' | '),
      dscItem: dets.dscItem.join(' | '),
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
  };
}
