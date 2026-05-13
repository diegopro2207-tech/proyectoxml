import * as XLSX from 'xlsx';
import type { AnalyzedInvoice } from '@/types/invoice';

// Definición de columnas del Excel.
// `header` es el título visible. `format` permite transformar el valor antes
// de exportarlo (por ejemplo: prefijar "VIN " al código detectado).
interface ColumnDef {
  key: keyof AnalyzedInvoice;
  header: string;
  format?: (row: AnalyzedInvoice) => unknown;
  width?: number;
}

export const COLUMNS: ColumnDef[] = [
  { key: 'archivo', header: 'Archivo', width: 30 },
  { key: 'tipoDTE', header: 'TipoDTE' },
  { key: 'folioFactura', header: 'FolioFactura' },
  { key: 'fechaEmision', header: 'FechaEmision' },
  { key: 'rutEmisor', header: 'RUTEmisor' },
  { key: 'razonSocialEmisor', header: 'RazonSocialEmisor', width: 35 },
  { key: 'montoNeto', header: 'MontoNeto' },
  { key: 'iva', header: 'IVA' },
  { key: 'montoTotal', header: 'MontoTotal' },
  { key: 'folioRefOriginal', header: 'Numero de OC', width: 30 },
  { key: 'motivoOriginal', header: 'MotivoOriginal', width: 50 },
  { key: 'descripcionItemsOriginal', header: 'Glosas Items', width: 60 },
  { key: 'nFolioDetectado', header: 'Codigo de Propuesta' },
  { key: 'motivoLimpio', header: 'MotivoLimpio', width: 40 },
  { key: 'propuestaDetectada', header: 'PropuestaDetectada', width: 30 },
  {
    key: 'vinDetectado',
    header: 'VIN',
    format: (r) => (r.vinDetectado ? `VIN ${r.vinDetectado}` : ''),
  },
  { key: 'customerCare', header: 'CustomerCare' },
  { key: 'observacion', header: 'Observacion', width: 40 },
  { key: 'confianza', header: 'Confianza' },
];

export function exportInvoicesToExcel(
  rows: AnalyzedInvoice[],
  fileName = 'facturas.xlsx'
): void {
  const data = rows.map((r) => {
    const obj: Record<string, unknown> = {};
    for (const c of COLUMNS) {
      obj[c.header] = c.format ? c.format(r) : r[c.key] ?? '';
    }
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(data, {
    header: COLUMNS.map((c) => c.header),
  });

  ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width ?? 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
  XLSX.writeFile(wb, fileName);
}
