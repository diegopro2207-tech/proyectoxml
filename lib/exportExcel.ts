import * as XLSX from 'xlsx';
import type { AnalyzedInvoice } from '@/types/invoice';

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
  format?: (row: AnalyzedInvoice) => unknown;
  width?: number;
  isDate?: boolean;
}

// Orden de columnas:
// 1) Identificación
// 2) Fecha y emisor
// 3) Montos (Exento, Neto, IVA, Total)
// 4) Numero de OC y Motivo (de la referencia 801)
// 5) Glosas
// 6) Detecciones: Codigo de Propuesta, Codigo Provision, PropuestaDetectada, VIN
// 7) Flags: CustomerCare, Reembolso
export const COLUMNS: ColumnDef[] = [
  { key: 'archivo', header: 'Archivo', width: 30 },
  { key: 'tipoDTE', header: 'TipoDTE' },
  { key: 'folioFactura', header: 'FolioFactura' },
  { key: 'folioSAP', header: 'Folio-SAP', width: 16 },
  {
    key: 'fechaEmision',
    header: 'FechaEmision',
    format: (r) => toDate(r.fechaEmision),
    isDate: true,
    width: 16,
  },
  { key: 'rutEmisor', header: 'RUTEmisor' },
  { key: 'razonSocialEmisor', header: 'RazonSocialEmisor', width: 35 },
  {
    key: 'montoExento',
    header: 'MontoExento',
    format: (r) => r.montoExento ?? '',
  },
  { key: 'montoNeto', header: 'MontoNeto', format: (r) => r.montoNeto ?? '' },
  { key: 'iva', header: 'IVA', format: (r) => r.iva ?? '' },
  { key: 'montoTotal', header: 'MontoTotal', format: (r) => r.montoTotal ?? '' },
  { key: 'numeroOC', header: 'Numero de OC', width: 18 },
  { key: 'motivoOriginal', header: 'MotivoOriginal', width: 50 },
  { key: 'descripcionItemsOriginal', header: 'Glosas Items', width: 60 },
  { key: 'codigoPropuesta', header: 'Codigo de Propuesta', width: 18 },
  { key: 'codigoProvision', header: 'Codigo Provision', width: 22 },
  { key: 'propuestaDetectada', header: 'PropuestaDetectada', width: 35 },
  {
    key: 'vinDetectado',
    header: 'VIN',
    width: 25,
    format: (r) =>
      r.vinDetectado.length > 0
        ? r.vinDetectado.map((v) => `VIN ${v}`).join(' | ')
        : '',
  },
  { key: 'customerCare', header: 'CustomerCare' },
  { key: 'reembolso', header: 'Reembolso' },
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

  // Aplicar formato de fecha DD/MM/YYYY a celdas de columnas isDate.
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  COLUMNS.forEach((col, colIdx) => {
    if (!col.isDate) return;
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const addr = XLSX.utils.encode_cell({ r: row, c: colIdx });
      if (ws[addr] && ws[addr].v instanceof Date) {
        ws[addr].t = 'd';
        ws[addr].z = 'DD/MM/YYYY';
      }
    }
  });

  ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width ?? 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
  XLSX.writeFile(wb, fileName);
}
