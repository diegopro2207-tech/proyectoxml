// Orden de lectura de una lámina (§4 de la especificación).
//
// Regla dura: en páginas a dos columnas se lee TODA la columna izquierda de
// arriba a abajo y después TODA la columna derecha. Nunca se intercalan líneas
// de ambas columnas. Los títulos que cruzan todo el ancho superior van primero.
//
// El texto se modela en dos niveles:
//   · Fila     — todo lo que está a la misma altura visual.
//   · Segmento — bloque contiguo de texto dentro de una fila, separado del
//                siguiente por un hueco horizontal claro.
// Los segmentos son la clave: distinguen "celda de tabla" de "columna de
// texto", y evitan que una barra lateral se fusione con el párrafo de al lado.

import type { ItemTexto, PaginaPdf } from './pdfText';

export interface Segmento {
  texto: string;
  x: number;
  ancho: number;
}

export interface Fila {
  y: number;
  segmentos: Segmento[];
}

export interface PaginaTexto {
  numero: number;
  lineas: string[];
  texto: string;
  dosColumnas: boolean;
}

// Un hueco mayor a este múltiplo de la altura de fuente separa dos segmentos.
const FACTOR_HUECO_SEGMENTO = 1.5;
// Filas exclusivas de un lado necesarias para aceptar una maqueta a dos columnas.
const FILAS_EXCLUSIVAS_MINIMAS = 2;
// Filas consecutivas mínimas para considerar que hay una banda a dos columnas.
const FILAS_MINIMAS_REGION = 4;
// Ancho mínimo (proporción de la página) para que un lado sea una columna de
// prosa y no la celda de valores de una tabla.
const ANCHO_MINIMO_COLUMNA = 0.25;

const mediana = (valores: number[]): number => {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.floor(orden.length / 2)];
};

// Agrupa los items en filas por cercanía vertical, y dentro de cada fila los
// parte en segmentos cuando hay un hueco horizontal grande.
export function agruparEnFilas(items: ItemTexto[]): Fila[] {
  if (items.length === 0) return [];

  const ordenados = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const grupos: ItemTexto[][] = [];

  for (const item of ordenados) {
    const grupo = grupos[grupos.length - 1];
    const referencia = grupo?.[0];
    const tolerancia = Math.max(2, (referencia?.alto ?? 10) * 0.5);
    if (referencia && Math.abs(item.y - referencia.y) <= tolerancia) {
      grupo.push(item);
    } else {
      grupos.push([item]);
    }
  }

  return grupos
    .map((grupo) => {
      const porX = [...grupo].sort((a, b) => a.x - b.x);
      const alturas = porX.map((i) => i.alto).sort((a, b) => a - b);
      const alturaRef = alturas[Math.floor(alturas.length / 2)] || 10;

      const segmentos: Segmento[] = [];
      let texto = '';
      let inicio = porX[0].x;
      let bordeDerecho = porX[0].x;

      const cerrarSegmento = () => {
        const limpio = texto.replace(/\s+/g, ' ').trim();
        if (limpio) {
          segmentos.push({ texto: limpio, x: inicio, ancho: bordeDerecho - inicio });
        }
        texto = '';
      };

      for (const item of porX) {
        if (texto !== '') {
          const hueco = item.x - bordeDerecho;
          if (hueco > alturaRef * FACTOR_HUECO_SEGMENTO) {
            // Hueco grande: es otra celda o la columna de al lado.
            cerrarSegmento();
            inicio = item.x;
          } else if (hueco > alturaRef * 0.15) {
            // Hueco pequeño: es un espacio real entre palabras. Sin esto las
            // palabras quedan pegadas ("losserviciosde").
            texto += ' ';
          }
        }
        texto += item.texto;
        bordeDerecho = item.x + item.ancho;
      }
      cerrarSegmento();

      return { y: porX[0].y, segmentos };
    })
    .filter((f) => f.segmentos.length > 0);
}

const izquierdaDe = (s: Segmento, corte: number) => s.x + s.ancho <= corte;
const derechaDe = (s: Segmento, corte: number) => s.x >= corte;

// Banda vertical de filas consecutivas maquetadas en dos columnas.
interface RegionDosColumnas {
  desde: number; // índice de la primera fila de la banda
  hasta: number; // índice de la última fila (inclusive)
  corte: number; // coordenada X que separa ambas columnas
}

// Busca la banda de la página que está realmente maquetada en dos columnas.
//
// La búsqueda es por BANDAS y no sobre la página completa porque las láminas
// suelen ser mixtas: una tabla o un título a todo lo ancho arriba y dos
// columnas de texto abajo. Un corredor global nunca sobreviviría a la tabla.
//
// Para cada corte candidato se toman los tramos de filas consecutivas que no lo
// cruzan y se exige que ambos lados tengan filas propias. Esa exigencia es la
// que distingue dos columnas de una tabla: en una tabla casi toda fila tiene
// celda a ambos lados, así que no hay filas exclusivas de un solo lado.
function detectarRegionDosColumnas(
  filas: Fila[],
  anchoPagina: number
): RegionDosColumnas | null {
  if (filas.length < FILAS_MINIMAS_REGION) return null;

  const desde = anchoPagina * 0.2;
  const hasta = anchoPagina * 0.8;
  const paso = Math.max(1, anchoPagina / 300);

  let mejor: (RegionDosColumnas & { puntaje: number }) | null = null;

  for (let corte = desde; corte <= hasta; corte += paso) {
    const cruza = filas.map((f) =>
      f.segmentos.some((s) => s.x < corte && s.x + s.ancho > corte)
    );

    let i = 0;
    while (i < filas.length) {
      if (cruza[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < filas.length && !cruza[j + 1]) j++;

      let soloIzquierda = 0;
      let soloDerecha = 0;
      const anchosIzq: number[] = [];
      const anchosDer: number[] = [];
      for (let k = i; k <= j; k++) {
        const izq = filas[k].segmentos.filter((s) => izquierdaDe(s, corte));
        const der = filas[k].segmentos.filter((s) => derechaDe(s, corte));
        if (izq.length && !der.length) soloIzquierda++;
        if (der.length && !izq.length) soloDerecha++;
        anchosIzq.push(...izq.map((s) => s.ancho));
        anchosDer.push(...der.map((s) => s.ancho));
      }

      // Dos maquetas distintas producen filas partidas, y hay que separarlas:
      //   · Texto a dos columnas — cada lado es una columna ANCHA de prosa.
      //   · Tabla — la primera celda es ancha y las demás son valores angostos.
      // Se acepta la banda si un lado tiene filas propias (típico de una barra
      // lateral) o si ambos lados son igual de anchos (columnas de prosa).
      const columnasAnchas =
        mediana(anchosIzq) >= anchoPagina * ANCHO_MINIMO_COLUMNA &&
        mediana(anchosDer) >= anchoPagina * ANCHO_MINIMO_COLUMNA;
      const hayFilasPropias =
        soloIzquierda >= FILAS_EXCLUSIVAS_MINIMAS &&
        soloDerecha >= FILAS_EXCLUSIVAS_MINIMAS;

      const largo = j - i + 1;
      if (
        largo >= FILAS_MINIMAS_REGION &&
        (hayFilasPropias || columnasAnchas) &&
        (!mejor || largo > mejor.puntaje)
      ) {
        mejor = { desde: i, hasta: j, corte, puntaje: largo };
      }
      i = j + 1;
    }
  }

  return mejor;
}

// Devuelve las filas de la página en su geometría original, ya ordenadas de
// arriba abajo. La detección de tablas trabaja sobre esta estructura.
export function paginaAFilas(pagina: PaginaPdf): Fila[] {
  return agruparEnFilas(pagina.items);
}

// Texto de una fila: sus segmentos de izquierda a derecha. El separador doble
// conserva la frontera entre celdas para la detección de tablas.
const textoFila = (fila: Fila) => fila.segmentos.map((s) => s.texto).join('  ');

// Convierte una página en texto plano respetando el orden de lectura.
export function paginaATexto(pagina: PaginaPdf): PaginaTexto {
  const filas = agruparEnFilas(pagina.items);
  const region = detectarRegionDosColumnas(filas, pagina.ancho);

  // Sin banda a dos columnas: cada fila es una línea, con sus segmentos en
  // orden (así una fila de tabla conserva sus celdas).
  if (region === null) {
    const lineas = filas.map(textoFila);
    return {
      numero: pagina.numero,
      lineas,
      texto: lineas.join('\n'),
      dosColumnas: false,
    };
  }

  // Lo que está por encima de la banda mantiene su orden natural: ahí viven los
  // títulos que cruzan todo el ancho y las tablas.
  const antes = filas.slice(0, region.desde).map(textoFila);
  const despues = filas.slice(region.hasta + 1).map(textoFila);

  // Dentro de la banda: toda la columna izquierda y después toda la derecha.
  const izquierda: string[] = [];
  const derecha: string[] = [];
  for (const fila of filas.slice(region.desde, region.hasta + 1)) {
    const izq = fila.segmentos.filter((s) => izquierdaDe(s, region.corte));
    const der = fila.segmentos.filter((s) => derechaDe(s, region.corte));
    if (izq.length) izquierda.push(izq.map((s) => s.texto).join('  '));
    if (der.length) derecha.push(der.map((s) => s.texto).join('  '));
  }

  const lineas = [...antes, ...izquierda, ...derecha, ...despues];
  return {
    numero: pagina.numero,
    lineas,
    texto: lineas.join('\n'),
    dosColumnas: true,
  };
}
