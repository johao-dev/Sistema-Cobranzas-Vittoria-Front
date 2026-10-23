# Stock por Proyecto — implementación frontend

Fecha: 2026-10-23.

Estado: implementación incremental terminada, con verificación automatizada. Pendiente de validación funcional con backend actualizado y navegador.

## Fuentes y alcance

Se utilizó `backend/docs/StockProyecto_Implementacion.md` como fuente principal. Para completar los tipos exactos, se revisaron en modo lectura los modelos `StockProyecto`, `TransferenciaProyecto`, filtros, DTO de creación, controlador, validador y traducción de errores del backend local. No se modificó el backend.

Se extiende Inventario en su ubicación actual, `cobranza-vittoria/src/inventario`, conservando rutas previas, contratos de entradas/salidas, estilos y mecanismos de sesión. La nueva ruta `/inventario/transferencias-proyecto` se carga de forma diferida y comparte `protegerRuta` del padre Inventario. Se añade su enlace al menú existente; no se incorporan roles ni permisos nuevos.

## Archivos de producción

Rutas relativas a `cobranza-vittoria/src/`:

| Archivos                                                                                                                     | Cambio                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `app/app.routes.ts`, `app/app.html`                                                                                          | Ruta y enlace Transferencias dentro de Inventario.                                                    |
| `inventario/stock/contratos-stock-proyecto.ts`                                                                               | Contratos explícitos de lectura y filtros de Stock por Proyecto.                                      |
| `inventario/registro-inventario.ts`                                                                                          | Consulta HTTP de Stock por Proyecto con `HttpParams`.                                                 |
| `inventario/stock/stock-actual.ts`, `stock-actual.html`, `stock-actual.css`                                                  | Selección de proyecto, consulta global o por proyecto, presentación y alcance visible de exportación. |
| `inventario/referencias-inventario/referencias-inventario.ts`                                                                | Proyectos disponibles en stock y referencias para transferencias.                                     |
| `inventario/errores-inventario.ts`                                                                                           | Mensajes operativos de errores de inventario, con respaldo en las utilidades existentes.              |
| `inventario/consulta-inventario/consulta-inventario.ts`                                                                      | Aplica los mensajes de negocio también en consultas.                                                  |
| `inventario/entradas/formulario-entrada.ts`, `entradas/lista-entradas.ts`                                                    | Aplica mensajes de negocio al guardar y eliminar entradas.                                            |
| `inventario/salidas/formulario-salida.ts`, `salidas/lista-salidas.ts`                                                        | Aplica mensajes de negocio al guardar, recuperar y eliminar salidas.                                  |
| `inventario/transferencias/contratos-transferencias-proyecto.ts`                                                             | Solicitud, filtros y filas de respuesta de transferencias.                                            |
| `inventario/transferencias/registro-transferencias-proyecto.ts`                                                              | Crear, listar y obtener transferencia por ID.                                                         |
| `inventario/transferencias/formulario-transferencia/datos-transferencia.ts`                                                  | Controles reactivos tipados, validación y construcción de petición.                                   |
| `inventario/transferencias/formulario-transferencia/formulario-transferencia.ts`, `formulario-transferencia.html`            | Diálogo de registro manual con materiales dinámicos.                                                  |
| `inventario/transferencias/lista-transferencias/lista-transferencias.ts`, `lista-transferencias.html`                        | Bandeja, filtros, carga, vacío, error, reintento y coordinación de formulario/detalle.                |
| `inventario/transferencias/detalle-transferencia/detalle-transferencia.ts`, `detalle-transferencia.html`                     | Diálogo de consulta de cabecera y todos los materiales obtenidos por ID.                              |
| `inventario/transferencias/transferencias-proyecto.css`                                                                      | Estilos locales para tablas, detalle y formulario móvil.                                              |
| `inventario/stock/distribucion-material/distribucion-material.ts`, `distribucion-material.html`, `distribucion-material.css` | Consulta de distribución completa por material al expandir una fila.                                  |

Se actualizan además este reporte y `docs/migracion-frontend.md`.

## Contratos y endpoints

- `StockProyecto`: `idStockProyecto`, proyecto, material, código, nombre, unidad, especialidad, stock y `fechaUltimoMovimiento`, respetando el nombre exacto del nuevo contrato. La fecha global anterior conserva su nombre `fechaUltimaMovimiento`.
- `FiltrosStockProyecto`: proyecto, especialidad, material y fechas opcionales.
- `CrearTransferenciaProyectoDto`: proyectos origen/destino, fecha civil sin conversión de zona horaria, observación y `items` con únicamente material/cantidad.
- `TransferenciaProyectoDetalle`: campos de lectura del detalle, incluidos material, especialidad y cantidad. `TransferenciaProyecto` incorpora la cabecera a cada detalle, tal como devuelve la API; no se espera una respuesta anidada.
- `FiltrosTransferenciasProyecto`: ID de transferencia, proyectos origen/destino y fechas.

| Método     | Endpoint utilizado                                            |
| ---------- | ------------------------------------------------------------- |
| GET        | `/api/almacen/kardex/stock-actual` (existente)                |
| GET        | `/api/almacen/kardex/stock-proyecto`                          |
| GET        | `/api/almacen/kardex/stock-actual/exportar-excel` (existente) |
| POST / GET | `/api/almacen/transferencias-proyecto`                        |
| GET        | `/api/almacen/transferencias-proyecto/{id}`                   |

No se añaden campos de especialidad a las escrituras ni se inventan endpoints. Los contratos de entradas/salidas existentes permanecen intactos.

## Stock Global y Stock por Proyecto

- Sin proyecto seleccionado, Filtrar consulta el endpoint global y mantiene ID, material, especialidad, unidad, entradas, salidas, stock y última fecha.
- Con proyecto seleccionado, Filtrar consulta Stock por Proyecto y muestra ID, material, especialidad, unidad, proyecto, stock y última fecha de asignación. No se inventan acumulados de entrada/salida para esta respuesta.
- La cabecera identifica la modalidad consultada. Modificar controles sin pulsar Filtrar conserva la modalidad de los resultados vigentes. Limpiar filtros vuelve a consultar el global.
- Cada fila incluye un botón **Distribución** junto al nombre del material, visible al pasar el mouse, enfocar con teclado o usar una pantalla táctil. Expande la distribución debajo de la fila, sin columna de acciones ni flecha adicional; solo una fila se mantiene expandida. Se usa `GET /api/almacen/kardex/stock-proyecto?idMaterial=...`, sin restringir a proyecto o fechas del listado, para mostrar la distribución actual completa. Se consulta al abrir y al reabrir, cancela al cerrar/cambiar de fila/filtrar, y muestra carga, error y reintento. Si no existe distribución, el espacio expandido queda en blanco. El botón expone `aria-expanded` y `aria-controls`.
- La UI combina proyecto, especialidad y fechas. `idMaterial` está tipado y admitido por el registro HTTP; no se añade un selector de material al filtro existente. Se conserva la búsqueda local por ID, código y nombre, sin tildes.
- Se aclara que las fechas por proyecto filtran el último cambio efectivo de asignación, incluidas transferencias/reversiones, y no reconstruyen saldos históricos. El endpoint global conserva la interpretación anterior de sus fechas.
- Se conservan estados de carga, vacío, errores, reintentos y fallos parciales de catálogos. Las consultas sustituidas se cancelan para impedir que una respuesta tardía cambie la modalidad vigente.

## Exportación

Se conserva `ExportacionStock`, su descarga binaria, nombres de archivo, manejo de errores JSON y opción de totales. Se siguen tomando especialidad y fechas de los controles actuales, aunque todavía no se haya pulsado Filtrar. La búsqueda local no se exporta.

Cuando hay proyecto seleccionado, el botón dice **Exportar Stock Global a Excel** y un mensaje explica el alcance. El registro HTTP envía exclusivamente `idEspecialidad`, `fechaDesde`, `fechaHasta` e `incluirTotales`; nunca envía `idProyecto` ni `idMaterial` a la exportación global.

**Pendiente funcional/técnico:** el backend no expone exportación por proyecto. No se genera una exportación simulada en el cliente. Requiere un contrato de backend antes de implementar esa capacidad.

## Transferencias

El código se organiza como los catálogos: contratos y registro HTTP públicos en la raíz, `lista-transferencias/`, `formulario-transferencia/` (incluidos controles y validaciones), `detalle-transferencia/` y `pruebas/`. TypeScript, plantilla y pruebas permanecen junto a su concepto. `transferencias-proyecto.css` conserva únicamente los estilos compartidos por sus vistas. Se actualizan imports, recursos relativos y carga diferida, sin duplicar implementaciones.

**Pendiente en backend:** aplicar la regla de máximo **10 materiales por transferencia** a las solicitudes HTTP. Por indicación del usuario, esta entrega la aplica en el frontend; el backend actual no garantiza ese límite. No se modifica el backend en esta corrección.

- Bandeja con los cinco filtros admitidos; rechaza ID no positivo/no entero y rango de fechas invertido antes de consultar. Proyecto origen igual a destino es válido como filtro de consulta; solo se rechaza al crear.
- La tabla presenta una fila por material con ID, proyectos, fecha, observación, material/código y cantidad/unidad.
- Ver detalle consulta siempre el endpoint por ID y muestra todos sus materiales. Un 404 se presenta como error, permite reintentar y no abre un diálogo con datos parciales.
- Registro en diálogo nativo reutilizable: origen, destino, fecha, observación de hasta 500 caracteres y lista dinámica de materiales/cantidades.
- Exige proyectos distintos y deshabilita el origen en el selector de destino; si se cambia el origen y coincide con el destino previo, limpia ese destino. Admite entre uno y **10 materiales**, con cantidades positivas de hasta dos decimales. El botón Agregar se deshabilita al llegar a diez, muestra el conteo y se rehabilita al quitar una línea; también se valida el límite antes de preparar el POST. Impide seleccionar un material usado en otra línea y vuelve a validar duplicados al preparar la solicitud. No redondea cantidades al enviarlas.
- Durante el POST deshabilita controles, envíos repetidos y cierre del diálogo. Ante error conserva el borrador y habilita corrección/reintento; ante éxito cierra, notifica y recarga la bandeja con los filtros aplicados.
- Usa formularios reactivos tipados, signals para estado y `toSignal` para cambios de líneas sin Zone.js. `finalize` y `takeUntilDestroyed` restauran estado y liberan suscripciones.
- Controles con etiquetas o nombres accesibles, diálogo con título y cierre por teclado, tablas desplazables y formulario de una columna en pantallas pequeñas. Se reutiliza la gestión de foco de `DialogoModal`.

## Errores e integración con entradas/salidas

`mensajeErrorInventario` reutiliza `esCodigoError`, `obtenerErrores` y `extraerMensajeError` del proyecto:

| Código                           | Presentación                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STOCK_PROYECTO_INSUFICIENTE`    | Falta stock del material en el proyecto seleccionado; conserva todos los materiales/proyectos y saldos disponibles/solicitados que entrega el mensaje de backend, presentando sus IDs como tales. |
| `STOCK_PROYECTO_NO_INICIALIZADO` | Indica contactar al administrador para la inicialización.                                                                                                                                         |
| `STOCK_PROYECTO_INCONSISTENTE`   | Informa inconsistencia entre global y distribución, y que la operación no fue realizada.                                                                                                          |
| `PROYECTOS_IGUALES`              | Exige origen y destino diferentes.                                                                                                                                                                |
| `INVENTARIO_OCUPADO`             | Indica esperar unos segundos y reintentar.                                                                                                                                                        |
| Otros                            | Conserva el manejo existente de mensajes, errores de negocio y DataAnnotations.                                                                                                                   |

Entradas y salidas conservan sus formularios, envío de `idProyecto`, contratos, cantidades cero previamente permitidas y flujos de edición/eliminación. Se aplica el traductor también a entradas, porque reducir, cambiar o eliminar puede fallar por saldo asignado al proyecto. En Salida se presenta insuficiencia del proyecto aunque el saldo global alcance. No se registran transferencias ni se cambian proyectos automáticamente.

## Pruebas y verificación

Archivos de pruebas agregados:

- `inventario/errores-inventario.spec.ts`.
- `inventario/transferencias/registro-transferencias-proyecto.spec.ts`.
- `inventario/transferencias/formulario-transferencia/datos-transferencia.spec.ts`.
- `inventario/transferencias/formulario-transferencia/formulario-transferencia.spec.ts`.
- `inventario/transferencias/lista-transferencias/lista-transferencias.spec.ts`.
- Datos de pruebas en `inventario/transferencias/pruebas/transferencias.fixture.ts`.

Archivos de pruebas ajustados:

- `inventario/registro-inventario.spec.ts`.
- `inventario/stock/stock-actual.spec.ts`.
- `inventario/salidas/formulario-salida.spec.ts`.

Se prueban solicitudes HTTP exactas, omisión de filtros vacíos, respuesta plana, POST con varios materiales, fechas y cantidades, rechazo de duplicados/negativos/cero/sin ítems/proyectos iguales, bloqueo de envíos/cierre, preservación del borrador, cinco errores de negocio, 404, listado/detalle, reintentos, filtros combinados, regreso al global, respuesta tardía y exportación global sin proyecto. Las pruebas previas de entradas/salidas y exportaciones continúan ejecutándose. Las pruebas HTTP usan `HttpTestingController`; no llaman a la API real. Las pruebas de interfaz esperan estabilización de Angular sin Zone.js en jsdom.

Verificación inicial de la primera implementación (comandos desde `cobranza-vittoria/`):

| Verificación                                                        | Resultado                                                                                                                                                                  |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -- --watch=false`                                         | **552 pruebas correctas en 83 archivos**, incluidas 112 de Inventario. La suite anterior tenía 513 pruebas en 78 archivos: se añaden 39 casos y cinco archivos de pruebas. |
| `npm test -- --watch=false --include='src/inventario/**/*.spec.ts'` | **112 pruebas correctas en 24 archivos** en la comprobación focalizada; la suite completa posterior incluye los ajustes finales.                                           |
| `npm run lint`                                                      | **0 errores y 1108 advertencias preexistentes** del código pendiente. Sin aumento respecto del registro anterior.                                                          |
| `./node_modules/.bin/eslint src/inventario --max-warnings=0`        | Correcto, sin errores ni advertencias.                                                                                                                                     |
| `npm run build`                                                     | Correcto; bundle inicial **623.04 kB**.                                                                                                                                    |
| `npm run build -- --configuration staging`                          | Correcto; bundle inicial **623.05 kB**.                                                                                                                                    |
| Prettier del código de Inventario y reporte nuevo                   | Correcto.                                                                                                                                                                  |
| `git diff --check`                                                  | Correcto.                                                                                                                                                                  |

Producción y staging conservan el aviso del presupuesto inicial de 500 kB y los cinco avisos CSS preexistentes (`app.css`, Valorizaciones, Control presupuestario, Gastos por proyecto y Terreno). No se modifican sus presupuestos. Los primeros intentos restringidos fallaron por DNS de Google Fonts; las repeticiones con acceso autorizado compilaron correctamente. Se repitieron la suite completa y la compilación de producción tras los ajustes finales de presentación y validación.

Evidencias de esta sesión en `/tmp`: `stock-proyecto-suite.log`, `stock-proyecto-tests.log`, `stock-proyecto-build.log`, `stock-proyecto-staging.log`, `stock-proyecto-lint.log`, `stock-proyecto-lint-inventario.log` y `stock-proyecto-formato.log`. Son registros locales de la sesión, no artefactos versionados.

## Correcciones solicitadas — 2026-10-23

- Se implementan origen inhabilitado como destino y limpieza de un destino que coincide al cambiar origen.
- Se limita la UI a diez materiales con bloqueo de altas y validación de petición. Queda pendiente en backend la misma regla.
- Se añade expansión de distribución por material en Stock Actual, incluida la modalidad por proyecto, con consulta independiente de los filtros de la tabla y área vacía si no hay distribución.
- Se organizan los archivos de Transferencias por concepto y se actualiza la ruta diferida, sin retirar capacidades ni contratos.
- Se agregan nueve pruebas: deshabilitado/limpieza de destino, máximo de líneas y recuperación al quitar, frontera diez/once en petición y seis casos de distribución (consulta al abrir/reabrir, todos los proyectos con filtros activos, vacío, error/reintento, cambio de material con respuesta tardía y cancelación al filtrar).
- `npm test -- --watch=false`: **561 pruebas correctas en 83 archivos**, frente a 552 antes de estas observaciones. Incluye **121 pruebas de Inventario en 24 archivos**; la comprobación focalizada también pasa sus 121 casos.
- `npm run lint`: **0 errores y 1108 advertencias preexistentes**. ESLint de Inventario con `--max-warnings=0` y Prettier de Stock/Transferencias correctos.
- `npm run build`: correcto, bundle inicial **623.04 kB**; se mantienen el aviso inicial y los cinco avisos CSS anteriores. El intento restringido falló por DNS de Google Fonts; la repetición con acceso autorizado compiló.
- `npm run build -- --configuration staging`: correcto, bundle inicial **623.05 kB**, con los mismos avisos preexistentes. Se usó el acceso a Google Fonts autorizado en esta sesión.
- `git diff --check`: correcto; rutas e imports de los conceptos movidos revisados.
- Las comprobaciones de interfaz usan Angular sin Zone.js y jsdom. Sigue pendiente validación con API real y navegador, incluidos hover, teclado y móvil. No se incorpora automatización e2e.
- Evidencias locales en `/tmp/stock-observaciones-{tests,suite,lint,lint-inventario,formato,build,staging}.log`.

## Limitaciones reales

- Falta validar con Almacén, navegador y API real: consulta por proyecto, transferencia y posterior saldo, salida con insuficiencia de proyecto, exportación global con proyecto seleccionado, permisos efectivos del servidor, foco y uso móvil. No se dispone de herramienta de navegador en esta sesión ni se realizaron escrituras reales contra la API.
- Backend pendiente: máximo de 10 materiales por transferencia. La UI y la construcción de su solicitud ya lo limitan; una llamada externa a la API no queda cubierta por esa validación.
- La activación y distribución inicial siguen siendo administrativas en DB. La UI muestra el error si no están listas; no ofrece inicialización ni regularización automática.
- Se conserva el Kardex legacy de Compras, con su inventario independiente.
- No se implementan edición/eliminación de transferencias, históricos, snapshots, cierre/reinicio, almacenes físicos, ubicaciones ni otras capacidades excluidas del alcance.
- No cambian dependencias, lockfile, presupuestos Angular ni almacenamiento/renovación de sesión.
