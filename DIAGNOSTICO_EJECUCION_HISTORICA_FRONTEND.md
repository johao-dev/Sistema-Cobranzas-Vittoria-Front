# Diagnóstico frontend: ejecución histórica del Panel de Control Presupuestario

Fecha: 5 de noviembre de 2026. Revisión frontend: `46da7aaa02ed364f1724aed4ebbe601209208edc`.

**Alcance:** análisis estático del checkout Angular y de sus pruebas existentes. El único archivo generado es este reporte; no se modificaron código, contratos ni pruebas. No se ejecutaron compilación, pruebas, navegador, solicitudes a la API ni consultas a base de datos. Los resultados describen este checkout, no el despliegue ni los importes reales de MC2.

**Referencia backend:** [DIAGNOSTICO_EJECUCION_HISTORICA.md](../backend/DIAGNOSTICO_EJECUCION_HISTORICA.md), fechado el 5 de noviembre de 2026, revisión backend `c1684ed70ce5a88b175a84df1ed52438a35eeacf`. Sus ejemplos se consideran propuestas pendientes, no un contrato ya implementado ni instrucciones de ejecución.

## 1. Resumen de hallazgos

1. El Panel corresponde a la ruta `/control-presupuestario/panel`, que carga `ControlPresupuestario`. Dentro de esta página conviven **consultas por versión y consultas consolidadas**. No todos sus indicadores provienen del endpoint `/dashboard`.
2. **`/consultas/resumen` alimenta seis tarjetas generales y la tabla «Partidas con saldo excedido».** La respuesta `porCentroCosto` se guarda en la página, pero no tiene una tabla ni otro consumidor visual en la plantilla actual.
3. **`/consultas/saldo` alimenta la pestaña inicial «Saldos», su búsqueda local y su exportación CSV.** Estas superficies representan disponibilidad general del centro/presupuesto seleccionado y deberían solicitar explícitamente `consolidado=true` cuando el backend lo implemente.
4. El Panel no transmite versión ni estado en esas llamadas: solo centro de costo y presupuesto. Según el diagnóstico backend, la ausencia de versión/estado hace que las consultas actuales seleccionen `APROBADO`, conservando únicamente los movimientos de esa versión. Angular no elimina movimientos históricos de una respuesta ni calcula su arrastre.
5. **Existe un consumidor externo de `/saldo`: Requerimientos.** Solicita `estadoPresupuesto=APROBADO`, utiliza IDs de detalle para imputar ítems y muestra información financiera de la partida elegida. Un valor consolidado predeterminado en el servicio compartido cambiaría ese flujo y, con la validación propuesta, causaría un conflicto de filtros.
6. `TableroPresupuestario` usa `/consultas/dashboard`; `ArbolPresupuestario` en modo vigente usa `/consultas/arbol`. El backend ya los consolida. **Donut, exclusiones, resumen interno del dashboard, evolución temporal y árbol pueden permanecer intactos.**
7. Las otras cuatro pestañas usan endpoints distintos y conservan semántica por versión. Agregar el parámetro solo a resumen/saldo **no consolida esas pestañas**. Deben mantenerse en esta integración mínima y explicitar su alcance; si se desea que también representen situación general, requieren una decisión y un contrato adicionales.
8. Los DTO de respuesta actuales pueden conservarse conforme a la propuesta backend. **La petición sí requiere ampliar su tipado:** `ReporteFiltro` todavía no declara `consolidado`. El serializador ya admite booleanos. Conviene limitar la opción a los métodos `resumen()` y `saldos()`.
9. Hay dos riesgos de presentación preexistentes que no corrige el parámetro: la columna «Versión» y el botón «Historial» pueden sugerir un alcance individual aunque el importe sea acumulado; además, la barra de avance de «Saldos» intenta leer un porcentaje que `SaldoPartida` no declara.

## 2. Componentes visuales, endpoints y propiedades consumidas

En esta tabla, las rutas `/consultas/...` llevan el prefijo `/api/control-presupuestario`. Las tarjetas y tablas de `ControlPresupuestario` son bloques de su plantilla, no componentes Angular independientes.

| Superficie visual | Propietario | Fuente y propiedades consumidas | Alcance recomendado |
| --- | --- | --- | --- |
| Tarjeta «Presupuestado» | `ControlPresupuestario` | `/consultas/resumen` → `totales.presupuestado` | Consolidado: presupuesto de la aprobada vigente, sin sumar snapshots históricos |
| Tarjeta «Comprometido» | Ídem | `/consultas/resumen` → `totales.comprometido` | Consolidado: compromiso neto aprobado + histórico |
| Tarjeta «Ejecutado» | Ídem | `/consultas/resumen` → `totales.ejecutado` | Consolidado: ejecución neta aprobada + histórica |
| Tarjeta «Saldo disponible» | Ídem | `/consultas/resumen` → `totales.saldoDisponible`; estilo de alerta si es negativo | Consolidado |
| Tarjeta «% ejecutado» | Ídem | `/consultas/resumen` → `totales.porcentajeEjecutado` | Porcentaje recalculado por backend sobre el consolidado |
| Tarjeta «Partidas excedidas» | Ídem | `/consultas/resumen` → `totales.partidasExcedidas` / `totales.partidas`; alerta si el numerador es mayor que cero | Conteo sobre las partidas consolidadas |
| Tabla «Partidas con saldo excedido» | Ídem | `/consultas/resumen` → `partidasExcedidas[]`: `centroCosto`, `codigoPresupuesto`, `codigoPartida`, `partida`, `montoPresupuestado`, `comprometido`, `ejecutado`, `simboloMoneda`, `montoExcedido` | Consolidado; se actualiza con la misma llamada que las tarjetas |
| Pestaña «Saldos» / «Saldo disponible por partida» | Ídem | `/consultas/saldo` → `codigoCentroCosto`, `centroCosto`, `codigoPresupuesto`, `codigoPartida`, `partida`, `numeroVersion`, `estado`, `simboloMoneda`, `montoPresupuestado`, `comprometido`, `ejecutado`, `saldoDisponible`, `excedido`; IDs para historial | Consolidado para sus importes; IDs y versión describirán la línea base vigente |
| Barra «Avance» de «Saldos» | Ídem | Misma respuesta; `porcentaje(f)` intenta leer `porcentajeEjecutado` y usa `0` si falta | Advertencia: ese campo no pertenece al contrato `SaldoPartida`; el parámetro no resuelve la barra |
| CSV de «Saldos» | Ídem | Mismas filas de `/consultas/saldo`, después de la búsqueda local; exporta las claves de la primera fila | Hereda el consolidado de la tabla, sin otra llamada HTTP |
| «Vs. comprometido» | Ídem, tabla reutilizada | `/consultas/presupuesto-vs-comprometido`: identificación centro/presupuesto/partida/versión/moneda, `montoPresupuestado`, `comprometido`, `porcentajeComprometido`; IDs para historial | Por versión; endpoint fuera de la ampliación propuesta |
| «Vs. ejecutado» | Ídem | `/consultas/presupuesto-vs-ejecutado`: identificación, `montoPresupuestado`, `ejecutado`, `porcentajeEjecutado`; IDs para historial | Por versión; fuera de esta ampliación |
| «Gastos por partida» | Ídem | `/consultas/gastos-por-partida`: identificación, `montoPresupuestado`, `ejecutado`, `porcentajeEjecutado` | Por versión; fuera de esta ampliación. El DTO no contiene `idPresupuestoDetalle`, por lo que el botón Historial no puede abrirlo |
| «Gastos por centro» | Ídem | `/consultas/gastos-por-centro-costo`: identificación centro/presupuesto/versión/moneda, `montoPresupuestado`, `comprometido`, `ejecutado`, `saldoDisponible`, `porcentajeEjecutado`, `excedido` | Por versión; no es la propiedad `porCentroCosto` de `/resumen` |
| Donut y tabla de distribución | `TableroPresupuestario` | `/consultas/dashboard` → `rubrosFiltrados[].codigo`, `nombre`, `idCatalogoPartida`, `ejecutado`, `porcentajeDelTotal`; total y segmentos calculados desde `ejecutado` | Ya consolidado; conservar |
| Resumen interno junto al donut | Ídem | `/consultas/dashboard` → `resumen.presupuestado`, `ejecutado`, `porcentajeEjecutado`, `desviacion`, `desviacionPorcentaje`; moneda del encabezado | Ya consolidado; es independiente de las seis tarjetas de `/resumen` |
| Evolución, tabla semanal, resumen al corte y desviaciones | Ídem | `/consultas/dashboard` → `semanas[].semana`, `fecha`, `realAcumulado`, `presupuestoAcumulado`; `alCorte`; `desviacionPorRubro`; `resumen.presupuestado` como referencia sin cronograma | Ya consolidado; conservar |
| Árbol vigente, subtotales y total | `ArbolPresupuestario`, `modo="vigente"` | `/consultas/arbol` → `nodos[]` y `totales`: `montoPresupuestado`, `montoComprometido`, `montoEjecutado`, `saldoDisponible`, `porcentajeEjecutado`; nodos: `excedido`, `partidasExcedidas`; jerarquía e IDs | Ya consolidado; conservar |
| Modal «Historial» desde tabla o árbol | `HistorialPresupuestario` | `/presupuestos/{id}/versiones/{versionId}/partidas/{detalleId}/movimientos`, mediante `RegistroPresupuestos.movimientos()` | Conservar lectura por versión/detalle; no es consumidor de resumen/saldo |

Evidencia visual: [plantilla del Panel](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.html#L103), [plantilla del tablero](cobranza-vittoria/src/presupuestos/tablero/tablero-presupuestario.html#L110) y [plantilla del árbol](cobranza-vittoria/src/presupuestos/arbol/arbol-presupuestario.html#L160).

### 2.1. Importes, porcentajes y excesos

- Angular presenta los importes HTTP con `DecimalPipe`; no suma versiones ni vuelve a calcular el saldo de las tarjetas o la tabla. Según el diagnóstico backend, la regla financiera es `saldo = presupuesto vigente - compromiso neto acumulado - ejecución neta acumulada` en modo consolidado.
- El presupuesto se llama `presupuestado` en `ResumenTotales`, `montoPresupuestado` en `SaldoPartida` y `montoPresupuestado` en el árbol. Compromiso/ejecución se llaman `comprometido`/`ejecutado` en resumen/saldo y `montoComprometido`/`montoEjecutado` en el árbol. No intercambiar estos nombres entre contratos.
- La tarjeta de porcentaje usa el valor agregado del backend, no un promedio de porcentajes de filas. Las barras de la tabla usan `porcentajeComprometido` solo en «Vs. comprometido» y `porcentajeEjecutado` en las demás vistas. El ancho visual se limita a 0–100%; la etiqueta conserva el porcentaje original. Los colores cambian por encima de 80% y 100%.
- `SaldoPartida` contiene `saldoDisponible`, `montoExcedido` y `excedido`, pero **no `porcentajeEjecutado`**. El tipo de filas `Partial<...>` permite consultar esa propiedad opcional y `porcentaje()` devuelve cero si falta. No se debe afirmar que la barra de «Saldos» representa un porcentaje correcto a partir del contrato actual; comprobar la respuesta real y tratar cualquier corrección como alcance separado.
- La tabla de excesos depende de la selección `partidasExcedidas[]` realizada por el servidor. La página no la reconstruye desde las filas de «Saldos». Cambiar únicamente `/saldo` dejaría las alertas generales por versión; cambiar únicamente `/resumen` dejaría la tabla de saldo por versión.
- `ResumenTotales.centrosCosto` no se muestra. `porCentroCosto` se asigna en `cargarResumen()` pero no se lee en la plantilla ni en otro método; no existe un widget adicional que deba migrarse para esa propiedad.

## 3. Archivos, métodos y flujo de datos

Las referencias de línea corresponden a la revisión indicada. Todas las rutas de esta tabla parten de la raíz frontend.

| Archivo | Métodos o bloques relevantes | Responsabilidad |
| --- | --- | --- |
| [src/rutas.ts](cobranza-vittoria/src/rutas.ts#L144) | Ruta hija `panel`, carga de `ControlPresupuestario` | Entrada al Panel y protección de acceso |
| [core/http/api-http.ts](cobranza-vittoria/src/core/http/api-http.ts#L6) | `ApiHttp.baseUrl`, `http` | Obtiene `environment.apiUrl` y el `HttpClient` compartido |
| [consultas-presupuestarias.ts](cobranza-vittoria/src/presupuestos/consultas/consultas-presupuestarias.ts#L18) | `resumen()`, `saldos()` | GET tipados, sin transformación de respuestas; ambos usan `parametrosConsulta({ ...filtro })` |
| [parametros-presupuestarios.ts](cobranza-vittoria/src/presupuestos/parametros-presupuestarios.ts#L3) | `parametrosConsulta()` | Serialización a `HttpParams`; omite `undefined`, `null` y cadena vacía, conserva números y booleanos, incluido `false` |
| [control-presupuestario.ts](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.ts#L99) | `ngOnInit()`, `cargarCatalogos()`, `recargar()` | Carga referencias y dispara resumen + vista inicial |
| [control-presupuestario.ts](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.ts#L108) | `normalizarIdentificador()`, getters `idCentroCostoDashboard`, `idPresupuestoDashboard`, `filtro`, `presupuestosDisponibles`, `onCentroCostoChange()` | Normaliza selección y delimita centro/presupuesto |
| [control-presupuestario.ts](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.ts#L283) | `cargarResumen()` | Asigna `data.totales`, `data.porCentroCosto`, `data.partidasExcedidas`; actualiza carga y detección de cambios |
| [control-presupuestario.ts](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.ts#L308) | `cambiarVista()`, `cargarVista()` | Selecciona uno de cinco endpoints y asigna `filas`; cancela la solicitud anterior |
| [control-presupuestario.ts](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.ts#L155) | `filasFiltradas`, getters `muestra*`, `etiquetaVista` | Búsqueda local y columnas según pestaña |
| [control-presupuestario.ts](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.ts#L384) | `porcentaje()`, `claseBarra()`, `anchoBarra()`, `exportarCsv()` | Presentación del avance y descarga de las filas filtradas |
| [exportacion-presupuestaria.ts](cobranza-vittoria/src/presupuestos/consultas/exportacion-presupuestaria.ts#L2) | `crearCsvPresupuestario()` | Exporta todas las propiedades de la primera fila; no solicita datos adicionales |
| [tablero-presupuestario.ts](cobranza-vittoria/src/presupuestos/tablero/tablero-presupuestario.ts#L146) | `ngOnChanges()`, `cargar()`, `rubrosDistribucion`, `totalDistribucion`, `construirDona()`, `construirLineas()` | Consulta dashboard, conserva alcance de exclusiones y dibuja los gráficos |
| [arbol-presupuestario.ts](cobranza-vittoria/src/presupuestos/arbol/arbol-presupuestario.ts#L135) | `cargar()`, `peticion()`, `indexar()`, `recalcular()` | Distingue árbol vigente y árbol de versión; organiza la visualización sin recalcular los importes |
| [historial-presupuestario.ts](cobranza-vittoria/src/presupuestos/movimientos/historial-presupuestario.ts#L35) | `cargar()` | Lee movimientos del detalle de la versión recibida |
| [registro-presupuestos.ts](cobranza-vittoria/src/presupuestos/registro-presupuestos.ts#L228) | `movimientos()` | Construye la ruta de movimientos por presupuesto/versión/detalle |

### 3.1. Recorrido de resumen y saldo hasta la pantalla

```text
/control-presupuestario/panel → ControlPresupuestario.ngOnInit()
  → cargarCatalogos(): centros activos, presupuestos activos y catálogo para exclusiones
  → recargar()
      → cargarResumen()
          → ConsultasPresupuestarias.resumen(this.filtro)
          → parametrosConsulta → ApiHttp.http.get → GET /consultas/resumen
          → respuesta.totales → seis tarjetas
          → respuesta.partidasExcedidas → tabla de excesos
          → respuesta.porCentroCosto → propiedad sin representación visual
      → cargarVista() [vista inicial: saldos]
          → ConsultasPresupuestarias.saldos(this.filtro)
          → parametrosConsulta → ApiHttp.http.get → GET /consultas/saldo
          → filas → filasFiltradas → tabla de saldos y exportarCsv()
```

Ambas cargas usan `takeUntilDestroyed`, cancelan su suscripción anterior y llaman a `ChangeDetectorRef.detectChanges()` al recibir éxito/error. La integración posterior debe conservar estas actualizaciones en el entorno sin Zone.js.

Al elegir otra pestaña, `cargarVista()` reutiliza **el mismo filtro** para los otros cuatro endpoints. No hay una llamada a `/saldo` para construir sus importes ni una combinación con `porCentroCosto` de `/resumen`.

## 4. Componentes que deberían activar el modo consolidado

### 4.1. Activación propuesta y delimitada

- **`ControlPresupuestario.cargarResumen()`**: solicitar el modo en esta llamada cubre las seis tarjetas y la tabla de excesos de forma coherente.
- **Rama `vista === 'saldos'` de `ControlPresupuestario.cargarVista()`**: solicitar el modo únicamente en `saldos()` cubre la tabla de disponibilidad y su CSV. La búsqueda continúa siendo local sobre esas filas.

Estas superficies no ofrecen selección de versión y se presentan como situación financiera general. La columna `vN · estado` de la tabla identifica actualmente una versión, pero no constituye un filtro ni justifica conservar importes limitados a esa versión en la vista general. En consolidado deberá entenderse como **versión base aprobada**.

### 4.2. Consultas que deben conservar su alcance

- **Árbol de versión en la gestión de presupuestos:** [versiones-presupuesto.html](cobranza-vittoria/src/presupuestos/versiones/versiones-presupuesto.html#L121) instancia `ArbolPresupuestario` con `modo="version"`, `idPresupuesto` e `idVersion` seleccionada. `peticion()` utiliza `arbolVersion()` y la ruta `/presupuestos/{id}/versiones/{versionId}/arbol`. Es una consulta histórica legítima, también para borradores; no debe sustituirse por vigente ni recibir `consolidado`.
- **Movimientos por versión/detalle:** `verMovimientos()` pasa `idPresupuestoVersion` e `idPresupuestoDetalle` al modal. Se conserva esa lectura individual para trazabilidad. No representa por sí sola el desglose de todo el acumulado.
- **Requerimientos:** conservar su solicitud actual en esta corrección del Panel. Evaluar separadamente si su saldo orientativo debería consolidarse; no cambiar ni quitar su filtro de estado incidentalmente.
- **Cuatro pestañas de comparativos/gastos:** conservar los endpoints y la semántica actual por versión en la integración mínima. No tienen filtros explícitos de versión en esta pantalla y, por tanto, no puede asumirse que su lectura limitada sea la expectativa funcional definitiva. Si se pretende conciliar también estas pestañas con los indicadores generales, el backend propuesto es insuficiente para hacerlo sin un trabajo adicional. No enviarles un parámetro que no está previsto para ellas.

## 5. Servicios compartidos y filtros existentes

### 5.1. Centro de costo y presupuesto

`filtroCentroCosto` y `filtroPresupuesto` son cadenas provenientes de `<select>`. Los getters convierten únicamente enteros positivos a número; «Todos» produce `null`, que se omite de HTTP. El getter `filtro` devuelve exclusivamente:

```typescript
{
  idCentroCosto: this.idCentroCostoDashboard,
  idPresupuesto: this.idPresupuestoDashboard,
}
```

`cargarCatalogos()` consulta centros activos y `RegistroPresupuestos.presupuestos(true, null, null, null)`, es decir, presupuestos activos. `presupuestosDisponibles` restringe las opciones al centro seleccionado. `onCentroCostoChange()` elimina un presupuesto que no pertenece al nuevo centro; `recargar()` evita cargas duplicadas del mismo contexto y limpia las exclusiones cuando cambia centro/presupuesto.

Sin centro seleccionado, resumen/saldos se consultan igualmente, incluso con ambos filtros omitidos. En cambio, dashboard y árbol solo se montan cuando existe centro. No se debe atribuir una diferencia por este alcance distinto a pérdida histórica.

### 5.2. Versión, estado, moneda y otros filtros

| Filtro | Soporte actual | Relación con consolidación |
| --- | --- | --- |
| `idPresupuestoVersion` | Declarado en `ReporteFiltro`, serializado por el servicio, sin control visual ni envío desde el Panel | Debe continuar disponible para consultas individuales; no combinar con `consolidado=true` |
| `estadoPresupuesto` | Declarado y serializado, ausente en el Panel; Requerimientos envía `APROBADO` | El backend propone rechazar cualquier estado explícito no vacío junto al nuevo modo, incluso `APROBADO` |
| `idMoneda` | Declarado, no seleccionado ni enviado por el Panel | «Todos» puede abarcar varias monedas. Según el diagnóstico, resumen actual no impide mezclarlas; el modo nuevo necesita una regla backend confirmada y una prueba específica |
| `incluirInactivos` | Declarado; no enviado por el Panel | Se conserva el valor predeterminado backend que excluye presupuestos inactivos. El modo nuevo no debe habilitarlos silenciosamente |
| `idCatalogoPartida` | Declarado, no enviado por el Panel | No confundir con exclusiones del donut ni con la rama del dashboard |
| Nivel | `filtroNivel` → `nivelDashboard`; input del tablero y `nivelSincronizado` del árbol | No llega a resumen/saldo. En el árbol limita la presentación local; en dashboard modifica la agrupación |
| Exclusiones | Signal `partidasExcluidas` → tablero → parámetros repetidos `partidasExcluidas` en dashboard | No llega a resumen/saldo/árbol; debe conservarse así |
| Rama del donut | `TableroPresupuestario.idPartidaPadre` → dashboard | Limita ese tablero completo; no cambia filtros del contenedor ni el árbol |
| Buscar | `filtroBusqueda` → `filasFiltradas` | Filtra tabla y CSV localmente, no las tarjetas, excesos, dashboard o árbol |

El backend propone validar la incompatibilidad antes de aplicar `APROBADO` por defecto. La llamada consolidada del Panel **no debe agregar `estadoPresupuesto: 'APROBADO'`**: basta centro/presupuesto + modo.

### 5.3. Consumidores fuera del Panel

La búsqueda de rutas, imports y llamadas en el código fuente identifica:

| Método compartido | Consumidores de producción localizados | Impacto de cambiar su valor predeterminado |
| --- | --- | --- |
| `ConsultasPresupuestarias.resumen()` | Solo `ControlPresupuestario.cargarResumen()` | No se localizaron otros consumidores frontend; conviene mantener compatibilidad del servicio y del endpoint |
| `ConsultasPresupuestarias.saldos()` | Panel y `PartidasRequerimiento` | Afectaría al editor de ítems de Requerimientos, incluyendo sus importes y referencias de imputación |
| `dashboard()` / `arbolVigente()` / `arbolVersion()` | Tablero y árbol reutilizado en Panel/gestión de versiones | Comparten la clase de servicio, no las llamadas resumen/saldo; deben permanecer intactos |

Flujo externo confirmado:

1. [PartidasRequerimiento](cobranza-vittoria/src/requerimientos/partidas-requerimiento.ts#L36) recibe proyecto por `cargar()`, resuelve su centro y llama a `saldos({ idCentroCosto, estadoPresupuesto: 'APROBADO' })`. Publica el resultado en el signal `partidas` y cancela solicitudes anteriores mediante `switchMap`.
2. [EstadoRequerimientos](cobranza-vittoria/src/requerimientos/estado-requerimientos.ts#L30) expone esas filas como `partidasPresupuesto`.
3. [EdicionItemRequerimiento.partidaPorDetalle()](cobranza-vittoria/src/requerimientos/edicion-item-requerimiento/edicion-item-requerimiento.ts#L170) busca la partida por `idPresupuestoDetalle` y resuelve la seleccionada en el modal.
4. [formulario-item.html](cobranza-vittoria/src/requerimientos/formulario-item/formulario-item.html#L90) usa ese identificador como valor del selector y muestra `codigoPartida`, `partida`, `simboloMoneda`, `saldoDisponible`, `montoPresupuestado`, `comprometido` y `ejecutado`. Resalta el saldo si es menor o igual a cero.

No se localizaron otros consumidores de producción de estos dos métodos ni accesos HTTP alternativos a esas dos rutas en este checkout. Las coincidencias adicionales son pruebas. Esta conclusión no cubre otros clientes, ramas ni despliegues del backend.

## 6. Contratos y propuesta mínima de integración futura

### 6.1. Compatibilidad de TypeScript

[contratos-consultas-presupuestarias.ts](cobranza-vittoria/src/presupuestos/consultas/contratos-consultas-presupuestarias.ts#L1) declara los filtros y las respuestas:

- `ReporteFiltro` no tiene `consolidado`: no se puede pasar como nueva propiedad de un literal tipado sin ampliar el contrato de petición. No utilizar `any` ni aserciones para eludirlo.
- `parametrosConsulta()` ya acepta `boolean` y los métodos propagan los campos mediante spread. No requiere cambiar la mecánica de `HttpParams` para serializar `true`.
- **`ResumenPresupuestario`, `ResumenTotales`, `GastoPorCentroCosto` y `SaldoPartida` pueden conservar su estructura** si el backend cumple la propuesta de mantener los JSON. Cambia el alcance de los números, no sus nombres o tipos.
- Los IDs de versión/detalle de una fila consolidada seguirán siendo los de la aprobada vigente, según el reporte backend. No asumir que permiten recuperar todos los movimientos incluidos en el importe.

### 6.2. Secuencia mínima propuesta; no implementada

1. Confirmar la disponibilidad backend del modo, respuestas sin cambios, reglas de moneda/inactivos y error ante versión/estado explícitos. No enviar el parámetro antes: un backend anterior podría ignorarlo y dar apariencia de consolidación sin aplicarla.
2. Introducir un filtro específico para resumen/saldo que extienda `ReporteFiltro` con `consolidado?: boolean`, y usarlo únicamente en las firmas de `resumen()` y `saldos()`. Mantener `ReporteFiltro` y los valores predeterminados del servicio sin modo consolidado. Esto acota el parámetro a las dos rutas admitidas.
3. En `cargarResumen()`, construir la petición con el filtro actual más `consolidado: true`.
4. En `cargarVista()`, agregarlo **solo a la llamada `saldos()`**. No agregarlo al getter `filtro`, porque ese objeto también se transmite a los cuatro reportes por versión.
5. Conservar asignaciones, estados de carga/error, cancelaciones, búsqueda, CSV y detección de cambios. No sumar versiones en Angular ni sustituir las fuentes de dashboard/árbol.
6. Aclarar en la presentación de «Saldos» que los importes son acumulados y la versión mostrada es la base vigente. El historial actual debe describirse como movimientos de ese detalle/versión; un desglose consolidado exigiría otra consulta y queda fuera de la integración mínima. Mantener diferenciados los reportes por versión de las otras pestañas.
7. Ajustar las pruebas de peticiones del Panel y comprobar que Requerimientos y los reportes individuales continúan sin el nuevo modo.

Solicitudes esperadas **una vez implementado el backend**:

```http
GET /api/control-presupuestario/consultas/resumen?idCentroCosto=10&idPresupuesto=20&consolidado=true
GET /api/control-presupuestario/consultas/saldo?idCentroCosto=10&idPresupuesto=20&consolidado=true
```

No enviar `idPresupuestoVersion`, `estadoPresupuesto`, nivel, rama ni exclusiones en esas solicitudes generales. Las consultas individuales conservarían, por ejemplo, `/consultas/saldo?idPresupuestoVersion=120` sin `consolidado=true`.

El backend menciona `/consultas/vigente` como alternativa para la tabla; el servicio Angular ya tiene `vigente()`. No es necesario cambiar a esa ruta para la propuesta solicitada y tampoco resolvería por sí sola las tarjetas de `/resumen`.

## 7. Confirmación de elementos que pueden permanecer intactos

**Sí: el donut, el filtro de exclusión de partidas, la evolución temporal y el árbol presupuestario pueden conservar su implementación actual para esta corrección.** La evidencia de separación es la siguiente:

- El padre envía centro/presupuesto/nivel/exclusiones al tablero y centro/presupuesto/nivel sincronizado al árbol en [control-presupuestario.html](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.html#L69). No les pasa `totales`, `filas` ni la respuesta de `/resumen`.
- `ConsultasPresupuestarias.dashboard()` construye sus propios parámetros y llama a `/consultas/dashboard`; `arbolVigente()` usa `/consultas/arbol`. Ninguno utiliza `ReporteFiltro` para reutilizar la solicitud del Panel.
- `rubrosDistribucion` lee **`datos.rubrosFiltrados`**. `totalDistribucion` suma su `ejecutado`, y `construirDona()` crea hasta cinco segmentos más «Otros» con proporciones calculadas sobre ese total. La tabla conserva importes originales, incluidos ceros/negativos; si los signos impiden dibujar el donut, mantiene la representación tabular.
- Las exclusiones viajan como enteros repetidos. El tablero normaliza conjuntos y espera 250 ms ante cambios de selección. En una actualización solo de exclusiones y mismo contexto, `cargar(true)` sustituye únicamente `rubrosFiltrados` y reconstruye la dona; conserva `encabezado`, `resumen`, `rubros`, `semanas`, `alCorte`, `desviacionPorRubro` y las líneas.
- `construirLineas()` usa `semanas[].realAcumulado` y `presupuestoAcumulado`; sin cronograma usa `resumen.presupuestado` como referencia horizontal. No depende de las seis tarjetas de `/resumen`.
- En el árbol, `peticion()` selecciona explícitamente vigente o versión. El Panel usa vigente y la gestión de versiones usa versión. El nivel sincronizado cambia las filas visibles sin consultar resumen/saldo.

Esta confirmación es estructural. El hecho de que el backend versionado consolide no acredita el SQL ni los datos desplegados. Una discrepancia dentro del dashboard requiere comprobar sus propias solicitudes/respuestas y el entorno, según el reporte backend.

## 8. Riesgos y pruebas de regresión recomendadas

### 8.1. Riesgos delimitados

- **Corrección parcial del Panel:** los cuatro endpoints de comparativos/gastos seguirán por versión. Si se exige conciliación de todas las pestañas con el árbol, será necesario ampliar el alcance funcional y contractual; no basta el nuevo booleano en dos llamadas.
- **Historial incompleto respecto del acumulado:** el botón de la fila consolidada abre solo el detalle vigente. El árbol vigente ya tiene esta misma limitación de navegación; no modificar su cálculo para hacer coincidir el total con ese historial.
- **Monedas y presupuestos seleccionados:** las tarjetas no muestran símbolo de moneda y «Todos» puede abarcar monedas distintas. Conciliar el mismo centro, presupuesto(s), moneda y presupuestos activos. Confirmar qué error devolverá el modo nuevo ante mezcla; no se ha implementado ni verificado.
- **Ámbitos deliberadamente distintos:** exclusiones solo afectan distribución; una rama limita el dashboard; búsqueda solo afecta tabla/CSV; árbol y tarjetas mantienen su alcance. No forzar igualdad entre vistas con filtros distintos.
- **Porcentaje de saldo:** el contrato no ofrece el campo leído por su barra; no encubrirlo añadiendo una propiedad inventada ni atribuirlo al problema de históricos.
- **Integridad y aprobación concurrente:** partidas históricas relevantes deben existir en la línea base aprobada, incluso con presupuesto cero. Las lecturas separadas pueden observar momentos distintos durante aprobaciones o nuevos movimientos; el análisis frontend no valida esa integridad ni consistencia temporal.
- **Servicio compartido:** no establecer `consolidado=true` como valor predeterminado, ni eliminar filtros explícitos de Requerimientos para hacerlos compatibles.

### 8.2. Casos propuestos para una implementación posterior

| Caso | Resultado esperado |
| --- | --- |
| Peticiones del Panel | Solo resumen y la rama saldos envían `consolidado=true`; preservan centro/presupuesto y omiten versión/estado |
| Servicios sin modo explícito | Se conservan las solicitudes actuales y los filtros por versión, estado, moneda e inactivos; no aparece el parámetro por defecto |
| Una aprobada sin históricos | Importes generales equivalentes a los anteriores |
| Históricas + aprobada, con compromisos y ejecución | Presupuesto solo de la aprobada; movimientos netos de aprobada + históricas; tarjetas, saldo, excesos y árbol concilian con igual alcance |
| Liberaciones y ajustes positivos/negativos entre versiones | Compromiso/ejecución/saldo mantienen los netos y centavos; no se resta ejecución dos veces |
| Detalle vigente con presupuesto cero e histórico no cero | Ejecución y compromiso conservados; saldo negativo y exceso correctos; confirmar la regla de porcentaje del servidor |
| Filtros centro/presupuesto y cambios rápidos | Descartar presupuesto ajeno y respuestas antiguas; mantener estados de carga/error y actualización visual sin Zone.js |
| Todos, varios presupuestos, inactivos y monedas mixtas | Alcance activo coherente; resultado o error de moneda conforme al contrato acordado; no sumar monedas distintas |
| Conflicto de filtros | Backend rechaza modo consolidado + versión o estado explícitos; frontend presenta el error sin mostrarlo como éxito |
| Requerimientos | Continúa enviando `estadoPresupuesto=APROBADO` sin modo consolidado; conserva selección por ID, importes, errores y cancelación por cambio de proyecto |
| Otras cuatro pestañas | No reciben `consolidado`; conservan endpoint, columnas y semántica individual. Verificar y comunicar las diferencias esperadas frente a las tarjetas consolidadas |
| Búsqueda y CSV de saldos | Exportan las mismas filas consolidadas filtradas localmente, con identificadores y valores sin conversiones; revisar claridad del alcance al compartir el CSV |
| Historial y gestión de versiones | Árbol de versión, movimientos y ajustes conservan sus rutas y referencias; el historial individual no se presenta como desglose completo del acumulado |
| Donut y exclusiones de hoja/padre/todas | Solo cambian `rubrosFiltrados`, total y proporciones de distribución; se conservan resumen interno, curva, corte, desviaciones, tarjetas y árbol |
| Nivel, rama, debounce y respuestas obsoletas | Mantener navegación, agrupación, espera de 250 ms y cancelación; rama y exclusión conservan sus diferentes efectos |
| Curva con/sin cronograma y árbol vigente | Mismas fuentes y reglas previas; sin cambios en importes, serie, totales o subtotales por introducir el parámetro en otras llamadas |

Pruebas existentes revisadas como base, **no ejecutadas en este análisis**:

- [consultas-presupuestarias.spec.ts](cobranza-vittoria/src/presupuestos/consultas/consultas-presupuestarias.spec.ts#L21): rutas, filtros por versión/estado, preservación de `false`, exclusiones y separación entre árbol vigente/de versión.
- [control-presupuestario.spec.ts](cobranza-vittoria/src/presupuestos/consultas/control-presupuestario.spec.ts#L41): filtro de centro, cancelación de respuestas anteriores, recarga por contexto y catálogo. Su prueba con plantilla real verifica que las exclusiones solo vuelvan a consultar dashboard, sin recargar resumen/saldo/árbol.
- [tablero-presupuestario.spec.ts](cobranza-vittoria/src/presupuestos/tablero/tablero-presupuestario.spec.ts#L91): total filtrado del donut, «Otros», conservación de datos/curvas al excluir, signos, debounce y cancelación.
- [partidas-requerimiento.spec.ts](cobranza-vittoria/src/requerimientos/partidas-requerimiento.spec.ts#L44): estado aprobado explícito, resolución de centro, cancelación por proyecto, errores y destrucción del propietario.

La regresión futura debe combinar pruebas unitarias/HTTP del frontend con respuestas reales del backend actualizado y comprobación del flujo en navegador. Las pruebas con mocks no demuestran el arrastre SQL entre versiones. Para este entregable documental solo corresponde verificar contenido, referencias y diff; no se afirma validación funcional ni de despliegue.
