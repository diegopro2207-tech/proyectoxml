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
// Cuántas veces se puede volver a dividir una columna en sub-columnas.
const PROFUNDIDAD_MAXIMA = 3;

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

// Extensión horizontal que ocupa un conjunto de filas.
function extension(filas: Fila[]): { inicio: number; fin: number; ancho: number } {
  const segmentos = filas.flatMap((f) => f.segmentos);
  if (segmentos.length === 0) return { inicio: 0, fin: 0, ancho: 0 };
  const inicio = Math.min(...segmentos.map((s) => s.x));
  const fin = Math.max(...segmentos.map((s) => s.x + s.ancho));
  return { inicio, fin, ancho: fin - inicio };
}

// Busca la banda de filas maquetada en dos columnas DENTRO del bloque recibido.
//
// Trabaja sobre la extensión real del bloque, no sobre el ancho de la página,
// para poder aplicarse también dentro de una columna ya separada (una lámina
// puede tener un panel lateral y, en el panel de contenido, dos sub-columnas).
//
// Se busca por bandas porque las láminas son mixtas: un título o una tabla a
// todo lo ancho arriba y dos columnas debajo. Para cada corte candidato se
// toman los tramos de filas consecutivas que no lo cruzan y se exige que las
// dos columnas se sostengan: o cada lado tiene filas propias (típico de un
// panel lateral) o ambos lados son igual de anchos (prosa a dos columnas). Eso
// es lo que distingue dos columnas de una tabla, cuyas celdas de valores son
// angostas y acompañan siempre a una celda de la izquierda.
function detectarRegionDosColumnas(
  filas: Fila[],
  profundidad: number,
  anchoPagina: number
): RegionDosColumnas | null {
  if (filas.length < FILAS_MINIMAS_REGION) return null;

  // A nivel de página se mide contra el ancho de la lámina. Dentro de una
  // columna ya separada, contra la extensión real de esa columna: si no, los
  // umbrales quedarían fuera de rango y nunca se encontraría el corte.
  const propia = extension(filas);
  const ancho = profundidad === 0 ? anchoPagina : propia.ancho;
  const inicio = profundidad === 0 ? 0 : propia.inicio;
  if (ancho <= 0) return null;

  const desde = inicio + ancho * 0.2;
  const hasta = inicio + ancho * 0.8;
  const paso = Math.max(1, ancho / 300);

  // Se prefiere el corte que deja más filas viviendo en un solo lado: ese es
  // el borde real de la columna. Elegir solo por longitud de banda hace que el
  // corte caiga dentro de una tabla, partiendo sus rótulos.
  let mejor: (RegionDosColumnas & { sueltas: number; largo: number }) | null = null;

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

      const largo = j - i + 1;

      // Dos columnas de prosa: cada lado es igual de ancho.
      const columnasAnchas =
        mediana(anchosIzq) >= ancho * ANCHO_MINIMO_COLUMNA &&
        mediana(anchosDer) >= ancho * ANCHO_MINIMO_COLUMNA;
      // Cada lado tiene varias filas propias: típico de una barra lateral.
      const hayFilasPropias =
        soloIzquierda >= FILAS_EXCLUSIVAS_MINIMAS &&
        soloDerecha >= FILAS_EXCLUSIVAS_MINIMAS;
      // Dentro de una columna ya separada el listón sube: solo se vuelve a
      // partir si ambos lados son prosa ancha. Si no, se partirían también las
      // columnas de una tabla de honorarios y se perderían sus rótulos.
      const aceptable =
        profundidad === 0 ? hayFilasPropias || columnasAnchas : columnasAnchas;

      const sueltas = soloIzquierda + soloDerecha;
      const mejora =
        !mejor || sueltas > mejor.sueltas || (sueltas === mejor.sueltas && largo > mejor.largo);

      if (largo >= FILAS_MINIMAS_REGION && aceptable && mejora) {
        mejor = { desde: i, hasta: j, corte, sueltas, largo };
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

// Ordena un bloque de filas respetando la regla de lectura, y se aplica a sí
// mismo dentro de cada columna que encuentra.
//
// La recursión es lo que permite leer bien una lámina con panel lateral cuyo
// panel de contenido está, a su vez, dividido en dos sub-columnas: primero se
// separa el panel del contenido y después, dentro del contenido, "Alcance" de
// "Reportes". Sin ella las sub-columnas se leen entrelazadas.
function ordenarFilas(filas: Fila[], anchoPagina: number, profundidad = 0): string[] {
  if (filas.length === 0) return [];
  if (profundidad >= PROFUNDIDAD_MAXIMA) return filas.map(textoFila);

  const region = detectarRegionDosColumnas(filas, profundidad, anchoPagina);
  if (region === null) return filas.map(textoFila);

  const banda = filas.slice(region.desde, region.hasta + 1);
  const izquierda: Fila[] = [];
  const derecha: Fila[] = [];
  for (const fila of banda) {
    const izq = fila.segmentos.filter((s) => izquierdaDe(s, region.corte));
    const der = fila.segmentos.filter((s) => derechaDe(s, region.corte));
    if (izq.length) izquierda.push({ y: fila.y, segmentos: izq });
    if (der.length) derecha.push({ y: fila.y, segmentos: der });
  }

  // Lo que queda arriba y abajo de la banda mantiene su orden natural: ahí
  // viven los títulos a todo lo ancho y las tablas.
  return [
    ...ordenarFilas(filas.slice(0, region.desde), anchoPagina, profundidad),
    ...ordenarFilas(izquierda, anchoPagina, profundidad + 1),
    ...ordenarFilas(derecha, anchoPagina, profundidad + 1),
    ...ordenarFilas(filas.slice(region.hasta + 1), anchoPagina, profundidad),
  ];
}

// Convierte una página en texto plano respetando el orden de lectura.
export function paginaATexto(pagina: PaginaPdf): PaginaTexto {
  const filas = agruparEnFilas(pagina.items);
  const dosColumnas = detectarRegionDosColumnas(filas, 0, pagina.ancho) !== null;
  const lineas = ordenarFilas(filas, pagina.ancho);
  return {
    numero: pagina.numero,
    lineas,
    texto: lineas.join('\n'),
    dosColumnas,
  };
}
