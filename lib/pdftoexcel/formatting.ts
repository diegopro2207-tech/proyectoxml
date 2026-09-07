// Ajuste tipográfico final del texto (§D.1 de la especificación).
//
// Reglas:
//   · Ancho máximo de línea: 60 caracteres.
//   · El corte se hace por palabras. Si una palabra sola no cabe en la línea,
//     se parte y se añade un guión al final; el guión CUENTA dentro de los 60.
//   · Las líneas de continuación de una viñeta se alinean con sangría colgante,
//     es decir, quedan bajo el texto del ítem y no bajo el marcador.
//
// Este es el ÚLTIMO paso del pipeline: nunca se traduce texto ya cortado.

export const ANCHO_MAXIMO = 60;

// Marcadores de lista reconocidos al inicio de una línea:
//   "• " (viñeta principal), "- " (sub-ítem), "a) " / "b) " (ítems etiquetados).
const MARCADOR = /^(•\s+|-\s+|[a-z]\)\s+)/i;

// Reparte el contenido de UNA línea lógica en líneas de ancho acotado.
// `presupuestoInicial` es el espacio disponible en la primera línea y
// `presupuestoResto` el de las siguientes (menor cuando hay sangría colgante).
function repartir(
  contenido: string,
  presupuestoInicial: number,
  presupuestoResto: number
): string[] {
  const salida: string[] = [];
  const palabras = contenido.split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [''];

  let linea = '';
  let presupuesto = presupuestoInicial;

  // Cierra la línea en curso y pasa al presupuesto de continuación.
  const cerrar = () => {
    salida.push(linea);
    linea = '';
    presupuesto = presupuestoResto;
  };

  // Coloca una palabra en una línea vacía, partiéndola con guión si no cabe.
  const colocarEnLineaVacia = (palabra: string) => {
    let resto = palabra;
    while (resto.length > presupuesto) {
      // Se reserva 1 carácter para el guión, que cuenta dentro del ancho.
      const corte = Math.max(1, presupuesto - 1);
      salida.push(resto.slice(0, corte) + '-');
      resto = resto.slice(corte);
      presupuesto = presupuestoResto;
    }
    linea = resto;
  };

  for (const palabra of palabras) {
    if (linea === '') {
      colocarEnLineaVacia(palabra);
    } else if (linea.length + 1 + palabra.length <= presupuesto) {
      linea += ' ' + palabra;
    } else {
      cerrar();
      colocarEnLineaVacia(palabra);
    }
  }
  if (linea !== '') salida.push(linea);

  return salida;
}

// Ajusta una única línea lógica respetando su marcador y sangría.
function ajustarLinea(linea: string, ancho: number): string[] {
  // Las líneas en blanco (separadores entre secciones) se conservan tal cual.
  if (linea.trim() === '') return [''];

  const sangria = linea.match(/^\s*/)?.[0] ?? '';
  const sinSangria = linea.slice(sangria.length);
  const marcador = sinSangria.match(MARCADOR)?.[0] ?? '';
  const contenido = sinSangria.slice(marcador.length);

  const prefijoPrimera = sangria + marcador;
  // Sangría colgante: el texto de continuación queda bajo el texto del ítem,
  // por eso el marcador se reemplaza por espacios del mismo ancho.
  const prefijoResto = sangria + ' '.repeat(marcador.length);

  // Se garantiza al menos 1 carácter de presupuesto para no entrar en bucle
  // cuando la sangría es absurdamente grande.
  const presupuestoInicial = Math.max(1, ancho - prefijoPrimera.length);
  const presupuestoResto = Math.max(1, ancho - prefijoResto.length);

  const partes = repartir(contenido, presupuestoInicial, presupuestoResto);
  return partes.map((p, i) => (i === 0 ? prefijoPrimera : prefijoResto) + p);
}

// Ajusta un bloque completo de texto a `ancho` caracteres por línea.
// Conserva los saltos de línea originales (incluidas las líneas en blanco que
// separan secciones) y aplica sangría colgante a las viñetas.
export function ajustarAncho(texto: string, ancho = ANCHO_MAXIMO): string {
  if (!texto) return '';
  return texto
    .split('\n')
    .flatMap((linea) => ajustarLinea(linea.replace(/\s+$/, ''), ancho))
    .join('\n');
}
