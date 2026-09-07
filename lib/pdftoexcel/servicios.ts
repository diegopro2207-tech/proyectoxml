// Formato del texto de servicios (§D.2).
//
// Estructura buscada por bloque:
//
//   TÍTULO DE LA SECCIÓN
//   Subtítulo
//   Frase introductoria:  ítem uno.  ítem dos.  ítem tres.
//
// Los ítems de viñeta van corridos dentro del párrafo, separados por DOS
// espacios, replicando cómo sale el texto del PDF original. Cada sección nueva
// empieza en línea aparte y entre secciones distintas va una línea en blanco.

// Símbolos de viñeta que usan las láminas de BDO.
const MARCADOR_VINIETA = /^[➢•●▪·−–—-]\s*/;

// Un título es corto, no termina en punto y no es una frase larga.
function esTitulo(linea: string): boolean {
  const limpia = linea.trim();
  if (limpia.length === 0 || limpia.length > 60) return false;
  if (/[.;,]$/.test(limpia)) return false;
  if (MARCADOR_VINIETA.test(limpia)) return false;

  const palabras = limpia.split(/\s+/).length;
  const enMayusculas = limpia === limpia.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(limpia);
  return enMayusculas || palabras <= 6;
}

// Convierte las líneas de una sección de servicios en el formato de §D.2.
export function formatearServicios(lineas: string[]): string {
  const salida: string[] = [];
  // Elementos del párrafo en curso: la frase introductoria y luego cada ítem.
  let parrafo: string[] = [];

  const cerrarParrafo = () => {
    if (parrafo.length === 0) return;
    salida.push(parrafo.join('  '));
    parrafo = [];
  };

  for (const cruda of lineas) {
    const linea = cruda.trim();
    if (!linea) continue;

    if (MARCADOR_VINIETA.test(linea)) {
      // Nuevo ítem del párrafo en curso.
      parrafo.push(linea.replace(MARCADOR_VINIETA, '').trim());
      continue;
    }

    if (esTitulo(linea)) {
      cerrarParrafo();
      salida.push(linea);
      continue;
    }

    if (parrafo.length > 0) {
      // Continuación de la línea anterior: el PDF ya venía cortado en líneas,
      // así que se vuelve a unir antes de reformatear.
      parrafo[parrafo.length - 1] = `${parrafo[parrafo.length - 1]} ${linea}`.trim();
    } else {
      parrafo.push(linea);
    }
  }
  cerrarParrafo();

  return salida.join('\n');
}
