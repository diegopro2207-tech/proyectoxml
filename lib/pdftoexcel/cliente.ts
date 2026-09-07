// Identificación del cliente (§A de la especificación).
//
// Orden de prioridad:
//   1. La portada (primera página): el texto más prominente que no sea
//      material de BDO.
//   2. El nombre del archivo, limpiando prefijos numéricos, códigos de
//      propuesta (PO / PTL / PA + número) y rangos de páginas.
//   3. El encabezado o pie de las láminas
//      ("P38 PROFESSIONAL SERVICES PROPOSAL | ENERCON").

import type { PaginaPdf } from './pdfText';
import { agruparEnFilas } from './readingOrder';

export type FuenteCliente = 'portada' | 'archivo' | 'encabezado' | 'desconocido';

export interface ClienteDetectado {
  nombre: string;
  fuente: FuenteCliente;
}

// Textos de la propia BDO que nunca son el nombre del cliente.
const BOILERPLATE = [
  'bdo',
  'nuestro equipo',
  'our team',
  'propuesta de servicios',
  'propuesta economica',
  'professional services proposal',
  'professional fees',
  'honorarios',
  'servicios profesionales',
  'indice',
  'contenido',
  'agenda',
  'executive summary',
  'resumen ejecutivo',
];

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

function esBoilerplate(texto: string): boolean {
  const n = normalizar(texto);
  if (n.length < 3) return true;
  return BOILERPLATE.some((b) => n === b || n.includes(b));
}

// Candidato de la portada: la línea con la tipografía más grande de la primera
// página que no sea material propio de BDO.
function desdePortada(primera: PaginaPdf | undefined): string | null {
  if (!primera || primera.items.length === 0) return null;

  const filas = agruparEnFilas(primera.items);
  const candidatos: { texto: string; alto: number }[] = [];

  for (const fila of filas) {
    for (const seg of fila.segmentos) {
      const texto = seg.texto.trim();
      // Un nombre de empresa es corto; los párrafos no son portada.
      if (texto.length < 3 || texto.length > 60) continue;
      if (esBoilerplate(texto)) continue;
      // Altura de los items que componen el segmento.
      const alto = Math.max(
        ...primera.items
          .filter((i) => i.x >= seg.x - 1 && i.x <= seg.x + seg.ancho + 1)
          .map((i) => i.alto),
        0
      );
      candidatos.push({ texto, alto });
    }
  }

  if (candidatos.length === 0) return null;
  candidatos.sort((a, b) => b.alto - a.alto);
  return candidatos[0].texto;
}

// Nombre derivado del archivo. Ejemplos de la especificación:
//   01-2021_A_B_Packing_PO_394.pdf        → A&B Packing
//   08-026_EBANX_Chile_Ltda_PTL_674-26.pdf → EBANX Chile Ltda
//   12-2023_Enercon_PO_279_37-42.pdf      → Enercon
export function nombreDesdeArchivo(archivo: string): string {
  const base = archivo.replace(/\.pdf$/i, '');
  const piezas = base.split(/[_\s]+/).filter(Boolean);

  const utiles: string[] = [];
  for (const pieza of piezas) {
    // Códigos de propuesta: a partir de aquí lo que sigue es numeración.
    if (/^(po|ptl|pa|prop)$/i.test(pieza)) break;
    // Prefijos numéricos y rangos de páginas: 01-2021, 08-026, 37-42, 674-26.
    if (/^\d+([-–]\d+)?$/.test(pieza)) {
      if (utiles.length === 0) continue; // prefijo al inicio
      break; // numeración al final
    }
    utiles.push(pieza);
  }

  if (utiles.length === 0) return base;

  // Iniciales sueltas consecutivas se unen con "&": A_B_Packing → A&B Packing.
  const unidas: string[] = [];
  for (const pieza of utiles) {
    const anterior = unidas[unidas.length - 1];
    if (pieza.length === 1 && anterior && anterior.length === 1) {
      unidas[unidas.length - 1] = `${anterior}&${pieza}`;
    } else if (pieza.length === 1 && anterior && /&[A-Za-z]$/.test(anterior)) {
      unidas[unidas.length - 1] = `${anterior}&${pieza}`;
    } else {
      unidas.push(pieza);
    }
  }

  return unidas.join(' ').trim();
}

// Encabezado/pie repetido de las láminas: se toma lo que va después de la
// última barra vertical y se elige el valor más frecuente del documento.
function desdeEncabezado(paginas: PaginaPdf[]): string | null {
  const conteo = new Map<string, number>();

  for (const pagina of paginas) {
    for (const fila of agruparEnFilas(pagina.items)) {
      for (const seg of fila.segmentos) {
        const partes = seg.texto.split('|');
        if (partes.length < 2) continue;
        const cola = partes[partes.length - 1].trim();
        if (cola.length < 3 || cola.length > 50 || esBoilerplate(cola)) continue;
        conteo.set(cola, (conteo.get(cola) ?? 0) + 1);
      }
    }
  }

  if (conteo.size === 0) return null;
  const [mejor, veces] = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0];
  // Un encabezado real se repite en varias láminas.
  return veces >= 2 ? mejor : null;
}

export function detectarCliente(
  archivo: string,
  paginas: PaginaPdf[]
): ClienteDetectado {
  const portada = desdePortada(paginas[0]);
  if (portada) return { nombre: portada, fuente: 'portada' };

  // Sin portada, el nombre se deriva del archivo. Solo se acepta si quedó algo
  // con letras: un archivo que era puro código numérico no sirve.
  const delArchivo = nombreDesdeArchivo(archivo);
  if (/[a-záéíóúñ]/i.test(delArchivo)) {
    return { nombre: delArchivo, fuente: 'archivo' };
  }

  const encabezado = desdeEncabezado(paginas);
  if (encabezado) return { nombre: encabezado, fuente: 'encabezado' };

  return { nombre: '', fuente: 'desconocido' };
}
