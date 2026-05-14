export interface RawInvoiceData {
  archivo: string;
  tipoDTE: string;
  folioFactura: string;
  fechaEmision: string;
  rutEmisor: string;
  razonSocialEmisor: string;
  rutReceptor: string;
  razonSocialReceptor: string;
  montoNeto: number | null;
  iva: number | null;
  montoTotal: number | null;
  folioRefOriginal: string;
  motivoOriginal: string;
  descripcionItemsOriginal: string;
}

export interface AnalyzedInvoice extends RawInvoiceData {
  nFolioDetectado: string;
  motivoLimpio: string;
  propuestaDetectada: string;
  // Lista de TODOS los VIN detectados en el archivo, deduplicados.
  // Para display se concatenan como "VIN xxx | VIN yyy".
  vinDetectado: string[];
  customerCare: string; // "Sí" si se detecta CustomerCare/Care en glosas, "" si no.
  observacion: string;
  confianza: number;
}

export type DetectionSource =
  | 'RazonRef'
  | 'FolioRef'
  | 'NmbItem'
  | 'DscItem'
  | 'None';

export interface DetectionResult {
  nFolio: string;
  source: DetectionSource;
  propuesta: string;
  motivoLimpio: string;
  vins: string[];
  candidates: string[];
  folioRefLooksGeneric: boolean;
}
