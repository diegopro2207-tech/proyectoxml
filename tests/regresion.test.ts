// Tests de regresión contra propuestas reales (§E de la especificación).
//
// Los PDF son documentos confidenciales de clientes y NO se versionan: viven en
// `tests/fixtures/`, que está en .gitignore. Si la carpeta está vacía los tests
// se saltan con un aviso, para que el repo siga siendo clonable y ejecutable.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'fs';
import { join } from 'path';
import { leerPdfNode } from './leerPdfNode.ts';
import { procesarDocumento, PENDIENTE_TRADUCCION } from '../lib/pdftoexcel/pipeline.ts';
import { ANCHO_MAXIMO } from '../lib/pdftoexcel/formatting.ts';
import type { FilaCliente } from '../lib/pdftoexcel/pipeline.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');

const AB = '01-2021 A&B Packing PO 394.pdf';
const EBANX = '08-026 EBANX Chile Ltda PTL 674-26.pdf';

// Páginas de una categoría, para comparar contra lo que dice §E.
const paginasDe = (fila: FilaCliente, categoria: string) =>
  fila.log.filter((p) => p.categoria === categoria).map((p) => p.numero);

// El texto original del documento: el par de columnas del idioma que trae.
const original = (fila: FilaCliente) =>
  fila.idioma === 'en'
    ? { servicios: fila.services, honorarios: fila.fees }
    : { servicios: fila.servicios, honorarios: fila.honorarios };

function ningunaLineaExcede(texto: string, etiqueta: string) {
  for (const linea of texto.split('\n')) {
    assert.ok(
      linea.length <= ANCHO_MAXIMO,
      `${etiqueta}: línea de ${linea.length} caracteres — ${JSON.stringify(linea.slice(0, 70))}`
    );
  }
}

const cache = new Map<string, Promise<FilaCliente>>();
function procesar(archivo: string): Promise<FilaCliente> {
  if (!cache.has(archivo)) {
    cache.set(
      archivo,
      leerPdfNode(join(FIXTURES, archivo), archivo).then(procesarDocumento)
    );
  }
  return cache.get(archivo)!;
}

const falta = (archivo: string) => !existsSync(join(FIXTURES, archivo));

describe('A&B Packing (propuesta en inglés)', { skip: falta(AB) && 'sin fixture' }, () => {
  test('identifica el cliente desde la portada', async () => {
    const fila = await procesar(AB);
    assert.equal(fila.cliente, 'A&B PACKING EQUIPMENT CHILE');
    assert.equal(fila.fuenteCliente, 'portada');
  });

  test('detecta que el documento está en inglés', async () => {
    const fila = await procesar(AB);
    assert.equal(fila.idioma, 'en');
    // El par en español queda pendiente de traducción manual.
    assert.equal(fila.servicios, PENDIENTE_TRADUCCION);
    assert.equal(fila.honorarios, PENDIENTE_TRADUCCION);
  });

  test('servicios en P5–P12 y honorarios solo en P14 (§E)', async () => {
    const fila = await procesar(AB);
    assert.deepEqual(paginasDe(fila, 'SERVICIOS'), [5, 6, 7, 8, 9, 10, 11, 12]);
    assert.deepEqual(paginasDe(fila, 'HONORARIOS'), [14]);
  });

  test('extrae los seis honorarios con sus montos', async () => {
    const { honorarios } = original(await procesar(AB));
    for (const esperado of [
      'Tax Address, USD 400 per month',
      'USD 1.500 per month',
      'USD 800 per month',
      'Monthly Tax Compliance, USD 550 per month',
      'USD 1.800',
    ]) {
      assert.ok(honorarios.includes(esperado), `falta el honorario: ${esperado}`);
    }
  });

  test('descarta datos bancarios y política de honorarios (§C)', async () => {
    const { honorarios } = original(await procesar(AB));
    for (const prohibido of ['ITAU', 'Account 0201', '77.548.780', 'written notice']) {
      assert.ok(!honorarios.includes(prohibido), `no debería aparecer: ${prohibido}`);
    }
  });

  test('respeta el ancho de 60 caracteres', async () => {
    const { servicios, honorarios } = original(await procesar(AB));
    ningunaLineaExcede(servicios, 'servicios');
    ningunaLineaExcede(honorarios, 'honorarios');
  });
});

describe('EBANX Chile (propuesta en español)', { skip: falta(EBANX) && 'sin fixture' }, () => {
  test('identifica el cliente desde la portada', async () => {
    const fila = await procesar(EBANX);
    assert.equal(fila.cliente, 'EBANX Chile Ltda.');
  });

  test('detecta que el documento está en español', async () => {
    const fila = await procesar(EBANX);
    assert.equal(fila.idioma, 'es');
    assert.equal(fila.services, PENDIENTE_TRADUCCION);
    assert.equal(fila.fees, PENDIENTE_TRADUCCION);
  });

  test('servicios desde Asesoría Contable (P25) hasta Cumplimiento Tributario (P46)', async () => {
    const fila = await procesar(EBANX);
    const servicios = paginasDe(fila, 'SERVICIOS');
    assert.equal(Math.min(...servicios), 25);
    assert.equal(Math.max(...servicios), 46);
    // El catálogo del inicio y las fichas del equipo no son servicios.
    for (const pagina of [6, 7, 8, 9, 13, 14, 15]) {
      assert.ok(!servicios.includes(pagina), `P${pagina} no debería ser servicios`);
    }
  });

  test('honorarios en las láminas de propuesta económica', async () => {
    const fila = await procesar(EBANX);
    const honorarios = paginasDe(fila, 'HONORARIOS');
    assert.ok(honorarios.includes(49), 'falta P49');
    assert.ok(honorarios.includes(50), 'falta P50');
  });

  test('extrae los tramos de honorarios de ambas tablas', async () => {
    const { honorarios } = original(await procesar(EBANX));
    for (const esperado of [
      'De 0 a 200 transacciones, UF 40',
      'De 201 a 500 transacciones, UF 55',
      'Mas de 500 transacciones, UF 80',
      'De 1 a 100 DTE, UF 15',
      'Declaración anual de Impuesto a la renta: 85',
      'Impuestos mensuales: 12',
    ]) {
      assert.ok(honorarios.includes(esperado), `falta el tramo: ${esperado}`);
    }
  });

  test('descarta el bloque Comentario y los datos bancarios', async () => {
    const { honorarios } = original(await procesar(EBANX));
    for (const prohibido of [
      'honorarios serán revisados cada',
      'Cta. Cte',
      'Banco Itaú',
      '77.548.780',
    ]) {
      assert.ok(!honorarios.includes(prohibido), `no debería aparecer: ${prohibido}`);
    }
  });

  test('el bloque Comentario no se traga la tabla que viene después', async () => {
    // Regresión: el comentario va en una columna lateral de P49 y antes se
    // descartaba el resto de la lámina, perdiendo toda la tabla de honorarios.
    const { honorarios } = original(await procesar(EBANX));
    assert.ok(honorarios.includes('UF 40'), 'se perdió la tabla de Asesoría Contable');
  });

  test('respeta el ancho de 60 caracteres', async () => {
    const { servicios, honorarios } = original(await procesar(EBANX));
    ningunaLineaExcede(servicios, 'servicios');
    ningunaLineaExcede(honorarios, 'honorarios');
  });
});

const ENERCON = '12-2023 Enercon PO 279 37-42.pdf';

describe('Enercon (extracto solo de honorarios)', { skip: falta(ENERCON) && 'sin fixture' }, () => {
  test('deriva el cliente del nombre del archivo', async () => {
    const fila = await procesar(ENERCON);
    assert.equal(fila.cliente, 'Enercon');
    assert.equal(fila.fuenteCliente, 'archivo');
  });

  test('avisa que el archivo no trae servicios en vez de inventarlos (§E)', async () => {
    const { servicios } = original(await procesar(ENERCON));
    assert.ok(servicios.startsWith('[PENDIENTE]'), servicios.slice(0, 60));
    // El aviso dice qué páginas SÍ trae el archivo.
    assert.match(servicios, /honorarios: P\d/);
  });

  test('extrae la tabla de honorarios y las tres opciones', async () => {
    const { honorarios } = original(await procesar(ENERCON));
    for (const esperado of [
      'Annual Income Tax Return: 6,480',
      'Mandatory Affidavits: 2,840',
      'Monthly Tax Compliance: 820',
      'Partner: 237',
      'Option B: Fixed monthly fee',
    ]) {
      assert.ok(honorarios.includes(esperado), `falta: ${esperado}`);
    }
  });
});

describe('Formato de servicios', { skip: falta(EBANX) && 'sin fixture' }, () => {
  test('omite el servicio Start-up en todos los documentos', async () => {
    for (const archivo of [AB, EBANX]) {
      if (falta(archivo)) continue;
      const { servicios } = original(await procesar(archivo));
      assert.ok(
        !/start[\s-]?up|puesta en marcha/i.test(servicios),
        `${archivo}: no debería aparecer el servicio Start-up`
      );
    }
  });

  test('ordena nombre, descripción y detalle en viñetas', async () => {
    const { servicios } = original(await procesar(EBANX));
    const lineas = servicios.split('\n');

    // El detalle va en viñetas con "- " al inicio, una por párrafo.
    const vinietas = lineas.filter((l) => l.startsWith('- '));
    assert.ok(vinietas.length > 10, `se esperaban varias viñetas, hubo ${vinietas.length}`);

    // El nombre del servicio abre el texto, antes de cualquier viñeta.
    assert.equal(lineas[0], 'Asesoría Contable');
    assert.ok(!lineas[0].startsWith('- '));

    // Los bloques se separan con una línea en blanco, para que se note el orden.
    assert.ok(servicios.includes('\n\n'), 'faltan separaciones entre bloques');
  });

  test('no arrastra bloques de Comentarios al detalle', async () => {
    for (const archivo of [AB, EBANX]) {
      if (falta(archivo)) continue;
      const { servicios } = original(await procesar(archivo));
      assert.ok(
        !/\bComment It will be|\bComentario\b/.test(servicios),
        `${archivo}: se coló un bloque de comentarios`
      );
    }
  });
});

describe('Portada', { skip: falta(AB) && 'sin fixture' }, () => {
  test('la portada nunca abre la sección de servicios', async () => {
    // El nombre de la propuesta ("Propuesta de Prestación de Servicios
    // Profesionales") contiene la palabra servicios. Si la portada abriera esa
    // sección, las láminas siguientes la continuarían y se arrastraría toda la
    // introducción del documento.
    for (const archivo of [AB, EBANX]) {
      if (falta(archivo)) continue;
      const fila = await procesar(archivo);
      const portada = fila.log.find((p) => p.numero === 1);
      assert.equal(portada?.categoria, 'IGNORAR', `${archivo}: la portada no debe aportar contenido`);
    }
  });
});
