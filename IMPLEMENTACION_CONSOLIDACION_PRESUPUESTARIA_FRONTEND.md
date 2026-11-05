# Implementación frontend de consolidación presupuestaria

Fecha: 5 de noviembre de 2026. Alcance: frontend Angular, cambios en el árbol de trabajo, sin commit ni despliegue.

## 1. Resultado

El Panel de Control solicita los seis reportes en modo consolidado. Las tarjetas, excesos y tablas presentan los importes devueltos por el backend: presupuesto de la base aprobada vigente y compromiso/ejecución acumulados entre versiones aprobadas e históricas. Angular no suma presupuestos históricos ni reconstruye importes financieros.

El historial del Panel consulta movimientos por presupuesto y partida común entre versiones, muestra su versión de origen y permite conciliar las sumas de los efectos firmados. El mismo componente conserva el historial individual de la gestión de versiones.

Se utilizó como contrato el [reporte del backend](../backend/IMPLEMENTACION_CONSOLIDACION_PRESUPUESTARIA.md). El [diagnóstico previo](DIAGNOSTICO_EJECUCION_HISTORICA_FRONTEND.md) sirvió de referencia histórica; su propuesta de consolidar únicamente dos reportes queda superada por el contrato actual de seis reportes. No se modifica ese diagnóstico.

## 2. Archivos creados y modificados

Rutas relativas a `cobranza-vittoria/src/presupuestos/`:

| Archivo                                                                                                                                 | Cambio                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [consultas/contratos-consultas-presupuestarias.ts](cobranza-vittoria/src/presupuestos/consultas/contratos-consultas-presupuestarias.ts) | Filtro opcional `consolidado` y contrato `MovimientoConsolidado`.                                               |
| [consultas/consultas-presupuestarias.ts](cobranza-vittoria/src/presupuestos/consultas/consultas-presupuestarias.ts)                     | Consulta HTTP de movimientos consolidados; reutiliza la serialización de filtros de los reportes.               |
| [consultas/control-presupuestario.ts](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.ts)                           | Modo consolidado del Panel, acciones por partida, permisos, limpieza de datos, mensajes y porcentaje de saldos. |
| [consultas/control-presupuestario.html](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.html)                       | Etiquetas de alcance, acciones de historial, errores visibles, reintentos y control de exportación.             |
| [consultas/mensajes-consultas-presupuestarias.ts](cobranza-vittoria/src/presupuestos/consultas/mensajes-consultas-presupuestarias.ts)   | **Creado:** presentación de errores de consultas e historial.                                                   |
| [movimientos/historial-presupuestario.ts](cobranza-vittoria/src/presupuestos/movimientos/historial-presupuestario.ts)                   | Contexto discriminado individual/consolidado, cancelación, signals y totales de efectos firmados.               |
| [movimientos/historial-presupuestario.html](cobranza-vittoria/src/presupuestos/movimientos/historial-presupuestario.html)               | Versiones de origen, efectos firmados, totales y diferenciación de modos.                                       |
| [arbol/arbol-presupuestario.html](cobranza-vittoria/src/presupuestos/arbol/arbol-presupuestario.html)                                   | El botón de movimientos respeta el bloqueo de acciones y la carga existentes.                                   |
| [versiones/versiones-presupuesto.ts](cobranza-vittoria/src/presupuestos/versiones/versiones-presupuesto.ts)                             | Declara explícitamente `modo: 'individual'` al abrir historial.                                                 |
| [consultas/consultas-presupuestarias.spec.ts](cobranza-vittoria/src/presupuestos/consultas/consultas-presupuestarias.spec.ts)           | Pruebas de los seis reportes, compatibilidad y nueva ruta de historial.                                         |
| [consultas/control-presupuestario.spec.ts](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.spec.ts)                 | Pruebas de peticiones, filtros, acciones, permisos, errores, porcentajes y presentación/CSV.                    |
| [movimientos/historial-presupuestario.spec.ts](cobranza-vittoria/src/presupuestos/movimientos/historial-presupuestario.spec.ts)         | **Creado:** versiones múltiples, efectos, compatibilidad individual, cancelación y errores.                     |

Se crea además este reporte en la raíz del repositorio frontend. No se modifican dependencias, lockfile, backend ni documentación de migración.

## 3. Integración de los seis reportes

`ReporteFiltro.consolidado?: boolean` es opcional. Los métodos compartidos conservan sus valores predeterminados y envían únicamente los filtros proporcionados mediante `HttpParams`. Omitido o `false` mantiene la consulta individual según el contrato backend.

El getter `ControlPresupuestario.filtro` incluye exclusivamente `consolidado: true`, `idCentroCosto` e `idPresupuesto`. Se reutiliza en `cargarResumen()` y en todas las ramas de `cargarVista()`:

| Método                        | GET bajo `/api/control-presupuestario/consultas` |
| ----------------------------- | ------------------------------------------------ |
| `resumen()`                   | `/resumen`                                       |
| `saldos()`                    | `/saldo`                                         |
| `presupuestoVsComprometido()` | `/presupuesto-vs-comprometido`                   |
| `presupuestoVsEjecutado()`    | `/presupuesto-vs-ejecutado`                      |
| `gastosPorPartida()`          | `/gastos-por-partida`                            |
| `gastosPorCentroCosto()`      | `/gastos-por-centro-costo`                       |

No se envían versión ni estado en estas peticiones del Panel. Los seis DTO de respuesta conservan sus campos. Requerimientos continúa con `saldos({ idCentroCosto, estadoPresupuesto: 'APROBADO' })`, sin nuevo modo.

La búsqueda local y la generación de CSV permanecen sobre las filas recibidas y filtradas. El CSV conserva los nombres originales de los campos y sus valores: `numeroVersion`/`estado` identifican la base aprobada vigente. No se agregan versiones ni conversiones al exportar. Se deshabilita la exportación durante la carga o cuando no existen filas filtradas.

## 4. Contratos y flujo del historial

`MovimientoConsolidado` extiende el contrato individual existente con los tres campos numéricos del backend: `idTipoMovimientoPresupuestal`, `efectoComprometido` y `efectoEjecutado`. La respuesta permanece como arreglo plano.

`ContextoMovimientos` exige uno de estos modos:

- `consolidado`: `idPresupuesto` e `idCatalogoPartida`; consulta `ConsultasPresupuestarias.movimientosConsolidados()` mediante `GET /consultas/movimientos`.
- `individual`: `idPresupuesto`, `idVersion` e `idDetalle`; conserva `RegistroPresupuestos.movimientos()` y `GET /presupuestos/{id}/versiones/{idVersion}/partidas/{idDetalle}/movimientos`.

El historial muestra fecha, versión/estado de origen, tipo, afectación, dirección, origen, importe original y observación. En modo consolidado agrega ambas columnas de efectos, con signo positivo explícito y negativo conservado, y sus totales mediante `computed`. Solo suma los efectos suministrados; nunca suma `monto` para reconstruir ejecución o compromiso. No resta ejecución del compromiso.

Se respeta el orden cronológico y desempate por ID entregados por el servidor; cada fila utiliza `idMovimientoPresupuestal` como clave. Un `effect` vuelve a consultar al cambiar contexto o reintentar y libera la suscripción anterior con su limpieza. El cierre explícito cancela inmediatamente; la destrucción también cancela. Antes de cada carga se vacían filas y errores, y `finalize` restaura el estado de carga.

## 5. Presentación y acciones

- El encabezado explica el alcance financiero acumulado y la tabla identifica «Versión base aprobada vigente».
- Saldos, ambos comparativos, gastos por partida y excesos abren el historial consolidado con presupuesto/partida. Gastos por partida no requiere detalle ni versión.
- Gastos por centro conserva su tabla agregada sin acción de historial de partida: no dispone de ese identificador. Para consultar movimientos se debe usar una vista con partidas o el árbol vigente.
- El árbol vigente abre el nuevo historial cuando su hoja identifica un presupuesto. Si agrega varios presupuestos, pide elegir uno; no inventa IDs. No cambia sus consultas, cálculos, subtotales ni navegación.
- La gestión explícita de versiones, incluido su árbol, abre el modo individual. Sus operaciones de ajustes y demás escrituras se conservan.
- La barra de Saldos usa `ejecutado / montoPresupuestado * 100`; con base cero presenta 0 %, igual que la regla documentada del backend. Conserva porcentajes negativos o superiores a 100 % en la etiqueta; limita solo el ancho visual a 0–100 %. Por encima de 100 % usa el color de exceso. Los importes originales no se alteran.

Se reutilizan el diálogo, los estilos y la tabla con desplazamiento horizontal existentes. No se modifica el donut, su exclusión de partidas, la evolución temporal ni el cálculo del árbol.

## 6. Errores, monedas y permisos

Antes de cargar otro resumen/reporte se eliminan sus resultados anteriores; los errores se muestran en pantalla y mediante `Notificaciones`, con reintento independiente. Los filtros permanecen seleccionados. Cambiar el contexto del Panel cierra el historial anterior. Las consultas de reportes conservan la cancelación por suscripción previa y destrucción.

`MONEDAS_MIXTAS` indica seleccionar un presupuesto. Se reutiliza ese filtro existente, sin incorporar filtro adicional de moneda ni cambiar el alcance del dashboard/árbol. No se suman ni convierten monedas. `FILTROS_INCOMPATIBLES` explica la incompatibilidad con versión/estado. Se presentan mensajes de autenticación/permisos (401/403), inexistencia (404) y validación/mensajes del servidor mediante las utilidades compartidas. El código de negocio directo del middleware y los códigos en `errores[]` se contemplan para monedas e incompatibilidad.

Las acciones consolidadas exigen conjuntamente `control_presupuestario.reporte.ver` y `control_presupuestario.movimiento.ver`. Las tablas ocultan acciones sin ambos; el árbol bloquea su botón y la emisión de la acción. Los métodos del Panel también comprueban permisos antes de abrir. La autorización definitiva sigue en el backend.

## 7. Verificaciones automatizadas

Desde `cobranza-vittoria/`:

```bash
npm test -- --watch=false --include='src/presupuestos/**/*.spec.ts' --include='src/requerimientos/partidas-requerimiento.spec.ts'
npm run lint
npm run build
```

Resultados:

- **162 pruebas aprobadas, 12 archivos, cero fallos.** Incluyen HTTP con `HttpTestingController`, TestBed y plantillas reales en jsdom sin Zone.js.
- **ESLint:** todos los archivos de la aplicación pasan.
- **Compilación de producción:** correcta con los presupuestos de error configurados. El primer intento restringido falló por DNS de Google Fonts (`EAI_AGAIN`); se repitió con acceso de red autorizado. Hay advertencias de tamaño en `tablero-presupuestario.css` (5.96 kB) y `aplicacion.css` (5.50 kB), archivos no modificados en esta entrega.
- **Prettier:** formato verificado sobre todos los archivos de código modificados/creados y este reporte.
- **`git diff --check`:** correcto.

Cobertura relevante: seis reportes con modo opcional/omitido/false, filtros y versión individual; historial por IDs correctos; cancelación entre partidas, cierre y destrucción; errores 400/401/403/404/500 y reintento; permisos; tarjetas y tablas con importes consolidados simulados; CSV filtrado; porcentajes cero/negativos/superiores a 100 %; versiones de origen y efectos compensatorios (compromiso neto 375, ejecución neta 530), conservando los montos positivos originales.

Se ejecutaron también las regresiones existentes de gestión de versiones, importes y ajustes, dashboard/donut/exclusiones/navegación, CSV, selector de partidas y consulta individual aprobada de Requerimientos. No se ejecutó la suite completa de los demás módulos.

Registros temporales: `/tmp/consolidacion-frontend-tests.log`, `/tmp/consolidacion-frontend-lint.log` y `/tmp/consolidacion-frontend-build.log`. No son artefactos versionados.

## 8. Validación pendiente con datos reales de MC2

1. Integrar con el backend actualizado y consultar el mismo centro, presupuesto, moneda y conjunto de partidas, sin movimientos concurrentes durante la comparación.
2. Conciliar las seis tarjetas y todas las pestañas contra las respuestas reales y el árbol vigente. Verificar ejecución histórica, liberaciones y ajustes positivos/negativos entre versiones; presupuesto base cero y sobreejecución.
3. Abrir historial desde cada tipo de fila, excesos y árbol vigente; comparar las sumas de efectos con el reporte correspondiente, y verificar cada versión de origen.
4. Probar un centro/global con monedas mixtas y corregir mediante selección de presupuesto; confirmar limpieza de datos y conservación de filtros.
5. Revisar en navegador de escritorio y móvil el desplazamiento de tablas, foco/teclado del diálogo, cancelación ante cambios rápidos y permisos reales. jsdom simula `showModal`; no verifica el comportamiento nativo del foco.
6. Descargar y abrir un CSV real para comprobar separador, codificación, importes y la interpretación de versión base; verificar también el historial individual desde gestión de versiones.

No se realizó comprobación manual en navegador, llamada a la API real, lectura de SQL, validación de MC2 ni despliegue. Las pruebas frontend con respuestas simuladas no acreditan la consolidación SQL instalada en otro entorno.

## 9. Limitaciones y riesgos

- El backend debe estar desplegado con el contrato nuevo antes de usar esta integración. No se incluye compatibilidad que omita silenciosamente la consolidación frente a una versión anterior del servidor.
- Reportes e historial son peticiones independientes: movimientos/aprobaciones concurrentes pueden producir diferencias temporales. Volver a consultar para conciliar con el mismo alcance.
- El historial no tiene paginación por contrato: descarga todos los asientos y suma todos sus efectos. Revisar tiempo y volumen de renderizado con presupuestos grandes.
- Las partidas económicamente relevantes deben existir en la base aprobada, incluso con monto cero. El frontend no repara snapshots, versiones duplicadas ni movimientos inconsistentes.
- Exclusiones, ramas, búsqueda y niveles tienen alcances distintos ya existentes. No se debe exigir igualdad entre cifras consultadas con conjuntos diferentes.
- Los IDs numéricos mantienen el transporte actual del backend y la precisión habitual de JavaScript. No se introduce un cambio de representación monetaria o de identificadores.
