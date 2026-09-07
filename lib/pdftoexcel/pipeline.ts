// Orquestador del pipeline por archivo (§3).
//
//   PDF → texto por página → cliente → clasificación → limpieza → formato
//       → idioma → ajuste a 60 caracteres → fila del Excel
//
// El ajuste tipográfico es SIEMPRE el último paso. Las columnas del idioma que
// el documento no trae quedan marcadas como pendientes para completarlas a mano
// en el panel de revisión.

import { leerPdf } from './pdfText';
import { paginaATexto } from './readingOrder';
import { detectarCliente, type FuenteCliente } from './cliente';
import { clasificarPaginas, type PaginaClasificada } from './classify';
import { formatearServicios } from './servicios';
import { formatearTablas } from './tables';
import { detectarIdioma, type Idioma } from './language';
import { ajustarAncho } from './formatting';

export const PENDIENTE_TRADUCCION = '[PENDIENTE TRADUCCIÓN]';

export type EstadoArchivo =
  | 'en cola'
  | 'leyendo PDF'
  | 'analizando'
  | 'listo'
  | 'error';

export interface FilaCliente {
  archivo: string;
  cliente: string;
  fuenteCliente: FuenteCliente;
  idioma: Idioma;
  // Las cuatro celdas de contenido. Las del idioma no original quedan con
  // PENDIENTE_TRADUCCION para completarlas manualmente.
  servicios: string;
  honorarios: string;
  services: string;
  fees: string;
  log: PaginaClasificada[];
  paginasSinTexto: number[];
  error?: string;
}

// Convierte [38,39,40,41,42] en "P38–P42" y [5,7] en "P5, P7".
function rangoPaginas(numeros: number[]): string {
  if (numeros.length === 0) return 'ninguna';
  const orden = [...numeros].sort((a, b) => a - b);
  const tramos: string[] = [];
  let inicio = orden[0];
  let previo = orden[0];

  for (const n of orden.slice(1)) {
    if (n === previo + 1) {
      previo = n;
      continue;
    }
    tramos.push(inicio === previo ? `P${inicio}` : `P${inicio}–P${previo}`);
    inicio = n;
    previo = n;
  }
  tramos.push(inicio === previo ? `P${inicio}` : `P${inicio}–P${previo}`);
  return tramos.join(', ');
}

// Agrupa las líneas de las páginas de una categoría, separando cada lámina con
// una línea en blanco para que se note el cambio de sección.
function lineasDe(log: PaginaClasificada[], categoria: string): string[] {
  const bloques = log
    .filter((p) => p.categoria === categoria && p.lineas.length > 0)
    .map((p) => p.lineas);
  const salida: string[] = [];
  for (const bloque of bloques) {
    if (salida.length) salida.push('');
    salida.push(...bloque);
  }
  return salida;
}

// Procesa un PDF completo y devuelve la fila lista para el Excel.
export async function procesarPdf(
  file: File,
  onProgreso?: (estado: EstadoArchivo, detalle?: string) => void
): Promise<FilaCliente> {
  const base: FilaCliente = {
    archivo: file.name,
    cliente: '',
    fuenteCliente: 'desconocido',
    idioma: 'es',
    servicios: '',
    honorarios: '',
    services: '',
    fees: '',
    log: [],
    paginasSinTexto: [],
  };

  try {
    onProgreso?.('leyendo PDF');
    const doc = await leerPdf(file, (n, total) =>
      onProgreso?.('leyendo PDF', `página ${n} de ${total}`)
    );

    onProgreso?.('analizando');
    const paginas = doc.paginas.map(paginaATexto);
    const cliente = detectarCliente(file.name, doc.paginas);
    const log = clasificarPaginas(paginas);

    const lineasServicios = lineasDe(log, 'SERVICIOS');
    const lineasHonorarios = lineasDe(log, 'HONORARIOS');

    // El idioma se decide sobre el contenido que sí se extrajo.
    const idioma = detectarIdioma(
      [...lineasServicios, ...lineasHonorarios].join(' ')
    );
    const enIngles = idioma === 'en';

    const paginasServicios = log
      .filter((p) => p.categoria === 'SERVICIOS')
      .map((p) => p.numero);
    const paginasHonorarios = log
      .filter((p) => p.categoria === 'HONORARIOS')
      .map((p) => p.numero);

    // Si una sección no viene en el archivo se explica qué SÍ trae, en vez de
    // dejar la celda vacía o inventar contenido (§E, caso Enercon).
    const servicios = lineasServicios.length
      ? ajustarAncho(formatearServicios(lineasServicios))
      : `[PENDIENTE] El archivo no trae sección de servicios. Páginas de honorarios: ${rangoPaginas(paginasHonorarios)}.`;

    const honorarios = lineasHonorarios.length
      ? ajustarAncho(
          formatearTablas(lineasHonorarios, {
            etiqueta: enIngles ? '[TABLE]' : '[TABLA]',
            columnaPorDefecto: enIngles ? 'Service' : 'Servicio',
          })
        )
      : `[PENDIENTE] El archivo no trae sección de honorarios. Páginas de servicios: ${rangoPaginas(paginasServicios)}.`;

    return {
      ...base,
      cliente: cliente.nombre,
      fuenteCliente: cliente.fuente,
      idioma,
      // El par del idioma original lleva el contenido; el otro queda pendiente
      // de traducción manual.
      servicios: enIngles ? PENDIENTE_TRADUCCION : servicios,
      honorarios: enIngles ? PENDIENTE_TRADUCCION : honorarios,
      services: enIngles ? servicios : PENDIENTE_TRADUCCION,
      fees: enIngles ? honorarios : PENDIENTE_TRADUCCION,
      log,
      paginasSinTexto: doc.paginasSinTexto,
    };
  } catch (err) {
    // Un PDF que falla no debe detener el lote: se devuelve la fila con el
    // motivo del error en su celda.
    const motivo = err instanceof Error ? err.message : 'Error desconocido';
    return {
      ...base,
      cliente: file.name.replace(/\.pdf$/i, ''),
      error: motivo,
      servicios: `[ERROR] ${motivo}`,
      honorarios: `[ERROR] ${motivo}`,
      services: `[ERROR] ${motivo}`,
      fees: `[ERROR] ${motivo}`,
    };
  }
}
