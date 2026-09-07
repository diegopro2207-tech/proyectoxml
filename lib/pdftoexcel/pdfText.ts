// Extracción de texto de PDF con coordenadas, usando pdf.js en el navegador.
//
// No se hace OCR ni se procesan imágenes: solo el texto embebido en el PDF.
// Si una página no tiene texto extraíble, se devuelve con `items` vacío y el
// clasificador la marcará como ignorada (queda registrada en el log).

export interface ItemTexto {
  texto: string;
  // Coordenadas en píxeles de la página, con el origen ARRIBA a la izquierda
  // (ya convertidas desde el sistema de PDF, que crece hacia arriba).
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface PaginaPdf {
  numero: number; // 1-indexado, como lo ve el usuario
  ancho: number;
  alto: number;
  items: ItemTexto[];
}

export interface DocumentoPdf {
  archivo: string;
  paginas: PaginaPdf[];
  // Páginas sin texto extraíble (imágenes/escaneadas). Solo para el log.
  paginasSinTexto: number[];
}

// pdf.js se carga de forma perezosa y solo en el navegador: es un módulo
// pesado y no debe evaluarse durante el render en servidor.
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function cargarPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('La lectura de PDF solo funciona en el navegador.');
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      // El worker se sirve desde /public para no depender del bundler.
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

// Lee un PDF completo y devuelve el texto de cada página con coordenadas.
// `onPagina` permite reportar avance en documentos largos (80+ páginas).
export async function leerPdf(
  file: File,
  onPagina?: (pagina: number, total: number) => void
): Promise<DocumentoPdf> {
  const pdfjs = await cargarPdfjs();
  const datos = new Uint8Array(await file.arrayBuffer());

  // La tarea de carga se guarda aparte: es la que libera el worker al final.
  const tarea = pdfjs.getDocument({ data: datos });
  const doc = await tarea.promise;

  const paginas: PaginaPdf[] = [];
  const paginasSinTexto: number[] = [];

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const contenido = await page.getTextContent();

      const items: ItemTexto[] = [];
      for (const item of contenido.items) {
        // Los marcadores de contenido estructural no traen texto.
        if (!('str' in item)) continue;
        const texto = item.str;
        if (!texto || !texto.trim()) continue;

        // transform = [a, b, c, d, e, f]; e/f son la posición del item.
        const [, , , , x, yPdf] = item.transform as number[];
        items.push({
          texto,
          x,
          // En PDF el eje Y crece hacia arriba; se invierte para ordenar
          // de arriba hacia abajo como lee una persona.
          y: viewport.height - yPdf,
          ancho: item.width ?? 0,
          alto: item.height ?? 0,
        });
      }

      if (items.length === 0) paginasSinTexto.push(n);

      paginas.push({
        numero: n,
        ancho: viewport.width,
        alto: viewport.height,
        items,
      });

      page.cleanup();
      onPagina?.(n, doc.numPages);
    }
  } finally {
    await tarea.destroy();
  }

  return { archivo: file.name, paginas, paginasSinTexto };
}
