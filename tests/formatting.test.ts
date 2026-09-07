import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajustarAncho, ANCHO_MAXIMO } from '../lib/pdftoexcel/formatting.ts';

// Ninguna línea puede superar el ancho máximo, en ningún caso.
function ningunaLineaExcede(texto: string, ancho = ANCHO_MAXIMO) {
  for (const linea of texto.split('\n')) {
    assert.ok(
      linea.length <= ancho,
      `Línea de ${linea.length} caracteres (máximo ${ancho}): ${JSON.stringify(linea)}`
    );
  }
}

test('respeta el ancho de 60 caracteres en un párrafo largo', () => {
  const entrada =
    'Honorario anual a pagar durante abril de cada año por el cumplimiento ' +
    'tributario anual de la Compañía en Chile, según lo acordado entre las partes.';
  const salida = ajustarAncho(entrada);
  ningunaLineaExcede(salida);
  // El corte es por palabras: nada se pierde ni se duplica.
  assert.equal(salida.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(), entrada);
});

test('no corta palabras que sí caben', () => {
  const salida = ajustarAncho('Servicios de Tesorería y Cuentas por Pagar');
  assert.equal(salida, 'Servicios de Tesorería y Cuentas por Pagar');
  assert.ok(!salida.includes('-\n'));
});

test('parte con guión una palabra más larga que el ancho', () => {
  const palabra = 'A'.repeat(150);
  const salida = ajustarAncho(palabra);
  const lineas = salida.split('\n');
  ningunaLineaExcede(salida);
  // Todas menos la última terminan en guión.
  for (const linea of lineas.slice(0, -1)) {
    assert.ok(linea.endsWith('-'), `Debería terminar en guión: ${linea}`);
  }
  // El guión cuenta dentro de los 60: las líneas partidas usan el ancho completo.
  assert.equal(lineas[0].length, ANCHO_MAXIMO);
  // Reconstruir quitando los guiones devuelve la palabra original.
  assert.equal(lineas.map((l) => l.replace(/-$/, '')).join(''), palabra);
});

test('aplica sangría colgante en viñetas', () => {
  const entrada =
    '• C. Declaración Anual de Impuesto a la Renta correspondiente al año tributario en curso';
  const salida = ajustarAncho(entrada);
  const lineas = salida.split('\n');
  ningunaLineaExcede(salida);
  assert.ok(lineas.length > 1, 'debería ocupar más de una línea');
  assert.ok(lineas[0].startsWith('• '));
  // Las continuaciones se alinean bajo el texto, no bajo el marcador.
  for (const linea of lineas.slice(1)) {
    assert.ok(
      linea.startsWith('  ') && !linea.trimStart().startsWith('•'),
      `Sangría colgante incorrecta: ${JSON.stringify(linea)}`
    );
  }
});

test('respeta la sangría existente de los sub-ítems', () => {
  const entrada =
    '  - De 21 a 50 transacciones mensuales, USD 1.200 por mes según el volumen procesado.';
  const salida = ajustarAncho(entrada);
  const lineas = salida.split('\n');
  ningunaLineaExcede(salida);
  assert.ok(lineas[0].startsWith('  - '));
  // Continuación alineada bajo el texto del sub-ítem (2 sangría + 2 marcador).
  for (const linea of lineas.slice(1)) {
    assert.ok(linea.startsWith('    '), `Esperaba 4 espacios: ${JSON.stringify(linea)}`);
  }
});

test('conserva las líneas en blanco entre secciones', () => {
  const entrada = 'ACCOUNTING SERVICES\nStart-up\n\nSCOPE OF OUR SERVICES';
  const salida = ajustarAncho(entrada);
  assert.equal(salida, entrada);
  assert.ok(salida.includes('\n\n'), 'debe mantener el separador de secciones');
});

test('no altera montos, códigos ni números de formulario', () => {
  const entrada = 'Formulario N°22, DJ 1887, UF 40, USD 1.200, 8 columnas.';
  const salida = ajustarAncho(entrada);
  assert.equal(salida, entrada);
});

test('texto vacío devuelve cadena vacía', () => {
  assert.equal(ajustarAncho(''), '');
});
