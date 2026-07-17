// xlsx-js-style = SheetJS + soporte de estilos de celda (wrapText, etc.),
// necesario para que Excel muestre los saltos de línea (Alt+Enter) en la glosa.
import * as XLSX from 'xlsx-js-style';
import type { AnalyzedInvoice } from '@/types/invoice';

// Convierte "yyyy-mm-dd" a Date. Si el string es inválido devuelve undefined.
function toDate(dateStr: string): Date | undefined {
  if (!dateStr || dateStr.length < 10) return undefined;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
}

// Corta el texto en líneas de máximo `width` caracteres, sin partir palabras
// (una palabra más larga que `width` se parte a la fuerza). Las líneas se unen
// con "\n", que en Excel equivale a Alt+Enter dentro de la celda.
export function wrapTextAt(text: string, width = 65): string {
  if (!text) return '';
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (let word of words) {
    if (line && line.length + 1 + word.length <= width) {
      line += ' ' + word;
      continue;
    }
    if (line) lines.push(line);
    // Palabra más larga que el ancho → cortar en trozos duros.
    while (word.length > width) {
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    line = word;
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

interface ColumnDef {
  key: keyof AnalyzedInvoice;
  header: string;
  format?: (row: AnalyzedInvoice) => unknown;
  width?: number;
  isDate?: boolean;
  // Celdas con saltos de línea internos + estilo "ajustar texto".
  wrap?: boolean;
}

// Orden de columnas del Excel (definido por el usuario). Se excluyen
// MotivoOriginal y PropuestaDetectada.
export const COLUMNS: ColumnDef[] = [
  { key: 'archivo', header: 'Archivo', width: 30 },
  { key: 'tipoDTE', header: 'TipoDTE' },
  { key: 'rutEmisor', header: 'RUTEmisor' },
  { key: 'razonSocialEmisor', header: 'RazonSocialEmisor', width: 35 },
  { key: 'folioFactura', header: 'Folio' },
  {
    key: 'fechaEmision',
    header: 'FechaEmision',
    format: (r) => toDate(r.fechaEmision),
    isDate: true,
    width: 16,
  },
  {
    key: 'montoExento',
    header: 'Monto Exento',
    format: (r) => r.montoExento ?? '',
  },
  { key: 'montoNeto', header: 'Monto Neto', format: (r) => r.montoNeto ?? '' },
  {
    key: 'iva',
    header: 'Monto IVA Recuperable',
    format: (r) => r.iva ?? '',
    width: 20,
  },
  {
    key: 'montoTotal',
    header: 'Monto Total',
    format: (r) => r.montoTotal ?? '',
  },
  { key: 'folioSAP', header: 'Folio-SAP', width: 16 },
  { key: 'rutFolio', header: 'RUT+Folio', width: 22 },
  {
    key: 'descripcionItemsOriginal',
    header: 'Glosas Items',
    width: 66,
    wrap: true,
    format: (r) => wrapTextAt(r.descripcionItemsOriginal, 65),
  },
  { key: 'numeroOC', header: 'Numero de OC', width: 18 },
  { key: 'concepto', header: 'Concepto', width: 32 },
  { key: 'customerCare', header: 'CustomerCare' },
  { key: 'reembolso', header: 'Reembolso' },
  { key: 'codigoPropuesta', header: 'Codigo de Propuesta', width: 18 },
  { key: 'codigoProvision', header: 'Codigo Provision', width: 22 },
  {
    key: 'vinDetectado',
    header: 'VIN',
    width: 25,
    format: (r) =>
      r.vinDetectado.length > 0
        ? r.vinDetectado.map((v) => `VIN ${v}`).join(' | ')
        : '',
  },
  { key: 'facturaNC', header: 'Factura De NC', width: 16 },
  { key: 'referencias1', header: 'Referencias1', width: 60 },
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

  // Columnas con wrap: estilo "ajustar texto" (para que Excel muestre los
  // Alt+Enter) y alto de fila proporcional al número de líneas.
  const rowLines: number[] = [];
  COLUMNS.forEach((col, colIdx) => {
    if (!col.wrap) return;
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const addr = XLSX.utils.encode_cell({ r: row, c: colIdx });
      const cell = ws[addr];
      if (!cell || typeof cell.v !== 'string' || !cell.v) continue;
      cell.s = {
        alignment: { wrapText: true, vertical: 'top' },
      };
      const lines = cell.v.split('\n').length;
      rowLines[row] = Math.max(rowLines[row] ?? 1, lines);
    }
  });

  if (rowLines.length > 0) {
    const rowsMeta: Array<{ hpt?: number }> = [];
    for (let row = range.s.r; row <= range.e.r; row++) {
      const lines = rowLines[row];
      rowsMeta[row] = lines && lines > 1 ? { hpt: 4 + lines * 13 } : {};
    }
    ws['!rows'] = rowsMeta;
  }

  ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width ?? 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
  XLSX.writeFile(wb, fileName);
}
