'use client';

import { useMemo, useState } from 'react';
import UploadZone from '@/components/UploadZone';
import InvoicePreviewTable from '@/components/InvoicePreviewTable';
import { parseInvoiceXml, readXmlFile } from '@/lib/xmlParser';
import { analyzeInvoice } from '@/lib/invoiceAnalyzer';
import { exportInvoicesToExcel } from '@/lib/exportExcel';
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

    // Una sola actualización al final — sin duplicados.
    setRows((prev) => [...prev, ...newRows]);
    setErrors((prev) => [...prev, ...newErrors]);
    setStatus(
      `Listo. ${newRows.length} archivo(s) procesado(s)${
        newErrors.length ? `, ${newErrors.length} con error` : ''
      }.`
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

  return (
    <main>
      <header className="app-header">
        <h1>Procesador XML — Facturas Sovos</h1>
        <p>
          Sube XML de DTEs, detecta el NFolio real aunque venga en RazonRef o en
          la descripción del ítem, y exporta a Excel.
        </p>
      </header>

      <UploadZone onFilesSelected={handleFiles} disabled={processing} />

      <div className="toolbar">
        <button onClick={handleExport} disabled={!rows.length || processing}>
          Exportar Excel
        </button>
        <button
          className="secondary"
          onClick={handleClear}
          disabled={!rows.length || processing}
        >
          Limpiar
        </button>
        {status && <span className="status">{status}</span>}
      </div>

      {rows.length > 0 && (
        <div className="summary">
          <span className="chip">
            Total: <strong>{stats.total}</strong>
          </span>
          <span className="chip">
            Con N° OC: <strong>{stats.conOC}</strong>
          </span>
          <span className="chip">
            Con Propuesta: <strong>{stats.conPropuesta}</strong>
          </span>
          <span className="chip">
            Con Provisión: <strong>{stats.conProvision}</strong>
          </span>
          <span className="chip">
            Con VIN: <strong>{stats.conVIN}</strong>
          </span>
          <span className="chip">
            CustomerCare: <strong>{stats.conCare}</strong>
          </span>
          <span className="chip">
            Reembolso: <strong>{stats.conReembolso}</strong>
          </span>
        </div>
      )}

      {errors.length > 0 && (
        <div className="errors">
          <strong>Archivos con error:</strong>
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
  );
}
