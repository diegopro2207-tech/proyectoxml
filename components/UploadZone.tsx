'use client';

import { useCallback, useRef, useState } from 'react';

interface Props {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export default function UploadZone({ onFilesSelected, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const files = Array.from(fileList).filter((f) =>
        f.name.toLowerCase().endsWith('.xml')
      );
      if (files.length) onFilesSelected(files);
    },
    [onFilesSelected]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        handleFiles(e.dataTransfer.files);
      }}
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
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="upload-inner">
        <strong>Arrastra aquí tus XML</strong>
        <span>o haz clic para seleccionar varios archivos</span>
        <small>Solo archivos .xml — procesamiento local</small>
      </div>
    </div>
  );
}
