'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export default function XmlscanPage() {
  const router = useRouter();
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

    // "Sin datos": archivos que parsearon pero no se reconoció el DTE (sin
    // folio). Se cuentan aparte y NO entran a la tabla, para que el Excel
    // quede limpio y los números cuadren de forma transparente.
    const withData = newRows.filter((r) => r.folioFactura);
    const sinDatos = newRows.length - withData.length;

    // Combinar con lo existente y eliminar duplicados (misma factura).
    let removed = 0;
    let nuevos = 0;
    setRows((prev) => {
      const { rows: deduped, removed: r } = dedupeInvoices([
        ...prev,
        ...withData,
      ]);
      removed = r;
      nuevos = deduped.length - prev.length;
      return deduped;
    });
    setErrors((prev) => [...prev, ...newErrors]);

    // Desglose transparente: subidos = nuevos + duplicados + con error + sin datos.
    const partes = [`${nuevos} nuevo(s) en tabla`];
    if (removed) partes.push(`${removed} duplicado(s)`);
    if (newErrors.length) partes.push(`${newErrors.length} con error`);
    if (sinDatos) partes.push(`${sinDatos} sin datos (no se reconoció DTE)`);
    setStatus(`Listo. ${files.length} subido(s): ${partes.join(', ')}.`);
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

  async function handleLogout() {
    try {
      await fetch('/api/xmlscan-logout', { method: 'POST' });
    } catch {
      /* no-op */
    }
    router.push('/');
    router.refresh();
  }

  return (
    <>
      <header className="app-bar">
        <div className="app-bar-inner">
          <Link href="/" className="brand brand-link">
            <span className="brand-logo" aria-hidden="true">
              {ICON.logo}
            </span>
            <span className="brand-text">
              <span className="brand-name">
                XMLScan <span className="brand-badge">V2</span>
              </span>
            </span>
          </Link>
          <span className="app-bar-spacer" />
          <button className="ghost" onClick={handleLogout} type="button">
            {ICON.logout}
            Salir
          </button>
        </div>
      </header>

      <main>
        <div className="page-head">
          <h1>Procesar facturas XML</h1>
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
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
};
