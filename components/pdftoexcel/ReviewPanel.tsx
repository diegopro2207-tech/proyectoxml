'use client';

import { useState } from 'react';
import type { FilaCliente } from '@/lib/pdftoexcel/pipeline';
import { PENDIENTE_TRADUCCION } from '@/lib/pdftoexcel/pipeline';

type CampoTexto = 'servicios' | 'honorarios' | 'services' | 'fees';

interface Props {
  fila: FilaCliente;
  onCambio: (campo: 'cliente' | CampoTexto, valor: string) => void;
}

const CELDAS: { campo: CampoTexto; titulo: string; idioma: 'es' | 'en' }[] = [
  { campo: 'servicios', titulo: 'Servicios', idioma: 'es' },
  { campo: 'honorarios', titulo: 'Honorarios', idioma: 'es' },
  { campo: 'services', titulo: 'Services', idioma: 'en' },
  { campo: 'fees', titulo: 'Fees', idioma: 'en' },
];

export default function ReviewPanel({ fila, onCambio }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [logAbierto, setLogAbierto] = useState(false);

  const servicios = fila.log.filter((p) => p.categoria === 'SERVICIOS');
  const honorarios = fila.log.filter((p) => p.categoria === 'HONORARIOS');
  const ignoradas = fila.log.filter((p) => p.categoria === 'IGNORAR');

  return (
    <div className={`revision ${fila.error ? 'con-error' : ''}`}>
      <button
        type="button"
        className="revision-cabecera"
        onClick={() => setAbierto((a) => !a)}
      >
        <span className={`chevron ${abierto ? 'abierto' : ''}`} aria-hidden="true">
          ▸
        </span>
        <strong>{fila.cliente || '(cliente sin identificar)'}</strong>
        <span className="revision-meta">
          {fila.archivo} · {fila.idioma === 'es' ? 'español' : 'inglés'} ·{' '}
          {servicios.length} pág. servicios · {honorarios.length} pág. honorarios
        </span>
      </button>

      {abierto && (
        <div className="revision-cuerpo">
          <label className="campo-cliente">
            <span>Cliente</span>
            <input
              type="text"
              value={fila.cliente}
              onChange={(e) => onCambio('cliente', e.target.value)}
              placeholder="Nombre del cliente"
            />
            <small>detectado desde: {fila.fuenteCliente}</small>
          </label>

          <div className="celdas">
            {CELDAS.map(({ campo, titulo, idioma }) => {
              const valor = fila[campo];
              const pendiente = valor.startsWith(PENDIENTE_TRADUCCION);
              const original = idioma === fila.idioma;
              return (
                <label key={campo} className={`celda ${pendiente ? 'pendiente' : ''}`}>
                  <span className="celda-titulo">
                    {titulo}
                    {original ? (
                      <em className="etiqueta original">original</em>
                    ) : (
                      <em className="etiqueta traducir">traducir</em>
                    )}
                  </span>
                  <textarea
                    value={valor}
                    onChange={(e) => onCambio(campo, e.target.value)}
                    spellCheck={false}
                    rows={14}
                    placeholder={
                      pendiente ? 'Escribe aquí la traducción…' : undefined
                    }
                  />
                </label>
              );
            })}
          </div>

          <button
            type="button"
            className="log-toggle"
            onClick={() => setLogAbierto((l) => !l)}
          >
            {logAbierto ? 'Ocultar' : 'Ver'} log de decisiones ({fila.log.length} páginas)
          </button>

          {logAbierto && (
            <div className="log">
              {fila.paginasSinTexto.length > 0 && (
                <p className="log-aviso">
                  Sin texto extraíble (imagen o diagrama):{' '}
                  {fila.paginasSinTexto.map((n) => `P${n}`).join(', ')}
                </p>
              )}
              <ul>
                {fila.log.map((p) => (
                  <li key={p.numero} className={`log-${p.categoria.toLowerCase()}`}>
                    <span className="log-pagina">P{p.numero}</span>
                    <span className="log-categoria">{p.categoria}</span>
                    <span className="log-motivo">
                      {p.motivo}
                      {p.dudosa && ' · marcada como dudosa'}
                      {p.descartes.length > 0 &&
                        ` · ${p.descartes.length} línea(s) descartada(s)`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="log-resumen">
                {servicios.length} servicios · {honorarios.length} honorarios ·{' '}
                {ignoradas.length} ignoradas
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
