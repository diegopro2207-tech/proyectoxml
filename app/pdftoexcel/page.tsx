'use client';

import { useState } from 'react';
import Link from 'next/link';
import DropzonePdf from '@/components/pdftoexcel/DropzonePdf';
import ReviewPanel from '@/components/pdftoexcel/ReviewPanel';
import { procesarPdf, type EstadoArchivo, type FilaCliente } from '@/lib/pdftoexcel/pipeline';
import { exportarExcel } from '@/lib/pdftoexcel/exportExcel';

interface ItemArchivo {
  id: string;
  nombre: string;
  estado: EstadoArchivo;
  detalle?: string;
  fila?: FilaCliente;
}

export default function PdfToExcelPage() {
  const [items, setItems] = useState<ItemArchivo[]>([]);
  const [procesando, setProcesando] = useState(false);

  function actualizar(id: string, cambios: Partial<ItemArchivo>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...cambios } : i)));
  }

  async function manejarArchivos(archivos: File[]) {
    const nuevos: ItemArchivo[] = archivos.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      nombre: f.name,
      estado: 'en cola',
    }));
    setItems((prev) => [...prev, ...nuevos]);
    setProcesando(true);

    // Se procesan de a uno: un PDF de 80 páginas es pesado y así el avance
    // por archivo es real y no una barra genérica.
    for (let i = 0; i < archivos.length; i++) {
      const item = nuevos[i];
      const fila = await procesarPdf(archivos[i], (estado, detalle) =>
        actualizar(item.id, { estado, detalle })
      );
      actualizar(item.id, {
        estado: fila.error ? 'error' : 'listo',
        detalle: fila.error,
        fila,
      });
    }

    setProcesando(false);
  }

  function cambiarCampo(
    id: string,
    campo: 'cliente' | 'servicios' | 'honorarios' | 'services' | 'fees',
    valor: string
  ) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id && i.fila ? { ...i, fila: { ...i.fila, [campo]: valor } } : i
      )
    );
  }

  function exportar() {
    const filas = items.map((i) => i.fila).filter((f): f is FilaCliente => !!f);
    if (!filas.length) return;
    const sello = new Date().toISOString().slice(0, 10);
    exportarExcel(filas, `Servicios_Honorarios_BDO_${sello}.xlsx`);
  }

  function limpiar() {
    setItems([]);
  }


  const listos = items.filter((i) => i.fila).length;
  const conError = items.filter((i) => i.estado === 'error').length;

  return (
    <>
      <header className="app-bar">
        <div className="app-bar-inner">
          <Link href="/" className="brand brand-link">
            <span className="brand-logo" aria-hidden="true">
              {ICON.logo}
            </span>
            <span className="brand-text">
              <span className="brand-name">PDF to Excel</span>
            </span>
          </Link>
          <span className="app-bar-spacer" />
        </div>
      </header>

      <main>
        <div className="page-head">
          <h1>Propuestas PDF a Excel</h1>
        </div>

        <DropzonePdf onArchivos={manejarArchivos} disabled={procesando} />

        <div className="toolbar">
          <button onClick={exportar} disabled={!listos || procesando}>
            {ICON.download}
            Exportar Excel
          </button>
          <button
            className="secondary"
            onClick={limpiar}
            disabled={!items.length || procesando}
          >
            {ICON.trash}
            Limpiar
          </button>
          {items.length > 0 && (
            <span className="status">
              {listos} de {items.length} procesado(s)
              {conError > 0 && ` · ${conError} con error`}
            </span>
          )}
        </div>

        {items.length > 0 && (
          <ul className="lista-archivos">
            {items.map((item) => (
              <li key={item.id} className={`estado-${item.estado.replace(/\s+/g, '-')}`}>
                <span className="archivo-nombre">{item.nombre}</span>
                <span className="archivo-estado">
                  {item.estado}
                  {item.detalle && <em> — {item.detalle}</em>}
                </span>
              </li>
            ))}
          </ul>
        )}

        {listos > 0 && (
          <section className="revisiones">
            <h2>
              Revisión
              <small>
                Corrige aquí antes de exportar. Las celdas marcadas “traducir”
                están pendientes de completar a mano.
              </small>
            </h2>
            {items.map(
              (item) =>
                item.fila && (
                  <ReviewPanel
                    key={item.id}
                    fila={item.fila}
                    onCambio={(campo, valor) => cambiarCampo(item.id, campo, valor)}
                  />
                )
            )}
          </section>
        )}
      </main>
    </>
  );
}

/* Iconos SVG inline (stroke 1.9, estilo lineal consistente). */
const ICON = {
  logo: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-5-5H9z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
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
};
