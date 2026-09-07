// Clasificación de páginas y limpieza de bloques (§B y §C).
//
// Cada página se marca como SERVICIOS, HONORARIOS o IGNORAR, siempre con un
// motivo que queda registrado en el log de decisiones. Ante la duda, la página
// se INCLUYE y se marca: nunca se elimina contenido en silencio.
//
// Todas las reglas viven en las listas de este archivo. Afinar el
// comportamiento es agregar o quitar patrones aquí, sin tocar el pipeline.

import type { PaginaTexto } from './readingOrder';

export type Categoria = 'SERVICIOS' | 'HONORARIOS' | 'IGNORAR';

export interface PaginaClasificada {
  numero: number;
  categoria: Categoria;
  motivo: string;
  // Líneas que sobreviven a la limpieza de bloques.
  lineas: string[];
  // Líneas descartadas dentro de la página, con su razón (para el log).
  descartes: { linea: string; motivo: string }[];
  dudosa: boolean;
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// ─── Reglas de título ───────────────────────────────────────────────────────

// Secciones que nunca aportan ni servicios ni honorarios (§B "NO se extrae").
export const TITULOS_DESCARTE = [
  'nuestro equipo',
  'our team',
  'por que bdo',
  'why bdo',
  'nuestra organizacion',
  'our organization',
  'nuestra tecnologia',
  'our technology',
  'portal global',
  'global portal',
  'propuesta de valor',
  'value proposition',
  'certificaciones',
  'certifications',
  'resultados financieros',
  'financial results',
  'indice',
  'contenido',
  'agenda',
  'table of contents',
  'executive summary',
  'resumen ejecutivo',
  'carta de presentacion',
  'acuerdo de confidencialidad',
  'confidentiality agreement',
  'condiciones limitantes',
  'limiting conditions',
  'politica de proteccion de datos',
  'data protection policy',
  'aceptacion de la propuesta',
  'acceptance of the proposal',
  'acuerdo servicios profesionales',
  'professional services agreement',
  'mas informacion',
  'more information',
  'nota',
  'timeline',
  'systematic process',
  // Catálogo de líneas de negocio del inicio: solo nombres, sin detalle.
  // Ojo: "Our Services" en las propuestas en inglés SÍ es la sección de
  // servicios, por eso solo se descarta la variante en español.
  'nuestros servicios',
  'nuestro equipo',
  'our team bso',
  'professional team',
  'equipo profesional',
  'data security',
  'seguridad de la informacion',
  'proposal acceptance',
  'about bdo',
  'about de bdo',
  'bdo in chile',
  'bdo en chile',
  'contactenos',
  'contact us',
  'otros',
  'portal global bdo',
  'global portal bdo',
  'hagalo todo con bdo',
  'resultados',
];

// Títulos que abren la sección de honorarios (§C).
export const TITULOS_HONORARIOS = [
  'professional fees',
  'honorarios',
  'propuesta economica',
  'economic proposal',
  'fees',
  'propuesta economica de servicios',
  'honorarios profesionales',
];

// Títulos que abren o continúan la sección de servicios (§B "SÍ se extrae").
export const TITULOS_SERVICIOS = [
  'accounting services',
  'asesoria contable',
  'servicio contable',
  'back office',
  'start-up',
  'startup',
  'scope of our services',
  'alcance de nuestros servicios',
  'cumplimiento tributario',
  'tax compliance',
  'tax advice',
  'asesoria tributaria',
  'objetivo',
  'objective',
  'alcance',
  'scope',
  'actividades',
  'activities',
  'proceso',
  'process',
  'reportes',
  'reports',
  'entregables',
  'deliverables',
  'introduction',
  'introduccion',
  'servicio de control',
  'cuentas por pagar',
  'cuentas por cobrar',
  'accounts payable',
  'accounts receivable',
  'tesoreria',
  'treasury',
  'servicios de tesoreria',
  'dte',
  'legal aspects',
  'aspectos legales',
  'estados financieros',
  'financial statements',
  'remuneraciones',
  'payroll',
  'our services',
  'administrative aspects',
  'aspectos administrativos',
  'servicio contable',
  'consultoria ifrs',
  'representacion con terceros',
  'custodia de documentos',
  'procesos adicionales',
  'notificaciones',
];

// ─── Reglas de bloque (dentro de una página) ────────────────────────────────

// Encabezado de "Comentarios": todo lo que sigue en la página se descarta,
// en cualquier sección (§B y §C lo exigen explícitamente).
// El rótulo puede venir solo en su línea ("Comentarios") o pegado al texto del
// comentario ("Comment It will be the responsibility of the Administration…").
const ENCABEZADO_COMENTARIOS = /^(comentarios?|comments?)\b\s*:?(\s|$)/i;

// Pie de página de las láminas ("© BDO"): no es contenido.
const LINEA_PIE = /^(©|\(c\))\s*bdo/i;

// Datos bancarios y de cobranza (§C "NO se extrae").
const LINEA_BANCARIA =
  /(cuenta corriente|cta\.?\s*cte|cuenta bancaria|^titular\s*:|^cuenta\s*:|^entidad\s*:|correo electr[oó]nico\s*:|bank account|bank references|referencias bancarias|datos bancarios|banco\b|bank\b|swift|n[uú]mero de cuenta|^account\b|correo de cobranza|rut\.?\s*:?\s*[\d.]+-?[\dkK]?$)/i;

// Símbolos de viñeta, incluidos los de fuentes simbólicas (Wingdings), que
// pdf.js entrega como caracteres de uso privado.
const MARCADOR_VINIETA = /^[\u2022\u25CF\u25AA\u00B7\u25E6\u2023\u2043\u27A2\u27A3\u25BA\u25B6\u2219\u2713\u2714\uE000-\uF8FF]\s*/u;

const enMayusculas = (linea: string) =>
  linea === linea.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(linea);

// Frontera estructural dentro de una lámina: una fila de tabla o un rótulo en
// mayúsculas. Marca dónde termina un bloque lateral y empieza el contenido.
const esFrontera = (linea: string) =>
  /\s{2,}/.test(linea) || (enMayusculas(linea) && linea.length <= 70);

// Texto legal y de política que acompaña a los honorarios pero no define un
// valor del servicio (§C lo enumera: IVA, ley 21.420, reajustes cada seis
// meses, desembolsos, gastos de viaje, no contratación de personal, vigencia
// de la propuesta, duración del contrato).
const TEXTO_LEGAL_HONORARIOS =
  /(ley\s*n[°ºo]?\s*21\.?420|hecho gravado|exent[oa]s?\s+de\s+iva|afect[oa]s?\s+a\s+iva|sociedad(es)? de profesionales|reajust|repactar|hard disbursement|desembolsos|gastos de viaje|no podr[aá] contratar|indemnizar a bdo|vigencia de (la|esta) propuesta|duraci[oó]n m[ií]nima|renovaci[oó]n autom[aá]tica|decreto ley|written notice|terminate this agreement|either party|with or without cause|unlimited duration|automatic renewal|travel expenses|notary fees)/i;

// Honorarios sin cifra: "se acordará de común acuerdo" (§C se descarta).
const SIN_CIFRA_ACORDADA =
  /(de com[uú]n acuerdo|by mutual agreement|mutuo acuerdo|a convenir|to be agreed)/i;

// Señales de que una línea define un valor: montos, monedas, porcentajes.
const TIENE_VALOR =
  /(\d[\d.,]*\s*(uf|usd|clp|eur|%)|(?:uf|usd|clp|eur|\$)\s*\d|\b\d{1,3}(?:[.,]\d{3})+\b|\b\d+\b)/i;

// Palabras que delatan una lámina de honorarios aunque el título no lo diga.
const SENALES_HONORARIOS =
  /(pago [uú]nico|mensual|anual|monthly|annual|one[- ]time|periodicidad|recurrencia|honorario|fee\b|tarifa|valor hora|hourly rate)/i;

// ─── Encabezados y pies recurrentes ────────────────────────────────────────

// Cuántas láminas debe repetir una línea para considerarla encabezado o pie.
const PROPORCION_RECURRENTE = 0.3;
// Solo se miran las primeras y últimas líneas de cada lámina: ahí viven los
// encabezados y pies, y así no se borra contenido del cuerpo por accidente.
const LINEAS_BORDE = 2;

// Forma normalizada que ignora la numeración, para que "P3 PROPUESTA…" y
// "P4 PROPUESTA…" se reconozcan como la misma línea recurrente.
const huella = (linea: string) => normalizar(linea).replace(/\d+/g, '#');

// Quita de todas las páginas las líneas que se repiten como encabezado o pie
// ("P38 PROFESSIONAL SERVICES PROPOSAL | ENERCON"). Sin esto, el título real de
// la lámina queda tapado y la clasificación falla en cadena.
export function quitarRecurrentes(paginas: PaginaTexto[]): PaginaTexto[] {
  if (paginas.length < 4) return paginas;

  const conteo = new Map<string, number>();
  for (const pagina of paginas) {
    const bordes = [
      ...pagina.lineas.slice(0, LINEAS_BORDE),
      ...pagina.lineas.slice(-LINEAS_BORDE),
    ];
    // Un mismo texto no cuenta dos veces dentro de la misma lámina.
    for (const linea of new Set(bordes.map(huella))) {
      if (linea.length < 4) continue;
      conteo.set(linea, (conteo.get(linea) ?? 0) + 1);
    }
  }

  const minimo = Math.max(3, Math.ceil(paginas.length * PROPORCION_RECURRENTE));
  const recurrentes = new Set(
    [...conteo.entries()].filter(([, veces]) => veces >= minimo).map(([h]) => h)
  );
  if (recurrentes.size === 0) return paginas;

  // Etiquetas laterales: el título de una sección se repite como banda vertical
  // al costado de la lámina, y pdf.js lo entrega pegado al texto del cuerpo
  // ("Asesoría Contable  ajustes y otros requerimientos similares."). Se
  // reconocen porque son títulos de página que se repiten, y se quitan SOLO
  // cuando la línea trae más contenido detrás.
  const titulos = new Map<string, number>();
  for (const pagina of paginas) {
    const primera = pagina.lineas[0];
    if (!primera) continue;
    const h = huella(primera);
    titulos.set(h, (titulos.get(h) ?? 0) + 1);
  }
  const etiquetas = new Set(
    [...titulos.entries()].filter(([, veces]) => veces >= 2).map(([h]) => h)
  );

  const quitarEtiquetaLateral = (linea: string): string => {
    const partes = linea.split(/\s{2,}/);
    if (partes.length < 2 || !etiquetas.has(huella(partes[0]))) return linea;
    return partes.slice(1).join('  ');
  };

  return paginas.map((pagina) => {
    const lineas = pagina.lineas
      .filter((l) => !recurrentes.has(huella(l)))
      .map(quitarEtiquetaLateral)
      .filter((l) => l.trim() !== '');
    return { ...pagina, lineas, texto: lineas.join('\n') };
  });
}

// Títulos de una lámina: la primera línea con contenido y, si existe, el
// subtítulo. Las láminas de BDO ponen la etiqueta de sección arriba
// ("OUR SERVICES", "Asesoría Contable") y el título real debajo
// ("TAX ADVICE", "Servicio Contable"), así que hay que mirar ambas.
//
// La segunda línea solo cuenta como subtítulo si es breve y no termina en dos
// puntos ni en punto: así no se confunde un párrafo con un título.
function titulosDe(pagina: PaginaTexto): string[] {
  const utiles = pagina.lineas.filter((l) => l.trim().length > 2);
  const titulos = utiles.length ? [normalizar(utiles[0])] : [];
  const segunda = utiles[1]?.trim();
  if (segunda && segunda.length <= 60 && !/[:.]$/.test(segunda)) {
    titulos.push(normalizar(segunda));
  }
  return titulos;
}

// Los patrones muy cortos ("otros", "fees", "dte") solo valen como coincidencia
// exacta: buscarlos dentro del texto daría falsos positivos ("nosotros").
const LARGO_PATRON_EXACTO = 6;

// El título de una lámina EMPIEZA por el nombre de su sección. Buscar el patrón
// en cualquier posición produce falsos positivos: un párrafo legal que menciona
// "contenido" no es un índice.
function coincideUno(titulo: string, patron: string): boolean {
  if (patron.length <= LARGO_PATRON_EXACTO) {
    return titulo === patron || titulo.startsWith(`${patron} `);
  }
  return titulo === patron || titulo.startsWith(patron);
}

// Cargos de personas: las láminas de currículum del equipo se descartan
// (§B "Equipo profesional, CVs, fotos, contactos"). Se detectan por el cargo
// que aparece bajo el nombre, porque el nombre en sí no es reconocible.
const TITULO_PERSONA =
  /^(managing partner|senior manager|socio|socia|partner|director|directora|gerente|manager|contador|abogad)/i;

const coincide = (titulos: string[], lista: string[]) =>
  titulos.some((t) => lista.some((p) => coincideUno(t, p)));

// Quita de una página los bloques que la especificación descarta siempre.
function limpiarBloques(
  lineas: string[],
  categoria: Categoria
): { lineas: string[]; descartes: { linea: string; motivo: string }[] } {
  const descartes: { linea: string; motivo: string }[] = [];

  // Paso 1: unir las viñetas que el PDF trae partidas en varias líneas, para
  // decidir sobre el ítem completo y no sobre un fragmento suelto. Una línea es
  // continuación si no abre viñeta, no es una fila de tabla (sin separador de
  // celdas) y viene después de una viñeta.
  const unidas: string[] = [];
  let enVinieta = false;
  for (const cruda of lineas) {
    const limpia = cruda.trim().replace(MARCADOR_VINIETA, '• ');
    if (!limpia) {
      enVinieta = false;
      continue;
    }
    const abreVinieta = limpia.startsWith('• ');
    const esFilaTabla = /\s{2,}/.test(limpia);
    // Una continuación empieza en minúscula: es la misma frase que sigue. Si
    // empieza en mayúscula ya es otro párrafo y la viñeta se cierra. Sin esta
    // condición se absorbían los párrafos posteriores a la lista.
    const esContinuacion = /^[a-záéíóúñü(]/.test(limpia);
    if (
      esContinuacion &&
      !abreVinieta &&
      !esFilaTabla &&
      enVinieta &&
      !ENCABEZADO_COMENTARIOS.test(limpia)
    ) {
      unidas[unidas.length - 1] = `${unidas[unidas.length - 1]} ${limpia}`;
      continue;
    }
    enVinieta = abreVinieta;
    unidas.push(limpia);
  }

  // Paso 2: descartar lo que la especificación excluye.
  const salida: string[] = [];
  let enComentarios = false;

  for (const limpia of unidas) {

    // El rótulo "Comentarios" puede venir en medio de una línea, porque en las
    // láminas a dos columnas el comentario va al costado del contenido. Se
    // corta la línea ahí y se conserva solo lo que había antes.
    const celdas = limpia.split(/\s{2,}/);
    const inicioComentario = celdas.findIndex((c) => ENCABEZADO_COMENTARIOS.test(c.trim()));
    if (inicioComentario >= 0) {
      enComentarios = true;
      descartes.push({
        linea: celdas.slice(inicioComentario).join('  '),
        motivo: 'bloque Comentarios',
      });
      const antes = celdas.slice(0, inicioComentario).join('  ').trim();
      if (!antes) continue;
      // Lo que iba antes del comentario sigue siendo contenido válido.
      salida.push(antes);
      continue;
    }
    // El bloque de comentarios termina en la primera frontera estructural. Sin
    // esto se perdía el resto de la lámina: en las propuestas el comentario va
    // en una columna lateral y la tabla de honorarios viene después.
    if (enComentarios) {
      if (esFrontera(limpia)) {
        enComentarios = false;
      } else {
        descartes.push({ linea: limpia, motivo: 'bloque Comentarios' });
        continue;
      }
    }

    if (LINEA_PIE.test(limpia)) {
      descartes.push({ linea: limpia, motivo: 'pie de página' });
      continue;
    }

    if (LINEA_BANCARIA.test(limpia)) {
      descartes.push({ linea: limpia, motivo: 'datos bancarios' });
      continue;
    }

    if (categoria === 'HONORARIOS') {
      if (TEXTO_LEGAL_HONORARIOS.test(limpia)) {
        descartes.push({ linea: limpia, motivo: 'texto legal / política de honorarios' });
        continue;
      }
      if (SIN_CIFRA_ACORDADA.test(limpia) && !TIENE_VALOR.test(limpia)) {
        descartes.push({ linea: limpia, motivo: 'honorario sin cifra' });
        continue;
      }
      // Solo sobrevive lo que define un valor o rotula una sección: los
      // párrafos introductorios ("Based on the foregoing, we have determined
      // that our professional fees…") se descartan (§C). Un rótulo es una línea
      // en mayúsculas o el nombre de una sección conocida; no basta con que sea
      // corta, porque el texto de una columna angosta también lo es.
      // También se conserva la frase que ENCABEZA una lista de valores
      // ("Servicio de Contabilidad, Nuestros honorarios ascienden a:"). Debe
      // empezar en mayúscula: así no se cuela un fragmento de párrafo suelto
      // ("according to the following detail:").
      const encabezaValores =
        /:$/.test(limpia) && limpia.length <= 80 && /^[A-ZÁÉÍÓÚÑ¿0-9]/.test(limpia);
      const esRotulo =
        enMayusculas(limpia) ||
        encabezaValores ||
        coincide([normalizar(limpia)], [...TITULOS_HONORARIOS, ...TITULOS_SERVICIOS]);
      if (!TIENE_VALOR.test(limpia) && !esRotulo) {
        descartes.push({ linea: limpia, motivo: 'párrafo introductorio sin valores' });
        continue;
      }
    }

    salida.push(limpia);
  }

  return { lineas: salida, descartes };
}

// Clasifica todas las páginas del documento. El estado de la página anterior
// permite que una sección se extienda por varias láminas consecutivas (los
// honorarios de Enercon ocupan cinco).
export function clasificarPaginas(paginas: PaginaTexto[]): PaginaClasificada[] {
  const resultado: PaginaClasificada[] = [];
  let seccionActual: Categoria = 'IGNORAR';

  for (const pagina of paginas) {
    const titulos = titulosDe(pagina);
    let lineasPagina = pagina.lineas;

    // Encabezado de plantilla obsoleto: la lámina abre con el título de otra
    // sección ("Nuestra Tecnología") pero su contenido real continúa la sección
    // que ya venía abierta ("Cumplimiento Tributario"). Solo se ignora ese
    // primer rótulo en ese caso; si no hay sección abierta, el título manda y
    // la lámina se descarta como corresponde.
    const continuaSeccionAbierta =
      seccionActual !== 'IGNORAR' &&
      coincide(
        titulos.slice(1),
        seccionActual === 'SERVICIOS' ? TITULOS_SERVICIOS : TITULOS_HONORARIOS
      );
    if (
      titulos.length > 1 &&
      coincide([titulos[0]], TITULOS_DESCARTE) &&
      continuaSeccionAbierta
    ) {
      titulos.shift();
      lineasPagina = lineasPagina.slice(1);
    }

    const cuerpo = lineasPagina.join(' ');
    const largo = cuerpo.replace(/\s+/g, '').length;

    let categoria: Categoria;
    let motivo: string;
    let dudosa = false;

    if (largo === 0) {
      categoria = 'IGNORAR';
      motivo = 'sin texto extraíble (imagen o diagrama)';
    } else if (titulos.some((t) => TITULO_PERSONA.test(t))) {
      categoria = 'IGNORAR';
      motivo = 'ficha de una persona del equipo';
      seccionActual = 'IGNORAR';
    } else if (coincide(titulos, TITULOS_DESCARTE)) {
      categoria = 'IGNORAR';
      motivo = `sección descartada por título: "${titulos.join(" | ")}"`;
      seccionActual = 'IGNORAR';
    } else if (coincide(titulos, TITULOS_HONORARIOS)) {
      categoria = 'HONORARIOS';
      motivo = `título de honorarios: "${titulos.join(" | ")}"`;
      seccionActual = 'HONORARIOS';
    } else if (coincide(titulos, TITULOS_SERVICIOS)) {
      categoria = 'SERVICIOS';
      motivo = `título de servicios: "${titulos.join(" | ")}"`;
      seccionActual = 'SERVICIOS';
    } else if (SENALES_HONORARIOS.test(cuerpo) && TIENE_VALOR.test(cuerpo)) {
      categoria = 'HONORARIOS';
      motivo = 'contiene montos y periodicidad, sin título reconocido';
      dudosa = true;
      seccionActual = 'HONORARIOS';
    } else if (seccionActual !== 'IGNORAR' && largo > 120) {
      // Continuación de la sección anterior: el título no se reconoce pero la
      // lámina trae contenido sustancial.
      categoria = seccionActual;
      motivo = `continúa la sección ${seccionActual} de la lámina anterior`;
      dudosa = true;
    } else {
      categoria = 'IGNORAR';
      motivo = largo <= 120 ? 'lámina divisoria o sin contenido' : 'sin sección reconocida';
    }

    let { lineas, descartes } =
      categoria === 'IGNORAR'
        ? { lineas: [] as string[], descartes: [] as { linea: string; motivo: string }[] }
        : limpiarBloques(lineasPagina, categoria);

    // Lámina de índice: pocas líneas, cada una "texto  número de página".
    // Trae el título de la sección pero ninguna información propia.
    if (categoria !== 'IGNORAR' && lineas.length <= 5) {
      const entradas = lineas.filter((l) => /^.{3,60}\s{2,}\d{1,3}$/.test(l));
      if (entradas.length > 0) {
        descartes = [
          ...descartes,
          ...entradas.map((linea) => ({ linea, motivo: 'entrada de índice' })),
        ];
        lineas = lineas.filter((l) => !entradas.includes(l));
      }
    }

    // Si la limpieza dejó la página vacía, deja de aportar.
    if (categoria !== 'IGNORAR' && lineas.length === 0) {
      resultado.push({
        numero: pagina.numero,
        categoria: 'IGNORAR',
        motivo: `${motivo} — sin contenido tras descartar bloques`,
        lineas: [],
        descartes,
        dudosa,
      });
      continue;
    }

    resultado.push({ numero: pagina.numero, categoria, motivo, lineas, descartes, dudosa });
  }

  return resultado;
}
