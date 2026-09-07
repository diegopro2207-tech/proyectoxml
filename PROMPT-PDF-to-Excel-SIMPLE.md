# Prompt — Proyecto "PDF to Excel" (MVP Maqueta)

> Pega esto como primer mensaje en un proyecto nuevo de Claude Code.

---

## Rol y objetivo

Eres un ingeniero de software. Vas a construir una **aplicación web llamada "PDF to Excel"**: una herramienta simple que permite subir un PDF, procesarlo, y exportar una fila de datos a una **plantilla Excel de carga de contratos**. La app es una **maqueta funcional** sin lógica de extracción aún. Solo interfaz de subida, procesamiento básico y exportación de Excel.

## Stack técnico

- **Next.js 14** (App Router) + **TypeScript** + **React**.
- **pdfjs-dist** para cargar/procesar el PDF en el navegador.
- **xlsx-js-style** para generar el Excel.
- Desplegable en **Vercel** con dominio propio (nexalumen.cl).
- Estilo: corporativo, limpio. Iconos SVG inline (sin emojis).
- Acceso protegido por contraseña: middleware + cookie de sesión SHA-256 (env `PDFEXCEL_PASSWORD`). Rutas `dynamic = 'force-dynamic'`. Login con `window.location.assign()`.

## Flujo básico

1. **Subir PDF** (drag & drop o clic). Detectar si tiene capa de texto.
2. **Procesar**: leer el PDF con pdf.js, extraer texto por páginas (sin análisis aún, solo almacenar).
3. **Mostrar resumen**: qué se extrajo (número de páginas, tamaño, etc.). Input para que el usuario complete/ingrese datos a mano en los 70 campos.
4. **Formulario de revisión**: mostrar todos los campos de la plantilla vacíos o parcialmente pre-llenados (por ahora, en blanco). El usuario puede editarlos.
5. **Exportar Excel**: generar `carga-contratos.xlsx` con la hoja "Contratos" (fila 1 = encabezados legibles, fila 2 = códigos de campo, fila 3 = datos ingresados). Permitir agregar más filas (múltiples contratos).

## Esquema destino — hoja "Contratos" (70 columnas)

**Fila 1** = nombres legibles. **Fila 2** = códigos de campo. **Filas 3+** = datos.

Estructura (columna → código → nombre):

| Col | Código | Nombre legible |
|-----|--------|----------------|
| A | `clave` | Referencia |
| B | `cliente_rut` | RUT del cliente |
| C | `fecha_celebracion` | Fecha de celebración |
| D | `ciudad_celebracion` | Ciudad de celebración |
| E | `responsable_email` | Responsable |
| F | `area_codigo` | Área |
| G | `area_servicio_codigo` | Área de prestación de servicios |
| H | `tipo_contrato_codigo` | Tipo de contrato |
| I | `centro_costo` | Centro de costo |
| J | `bdo_actividad_relevante` | Actividad de BDO relevante |
| K | `titulo_servicios` | Título de los servicios |
| L | `alcance_detalle` | Detalle del alcance |
| M | `servicio_normativa` | Servicio de la cláusula de normativa |
| N | `exclusiones_texto` | Exclusiones |
| O | `moneda_pago` | Moneda o unidad de pago |
| P | `tiene_forma_pago_diversa` | ¿Forma de pago distinta? |
| Q | `forma_pago_diversa` | Cuál es la forma de pago distinta |
| R | `vigencia_fecha_inicio` | Inicio de vigencia |
| S | `vigencia_fecha_termino` | Término de vigencia |
| T | `vigencia_renovacion_automatica` | Renovación automática |
| U | `vigencia_duracion_renovacion` | Se renueva por |
| V | `vigencia_unidad_renovacion` | Unidad de la renovación |
| W | `vigencia_dias_aviso` | Días de aviso para no renovar |
| X | `vigencia_condiciones_termino_anticipado` | Condiciones de término anticipado |
| Y | `observaciones` | Observaciones internas |
| Z–AC | `honorario_1_*` | Honorario 1 (Servicio/Moneda/Monto/Periodicidad) |
| AD–AG | `honorario_2_*` | Honorario 2 |
| AH–AK | `honorario_3_*` | Honorario 3 |
| AL–AO | `honorario_4_*` | Honorario 4 |
| AP–AS | `honorario_5_*` | Honorario 5 |
| AT–AW | `honorario_6_*` | Honorario 6 |
| AX–BA | `alcance_1_texto` … `alcance_4_texto` | Párrafo de alcance 1–4 |
| BB–BD | `servicio_1_*` | Servicio 1 (Nombre/Periodicidad/Descripción) |
| BE–BG | `servicio_2_*` | Servicio 2 |
| BH–BJ | `servicio_3_*` | Servicio 3 |
| BK–BM | `servicio_4_*` | Servicio 4 |
| BN–BQ | `exclusion_1_texto` … `exclusion_4_texto` | Exclusión 1–4 |
| BR | `firmante_1_rut` | Firmante del cliente 1 · RUT |

**Total: 70 columnas (A–BR).**

## Componentes mínimos

1. **UploadZone**: drag & drop de PDF, mostrar feedback.
2. **PdfViewer**: mostrar si el PDF se cargó, número de páginas, tamaño.
3. **FormularioContratos**: formulario con los 70 campos (todos vacíos inicialmente, editables por el usuario).
4. **ExportarExcel**: botón que genera el `.xlsx` con la estructura de 70 columnas + la fila de datos.
5. **Login**: ruta protegida con contraseña (igual a XMLScan).

## Consideraciones

- **100% browser**: el PDF se procesa en el navegador. Sin servidor.
- **Sin lógica de extracción**: de momento, el usuario completa los campos a mano (el PDF está ahí solo como referencia visual o histórico).
- **Acumular filas**: permitir agregar más contratos (más filas) antes de exportar.
- **Iguales patrones que XMLScan**: estilo, login, estructura de rutas, etc.

## Entregables

1. App Next.js funcional (`npm run dev`).
2. Ruta `/pdftoexcel` protegida por login.
3. Componentes: upload, visor PDF básico, formulario de 70 campos, exportador Excel.
4. README: cómo correr, variable de entorno `PDFEXCEL_PASSWORD`, despliegue en Vercel.
5. Código comentado en español.

**Empieza confirmando el plan, luego construye la estructura.**
