# NexaProyects

Portafolio desplegado en **nexalumen.cl**. Cada herramienta vive como una ruta
privada del mismo proyecto Next.js y se protege con su propia contraseña.

| Ruta | Herramienta | Qué hace |
|---|---|---|
| `/xmlscan` | **XMLScan** | Procesa XML de facturas electrónicas (DTE) y los exporta a Excel. |
| `/pdftoexcel` | **PDF to Excel** | Extrae servicios y honorarios de propuestas en PDF y los exporta a Excel. |

Todo el procesamiento ocurre **en el navegador**: ni los XML ni los PDF se
suben a ningún servidor. El servidor solo valida la contraseña.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
npm test         # tests unitarios (formato de texto)
```

### Variables de entorno

Crear un archivo `.env.local` (está en `.gitignore`):

```
XMLSCAN_PASSWORD=...
PDFEXCEL_PASSWORD=...
```

En Vercel se configuran en *Settings → Environment Variables*. Sin la variable,
la herramienta correspondiente rechaza cualquier contraseña.

---

## PDF to Excel

Convierte propuestas de servicios profesionales en PDF (español o inglés, de 5 a
80+ páginas) en un Excel con **una fila por cliente** y cinco columnas:

```
Cliente | Servicios | Honorarios | Services | Fees
```

Todo el contenido de una categoría va en **una sola celda**, como texto plano
con saltos de línea.

### Cómo funciona

```
PDF
 └─ 1. Texto por página con coordenadas          lib/pdftoexcel/pdfText.ts
 └─ 2. Orden de lectura (dos columnas por banda) lib/pdftoexcel/readingOrder.ts
 └─ 3. Identificación del cliente                lib/pdftoexcel/cliente.ts
 └─ 4. Clasificación SERVICIOS/HONORARIOS/IGNORAR lib/pdftoexcel/classify.ts
 └─ 5. Formato de servicios y de tablas          servicios.ts · tables.ts
 └─ 6. Detección de idioma                       lib/pdftoexcel/language.ts
 └─ 7. Ajuste a 60 caracteres (último paso)      lib/pdftoexcel/formatting.ts
 └─ 8. Fila del Excel                            lib/pdftoexcel/exportExcel.ts
```

**No hay OCR y no se procesan imágenes**: solo el texto embebido en el PDF. Las
páginas sin texto extraíble se ignoran y quedan anotadas en el log de decisiones.

### Traducción

La traducción entre español e inglés **no se hace automáticamente** (requeriría
un servicio de pago). El par de columnas del idioma original se rellena solo; el
otro queda marcado como `[PENDIENTE TRADUCCIÓN]` para completarlo a mano en el
panel de revisión antes de exportar.

### Ajustar las reglas de extracción

Las reglas viven en listas al principio de cada módulo y se pueden editar sin
tocar el pipeline:

- **Qué páginas descartar / cuáles son servicios u honorarios** →
  `TITULOS_DESCARTE`, `TITULOS_HONORARIOS`, `TITULOS_SERVICIOS` en
  `lib/pdftoexcel/classify.ts`.
- **Qué líneas descartar dentro de una página** (bloques "Comentarios", datos
  bancarios, párrafos sin cifras) → las expresiones regulares del mismo archivo.
- **Ancho de línea y sangría colgante** → `lib/pdftoexcel/formatting.ts`.

Ante la duda, una página se **incluye y se marca como dudosa** en el log, en vez
de descartarse en silencio.

### Panel de revisión

Antes de exportar, cada cliente muestra sus cuatro celdas en modo editable
(monoespaciado, respetando los saltos de línea) y un log plegable con qué
páginas se clasificaron como servicios, cuáles como honorarios, cuáles se
ignoraron y por qué. La extracción no será perfecta: el panel existe para
corregir sin abrir el Excel.

### Notas de implementación

- `public/pdf.worker.min.mjs` es el worker de pdf.js, copiado desde
  `node_modules/pdfjs-dist/build/`. Si se actualiza `pdfjs-dist`, hay que
  volver a copiarlo.
- Los PDF se procesan **de a uno** para que el avance por archivo sea real y
  para no agotar la memoria con documentos de 80+ páginas.
- Si un PDF falla, el resto del lote se procesa igual y la fila de ese cliente
  se incluye con el motivo del error en sus celdas.
