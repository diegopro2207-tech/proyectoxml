import type {
  AnalyzedInvoice,
  DetectionResult,
  DetectionSource,
} from '@/types/invoice';
import type { ParsedXmlPayload } from './xmlParser';
import { hasEncodingArtifacts } from './xmlParser';
import {
  cleanMotivo,
  detectCustomerCare,
  detectPropuestaKeyword,
  findAllVINs,
  findNFolioCandidates,
  looksGeneric,
} from './patterns';

// Orden de prioridad para buscar NFolio.
const PRIORITY: DetectionSource[] = ['RazonRef', 'FolioRef', 'NmbItem', 'DscItem'];

function pickSourceText(
  fuentes: ParsedXmlPayload['fuentes'],
  src: DetectionSource
): string {
  switch (src) {
    case 'RazonRef':
      return fuentes.razonRef;
    case 'FolioRef':
      return fuentes.folioRef;
    case 'NmbItem':
      return fuentes.nmbItem;
    case 'DscItem':
      return fuentes.dscItem;
    default:
      return '';
  }
}

// Compara dos identificadores ignorando ceros a la izquierda y espacios.
function sameNumber(a: string, b: string): boolean {
  if (!a || !b) return false;
  const norm = (x: string) => x.replace(/\s+/g, '').replace(/^0+/, '');
  return norm(a) === norm(b);
}

export function detectFromSources(
  fuentes: ParsedXmlPayload['fuentes'],
  folioFactura: string
): DetectionResult {
  const allCandidates: string[] = [];
  let chosen = '';
  let chosenSource: DetectionSource = 'None';

  for (const src of PRIORITY) {
    const txt = pickSourceText(fuentes, src);
    const cands = findNFolioCandidates(txt).filter(
      // Descartar candidatos que sean el mismo número que el folio de la factura.
      (c) => !sameNumber(c, folioFactura)
    );
    if (cands.length && !chosen) {
      chosen = cands[0];
      chosenSource = src;
    }
    allCandidates.push(...cands);
  }

  // Texto combinado para VIN y propuesta.
  const combined = [
    fuentes.razonRef,
    fuentes.folioRef,
    fuentes.nmbItem,
    fuentes.dscItem,
  ]
    .filter(Boolean)
    .join(' | ');

  const vins = findAllVINs(combined);

  // MotivoLimpio: priorizar RazonRef como base; si está vacío, usar FolioRef.
  const motivoBase = fuentes.razonRef || fuentes.folioRef || '';
  const motivoLimpio = cleanMotivo(motivoBase);

  // Propuesta detectada.
  const propuesta =
    detectPropuestaKeyword(motivoLimpio) ||
    detectPropuestaKeyword(fuentes.razonRef) ||
    detectPropuestaKeyword(fuentes.folioRef) ||
    detectPropuestaKeyword(fuentes.nmbItem) ||
    detectPropuestaKeyword(fuentes.dscItem) ||
    '';

  const folioRefLooksGeneric =
    !!fuentes.folioRef && looksGeneric(fuentes.folioRef);

  return {
    nFolio: chosen,
    source: chosenSource,
    propuesta,
    motivoLimpio,
    vins,
    candidates: Array.from(new Set(allCandidates)),
    folioRefLooksGeneric,
  };
}

function buildObservacion(
  det: DetectionResult,
  fuentes: ParsedXmlPayload['fuentes'],
  encodingSospechoso: boolean
): string {
  const obs: string[] = [];

  if (encodingSospechoso) {
    obs.push('Encoding sospechoso (revisar acentos/símbolos)');
  }

  if (det.candidates.length > 1) {
    obs.push('Revisar manualmente');
  }

  if (det.nFolio) {
    if (det.source === 'RazonRef') obs.push('NFolio detectado en motivo');
    else if (det.source === 'NmbItem' || det.source === 'DscItem')
      obs.push('NFolio detectado en descripción de ítem');
  } else {
    obs.push('NFolio no detectado');
  }

  if (det.vins.length > 0) {
    obs.push(
      det.vins.length === 1
        ? 'VIN detectado en descripción'
        : `${det.vins.length} VINs detectados en descripción`
    );
  }

  if (det.folioRefLooksGeneric && det.source !== 'FolioRef') {
    obs.push('FolioRef parece incompleto o genérico');
  }

  if (!obs.length) obs.push('Correcto');

  return obs.join(' | ');
}

function computeConfianza(
  det: DetectionResult,
  fuentes: ParsedXmlPayload['fuentes'],
  encodingSospechoso: boolean
): number {
  let score = 0.5;

  if (det.nFolio) {
    if (det.source === 'FolioRef' && /^\d+$/.test(fuentes.folioRef.trim())) {
      score = 0.98;
    } else if (det.source === 'RazonRef') {
      score = 0.85;
    } else if (det.source === 'FolioRef') {
      score = 0.8;
    } else {
      score = 0.65;
    }
  } else {
    score = 0.2;
  }

  if (det.candidates.length > 1) score -= 0.2;
  if (det.folioRefLooksGeneric && det.source !== 'FolioRef') score -= 0.05;
  if (encodingSospechoso) score -= 0.1;
  if (det.vins.length > 0) score += 0.02;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

export function analyzeInvoice(payload: ParsedXmlPayload): AnalyzedInvoice {
  const encodingSospechoso =
    hasEncodingArtifacts(payload.fuentes.razonRef) ||
    hasEncodingArtifacts(payload.fuentes.folioRef) ||
    hasEncodingArtifacts(payload.fuentes.nmbItem) ||
    hasEncodingArtifacts(payload.fuentes.dscItem);

  const det = detectFromSources(payload.fuentes, payload.raw.folioFactura);
  const observacion = buildObservacion(det, payload.fuentes, encodingSospechoso);
  const confianza = computeConfianza(det, payload.fuentes, encodingSospechoso);

  // Buscar CustomerCare en TODAS las glosas (NmbItem + DscItem).
  const glosasParaBuscar = [
    payload.fuentes.nmbItem,
    payload.fuentes.dscItem,
  ]
    .filter(Boolean)
    .join(' | ');
  const customerCare = detectCustomerCare(glosasParaBuscar) ? 'Sí' : '';

  return {
    ...payload.raw,
    nFolioDetectado: det.nFolio,
    motivoLimpio: det.motivoLimpio,
    propuestaDetectada: det.propuesta,
    vinDetectado: det.vins,
    customerCare,
    observacion,
    confianza,
  };
}

// Punto de extensión para una futura capa de IA.
export async function refineWithAI(
  analyzed: AnalyzedInvoice,
  _payload: ParsedXmlPayload
): Promise<AnalyzedInvoice> {
  return analyzed;
}
