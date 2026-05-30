'use client';

import { useMemo, useState } from 'react';
import UploadZone from '@/components/UploadZone';
import InvoicePreviewTable from '@/components/InvoicePreviewTable';
import { parseInvoiceXml, readXmlFile } from '@/lib/xmlParser';
import { analyzeInvoice } from '@/lib/invoiceAnalyzer';
import { exportInvoicesToExcel } from '@/lib/exportExcel';
import { dedupeInvoices } from '@/lib/dedupe';
import type { AnalyzedInvoice } from '@/types/invoice';

interface FileError {
  archivo: string;
  error: string;
}

export default function HomePage() {
  const [rows, setRows] = useState<AnalyzedInvoice[]>([]);
  const [errors, setErrors] = useState<FileError[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');

  async function handleFiles(files: File[]) {
    setProcessing(true);
    setStatus(`Iniciando procesamiento de ${files.length} archivo(s)...`);

    const newRows: AnalyzedInvoice[] = [];
    const newErrors: FileError[] = [];
    const BATCH_SIZE = 100;

    // Procesar en lotes para no bloquear el UI.
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      setStatus(`Procesando ${Math.min(i + BATCH_SIZE, files.length)} de ${files.length}...`);

      const batchResults = await Promise.all(
        batch.map(async (file) => {
          try {
            const text = await readXmlFile(file);
            const payload = parseInvoiceXml(text, file.name);
            const analyzed = analyzeInvoice(payload);
            return { success: true as const, data: analyzed };
          } catch (err) {
            return {
              success: false as const,
              error: {
                archivo: file.name,
                error: err instanceof Error ? err.message : 'Error desconocido',
              },
            };
          }
        })
      );

      for (const result of batchResults) {
        if (result.success) newRows.push(result.data);
        else newErrors.push(result.error);
      }
    }

    // Combinar con lo existente y eliminar duplicados (misma factura).
    // De los repetidos se descarta el que no tenga montos; si ambos tienen
    // montos, se conserva solo uno.
    let removed = 0;
    setRows((prev) => {
      const { rows: deduped, removed: r } = dedupeInvoices([...prev, ...newRows]);
      removed = r;
      return deduped;
    });
    setErrors((prev) => [...prev, ...newErrors]);
    setStatus(
      `Listo. ${newRows.length} archivo(s) procesado(s)${
        removed ? `, ${removed} duplicado(s) eliminado(s)` : ''
      }${newErrors.length ? `, ${newErrors.length} con error` : ''}.`
    );
    setProcessing(false);
  }

  function handleExport() {
    if (!rows.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    exportInvoicesToExcel(rows, `facturas_${stamp}.xlsx`);
  }

  function handleClear() {
    setRows([]);
    setErrors([]);
    setStatus('');
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const conPropuesta = rows.filter((r) => r.codigoPropuesta).length;
    const conProvision = rows.filter((r) => r.codigoProvision).length;
    const conOC = rows.filter((r) => r.numeroOC).length;
    const conVIN = rows.filter((r) => r.vinDetectado.length > 0).length;
    const conCare = rows.filter((r) => r.customerCare).length;
    const conReembolso = rows.filter((r) => r.reembolso).length;
    return { total, conPropuesta, conProvision, conOC, conVIN, conCare, conReembolso };
  }, [rows]);

  const statCards: {
    label: string;
    value: number;
    tone: 'is-primary' | 'is-ok' | 'is-info' | 'is-warn' | 'is-muted';
    icon: JSX.Element;
  }[] = [
    { label: 'Total facturas', value: stats.total, tone: 'is-primary', icon: ICON.doc },
    { label: 'Con N° OC', value: stats.conOC, tone: 'is-info', icon: ICON.hash },
    { label: 'Con Propuesta', value: stats.conPropuesta, tone: 'is-ok', icon: ICON.check },
    { label: 'Con Provisión', value: stats.conProvision, tone: 'is-ok', icon: ICON.check },
    { label: 'Con VIN', value: stats.conVIN, tone: 'is-info', icon: ICON.car },
    { label: 'CustomerCare', value: stats.conCare, tone: 'is-warn', icon: ICON.support },
    { label: 'Reembolso', value: stats.conReembolso, tone: 'is-warn', icon: ICON.refund },
  ];

  return (
    <>
      <header className="app-bar">
        <div className="app-bar-inner">
          <div className="brand">
            <span className="brand-logo" aria-hidden="true">
              {ICON.logo}
            </span>
            <span className="brand-text">
              <span className="brand-name">
                FacturaScan <span className="brand-badge">V2</span>
              </span>
              <span className="brand-sub">Procesador de DTEs · Sovos</span>
            </span>
          </div>
          <span className="app-bar-spacer" />
          <span className="app-bar-meta">
            <span className="dot" aria-hidden="true" />
            Procesamiento 100% local
          </span>
        </div>
      </header>

      <main>
        <div className="page-head">
          <h1>Procesar facturas XML</h1>
          <p>
            Sube XML de DTEs y detecta automáticamente el N° de propuesta —
            aunque venga en la RazonRef o en la descripción del ítem — junto con
            provisión, VIN, CustomerCare y reembolso. Exporta todo a Excel.
          </p>
        </div>

        <UploadZone onFilesSelected={handleFiles} disabled={processing} />

        <div className="toolbar">
          <button onClick={handleExport} disabled={!rows.length || processing}>
            {ICON.download}
            Exportar Excel
          </button>
          <button
            className="secondary"
            onClick={handleClear}
            disabled={!rows.length || processing}
          >
            {ICON.trash}
            Limpiar
          </button>
          {status && <span className="status">{status}</span>}
        </div>

        {rows.length > 0 && (
          <div className="summary">
            {statCards.map((s) => (
              <div className="stat-card" key={s.label}>
                <span className={`stat-ico ${s.tone}`} aria-hidden="true">
                  {s.icon}
                </span>
                <span className="stat-body">
                  <span className="stat-value">{s.value}</span>
                  <span className="stat-label">{s.label}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {errors.length > 0 && (
          <div className="errors">
            <strong>
              {ICON.alert}
              Archivos con error ({errors.length})
            </strong>
            <ul>
              {errors.map((e, i) => (
                <li key={i}>
                  {e.archivo}: {e.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <InvoicePreviewTable rows={rows} />
      </main>
    </>
  );
}

/* Iconos SVG inline (stroke 1.75, estilo lineal consistente). */
const ICON = {
  logo: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-5-5H9z" />
      <path d="M14 3v5h5M9 13h6M9 17h6M9 9h1" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </svg>
  ),
  hash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.8 10v2a10 10 0 1 1-5.9-9.1" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  ),
  car: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14M3 17l1.6-5a2 2 0 0 1 1.9-1.4h11a2 2 0 0 1 1.9 1.4L21 17M7 10l1-4h8l1 4" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12a8 8 0 0 1 16 0" />
      <rect x="2" y="12" width="4" height="7" rx="1.5" />
      <rect x="18" y="12" width="4" height="7" rx="1.5" />
      <path d="M20 19a4 4 0 0 1-4 3h-3" />
    </svg>
  ),
  refund: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 8v8M9.5 14.5c0 1 .9 1.5 2.5 1.5s2.5-.6 2.5-1.6c0-2.4-5-1.3-5-3.4 0-1 .9-1.5 2.5-1.5s2.5.5 2.5 1.5" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
    </svg>
  ),
};
