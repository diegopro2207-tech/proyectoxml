import type { AnalyzedInvoice } from '@/types/invoice';

// Identidad de una factura: un DTE queda determinado por emisor + tipo + folio.
// Si la identidad está incompleta (archivo que no se pudo parsear: sin RUT o
// sin folio), se usa el nombre de archivo como clave para que cada fila sea
// única. Sin esto, TODOS los archivos sin identidad colapsaban en una sola
// fila (clave "||") y se contaban como duplicados.
function identityKey(r: AnalyzedInvoice): string {
  if (!r.rutEmisor || !r.folioFactura) {
    return `archivo:${r.archivo}`;
  }
  return `${r.rutEmisor}|${r.tipoDTE}|${r.folioFactura}`;
}

// "Tiene montos" = al menos una de sus variables de monto trae un valor != 0.
// (montoExento, montoNeto, iva o montoTotal). Si todas vienen vacías o en 0,
// se considera una copia sin montos y es candidata a eliminarse.
export function hasAmounts(r: AnalyzedInvoice): boolean {
  return [r.montoExento, r.montoNeto, r.iva, r.montoTotal].some(
    (v) => v !== null && v !== undefined && v !== 0
  );
}

export interface DedupeResult {
  rows: AnalyzedInvoice[];
  // Cantidad de filas eliminadas por ser duplicados.
  removed: number;
}

// Elimina duplicados:
//   1. Agrupa por identidad (emisor + tipo + folio).
//   2. Si el grupo tiene una sola fila, se conserva tal cual.
//   3. Si hay duplicados:
//      - Se prefieren las copias CON montos; las que no tienen montos se descartan.
//      - Entre las que quedan (todas con montos, o todas sin si ninguna tenía),
//        se conserva solo UNA.
// El orden de salida respeta la primera aparición de cada factura.
export function dedupeInvoices(rows: AnalyzedInvoice[]): DedupeResult {
  const groups = new Map<string, AnalyzedInvoice[]>();
  for (const r of rows) {
    const key = identityKey(r);
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const out: AnalyzedInvoice[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const conMontos = group.filter(hasAmounts);
    const pool = conMontos.length > 0 ? conMontos : group;
    // Conservar solo una copia (la primera del pool en orden de aparición).
    out.push(pool[0]);
  }

  return { rows: out, removed: rows.length - out.length };
}
