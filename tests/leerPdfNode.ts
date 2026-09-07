// Lector de PDF para los tests: hace en Node lo mismo que `leerPdf` hace en el
// navegador, para poder ejercitar el pipeline completo contra PDFs reales.

import { readFileSync } from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { DocumentoPdf, ItemTexto, PaginaPdf } from '../lib/pdftoexcel/pdfText.ts';

export async function leerPdfNode(ruta: string, archivo: string): Promise<DocumentoPdf> {
  const datos = new Uint8Array(readFileSync(ruta));
  const tarea = getDocument({ data: datos });
  const doc = await tarea.promise;

  const paginas: PaginaPdf[] = [];
  const paginasSinTexto: number[] = [];

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const contenido = await page.getTextContent();

      const items: ItemTexto[] = [];
      for (const item of contenido.items as any[]) {
        if (!('str' in item) || !item.str?.trim()) continue;
        const t = item.transform as number[];
        items.push({
          texto: item.str,
          x: t[4],
          y: viewport.height - t[5],
          ancho: item.width ?? 0,
          alto: item.height ?? 0,
        });
      }
      if (items.length === 0) paginasSinTexto.push(n);

      paginas.push({ numero: n, ancho: viewport.width, alto: viewport.height, items });
      page.cleanup();
    }
  } finally {
    await tarea.destroy();
  }

  return { archivo, paginas, paginasSinTexto };
}
