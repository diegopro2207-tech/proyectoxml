import * as XLSX from 'xlsx';
import type { AnalyzedInvoice } from '@/types/invoice';
import { formatNumber } from './formatting';

// Convierte "yyyy-mm-dd" a Date. Si el string es inválido devuelve undefined.
function toDate(dateStr: string): Date | undefined {
  if (!dateStr || dateStr.length < 10) return undefined;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
}

interface ColumnDef {
  key: keyof AnalyzedInvoice;
  header: string;
  // Devuelve el valor de celda. Puede ser string, number, Date, etc.
  format?: (row: AnalyzedInvoice) => unknown;
  width?: number;
  // Si true, aplica formato de fecha "DD/MM/YYYY" a las celdas de esta columna.
  isDate?: boolean;
}

export const COLUMNS: ColumnDef[] = [
  { key: 'archivo', header: 'Archivo', width: 30 },
  { key: 'tipoDTE', header: 'TipoDTE' },
  { key: 'folioFactura', header: 'FolioFactura' },
  {
    key: 'fechaEmision',
    header: 'FechaEmision',
    format: (r) => toDate(r.fechaEmision),
    isDate: true,
    width: 16,
  },
  { key: 'rutEmisor', header: 'RUTEmisor' },
  { key: 'razonSocialEmisor', header: 'RazonSocialEmisor', width: 35 },
  { key: 'montoNeto', header: 'MontoNeto', format: (r) => r.montoNeto ?? '' },
  { key: 'iva', header: 'IVA', format: (r) => r.iva ?? '' },
  { key: 'montoTotal', header: 'MontoTotal', format: (r) => r.montoTotal ?? '' },
  { key: 'folioRefOriginal', header: 'Numero de OC', width: 30 },
  { key: 'motivoOriginal', header: 'MotivoOriginal', width: 50 },
  { key: 'descripcionItemsOriginal', header: 'Glosas Items', width: 60 },
  { key: 'nFolioDetectado', header: 'Codigo de Propuesta' },
  { key: 'motivoLimpio', header: 'MotivoLimpio', width: 40 },
  { key: 'propuestaDetectada', header: 'PropuestaDetectada', width: 30 },
  {
    key: 'vinDetectado',
    header: 'VIN',
    width: 25,
    // Si hay 1 o más VINs, devolver "VIN xxx | VIN yyy | ...".
    format: (r) =>
      r.vinDetectado.length > 0
        ? r.vinDetectado.map((v) => `VIN ${v}`).join(' | ')
        : '',
  },
  { key: 'customerCare', header: 'CustomerCare' },
  { key: 'observacion', header: 'Observacion', width: 40 },
  { key: 'confianza', header: 'Confianza' },
];

export function exportInvoicesToExcel(
  rows: AnalyzedInvoice[],
  fileName = 'facturas.xlsx'
): void {
  // Construir filas. Los valores de tipo Date se escriben directamente;
  // xlsx los convierte a número serial de Excel y con "z" le damos el formato.
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

  // Aplicar formato de fecha DD/MM/YYYY a todas las celdas de columnas isDate.
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  COLUMNS.forEach((col, colIdx) => {
    if (!col.isDate) return;
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const addr = XLSX.utils.encode_cell({ r: row, c: colIdx });
      if (ws[addr] && ws[addr].v instanceof Date) {
        ws[addr].t = 'd';           // tipo fecha
        ws[addr].z = 'DD/MM/YYYY'; // formato visual
      }
    }
  });

  // Anchos de columna.
  ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width ?? 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
  XLSX.writeFile(wb, fileName);
}
