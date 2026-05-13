'use client';

import type { AnalyzedInvoice } from '@/types/invoice';

interface Props {
  rows: AnalyzedInvoice[];
}

interface ColDef {
  key: keyof AnalyzedInvoice;
  label: string;
  format?: (row: AnalyzedInvoice) => string;
}

const COLS: ColDef[] = [
  { key: 'archivo', label: 'Archivo' },
  { key: 'tipoDTE', label: 'TipoDTE' },
  { key: 'folioFactura', label: 'FolioFactura' },
  { key: 'fechaEmision', label: 'FechaEmision' },
  { key: 'rutEmisor', label: 'RUTEmisor' },
  { key: 'razonSocialEmisor', label: 'RazonSocialEmisor' },
  { key: 'montoNeto', label: 'MontoNeto' },
  { key: 'iva', label: 'IVA' },
  { key: 'montoTotal', label: 'MontoTotal' },
  { key: 'folioRefOriginal', label: 'Numero de OC' },
  { key: 'motivoOriginal', label: 'MotivoOriginal' },
  { key: 'descripcionItemsOriginal', label: 'Glosas Items' },
  { key: 'nFolioDetectado', label: 'Codigo de Propuesta' },
  { key: 'motivoLimpio', label: 'MotivoLimpio' },
  { key: 'propuestaDetectada', label: 'PropuestaDetectada' },
  {
    key: 'vinDetectado',
    label: 'VIN',
    format: (r) => (r.vinDetectado ? `VIN ${r.vinDetectado}` : ''),
  },
  { key: 'customerCare', label: 'CustomerCare' },
  { key: 'observacion', label: 'Observacion' },
  { key: 'confianza', label: 'Confianza' },
];

function cellClass(row: AnalyzedInvoice, key: keyof AnalyzedInvoice): string {
  if (key === 'observacion') {
    if (row.observacion.includes('Revisar')) return 'cell warn';
    if (row.observacion === 'Correcto') return 'cell ok';
    return 'cell info';
  }
  if (key === 'confianza') {
    if (row.confianza >= 0.85) return 'cell ok';
    if (row.confianza >= 0.6) return 'cell info';
    return 'cell warn';
  }
  if (key === 'customerCare' && row.customerCare) return 'cell info';
  return 'cell';
}

function defaultFmt(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  return String(value);
}

export default function InvoicePreviewTable({ rows }: Props) {
  if (!rows.length) {
    return (
      <div className="empty">
        Sube archivos XML para ver el resultado del análisis.
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.archivo}-${i}`}>
              {COLS.map((c) => (
                <td key={c.key} className={cellClass(r, c.key)}>
                  {c.format ? c.format(r) : defaultFmt(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
