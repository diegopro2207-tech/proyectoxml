// Generación del Excel de salida.
//
// Un solo archivo .xlsx con UNA FILA POR CLIENTE y exactamente estas cinco
// columnas, en este orden:
//
//   Cliente | Servicios | Honorarios | Services | Fees
//
// Todo el contenido de una categoría va en UNA SOLA celda, como texto plano con
// saltos de línea. Nunca varias filas por cliente.

import * as XLSX from 'xlsx-js-style';
import type { FilaCliente } from './pipeline';

export const COLUMNAS = ['Cliente', 'Servicios', 'Honorarios', 'Services', 'Fees'] as const;

// Ancho de las columnas de contenido: el texto viene ajustado a 60 caracteres,
// así que 62 deja un margen cómodo.
const ANCHO_CONTENIDO = 62;
const ANCHO_CLIENTE = 28;

// Excel no admite filas de más de 409 puntos de alto.
const ALTO_MAXIMO = 409;
const PUNTOS_POR_LINEA = 13;

function filaAObjeto(fila: FilaCliente): Record<string, string> {
  return {
    Cliente: fila.cliente,
    Servicios: fila.servicios,
    Honorarios: fila.honorarios,
    Services: fila.services,
    Fees: fila.fees,
  };
}

export function exportarExcel(filas: FilaCliente[], nombreArchivo = 'clientes.xlsx'): void {
  const datos = filas.map(filaAObjeto);
  const ws = XLSX.utils.json_to_sheet(datos, { header: [...COLUMNAS] });

  const rango = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const altos: number[] = [];

  for (let f = rango.s.r; f <= rango.e.r; f++) {
    for (let c = rango.s.c; c <= rango.e.c; c++) {
      const dir = XLSX.utils.encode_cell({ r: f, c });
      const celda = ws[dir];
      if (!celda) continue;

      if (f === rango.s.r) {
        // Fila de encabezados.
        celda.s = {
          font: { bold: true },
          alignment: { vertical: 'center' },
        };
        continue;
      }

      // Las celdas de contenido conservan sus saltos de línea: "ajustar texto"
      // es lo que hace que Excel los muestre.
      celda.s = { alignment: { wrapText: true, vertical: 'top' } };

      if (typeof celda.v === 'string') {
        const lineas = celda.v.split('\n').length;
        altos[f] = Math.max(altos[f] ?? 1, lineas);
      }
    }
  }

  ws['!cols'] = [
    { wch: ANCHO_CLIENTE },
    { wch: ANCHO_CONTENIDO },
    { wch: ANCHO_CONTENIDO },
    { wch: ANCHO_CONTENIDO },
    { wch: ANCHO_CONTENIDO },
  ];

  ws['!rows'] = altos.map((lineas) =>
    lineas && lineas > 1
      ? { hpt: Math.min(ALTO_MAXIMO, 4 + lineas * PUNTOS_POR_LINEA) }
      : {}
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Propuestas BDO');
  XLSX.writeFile(wb, nombreArchivo);
}
