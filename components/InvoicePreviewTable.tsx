'use client';

import { useState, useMemo } from 'react';
import type { AnalyzedInvoice } from '@/types/invoice';
import { formatDateDMY, formatNumber } from '@/lib/formatting';

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
  {
    key: 'fechaEmision',
    label: 'FechaEmision',
    format: (r) => formatDateDMY(r.fechaEmision),
  },
  { key: 'rutEmisor', label: 'RUTEmisor' },
  { key: 'razonSocialEmisor', label: 'RazonSocialEmisor' },
  {
    key: 'montoNeto',
    label: 'MontoNeto',
    format: (r) => formatNumber(r.montoNeto),
  },
  { key: 'iva', label: 'IVA', format: (r) => formatNumber(r.iva) },
  {
    key: 'montoTotal',
    label: 'MontoTotal',
    format: (r) => formatNumber(r.montoTotal),
  },
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

const ROWS_PER_PAGE = 50;

export default function InvoicePreviewTable({ rows }: Props) {
  const [currentPage, setCurrentPage] = useState(0);

  if (!rows.length) {
    return (
      <div className="empty">
        Sube archivos XML para ver el resultado del análisis.
      </div>
    );
  }

  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
  const start = currentPage * ROWS_PER_PAGE;
  const end = start + ROWS_PER_PAGE;
  const pageRows = rows.slice(start, end);

  return (
    <div className="table-wrap">
      <div className="table-info">
        Mostrando {start + 1}–{Math.min(end, rows.length)} de {rows.length}{' '}
        facturas
      </div>
      <table>
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((r, i) => (
            <tr key={`${r.archivo}-${start + i}`}>
              {COLS.map((c) => (
                <td key={c.key} className={cellClass(r, c.key)}>
                  {c.format ? c.format(r) : defaultFmt(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="table-pagination">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            ← Anterior
          </button>
          <span className="page-info">
            Página {currentPage + 1} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
