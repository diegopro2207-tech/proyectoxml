// Formato del texto de servicios.
//
// La salida se estructura para que el orden se note a simple vista:
//
//   Nombre del servicio
//   Subtítulo (si lo hay)
//
//   Descripción del servicio, cuando existe.
//
//   - Primer punto del detalle.
//   - Segundo punto del detalle.
//
// Es decir: primero el NOMBRE, después la DESCRIPCIÓN y al final el DETALLE en
// viñetas, cada una en su propio párrafo y precedida por "- ".
//
// Las líneas llegan ya normalizadas desde `classify`: las viñetas empiezan por
// "• " y las que el PDF traía partidas ya vienen unidas.

// Servicios que no deben extraerse nunca. El bloque completo del servicio
// (su rótulo, su descripción y sus viñetas) se omite.
export const SERVICIOS_OMITIDOS = [/^start[\s-]?up\b/i, /^puesta en marcha\b/i];

// Un rótulo encabeza un bloque: es breve, no cierra como una frase y tiene
// pocas palabras. La condición de las palabras es la que importa: sin ella, la
// continuación de una viñeta ("Republic General Treasury and the
// Municipalities, among") se confundiría con un título.
function esRotulo(linea: string): boolean {
  if (linea.length > 60 || /[.;,]$/.test(linea)) return false;
  const enMayusculas = linea === linea.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(linea);
  return enMayusculas || linea.split(/\s+/).length <= 6;
}

const esVinieta = (linea: string) => linea.startsWith('• ');

const debeOmitirse = (linea: string) =>
  SERVICIOS_OMITIDOS.some((patron) => patron.test(linea.replace(/^[•\-]\s*/, '')));

// Da formato a las líneas de UNA lámina de servicios.
function formatearLamina(lineas: string[]): string[] {
  const salida: string[] = [];
  const descripcion: string[] = [];
  const vinietas: string[] = [];
  // Mientras se omite un servicio se descartan su descripción y sus viñetas,
  // hasta que aparece el rótulo del siguiente bloque.
  let omitiendo = false;

  const volcarDescripcion = () => {
    if (descripcion.length === 0) return;
    if (salida.length) salida.push('');
    salida.push(descripcion.join(' '));
    descripcion.length = 0;
  };

  const volcarVinietas = () => {
    if (vinietas.length === 0) return;
    if (salida.length) salida.push('');
    salida.push(...vinietas.map((v) => `- ${v}`));
    vinietas.length = 0;
  };

  for (const [indice, linea] of lineas.entries()) {
    const limpia = linea.trim();
    if (!limpia) continue;

    if (esVinieta(limpia)) {
      if (omitiendo) continue;
      vinietas.push(limpia.slice(2).trim());
      continue;
    }

    // Fragmento que continúa la descripción anterior: empieza en minúscula, así
    // que no puede ser un rótulo aunque sea corto ("activities:").
    const continuaDescripcion = descripcion.length > 0 && /^[a-záéíóúñü(]/.test(limpia);

    // Línea sin viñeta: o es un rótulo (abre bloque) o es descripción.
    if (!continuaDescripcion && esRotulo(limpia)) {
      // Mientras se omite un servicio, solo lo cierra el rótulo del SIGUIENTE
      // servicio. Un sub-rótulo que introduce sus valores ("Our services
      // consider:") pertenece al bloque omitido y no lo reactiva.
      if (omitiendo && /:$/.test(limpia)) continue;

      if (!omitiendo) {
        volcarDescripcion();
        volcarVinietas();
      }
      omitiendo = debeOmitirse(limpia);
      if (omitiendo) continue;

      // La primera línea de la lámina es el nombre del servicio; el resto de
      // los rótulos son subtítulos de bloque ("Objetivo", "Entregables:").
      if (salida.length && indice > 0) salida.push('');
      salida.push(limpia);
      continue;
    }

    if (omitiendo) continue;

    // Sin rótulo y ya dentro del detalle: es la continuación de la última
    // viñeta, que el PDF trae cortada en varias líneas.
    if (vinietas.length > 0) {
      vinietas[vinietas.length - 1] = `${vinietas[vinietas.length - 1]} ${limpia}`;
      continue;
    }

    descripcion.push(limpia);
  }

  volcarDescripcion();
  volcarVinietas();
  return salida;
}

// Da formato a todas las láminas de servicios. `bloques` trae las líneas de
// cada lámina por separado, para poder agrupar nombre, descripción y detalle.
export function formatearServicios(bloques: string[][]): string {
  const partes: string[] = [];
  // Rótulos ya emitidos al final del bloque anterior: si la lámina siguiente
  // vuelve a abrir con uno de ellos, no se repite. Varias láminas seguidas
  // describen el mismo servicio y deben leerse como un solo bloque.
  let emitidos: string[] = [];

  for (const bloque of bloques) {
    const lineas = formatearLamina(bloque);

    while (lineas.length > 0 && emitidos.includes(lineas[0])) lineas.shift();
    if (lineas.length === 0) continue;

    // Se recuerdan los rótulos con los que abre esta lámina.
    emitidos = [];
    for (const linea of lineas) {
      if (!esRotulo(linea) || linea.startsWith('- ')) break;
      emitidos.push(linea);
    }

    if (partes.length) partes.push('');
    partes.push(lineas.join('\n'));
  }

  return partes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
