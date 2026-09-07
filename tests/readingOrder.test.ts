// Orden de lectura (§4) sobre maquetas sintéticas.
//
// Reproducen la distribución de las láminas de BDO con panel lateral: el
// título y una cita ocupan una banda a la izquierda y el contenido va a la
// derecha, a la misma altura. Sin separar esas columnas, la cita se mezcla con
// los honorarios y el resultado es ilegible.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paginaATexto } from '../lib/pdftoexcel/readingOrder.ts';
import type { ItemTexto, PaginaPdf } from '../lib/pdftoexcel/pdfText.ts';

const ANCHO = 1500;
const ALTO = 825;

// Un item de texto con ancho proporcional al largo del texto.
function it(texto: string, x: number, y: number, alto = 14): ItemTexto {
  return { texto, x, y, ancho: texto.length * alto * 0.5, alto };
}

const pagina = (items: ItemTexto[]): PaginaPdf => ({
  numero: 1,
  ancho: ANCHO,
  alto: ALTO,
  items,
});

// Índice de la primera línea que contiene el texto buscado.
const indiceDe = (lineas: string[], aguja: string) =>
  lineas.findIndex((l) => l.includes(aguja));

describe('Lámina con panel lateral (título + cita a la izquierda)', () => {
  // Panel izquierdo hasta x≈440; contenido desde x≈530. La cita y las primeras
  // viñetas de honorarios están a la MISMA altura, que es lo que las mezclaba.
  const lineas = paginaATexto(
    pagina([
      it('PROPUESTA', 80, 155, 40),
      it('ECONOMICA', 80, 215, 40),
      it('Honorarios Profesionales', 530, 137, 28),
      it('Al preparar nuestra propuesta de servicio, hemos', 530, 175),
      it('considerado las condiciones actuales del mercado.', 530, 196),
      it('Estamos comprometidos a', 80, 370, 20),
      it('Servicios de obtencion de Identificacion tributaria.', 530, 374),
      it('brindarle un servicio de calidad', 80, 400, 20),
      it('Por el servicio antes descrito, USD 800', 545, 404),
      it('que represente una buena', 80, 430, 20),
      it('Asesoria Contable', 530, 434),
      it('relacion calidad-precio', 80, 460, 20),
      it('De 1 a 25 transacciones, USD 450 por mes', 545, 464),
      it('Consideraciones', 80, 617, 22),
      it('Confidencial', 80, 686, 22),
    ])
  ).lineas;

  test('ninguna línea mezcla el panel con el contenido', () => {
    for (const linea of lineas) {
      const hayPanel = /Estamos comprometidos|que represente|brindarle|relacion calidad/.test(linea);
      const hayContenido = /USD 800|USD 450|Identificacion|Asesoria Contable/.test(linea);
      assert.ok(
        !(hayPanel && hayContenido),
        `se mezclaron panel y contenido: ${JSON.stringify(linea)}`
      );
    }
  });

  test('el panel se lee completo antes que el contenido', () => {
    const ultimaDelPanel = indiceDe(lineas, 'relacion calidad-precio');
    const primeraDelContenido = indiceDe(lineas, 'Identificacion tributaria');
    assert.ok(ultimaDelPanel >= 0 && primeraDelContenido >= 0, lineas.join(' | '));
    assert.ok(
      ultimaDelPanel < primeraDelContenido,
      'la columna izquierda debe leerse entera antes que la derecha'
    );
  });

  test('el subtítulo queda pegado a sus montos, en orden', () => {
    const subtitulo = indiceDe(lineas, 'Identificacion tributaria');
    const monto = indiceDe(lineas, 'USD 800');
    assert.equal(monto, subtitulo + 1, 'el monto debe seguir a su subtítulo');
  });
});

// PENDIENTE. Cuando el panel de contenido se divide a su vez en dos
// sub-columnas ("Alcance" y "Reportes" una al lado de la otra), el corte no se
// detecta y ambas se leen entrelazadas.
//
// Los criterios que lo reconocerían —corredor vacío ancho, o mayoría de filas
// en un solo lado— también parten las tablas de honorarios de Enercon y EBANX,
// que hoy se extraen bien. Hace falta el PDF real para encontrar una señal que
// distinga los dos casos sin romper lo que ya funciona.
describe('Panel de contenido dividido en dos sub-columnas', { todo: 'requiere el PDF real para distinguirlo de una tabla' }, () => {
  // Además del panel lateral, el contenido se parte en "Alcance" (izquierda) y
  // "Reportes" (derecha). Requiere volver a dividir dentro de una columna.
  const lineas = paginaATexto(
    pagina([
      it('SERVICIOS', 80, 120, 34),
      it('PROPUESTOS', 80, 165, 34),
      it('CONSULTORIA IFRS', 80, 340, 16),
      it('Alcance de Nuestros Servicios', 530, 80, 26),
      it('Nuestra asesoria consiste en entregar opinion sobre la consulta', 530, 143),
      it('tecnica segun Normas Internacionales de informacion financiera.', 530, 170),
      it('Alcance:', 530, 335),
      it('Nuestra Consultoria comienza una vez recibido el', 530, 367),
      it('requerimiento en relacion a las normas.', 530, 394),
      it('Reportes:', 1020, 520),
      it('El desarrollo de nuestra consultoria podra', 530, 549),
      it('La respuesta a cada requerimiento se', 1020, 550),
      it('materializarse via correo electronico.', 530, 576),
      it('materializara en una minuta tecnica.', 1020, 577),
    ])
  ).lineas;

  test('no se entrelazan las sub-columnas Alcance y Reportes', () => {
    for (const linea of lineas) {
      const alcance = /desarrollo de nuestra consultoria|materializarse via/.test(linea);
      const reportes = /respuesta a cada requerimiento|minuta tecnica/.test(linea);
      assert.ok(
        !(alcance && reportes),
        `se entrelazaron las sub-columnas: ${JSON.stringify(linea)}`
      );
    }
  });

  test('Alcance se lee completo antes que Reportes', () => {
    const finAlcance = indiceDe(lineas, 'materializarse via correo');
    const inicioReportes = indiceDe(lineas, 'Reportes:');
    assert.ok(finAlcance >= 0 && inicioReportes >= 0, lineas.join(' | '));
    assert.ok(finAlcance < inicioReportes, 'Alcance debe cerrarse antes de Reportes');
  });

  test('el panel lateral no se cuela en el párrafo del contenido', () => {
    for (const linea of lineas) {
      const panel = /SERVICIOS|PROPUESTOS|CONSULTORIA IFRS/.test(linea);
      const contenido = /Nuestra asesoria|Normas Internacionales/.test(linea);
      assert.ok(!(panel && contenido), `panel dentro del párrafo: ${JSON.stringify(linea)}`);
    }
  });
});
