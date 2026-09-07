// Reglas de clasificación y limpieza sobre láminas sintéticas.
//
// Cubren casos que los tres PDF de referencia no contienen, para poder
// cambiarlos con seguridad y detectar si una regla nueva rompe otra.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clasificarPaginas } from '../lib/pdftoexcel/classify.ts';
import type { PaginaTexto } from '../lib/pdftoexcel/readingOrder.ts';

const lamina = (numero: number, lineas: string[]): PaginaTexto => ({
  numero,
  lineas,
  texto: lineas.join('\n'),
  dosColumnas: false,
});

// La primera lámina es la portada; se antepone para que no arrastre reglas.
const clasificar = (lineas: string[]) =>
  clasificarPaginas([lamina(1, ['Propuesta de Servicios Profesionales']), lamina(2, lineas)])[1];

describe('Honorarios sin cifra', () => {
  test('conserva la viñeta cuyo honorario se pacta de común acuerdo', () => {
    // Pedido explícito: aunque no traiga monto, la condición es parte de la
    // propuesta. La especificación descarta "frases sueltas" con esa fórmula,
    // y una viñeta no lo es.
    const p = clasificar([
      'Propuesta económica, servicios de Nómina',
      '• Firma Electrónica USD 120, mensual por el total de trabajadores.',
      '• Por la asesoría laboral, de solicitarse, los honorarios se pactarán de común acuerdo teniendo en consideración el nivel profesional requerido.',
    ]);
    assert.equal(p.categoria, 'HONORARIOS');
    assert.ok(
      p.lineas.some((l) => l.includes('asesoría laboral')),
      `se perdió la viñeta: ${JSON.stringify(p.lineas)}`
    );
  });

  test('sigue descartando la misma fórmula cuando es prosa suelta', () => {
    const p = clasificar([
      'Propuesta económica',
      '• Firma Electrónica USD 120, mensual por el total de trabajadores.',
      'For the labor consultancy, the fees will be agreed upon by mutual agreement, taking into consideration the professional level required.',
    ]);
    assert.ok(
      !p.lineas.some((l) => l.includes('mutual agreement')),
      'una frase suelta sin cifra no debe extraerse'
    );
  });
});

describe('Subtítulos que agrupan montos', () => {
  test('conserva el subtítulo aunque termine en punto y no traiga monto', () => {
    const p = clasificar([
      'Honorarios Profesionales',
      'Servicios de obtención de Identificación tributaria.',
      '• Por el servicio antes descrito, nuestros honorarios ascienden a USD 800',
    ]);
    assert.ok(
      p.lineas.some((l) => l.includes('Identificación tributaria')),
      `se perdió el subtítulo: ${JSON.stringify(p.lineas)}`
    );
  });
});

describe('Títulos que contienen una palabra de descarte', () => {
  test('"Certificaciones Laborales" es un servicio, no la lámina corporativa', () => {
    const p = clasificar([
      'Certificaciones Laborales',
      'Alcance de nuestros servicios',
      'En función de los requerimientos actuales recopilaremos la información mensual.',
      '• Liquidaciones de sueldo firmadas mensualmente.',
    ]);
    assert.notEqual(p.categoria, 'IGNORAR', `motivo: ${p.motivo}`);
    assert.ok(p.lineas.some((l) => l.includes('Liquidaciones de sueldo')));
  });

  test('"Certificaciones" a secas sí se descarta', () => {
    const p = clasificar(['Certificaciones', 'ISO 9001 y otras acreditaciones de la firma.']);
    assert.equal(p.categoria, 'IGNORAR');
  });
});

describe('Portada', () => {
  test('no abre la sección de servicios ni arrastra las láminas siguientes', () => {
    const paginas = [
      lamina(1, ['Propuesta de Prestación de Servicios Profesionales', 'Santiago, 2026']),
      lamina(2, ['Introducción', 'Agradecemos la oportunidad de presentar esta propuesta.']),
    ];
    const [portada, siguiente] = clasificarPaginas(paginas);
    assert.equal(portada.categoria, 'IGNORAR');
    assert.equal(portada.motivo, 'portada de la propuesta');
    assert.notEqual(siguiente.categoria, 'SERVICIOS');
  });
});
