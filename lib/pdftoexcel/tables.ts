// Formato de las tablas de honorarios (§D.3).
//
// Las filas llegan del lector de PDF con sus celdas separadas por dos espacios
// (el separador que produce `paginaATexto` al unir segmentos). Aquí se agrupan
// las filas con la misma cantidad de celdas en bloques de tabla y se les da el
// formato legible que pide la especificación.
//
//   Dos columnas:      [TABLA] Cargo | USD
//                      • Socio: 237
//
//   Tres o más:        [TABLA] Servicio | Honorario (USD) | Periodicidad
//                      • C. Declaración Anual de Impuesto a la Renta
//                        Honorario (USD): 6.480
//                        Periodicidad: Anual

// Separador de celdas que produce el lector de PDF.
const SEPARADOR_CELDA = /\s{2,}/;

// Filas consecutivas necesarias para considerar que hay una tabla.
const FILAS_MINIMAS_TABLA = 2;

// Una celda de tabla es compacta; más largo que esto es prosa a dos columnas.
const LARGO_MAXIMO_CELDA = 120;

const TIENE_NUMERO = /\d/;

export interface OpcionesTabla {
  // Etiqueta del bloque: "[TABLA]" en español, "[TABLE]" en inglés.
  etiqueta?: string;
  // Nombre de la primera columna cuando la tabla no trae encabezado propio.
  columnaPorDefecto?: string;
}

const celdasDe = (linea: string): string[] =>
  linea.split(SEPARADOR_CELDA).map((c) => c.trim()).filter(Boolean);

// Una línea sirve como encabezado si no trae cifras y es breve: son los
// rótulos de columna ("UF", "Recurrencia", "Periodicidad").
function esEncabezado(celdas: string[]): boolean {
  if (celdas.length === 0) return false;
  return celdas.every((c) => !TIENE_NUMERO.test(c) && c.length <= 40);
}

// Da formato a un bloque de filas con la misma cantidad de celdas.
function formatearBloque(
  encabezados: string[],
  filas: string[][],
  opciones: Required<OpcionesTabla>
): string[] {
  const salida: string[] = [];
  salida.push(`${opciones.etiqueta} ${encabezados.join(' | ')}`);

  // Dos columnas: una viñeta por fila, "clave: valor".
  if (encabezados.length === 2) {
    for (const fila of filas) {
      salida.push(`• ${fila[0]}: ${fila[1]}`);
    }
    return salida;
  }

  // Tres o más: la primera celda es la viñeta y el resto va etiquetado debajo.
  for (const fila of filas) {
    salida.push(`• ${fila[0]}`);
    for (let i = 1; i < fila.length; i++) {
      if (!fila[i]) continue;
      salida.push(`  ${encabezados[i]}: ${fila[i]}`);
    }
  }
  return salida;
}

// Convierte las líneas de una sección de honorarios en texto con las tablas ya
// formateadas. Las líneas que no forman parte de una tabla se dejan tal cual,
// salvo las listas simples de precios, que pasan a viñeta.
export function formatearTablas(lineas: string[], opciones: OpcionesTabla = {}): string {
  const config: Required<OpcionesTabla> = {
    etiqueta: opciones.etiqueta ?? '[TABLA]',
    columnaPorDefecto: opciones.columnaPorDefecto ?? 'Servicio',
  };

  const salida: string[] = [];
  // Rótulos de columna vistos en una línea suelta ("UF  Recurrencia"). Se
  // guardan porque suelen anunciarse una sola vez y valer para las tablas que
  // vienen después, incluso si entremedio hay títulos de sección.
  let etiquetasPendientes: string[] | null = null;
  let i = 0;

  while (i < lineas.length) {
    const celdas = celdasDe(lineas[i]);

    // ¿Arranca aquí un bloque de filas con la misma cantidad de celdas?
    if (celdas.length >= 2) {
      const ancho = celdas.length;
      const bloque: string[][] = [];
      let j = i;
      while (j < lineas.length) {
        const fila = celdasDe(lineas[j]);
        if (fila.length !== ancho) break;
        bloque.push(fila);
        j++;
      }

      // Un bloque de filas parejas no basta para ser tabla: el texto a dos
      // columnas también lo parece. Una tabla real tiene celdas compactas y
      // cifras en la mayoría de sus filas.
      const celdasCompactas = bloque.every((f) =>
        f.every((c) => c.length <= LARGO_MAXIMO_CELDA)
      );
      const filasConCifra = bloque.filter((f) => f.some((c) => TIENE_NUMERO.test(c))).length;
      const pareceTabla =
        celdasCompactas && filasConCifra >= Math.ceil(bloque.length / 2);

      if (bloque.length >= FILAS_MINIMAS_TABLA && pareceTabla) {
        // La primera fila hace de encabezado si no trae cifras.
        let encabezados: string[];
        let filas: string[][];
        if (esEncabezado(bloque[0]) && bloque.length > FILAS_MINIMAS_TABLA) {
          encabezados = bloque[0];
          filas = bloque.slice(1);
        } else {
          // Sin encabezado propio: se usan los rótulos anunciados antes. Suelen
          // nombrar solo las columnas de la derecha ("UF  Recurrencia"), así que
          // se alinean al final y la primera columna toma el nombre por defecto.
          const relleno = (desde: number, hasta: number) =>
            Array.from({ length: Math.max(0, hasta - desde) }, (_, k) => `Columna ${desde + k + 1}`);

          if (etiquetasPendientes && etiquetasPendientes.length === ancho) {
            encabezados = etiquetasPendientes;
          } else if (etiquetasPendientes && etiquetasPendientes.length < ancho) {
            encabezados = [
              config.columnaPorDefecto,
              ...relleno(1, ancho - etiquetasPendientes.length),
              ...etiquetasPendientes,
            ];
          } else {
            encabezados = [config.columnaPorDefecto, ...relleno(1, ancho)];
          }
          filas = bloque;
        }

        salida.push(...formatearBloque(encabezados, filas, config));
        i = j;
        continue;
      }
    }

    // Línea suelta de rótulos ("UF  Recurrencia"): no es contenido, son los
    // nombres de columna de la tabla que viene más abajo. Se guarda y no se
    // imprime. Solo se interpreta así si de verdad viene una tabla más ancha.
    if (celdas.length >= 2 && esEncabezado(celdas)) {
      const vieneTablaMasAncha = lineas
        .slice(i + 1, i + 6)
        .some((l) => celdasDe(l).length > celdas.length);
      if (vieneTablaMasAncha) {
        etiquetasPendientes = celdas;
        i++;
        continue;
      }
    }

    // Línea suelta: si es una lista simple de precios pasa a viñeta.
    const linea = lineas[i].trim();
    if (!linea) {
      // Separador entre láminas: los rótulos de columna no cruzan de página.
      etiquetasPendientes = null;
    } else {
      const yaEsVinieta = /^[•\-➢•]/.test(linea);
      if (!yaEsVinieta && celdas.length >= 2 && TIENE_NUMERO.test(linea)) {
        salida.push(`• ${celdas.join(': ')}`);
      } else {
        // Se normalizan los símbolos de viñeta del PDF al estándar del formato.
        salida.push(linea.replace(/^[➢•●▪]\s*/, '• '));
      }
    }
    i++;
  }

  return salida.join('\n');
}
