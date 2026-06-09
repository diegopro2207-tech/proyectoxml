'use client';

import { useState } from 'react';
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
  { key: 'folioSAP', label: 'Folio-SAP' },
  {
    key: 'fechaEmision',
    label: 'FechaEmision',
    format: (r) => formatDateDMY(r.fechaEmision),
  },
  { key: 'rutEmisor', label: 'RUTEmisor' },
  { key: 'rutFolio', label: 'RUT+Folio' },
  { key: 'razonSocialEmisor', label: 'RazonSocialEmisor' },
  {
    key: 'montoExento',
    label: 'MontoExento',
    format: (r) => formatNumber(r.montoExento),
  },
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
  { key: 'numeroOC', label: 'Numero de OC' },
  { key: 'motivoOriginal', label: 'MotivoOriginal' },
  // Orden desde Glosas en adelante:
  { key: 'descripcionItemsOriginal', label: 'Glosas Items' },
  { key: 'concepto', label: 'Concepto' },
  { key: 'customerCare', label: 'CustomerCare' },
  { key: 'reembolso', label: 'Reembolso' },
  { key: 'codigoPropuesta', label: 'Codigo de Propuesta' },
  { key: 'codigoProvision', label: 'Codigo Provision' },
  { key: 'propuestaDetectada', label: 'PropuestaDetectada' },
  {
    key: 'vinDetectado',
    label: 'VIN',
    format: (r) =>
      r.vinDetectado.length > 0
        ? r.vinDetectado.map((v) => `VIN ${v}`).join(' | ')
        : '',
  },
  { key: 'facturaNC', label: 'Factura De NC' },
  { key: 'referencias1', label: 'Referencias1' },
];

function cellClass(row: AnalyzedInvoice, key: keyof AnalyzedInvoice): string {
  if (key === 'customerCare' && row.customerCare) return 'cell info';
  if (key === 'reembolso' && row.reembolso) return 'cell info';
  if (key === 'codigoPropuesta' && row.codigoPropuesta) return 'cell ok';
  if (key === 'codigoProvision' && row.codigoProvision) return 'cell ok';
  if (key === 'concepto' && row.concepto) return 'cell info';
  return 'cell';
}

function defaultFmt(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') return String(value);
  return String(value);
}

const ROWS_PER_PAGE = 50;

export default function InvoicePreviewTable({ rows }: Props) {
  const [currentPage, setCurrentPage] = useState(0);

  if (!rows.length) {
    return (
      <div className="empty">
        <span className="empty-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z" />
          </svg>
        </span>
        Aún no hay datos. Sube archivos XML para ver el análisis aquí.
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
      <div className="table-scroll">
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
      </div>
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
