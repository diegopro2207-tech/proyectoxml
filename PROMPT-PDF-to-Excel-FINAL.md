# Prompt — Proyecto "PDF to Excel" (MVP Maqueta)

> Pega esto como primer mensaje en un proyecto nuevo de Claude Code, y **adjunta el archivo Excel** (`carga-contratos-v1.0.0...xlsx`) junto con este prompt.

---

## Rol y objetivo

Eres un ingeniero de software. Vas a construir una **aplicación web llamada "PDF to Excel"**.

**Flujo exacto (no agregues pasos ni supuestos fuera de esto):**

1. La **base de todo es el archivo Excel adjunto**. Ese archivo ya viene con su estructura de columnas, encabezados, estilos y otras hojas completamente definidos — **no lo recrees, no inventes columnas, no cambies su estructura**. Ese Excel se incorpora a la app como **plantilla base** (queda dentro del proyecto, el usuario NO lo sube cada vez).
2. El usuario **solo arrastra uno o varios PDFs** a la app. No sube ningún Excel — el Excel ya está integrado como base.
3. La app **procesa el/los PDF(s)** (por ahora, procesamiento básico: cargar el archivo con pdf.js, extraer el texto por página, mostrar que se cargó correctamente — número de páginas, nombre, etc. **Sin lógica de extracción de datos todavía**, porque las reglas de qué dato va en qué celda **aún no están definidas** — te las daré después en otra sesión).
4. Cuando llegue el momento (no ahora), la app llenará las celdas correspondientes de la hoja de datos con la información extraída de cada PDF. **Por ahora, deja ese paso como un placeholder claro**: una fila nueva se agrega a la plantilla con los campos vacíos, lista para que más adelante se conecten las reglas de extracción.
5. Al exportar, la app genera una copia del Excel base **con la nueva fila agregada**, preservando intacta toda la estructura, estilos y demás hojas del archivo original.

**Importante:** no agregues explicaciones de qué columna significa qué, ni definas reglas de mapeo de datos. Eso se hará en una sesión posterior cuando yo entregue las instrucciones célula por célula. Por ahora la app debe **leer la estructura del Excel adjunto tal cual está** (nombres de columnas, hoja de datos, cuántas filas ya tiene) y usarla como plantilla, sin más.

## Stack técnico

- **Next.js 14** (App Router) + **TypeScript** + **React**.
- **pdfjs-dist** para cargar/procesar el PDF en el navegador.
- **xlsx-js-style** para leer el Excel base y escribir la nueva fila **sin perder estilos ni estructura**.
- Desplegable en **Vercel** con dominio propio (nexalumen.cl).
- Estilo: corporativo, limpio. Iconos SVG inline (sin emojis).
- Acceso protegido por contraseña: middleware + cookie de sesión SHA-256 (env `PDFEXCEL_PASSWORD`). Rutas `dynamic = 'force-dynamic'`. Login con `window.location.assign()`.
- **100% del lado del cliente (browser).** Ni el PDF ni el Excel se suben a un servidor.

## Qué construir en esta sesión (MVP)

1. **Excel base integrado**: el archivo adjunto se guarda dentro del proyecto (ej. `public/templates/` o similar) y la app lo carga como plantilla al iniciar.
2. **UploadZone de PDF(s)**: drag & drop o selección de uno o varios PDFs. Detectar si tienen capa de texto.
3. **Procesamiento básico del PDF**: leer con pdf.js, extraer texto por página, mostrar un resumen (páginas, tamaño, nombre del archivo). Sin análisis de contenido todavía.
4. **Agregar fila placeholder**: por cada PDF procesado, agregar una fila nueva a la hoja de datos del Excel base (en la próxima fila libre), dejando las celdas de contenido vacías por ahora — solo dejar preparado el mecanismo de "una fila por PDF procesado".
5. **Exportar**: descargar la plantilla Excel con las filas nuevas agregadas, preservando exactamente la estructura, encabezados, estilos y otras hojas del archivo original.
6. **Login**: ruta protegida con contraseña, igual patrón que el proyecto XMLScan existente.

## Consideraciones técnicas

- **Leer, no redefinir**: la app debe detectar la estructura del Excel adjunto (nombre de la hoja de datos, encabezados, próxima fila libre) leyéndolo directamente, no a partir de una lista que tú definas en el código a mano.
- **Preservar estilos**: usar las capacidades de xlsx-js-style para no perder formato de celdas, anchos de columna, ni otras hojas del archivo al reescribirlo.
- **Múltiples PDFs**: si el usuario suelta varios PDFs a la vez, se agrega una fila por cada uno.
- **Sin reglas de extracción**: no implementes ninguna lógica que intente adivinar qué dato del PDF va en qué columna. Eso se define después.

## Entregables

1. App Next.js funcional (`npm run dev`).
2. Ruta `/pdftoexcel` protegida por login.
3. Plantilla Excel del usuario integrada como base del proyecto.
4. Componentes: upload de PDF(s), procesador básico de PDF, mecanismo de agregar fila a la plantilla, exportador.
5. README: cómo correr, variable de entorno `PDFEXCEL_PASSWORD`, despliegue en Vercel.
6. Código comentado en español.

**Empieza confirmando el plan, luego construye la estructura.**
