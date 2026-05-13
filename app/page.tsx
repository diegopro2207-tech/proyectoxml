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
    setStatus(`Procesando ${files.length} archivo(s)...`);

    const newRows: AnalyzedInvoice[] = [];
    const newErrors: FileError[] = [];

    for (const file of files) {
      try {
        const text = await readXmlFile(file);
        const payload = parseInvoiceXml(text, file.name);
        const analyzed = analyzeInvoice(payload);
        newRows.push(analyzed);
      } catch (err) {
        newErrors.push({
          archivo: file.name,
          error: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    }

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
    const conNFolio = rows.filter((r) => r.nFolioDetectado).length;
    const conVIN = rows.filter((r) => r.vinDetectado).length;
    const revisar = rows.filter((r) => r.observacion.includes('Revisar')).length;
    return { total, conNFolio, conVIN, revisar };
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
            Con NFolio detectado: <strong>{stats.conNFolio}</strong>
          </span>
          <span className="chip">
            Con VIN: <strong>{stats.conVIN}</strong>
          </span>
          <span className="chip">
            Requieren revisión: <strong>{stats.revisar}</strong>
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
