import type { AnalyzedInvoice } from '@/types/invoice';
import type { ParsedXmlPayload } from './xmlParser';
import {
  detectCustomerCare,
  detectPropuestaKeyword,
  detectReembolso,
  findAllVINs,
  findCodigoProvision,
  findPropuestaCode,
} from './patterns';

// Busca el Código de Propuesta en este orden:
//   1) RazonRef del 801 (motivo de la orden de compra).
//   2) Glosas (NmbItem + DscItem).
// Solo dispara cuando hay keyword PROPOSICION/PROPUESTA/PROP presente.
function detectCodigoPropuesta(fuentes: ParsedXmlPayload['fuentes']): string {
  // 1) Motivo del 801
  const fromMotivo = findPropuestaCode(fuentes.razonRef801);
  if (fromMotivo) return fromMotivo;

  // 2) Glosas (combinadas)
  const glosas = [fuentes.nmbItem, fuentes.dscItem].filter(Boolean).join(' | ');
  const fromGlosas = findPropuestaCode(glosas);
  if (fromGlosas) return fromGlosas;

  return '';
}

// Busca el Código de Provisión en glosas y motivo.
function detectCodigoProvision(fuentes: ParsedXmlPayload['fuentes']): string {
  const todoTexto = [
    fuentes.razonRef801,
    fuentes.nmbItem,
    fuentes.dscItem,
  ]
    .filter(Boolean)
    .join(' | ');
  return findCodigoProvision(todoTexto);
}

export function analyzeInvoice(payload: ParsedXmlPayload): AnalyzedInvoice {
  const codigoPropuesta = detectCodigoPropuesta(payload.fuentes);
  const codigoProvision = detectCodigoProvision(payload.fuentes);

  // Texto combinado para VIN, propuesta-keyword, customerCare y reembolso.
  const combined = [
    payload.fuentes.razonRef801,
    payload.fuentes.nmbItem,
    payload.fuentes.dscItem,
  ]
    .filter(Boolean)
    .join(' | ');

  const vins = findAllVINs(combined);

  const propuestaDetectada =
    detectPropuestaKeyword(payload.fuentes.razonRef801) ||
    detectPropuestaKeyword(payload.fuentes.nmbItem) ||
    detectPropuestaKeyword(payload.fuentes.dscItem) ||
    '';

  const customerCare = detectCustomerCare(combined) ? 'Sí' : '';
  const reembolso = detectReembolso(combined) ? 'Sí' : '';

  return {
    ...payload.raw,
    codigoPropuesta,
    codigoProvision,
    propuestaDetectada,
    vinDetectado: vins,
    customerCare,
    reembolso,
  };
}

// Punto de extensión para una futura capa de IA.
export async function refineWithAI(
  analyzed: AnalyzedInvoice,
  _payload: ParsedXmlPayload
): Promise<AnalyzedInvoice> {
  return analyzed;
}
