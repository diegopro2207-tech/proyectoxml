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
];

// ─── Reglas de bloque (dentro de una página) ────────────────────────────────

// Encabezado de "Comentarios": todo lo que sigue en la página se descarta,
// en cualquier sección (§B y §C lo exigen explícitamente).
const ENCABEZADO_COMENTARIOS = /^(comentarios?|comments?)\b[:\s]*$/i;

// Pie de página de las láminas ("© BDO"): no es contenido.
const LINEA_PIE = /^(©|\(c\))\s*bdo/i;

// Datos bancarios y de cobranza (§C "NO se extrae").
const LINEA_BANCARIA =
  /(cuenta corriente|cuenta bancaria|bank account|datos bancarios|banco\b|swift|n[uú]mero de cuenta|correo de cobranza|rut\s*:?\s*\d)/i;

// Honorarios sin cifra: "se acordará de común acuerdo" (§C se descarta).
const SIN_CIFRA_ACORDADA =
  /(de com[uú]n acuerdo|by mutual agreement|mutuo acuerdo|a convenir|to be agreed)/i;

// Señales de que una línea define un valor: montos, monedas, porcentajes.
const TIENE_VALOR =
  /(\d[\d.,]*\s*(uf|usd|clp|eur|%)|(?:uf|usd|clp|eur|\$)\s*\d|\b\d{1,3}(?:[.,]\d{3})+\b|\b\d+\b)/i;

// Palabras que delatan una lámina de honorarios aunque el título no lo diga.
const SENALES_HONORARIOS =
  /(pago [uú]nico|mensual|anual|monthly|annual|one[- ]time|periodicidad|recurrencia|honorario|fee\b|tarifa|valor hora|hourly rate)/i;

// Un título de página es la primera línea con contenido real.
function tituloDe(pagina: PaginaTexto): string {
  return normalizar(pagina.lineas.find((l) => l.trim().length > 2) ?? '');
}

const coincide = (titulo: string, lista: string[]) =>
  lista.some((p) => titulo === p || titulo.startsWith(p) || titulo.includes(p));

// Quita de una página los bloques que la especificación descarta siempre.
function limpiarBloques(
  lineas: string[],
  categoria: Categoria
): { lineas: string[]; descartes: { linea: string; motivo: string }[] } {
  const salida: string[] = [];
  const descartes: { linea: string; motivo: string }[] = [];
  let enComentarios = false;

  for (const linea of lineas) {
    const limpia = linea.trim();
    if (!limpia) continue;

    // Una vez abierto el bloque "Comentarios", se descarta el resto de la página.
    if (ENCABEZADO_COMENTARIOS.test(limpia)) {
      enComentarios = true;
      descartes.push({ linea: limpia, motivo: 'bloque Comentarios' });
      continue;
    }
    if (enComentarios) {
      descartes.push({ linea: limpia, motivo: 'bloque Comentarios' });
      continue;
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
      if (SIN_CIFRA_ACORDADA.test(limpia) && !TIENE_VALOR.test(limpia)) {
        descartes.push({ linea: limpia, motivo: 'honorario sin cifra' });
        continue;
      }
      // Párrafos introductorios sin valores. Se conservan las líneas cortas
      // porque suelen ser títulos de sección o cabeceras de tabla.
      if (limpia.length > 90 && !TIENE_VALOR.test(limpia)) {
        descartes.push({ linea: limpia, motivo: 'párrafo sin valores' });
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
    const titulo = tituloDe(pagina);
    const cuerpo = pagina.lineas.join(' ');
    const largo = cuerpo.replace(/\s+/g, '').length;

    let categoria: Categoria;
    let motivo: string;
    let dudosa = false;

    if (largo === 0) {
      categoria = 'IGNORAR';
      motivo = 'sin texto extraíble (imagen o diagrama)';
    } else if (coincide(titulo, TITULOS_DESCARTE)) {
      categoria = 'IGNORAR';
      motivo = `sección descartada por título: "${titulo}"`;
      seccionActual = 'IGNORAR';
    } else if (coincide(titulo, TITULOS_HONORARIOS)) {
      categoria = 'HONORARIOS';
      motivo = `título de honorarios: "${titulo}"`;
      seccionActual = 'HONORARIOS';
    } else if (coincide(titulo, TITULOS_SERVICIOS)) {
      categoria = 'SERVICIOS';
      motivo = `título de servicios: "${titulo}"`;
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

    const { lineas, descartes } =
      categoria === 'IGNORAR'
        ? { lineas: [], descartes: [] }
        : limpiarBloques(pagina.lineas, categoria);

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
