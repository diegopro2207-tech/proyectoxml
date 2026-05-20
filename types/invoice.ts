export interface RawInvoiceData {
  archivo: string;
  tipoDTE: string;
  folioFactura: string;
  // Folio-SAP es la concatenación TipoDTE-FolioFactura, ej: "33-100729".
  folioSAP: string;
  fechaEmision: string;
  rutEmisor: string;
  razonSocialEmisor: string;
  rutReceptor: string;
  razonSocialReceptor: string;
  // MontoExento viene de <Totales><MntExe>. Orden de columnas: Exento, Neto, IVA, Total.
  montoExento: number | null;
  montoNeto: number | null;
  iva: number | null;
  montoTotal: number | null;
  // Numero de OC: solo el FolioRef de la referencia con TpoDocRef=801. Vacío si no existe.
  numeroOC: string;
  // MotivoOriginal: solo la RazonRef del 801. Vacío si no existe.
  motivoOriginal: string;
  // Glosas: NmbItem + DscItem de cada detalle, agrupadas.
  descripcionItemsOriginal: string;
}

export interface AnalyzedInvoice extends RawInvoiceData {
  // Codigo de Propuesta: número detectado solo cuando hay contexto PROPOSICION/PROPUESTA.
  // Se eliminan ceros a la izquierda.
  codigoPropuesta: string;
  // Codigo Provision: códigos alfanuméricos tipo BVN100012P0326, CXCL000020P0226.
  codigoProvision: string;
  // PropuestaDetectada: la frase keyword con contexto, ej: "PROPOSICION DE GARANTIA PEUGEOT".
  propuestaDetectada: string;
  // Lista de TODOS los VIN detectados, deduplicados. Display: "VIN xxx | VIN yyy".
  vinDetectado: string[];
  // "Sí" si se detecta CustomerCare con las reglas estrictas, "" si no.
  customerCare: string;
  // "Sí" si se detecta Reembolso / Flex Care / Mantención Flex Care.
  reembolso: string;
}

export type DetectionSource =
  | 'Ref801'
  | 'Glosas'
  | 'Motivo'
  | 'None';
