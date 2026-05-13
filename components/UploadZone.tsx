'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

// Lee recursivamente todos los archivos .xml desde una entrada del FileSystem API.
async function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return new Promise((resolve) => {
      fileEntry.file((file) => {
        resolve(file.name.toLowerCase().endsWith('.xml') ? [file] : []);
      });
    });
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const allEntries: FileSystemEntry[] = [];

    // readEntries devuelve máximo 100 por llamada — hay que iterar.
    await (async function readAll() {
      const batch: FileSystemEntry[] = await new Promise((resolve) =>
        reader.readEntries(resolve)
      );
      if (batch.length === 0) return;
      allEntries.push(...batch);
      await readAll();
    })();

    const nested = await Promise.all(allEntries.map(readEntry));
    return nested.flat();
  }

  return [];
}

async function extractFilesFromDrop(
  dataTransfer: DataTransfer
): Promise<File[]> {
  // Intentar con FileSystem API (soporta carpetas).
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    const entries: FileSystemEntry[] = [];
    for (const item of Array.from(dataTransfer.items)) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
    if (entries.length > 0) {
      const nested = await Promise.all(entries.map(readEntry));
      return nested.flat();
    }
  }
  // Fallback: archivos sueltos (sin carpetas).
  return Array.from(dataTransfer.files).filter((f) =>
    f.name.toLowerCase().endsWith('.xml')
  );
}

export default function UploadZone({ onFilesSelected, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // webkitdirectory no se puede poner en JSX (TypeScript lo rechaza y React
  // a veces no lo pasa al DOM). Se asigna por ref después del mount.
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setAttribute('webkitdirectory', '');
      inputRef.current.setAttribute('multiple', '');
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).filter((f) =>
        f.name.toLowerCase().endsWith('.xml')
      );
      if (files.length) onFilesSelected(files);
      // Resetear el input para que se pueda volver a seleccionar la misma carpeta.
      e.target.value = '';
    },
    [onFilesSelected]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const files = await extractFilesFromDrop(e.dataTransfer);
      if (files.length) onFilesSelected(files);
    },
    [onFilesSelected, disabled]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`upload-zone ${dragOver ? 'drag-over' : ''} ${
        disabled ? 'disabled' : ''
      }`}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xml,application/xml,text/xml"
        hidden
        onChange={handleInputChange}
      />
      <div className="upload-inner">
        <strong>Arrastra aquí una carpeta o archivos XML</strong>
        <span>o haz clic para seleccionar carpeta o archivos individuales</span>
        <small>
          Soporta 9.000+ archivos — todo se procesa localmente, nada sale de tu
          computador
        </small>
      </div>
    </div>
  );
}
