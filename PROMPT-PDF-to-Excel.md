# Prompt — Proyecto "PDF to Excel"

> Pega esto como primer mensaje en un proyecto nuevo de Claude Code.

---

## Rol y objetivo

Eres un ingeniero de software senior. Vas a construir una **aplicación web llamada "PDF to Excel"**: una herramienta que lee documentos PDF (propuestas/contratos de servicios profesionales), **extrae los datos** y los deja escritos en las celdas correctas de una **plantilla Excel de carga de contratos**. El usuario sube un PDF, la app extrae automáticamente todo lo que puede, muestra un formulario de revisión pre-llenado para completar/corregir lo que falta, y exporta la fila lista en la plantilla Excel.

El objetivo inmediato es tener un **MVP funcional desplegable**, que luego se integra a un sitio existente (nexalumen.cl) como una herramienta más, junto a otra app llamada "XMLScan".

## Principios (no negociables)

1. **100% del lado del cliente (browser).** La lectura del PDF, la extracción y la generación del Excel ocurren en el navegador. Los archivos **nunca** se suben a un servidor → privacidad total. Esto es un requisito de confianza del cliente (son contratos confidenciales).
2. **Honestidad sobre la extracción.** Nunca inventes datos. Si un campo no se encuentra con confianza, se deja **vacío y marcado** para revisión manual. Es preferible una celda vacía a un dato inventado.
3. **Transparencia.** Al terminar, mostrar de dónde salió cada dato (página del PDF) y qué campos quedaron pendientes de completar.

## Stack técnico

- **Next.js 14** (App Router) + **TypeScript** + **React**.
- **pdfjs-dist** (pdf.js) para extraer texto del PDF en el navegador.
- **xlsx-js-style** para generar el Excel con formato.
- Desplegable en **Vercel**.
- Estilo visual: limpio, corporativo, claro (no oscuro). Iconos SVG inline (no emojis).
- Acceso protegido por contraseña vía middleware + cookie de sesión con token SHA-256 (variable de entorno `PDFEXCEL_PASSWORD`). Rutas marcadas `dynamic = 'force-dynamic'`. Login con redirect duro (`window.location.assign`) tras setear la cookie.

## Flujo de la aplicación

1. **Subir PDF** (drag & drop o selección). Soporta PDF digital (con capa de texto). Detecta si el PDF **no tiene texto** (escaneado) y avisa: "Este PDF parece escaneado; el OCR es una función posterior" (ver Fase 2).
2. **Extraer** el texto por página con pdf.js.
3. **Parsear** los campos conocidos con reglas (ver "Reglas de extracción").
4. **Revisar**: mostrar un formulario con TODOS los campos de la plantilla, pre-llenados con lo extraído. Los campos de alta confianza en verde, los de baja confianza o vacíos resaltados. El usuario completa/corrige a mano lo que falte (especialmente datos del cliente).
5. **Exportar Excel**: generar el archivo `carga-contratos.xlsx` con la hoja **"Contratos"**, escribiendo la fila de datos debajo de los encabezados (fila 1 = nombres legibles, fila 2 = códigos de campo, fila 3+ = datos). Debe poder acumular varios contratos (varias filas).

## Esquema destino — hoja "Contratos" (70 columnas)

La plantilla tiene 2 filas de encabezado: **fila 1** = nombre legible, **fila 2** = código de campo (usar el código como identificador interno). Los campos marcados `*` son obligatorios en la plantilla. Estructura exacta (columna → código → nombre):

| Col | Código | Nombre legible |
|-----|--------|----------------|
| A | `clave` | Referencia |
| B | `cliente_rut` * | RUT del cliente |
| C | `fecha_celebracion` * | Fecha de celebración (Comparecencia) |
| D | `ciudad_celebracion` | Ciudad de celebración |
| E | `responsable_email` | Responsable |
| F | `area_codigo` | Área |
| G | `area_servicio_codigo` | Área de prestación de servicios (1ª Antecedentes) |
| H | `tipo_contrato_codigo` | Tipo de contrato |
| I | `centro_costo` | Centro de costo |
| J | `bdo_actividad_relevante` | Actividad de BDO relevante (1ª Antecedentes) |
| K | `titulo_servicios` * | Título de los servicios (2ª Título) |
| L | `alcance_detalle` * | Detalle del alcance (2ª Alcance) |
| M | `servicio_normativa` | Servicio de la cláusula de normativa (4ª) |
| N | `exclusiones_texto` * | Exclusiones (2ª Exclusiones) |
| O | `moneda_pago` * | Moneda o unidad de pago (5ª Honorarios) |
| P | `tiene_forma_pago_diversa` | ¿Forma de pago distinta? (5ª) |
| Q | `forma_pago_diversa` | Cuál es la forma de pago distinta (5ª) |
| R | `vigencia_fecha_inicio` * | Inicio de vigencia (7ª) |
| S | `vigencia_fecha_termino` * | Término de vigencia (7ª) |
| T | `vigencia_renovacion_automatica` | Renovación automática (7ª) |
| U | `vigencia_duracion_renovacion` | Se renueva por (7ª) |
| V | `vigencia_unidad_renovacion` | Unidad de la renovación (7ª) |
| W | `vigencia_dias_aviso` | Días de aviso para no renovar (7ª) |
| X | `vigencia_condiciones_termino_anticipado` | Condiciones de término anticipado (13ª) |
| Y | `observaciones` | Observaciones internas |
| Z–AC | `honorario_1_servicio` * / `honorario_1_moneda` * / `honorario_1_monto` * / `honorario_1_periodicidad` * | Honorario 1 (Servicio/Moneda/Monto/Periodicidad) |
| AD–AG | `honorario_2_*` | Honorario 2 (Servicio/Moneda/Monto/Periodicidad) |
| AH–AK | `honorario_3_*` | Honorario 3 |
| AL–AO | `honorario_4_*` | Honorario 4 |
| AP–AS | `honorario_5_*` | Honorario 5 |
| AT–AW | `honorario_6_*` | Honorario 6 |
| AX–BA | `alcance_1_texto` … `alcance_4_texto` | Párrafo de alcance 1–4 |
| BB–BD | `servicio_1_nombre` * / `servicio_1_periodicidad_informes` / `servicio_1_descripcion` | Servicio 1 |
| BE–BG | `servicio_2_*` | Servicio 2 |
| BH–BJ | `servicio_3_*` | Servicio 3 |
| BK–BM | `servicio_4_*` | Servicio 4 |
| BN–BQ | `exclusion_1_texto` * … `exclusion_4_texto` * | Exclusión 1–4 |
| BR | `firmante_1_rut` | Firmante del cliente 1 · RUT del representante |

## Reglas de extracción (basadas en un PDF real de ejemplo)

El PDF de ejemplo es un **deck de propuesta de servicios de BDO/BSO** (~39 páginas, con capa de texto). Los datos vienen **en orden** y la búsqueda no es compleja: es ubicar la sección y copiar el dato crudo. Reglas conocidas:

### Honorarios (tabla, alta confianza)
En la página de "Propuesta económica" hay una tabla `Servicio | UF | Recurrencia`. Ejemplo real:

```
Asesoría Contable
  Startup e implementación Contable ...... 35 ... Pago único
  Contabilidad recurrente ................ 30 ... Mensual
Back Office
  Startup DTE ............................ 12 ... Pago único
  Control, Emisión y Recepción DTE ....... 10 ... Mensual
  Cuentas por Pagar y Cobrar ............. 8 .... Mensual
  Servicios de Tesorería ................. 10 ... Mensual
```

Mapear cada fila a `honorario_N_servicio` / `honorario_N_moneda` (="UF") / `honorario_N_monto` / `honorario_N_periodicidad` (Pago único | Mensual). El `moneda_pago` global = "UF".

### Vigencia (alta confianza)
Buscar el párrafo tipo: *"Este acuerdo tendrá una duración mínima de un año desde su fecha de aceptación, con renovación automática por igual período… podrá poner término… con una anticipación de 90 días."*
Mapear: `vigencia_renovacion_automatica` = "Sí", `vigencia_duracion_renovacion` = "1", `vigencia_unidad_renovacion` = "año", `vigencia_dias_aviso` = "90".

### Servicios, alcance y exclusiones (confianza media)
Las secciones de servicios (Asesoría Contable, DTE, Cuentas por Pagar/Cobrar, Tesorería) y los bloques "Comentarios" / "Condiciones limitantes" contienen los textos de `titulo_servicios`, `alcance_*`, `servicio_N_*`, `exclusion_N_texto`. Extraer como párrafos y ofrecerlos al usuario para asignar/editar en la revisión.

### Datos del cliente (NO están en este PDF → entrada manual)
`clave`, `cliente_rut`, `fecha_celebracion`, `ciudad_celebracion`, `responsable_email`, `area_codigo`, `centro_costo`, `firmante_1_rut` y fechas de vigencia concretas **no aparecen** en el deck genérico. La app debe dejarlos como **campos de formulario para llenar a mano** (o, más adelante, tomarlos de otra fuente). El diseño debe asumir que buena parte de estos 70 campos se completan en la pantalla de revisión, no automáticamente.

## Consideraciones técnicas importantes

- **Layout multi-columna:** algunas láminas tienen 2–3 columnas y pdf.js puede entregar el texto entremezclado. Usar las coordenadas (x/y) de los items de texto de pdf.js para reconstruir el orden por columnas cuando haga falta, o al menos detectar y avisar cuando una sección venga desordenada.
- **Tildes/encoding:** normalizar el texto (algunos PDFs entregan caracteres de reemplazo en las tildes).
- **Confianza por campo:** cada campo extraído lleva un nivel (alta/media/vacío) que se refleja en el color del formulario de revisión.

## Fases

- **Fase 1 (MVP, esto es lo que construyes ahora):** PDF digital → extracción de honorarios y vigencia (alta confianza) + formulario de revisión con los 70 campos + exportar a la plantilla Excel "Contratos". UI de subida, revisión y exportación. Login por contraseña.
- **Fase 2 (posterior, dejar preparado pero no implementar aún):** OCR con Tesseract.js para PDFs escaneados; reglas de extracción para más tipos de PDF; toma de datos de cliente desde otra fuente.

## Entregables

1. App Next.js funcional corriendo localmente (`npm run dev`).
2. Ruta principal protegida (ej. `/pdftoexcel`) con login.
3. Componentes: zona de subida, extractor pdf.js, motor de reglas, formulario de revisión, exportador Excel.
4. README con: cómo correr local, variable de entorno `PDFEXCEL_PASSWORD`, y pasos de despliegue en Vercel.
5. Código comentado en español.

Empieza confirmando el plan y luego arma la estructura del proyecto.
```
