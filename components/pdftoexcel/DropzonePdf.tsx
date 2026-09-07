'use client';

import { useCallback, useRef, useState } from 'react';

interface Props {
  onArchivos: (archivos: File[]) => void;
  disabled?: boolean;
}

const esPdf = (f: File) => f.name.toLowerCase().endsWith('.pdf');

// Lee recursivamente los PDF de una entrada del FileSystem API (soporta que se
// arrastre una carpeta completa).
async function leerEntrada(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return new Promise((resolve) => {
      fileEntry.file((file) => resolve(esPdf(file) ? [file] : []));
    });
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const todas: FileSystemEntry[] = [];

    // readEntries devuelve como máximo 100 por llamada: hay que iterar.
    await (async function leerTodo() {
      const lote: FileSystemEntry[] = await new Promise((resolve) =>
        reader.readEntries(resolve)
      );
      if (lote.length === 0) return;
      todas.push(...lote);
      await leerTodo();
    })();

    const anidadas = await Promise.all(todas.map(leerEntrada));
    return anidadas.flat();
  }

  return [];
}

async function extraerDelDrop(dataTransfer: DataTransfer): Promise<File[]> {
  if (dataTransfer.items?.length) {
    const entradas: FileSystemEntry[] = [];
    for (const item of Array.from(dataTransfer.items)) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) entradas.push(entry);
    }
    if (entradas.length > 0) {
      const anidadas = await Promise.all(entradas.map(leerEntrada));
      return anidadas.flat();
    }
  }
  return Array.from(dataTransfer.files).filter(esPdf);
}

export default function DropzonePdf({ onArchivos, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);

  const alSeleccionar = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const archivos = Array.from(e.target.files ?? []).filter(esPdf);
      if (archivos.length) onArchivos(archivos);
      // Resetear para poder volver a elegir los mismos archivos.
      e.target.value = '';
    },
    [onArchivos]
  );

  const alSoltar = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setEncima(false);
      if (disabled) return;
      const archivos = await extraerDelDrop(e.dataTransfer);
      if (archivos.length) onArchivos(archivos);
    },
    [onArchivos, disabled]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={alSoltar}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`upload-zone ${encima ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        hidden
        onChange={alSeleccionar}
      />
      <div className="upload-inner">
        <span className="upload-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M17 8l-5-5-5 5M12 3v12" />
          </svg>
        </span>
        <strong>Arrastra aquí los PDF o una carpeta</strong>
        <span>o haz clic para seleccionar varios archivos</span>
        <small>Se procesan en tu navegador: los documentos no se suben a ningún servidor</small>
      </div>
    </div>
  );
}
