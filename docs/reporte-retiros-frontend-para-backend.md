# Reporte de retiradas del frontend para backend

**Fecha:** 2026-11-03. **Proyecto:** Sistema de Gastos Vittoria. **Estado de la migración:** cerrada globalmente tras la validación funcional del usuario en navegador y backend.

## 1. Resultado para backend

Se identificaron **42 combinaciones método/ruta parametrizada** de adaptadores retirados sin llamadas actuales en este frontend, agrupadas en diez conceptos. Se añaden dos antecedentes de Requerimientos y Partidas anteriores al punto de partida. El [CSV de endpoints](endpoints-retirados-frontend.csv) contiene las 42 filas `R01`–`R42` y los antecedentes `A01`–`A02`, con método, ruta, fuente y referencia Git.

El [inventario completo de archivos](archivos-retirados-frontend.csv) enumera **186 rutas de archivos ausentes**: 184 pertenecían a `src/app`, una al diálogo específico de Requerimientos y una a un documento histórico. Incluye archivos iniciales y otros creados/retirados en entregas intermedias. **No son 186 funcionalidades eliminadas:** muchos archivos fueron trasladados, sustituidos o distribuidos y sus APIs siguen vigentes.

Este reporte acredita ausencia de consumidores en el árbol local revisado. No acredita ausencia de otros clientes, de dependencias internas del servidor ni de versiones desplegadas anteriores. Tampoco afirma que todas las rutas históricas existan hoy en backend: varias eran llamadas legacy sin correspondencia en el contrato local. No se modificó backend ni base de datos. En Valorizaciones, el acuerdo conservó expresamente su API y sus datos.

## 2. Alcance y fuentes

- Punto de partida: commit `49dfb84`, acuerdo documental de migración del 2026-10-16. Se revisaron los retiros posteriores hasta `HEAD e6a5675` y el árbol local que contiene la entrega final de infraestructura aún sin commit.
- Fuentes: [registro de migración](migracion-frontend.md), historial Git, servicios antes de su retirada, [contrato API local](ContratoApi.md) y código actual completo bajo `cobranza-vittoria/src`. Las pruebas no cuentan como consumidores de producción.
- Se revisaron tanto las llamadas HTTP como las URLs de descarga, los metadatos/rutas dinámicas de importación y el router vigente. Se normalizaron los nombres de parámetros de ruta y se distinguieron rutas exactas de sus subrutas.
- `Documentado` significa que se encontró la combinación método/ruta en `ContratoApi.md`; `No localizado` no demuestra que no exista un controlador. No se inspeccionó el backend actual ni se hicieron peticiones de red para este reporte.
- Los `{parámetros}` representan segmentos variables. Los query strings, como `fecha`, filtros o `usuario`, no crean un endpoint distinto. Los nombres de parámetros del contrato pueden diferir de los empleados por el antiguo cliente.

## 3. Endpoints sin consumidor tras retirar sus adaptadores

| Concepto | Combinaciones método/ruta | Efecto principal |
| --- | ---: | --- |
| Valorizaciones | 11 | Adaptador retirado; detalle y alcance debajo |
| Subcotizaciones de materiales por proyecto | 3 | Adaptador retirado; detalle y alcance debajo |
| Presupuesto bancario | 2 | Adaptador retirado; detalle y alcance debajo |
| Gastos administrativos antiguos | 8 | Adaptador retirado; detalle y alcance debajo |
| Gastos por proyecto antiguos | 8 | Adaptador retirado; detalle y alcance debajo |
| Órdenes de compra legacy | 2 | Adaptador retirado; detalle y alcance debajo |
| Cotizaciones legacy de requerimientos | 2 | Adaptador retirado; detalle y alcance debajo |
| Kardex agregado antiguo | 2 | Adaptador retirado; detalle y alcance debajo |
| Catálogos alternativos antiguos | 3 | Adaptador retirado; detalle y alcance debajo |
| Tipo de cambio | 1 | Adaptador retirado; detalle y alcance debajo |

### 3.1. Valorizaciones

Retirados la ruta /valorizaciones, página, servicio, modelos, configuración/reglas, detalle y adjuntos de su UI. Dashboard conserva Compras y pierde los indicadores Valorizado facturado, Valorizado transferido, Garantías retenidas y Detracciones. No queda otro consumidor frontend de esta familia. El acuerdo de retirada conservó expresamente API y datos del backend.

Fuente histórica: `git show be3285d^:cobranza-vittoria/src/app/core/services/valorizaciones.service.ts`.

| Método | Ruta | Contrato local |
| --- | --- | --- |
| GET | `/api/contable/valorizaciones/configuraciones` | Documentado |
| POST | `/api/contable/valorizaciones/configuraciones` | Documentado |
| POST | `/api/contable/valorizaciones/reglas-proveedor` | Documentado |
| GET | `/api/contable/valorizaciones` | Documentado |
| GET | `/api/contable/valorizaciones/{id}` | Documentado |
| GET | `/api/contable/valorizaciones/configuracion/{idConfiguracion}` | Documentado |
| POST | `/api/contable/valorizaciones` | Documentado |
| POST | `/api/contable/valorizaciones/detalle` | Documentado |
| DELETE | `/api/contable/valorizaciones/detalle/{idDetalle}` | Documentado |
| POST | `/api/contable/valorizaciones/detalle/{idDetalle}/archivos` | Documentado |
| GET | `/api/contable/valorizaciones/detalle/{idDetalle}/archivos/{idArchivo}/download` | Documentado |

### 3.2. Subcotizaciones de materiales por proyecto

Se retiraron de Proyectos la tabla, edición, carga, resumen y guardado de subcotizaciones por especialidad, junto con CotizacionMaterialesService. Los endpoints no figuraban en el contrato consultado. Proyectos sigue activo y conserva cotizacionGeneral; no se retira ese campo ni /api/maestra/proyectos.

Fuente histórica: `git show 75292a6^:cobranza-vittoria/src/app/core/services/cotizacion-materiales.service.ts`.

| Método | Ruta | Contrato local |
| --- | --- | --- |
| GET | `/api/contable/cotizacion-materiales/{idProyecto}` | No localizado |
| GET | `/api/contable/cotizacion-materiales/resumen/{idProyecto}` | No localizado |
| POST | `/api/contable/cotizacion-materiales` | No localizado |

### 3.3. Presupuesto bancario

Se retiraron /presupuesto, PresupuestoPage, PresupuestoService, su enlace y TipoCambioComponent. Esta pantalla es distinta del módulo vigente /control-presupuestario/presupuestos, que sigue usando /api/control-presupuestario y sus versiones, partidas y movimientos.

Fuente histórica: `git show 5b0b756^:cobranza-vittoria/src/app/core/services/presupuesto.service.ts`.

| Método | Ruta | Contrato local |
| --- | --- | --- |
| GET | `/api/contable/presupuesto/{idProyecto}` | No localizado |
| POST | `/api/contable/presupuesto` | No localizado |

### 3.4. Gastos administrativos antiguos

Se retiró la implementación GastosAdministrativosPage sin consumidores y las operaciones contables de GastosAdministrativosService. La URL frontend /gastos-administrativos sigue activa con GastosSeccion y RegistroGastosDirectos; ya no utiliza esta familia contable. Los endpoints de categorías y proveedores que estaban en el mismo servicio continúan en los catálogos propios de Gastos.

Fuente histórica: `git show 343ea67^:cobranza-vittoria/src/app/core/services/gastos-administrativos.service.ts`.

| Método | Ruta | Contrato local |
| --- | --- | --- |
| GET | `/api/contable/gastos-administrativos` | No localizado |
| GET | `/api/contable/gastos-administrativos/{id}` | No localizado |
| POST | `/api/contable/gastos-administrativos` | No localizado |
| PUT | `/api/contable/gastos-administrativos/{id}` | No localizado |
| DELETE | `/api/contable/gastos-administrativos/{id}` | No localizado |
| GET | `/api/contable/gastos-administrativos/{id}/documentos` | No localizado |
| POST | `/api/contable/gastos-administrativos/{id}/documentos` | No localizado |
| GET | `/api/contable/gastos-administrativos/{id}/documentos/{docId}/download` | No localizado |

### 3.5. Gastos por proyecto antiguos

Se retiraron GastosProyectoPage, TerrenoPage y GastoProyectoService. {tipoModulo} admitía terreno, marketing-publicidad, otros-gastos y gastos-municipales-distritales. Las cuatro URLs frontend se conservan con Gastos Directos: retirarlas de esta tabla no significa retirar esas secciones de la aplicación. No se documenta una equivalencia de IDs o una migración de datos entre los modelos antiguos y los actuales.

Fuente histórica: `git show 343ea67^:cobranza-vittoria/src/app/core/services/gasto-proyecto.service.ts`.

| Método | Ruta | Contrato local |
| --- | --- | --- |
| GET | `/api/contable/gastos-proyecto/{tipoModulo}` | No localizado |
| GET | `/api/contable/gastos-proyecto/{tipoModulo}/{id}` | No localizado |
| POST | `/api/contable/gastos-proyecto/{tipoModulo}` | No localizado |
| PUT | `/api/contable/gastos-proyecto/{tipoModulo}/{id}` | No localizado |
| DELETE | `/api/contable/gastos-proyecto/{tipoModulo}/{id}` | No localizado |
| GET | `/api/contable/gastos-proyecto/{tipoModulo}/{id}/documentos` | No localizado |
| POST | `/api/contable/gastos-proyecto/{tipoModulo}/{id}/documentos` | No localizado |
| GET | `/api/contable/gastos-proyecto/{tipoModulo}/{id}/documentos/{docId}/download` | No localizado |

### 3.6. Órdenes de compra legacy

OrdenesCompraService y sus modelos no tenían consumidores. Las órdenes vigentes utilizan RegistroOrdenesCompra bajo /api/compras/ordenes-compra; la ruta sin /compras y su operación /generar ya no se consumen. No se declara que generar y crear sean contratos intercambiables.

Fuente histórica: `git show 67e1d55^:cobranza-vittoria/src/app/core/services/ordenes-compra.service.ts`.

| Método | Ruta | Contrato local |
| --- | --- | --- |
| POST | `/api/ordenes-compra/generar` | No localizado |
| GET | `/api/ordenes-compra/{idOrdenCompra}` | No localizado |

### 3.7. Cotizaciones legacy de requerimientos

Se retiraron CotizacionesService, CotizacionCreate y CotizacionGetResponse al no tener consumidores. Ninguna pantalla actual llama a estas dos rutas. Requerimientos, sus ítems y su flujo siguen bajo /api/compras/requerimientos; no se ha implementado un reemplazo de estas cotizaciones.

Fuente histórica: `git show e6a5675:cobranza-vittoria/src/app/core/services/cotizaciones.service.ts`.

| Método | Ruta | Contrato local |
| --- | --- | --- |
| POST | `/api/requerimientos/{idRequerimiento}/cotizaciones` | No localizado |
| GET | `/api/cotizaciones/{idCotizacion}` | No localizado |

### 3.8. Kardex agregado antiguo

Se retiró AlmacenService sin consumidores. La ausencia se refiere exactamente a GET /api/almacen/kardex y GET /api/almacen/kardex/resumen. Entradas, salidas, stock, movimientos y salidas-manuales bajo el mismo prefijo siguen activos; no corresponde retirar la familia completa /api/almacen/kardex.

Fuente histórica: `git show 3fcc02c^:cobranza-vittoria/src/app/core/services/almacen.service.ts`.

| Método | Ruta | Contrato local |
| --- | --- | --- |
| GET | `/api/almacen/kardex` | No localizado |
| GET | `/api/almacen/kardex/resumen` | No localizado |

### 3.9. Catálogos alternativos antiguos

Se retiraron CatalogosService y catalogos.models.ts sin consumidores. Los maestros vigentes están bajo /api/maestra; Gastos Directos mantiene además su propio endpoint /api/contable/gastos-directos/proveedores. No se ha unificado la identidad de proveedores ni se deben mezclar IDs entre esos contratos.

Fuente histórica: `git show e6a5675:cobranza-vittoria/src/app/core/services/catalogos.service.ts`.

| Método | Ruta | Contrato local |
| --- | --- | --- |
| GET | `/api/catalogos/categorias` | No localizado |
| GET | `/api/catalogos/proveedores` | No localizado |
| GET | `/api/catalogos/materiales` | No localizado |

### 3.10. Tipo de cambio

SunatService solo consultaba el tipo de cambio: se retiró su último adaptador y tipo-cambio.models.ts. El código actual no llama a GET /api/tipo-cambio, incluido su filtro opcional fecha. La consulta RUC de proveedores sigue activa en /api/maestra/proveedores/consulta-ruc/{ruc}; retirar SunatService no equivale a retirar esa integración.

Fuente histórica: `git show e6a5675:cobranza-vittoria/src/app/core/services/sunat.service.ts`.

| Método | Ruta | Contrato local |
| --- | --- | --- |
| GET | `/api/tipo-cambio` | Documentado |

Los ocho patrones de Gastos por proyecto contienen `{tipoModulo}`. El adaptador admitía cuatro valores; la cifra 42 cuenta patrones parametrizados, no expande esos cuatro valores ni afirma que todos existan como acciones del servidor.

## 4. Código eliminado cuyo backend sigue teniendo cliente

Las rutas de destino de esta sección son relativas a `cobranza-vittoria/src`. Estas retiradas no justifican dar de baja sus endpoints.

| Servicio anterior retirado | Sustituto vigente | API que se conserva |
| --- | --- | --- |
| `ApiService` | `core/http/api-http.ts`, `ApiHttp` | Base de API y transporte HTTP; no tenía endpoints de negocio propios |
| `AuthService`, guard, interceptor y utilidades de claims/acceso | `core/sesion/`, `SesionUsuario`, `protegerRuta`, `interceptarSesion` | POST `/api/seguridad/auth/login`, `/refresh` y `/logout`; sesión, claims y reintentos compartidos |
| `MaestraService` y `maestra.models.ts` | `catalogos/<concepto>/` | Maestros de especialidades, materiales, proveedores, proyectos y unidades de medida bajo `/api/maestra`; detalle, siguiente código, consulta RUC y asignación de especialidades donde correspondan |
| Métodos duplicados de requerimientos y OC de `ComprasService` | `RegistroRequerimientos` y `RegistroOrdenesCompra` | `/api/compras/requerimientos` y `/api/compras/ordenes-compra`, con sus operaciones e ítems/estados |
| `ComprasService` y `compras.models.ts` | `compras/registro-compras.ts` y contratos propios | `/api/compras/compras`, pendientes desde OC, aceptación, documentos y descarga |
| `RequerimientosService` y modelos | `requerimientos/registro-requerimientos.ts` | `/api/compras/requerimientos`, ítems y transiciones de flujo |
| `KardexInventarioService` y modelos | `inventario/registro-inventario.ts` | `/api/almacen/kardex/entradas`, `/salidas`, `/stock-actual` y `/stock-actual/exportar-excel`; hoy también existe `/stock-proyecto` |
| `KardexService` y `almacen.models.ts` | `inventario/kardex-compras/registro-kardex-compras.ts` y registro de Inventario | GET `/api/almacen/kardex/movimientos` y POST `/api/almacen/kardex/salidas-manuales`; CRUD vigente de entradas/salidas en Inventario |
| `GastosDirectosService` | `gastos/registro-gastos-directos.ts` | `/api/contable/gastos-directos`: catálogos del agregado, listado/detalle, alta/edición, confirmar/anular y documentos |
| Parte maestra de `GastosAdministrativosService` | `gastos/categorias/` y `gastos/proveedores-gasto/` | GET/POST/PUT/DELETE de `/api/maestra/categorias-gasto` y `/api/maestra/proveedores-gasto` |
| `ProveedoresTerrenoService` | `gastos/proveedores-terreno/registro-proveedores-terreno.ts` | GET/POST/PUT/DELETE de `/api/maestra/proveedores-terreno` |
| `ControlPresupuestarioService` y modelos agregados | Registros, catálogos y consultas de `presupuestos/` | `/api/control-presupuestario`: catálogos, centros, partidas, presupuestos, versiones, montos, movimientos, ajustes y consultas |
| `SeguridadService`, modelos de usuarios/roles/permisos y `PermisoCardComponent` | `control-accesos/{usuarios,roles,permisos}` y `TarjetaPermiso` | `/api/seguridad/usuarios`, `/roles`, `/permisos`, asignaciones/retiradas de permisos y PATCH `/enable`/`/disable` |
| `ImportService`, `ImportModalComponent` e `import.models.ts` | `shared/importacion/`, `RegistroImportacion`, `ModalImportacion` | POST `/api/import/{modulo}`, GET `/api/import/{modulo}/plantilla` y endpoints propios de Gastos Directos, Partidas y Centros de costo |
| `NotificationService` y `NotificationComponent` | `shared/notificaciones/`, `Notificaciones`, `AvisoNotificacion` | Sin endpoint propio |

Fuentes actuales para contrastar: [Requerimientos](../cobranza-vittoria/src/requerimientos/registro-requerimientos.ts), [OC](../cobranza-vittoria/src/ordenes-compra/registro-ordenes-compra.ts), [Compras](../cobranza-vittoria/src/compras/registro-compras.ts), [Inventario](../cobranza-vittoria/src/inventario/registro-inventario.ts), [Kardex de Compras](../cobranza-vittoria/src/inventario/kardex-compras/registro-kardex-compras.ts), [Gastos](../cobranza-vittoria/src/gastos/registro-gastos-directos.ts), [Presupuestos](../cobranza-vittoria/src/presupuestos/registro-presupuestos.ts), [proveedores/RUC](../cobranza-vittoria/src/catalogos/proveedores/catalogo-proveedores.ts) y [metadatos de importación](../cobranza-vittoria/src/shared/importacion/metadatos-importacion.ts).

### 4.1. Importaciones que siguen activas

`{modulo}` se utiliza con `unidad-medida`, `especialidad`, `material`, `proveedor`, `proveedor-gasto`, `proveedor-terreno` y `categoria-gasto` en la ruta genérica. `partida` y `centro-costo` usan `/api/control-presupuestario/{partidas|centros-costo}/{importar|plantilla}`; `gastos-directos` usa `/api/contable/gastos-directos/{importar|plantilla}`. La importación de montos/estructura de versiones presupuestarias conserva además sus rutas propias bajo `/api/control-presupuestario/presupuestos/{id}/versiones/{versionId}/partidas/...`.

### 4.2. Pantallas y navegación

| Retirada o sustitución | Situación vigente e impacto en backend |
| --- | --- |
| `/valorizaciones` | Pantalla y acceso retirados; también sus consumidores en Dashboard. Las 11 rutas API están en 3.1 |
| `/presupuesto` | Pantalla bancaria retirada; no confundir con Presupuestos y Control presupuestario vigentes |
| Subcotizaciones dentro de Proyectos | Solo se retiró esa funcionalidad secundaria. Proyectos y su `cotizacionGeneral` siguen activos |
| `GastosAdministrativosPage`, `GastosProyectoPage` y `TerrenoPage` | Implementaciones anteriores sin consumidores retiradas. Las cinco secciones públicas de Gastos permanecen con `GastosSeccion` y Gastos Directos |
| Grupo del menú «Mantenimiento» | Se redistribuyeron sus accesos entre Gestión de obra, Inventario y Gastos. Los catálogos y sus endpoints siguen activos |
| Páginas antiguas de login, Dashboard, catálogos, Requerimientos, OC, Compras, Inventario, Gastos, Presupuestos y Control de accesos | Sustituidas por conceptos en `src/<funcionalidad>`. No son bajas funcionales de esos módulos |
| Carpeta `src/app`, contenedor, rutas y configuración | Retirados de esa ubicación; contenedor/arranque en la raíz de `src`, infraestructura en `core` y reutilización en `shared` |
| Diálogos específicos y componente de tarjeta de permiso | Sustituidos por `DialogoModal` y `TarjetaPermiso`; sin retirada de API propia |

El router actual es [rutas.ts](../cobranza-vittoria/src/rutas.ts). Las rutas `/gastos-administrativos`, `/terreno`, `/marketing-publicidad`, `/otros-gastos` y `/gastos-municipales-distritales` siguen activas; se conserva también el alias `/control-presupuestario/gastos-directos`. Dashboard continúa operativo en `/dashboard`.

## 5. Contratos, campos y lógica retirados sin dar de baja un endpoint

- Se retiraron `valorizaciones.models.ts`, `catalogos.models.ts`, `cotizaciones.models.ts`, `tipo-cambio.models.ts` y `common.models.ts` (`ApiOkResponse`) al desaparecer sus consumidores. Los modelos globales de dominios que siguen activos se distribuyeron en contratos propios, según el inventario CSV; su ausencia en `app/models` no demuestra que sus DTOs de servidor puedan eliminarse.
- Se retiraron los contratos legacy `OrdenCompraGenerar`, `OrdenCompraGenerarResponse` y `OrdenCompraGetResponse` junto a `OrdenesCompraService`; las órdenes vigentes poseen otro contrato bajo `/api/compras/ordenes-compra`.
- Se retiró del alta de Compras el `idProveedor` de cabecera que no pertenecía a `CompraCreateDto`. Proveedor por línea, `Proveedores`/`Especialidades` del listado y los campos documentados se conservan. No se retira el endpoint de Compras.
- Se retiraron lecturas alternativas PascalCase/camelCase no respaldadas por el contrato en OC/Compras. OC usa `proveedores` en cabecera y `proveedor` por línea; las respuestas SQL de Compras mantienen sus nombres documentados. En Control de accesos se conserva la compatibilidad histórica validada en el borde HTTP.
- `KardexService.registrarSalida` tenía un DTO antiguo con cantidad/compra/material. Esa implementación no se conserva como contrato alternativo: la salida ligada a Compras utiliza `/salidas-manuales`; Inventario conserva POST `/salidas` con su DTO actual. No se elimina el endpoint compartido por retirar un DTO legacy.
- Se retiraron la impresión del listado completo de OC sin consumidores, las lecturas de proyectos/usuarios cuyos resultados no se utilizaban, estilos obsoletos, aserciones de datos no validados y la rebaja transitoria de reglas de ESLint. No tienen una operación backend exclusiva que retirar. La impresión/CSV de compras y OC continúa generándose en frontend donde corresponde.
- Se retiraron las suscripciones e indicadores de Valorizaciones del Dashboard; no se retiró la consulta de Compras. Se retiró el indicador de tipo de cambio de la pantalla bancaria; la consulta RUC sigue activa.
- El nombre de Excel de stock pasó a su propietario en Inventario; la mecánica de descarga/`Content-Disposition`, presentación de errores y notificaciones solo cambiaron de ubicación. Sus endpoints de descarga permanecen.
- No se unificaron proveedores generales, de gasto y de terreno; no se eliminaron sus mantenimientos ni sus identificadores. Tampoco se resolvieron por esta limpieza las discrepancias documentales de contraseña/roles del usuario expresamente aplazadas.

## 6. Antecedentes anteriores al punto de partida

Se incluyen para que backend no los confunda con consumidores todavía vigentes. No se cuentan entre los 42 endpoints de la migración.

| Antecedente | Evidencia | Resultado actual |
| --- | --- | --- |
| Método `actualizarCantidadesAlmacen` y `RequerimientoCantidadAlmacenRequest` | Commit `2d22212` del 2026-10-16, anterior a `49dfb84` | PATCH `/api/compras/requerimientos/{id}/cantidades-almacen` no tiene consumidor actual identificado. El flujo vigente utiliza ítems y validación de almacén; no se declara equivalencia de DTOs |
| Pantalla Resumen Total, `/resumen-total` y sus exportaciones | Commit `9e5258a` del 2026-10-07 | Página retirada antes de la migración. Consumía servicios compartidos; su eliminación por sí sola no retira las APIs de Compras, Proyectos, Gastos Directos o Control presupuestario. Valorizaciones y subcotizaciones se retiraron después por separado |
| Consulta de secciones de gasto, campo/filtro `idSeccionGasto`, nombre de sección y columna `Seccion` de importación de partidas | Cambio incluido en `9e5258a`, prueba conservada en `shared/importacion/metadatos-importacion.spec.ts` | GET `/api/control-presupuestario/catalogos/secciones-gasto` no tiene consumidor actual identificado. Las columnas opcionales vigentes son `CodigoPadre` y `Descripcion`; los endpoints de Partidas y su importación siguen activos |

## 7. Trazabilidad de las retiradas

| Referencia | Evidencia relevante |
| --- | --- |
| `49dfb84` | Punto de partida del acuerdo y organización anterior |
| `75292a6` | Catálogos migrados; retirada de `CotizacionMaterialesService` y de subcotizaciones |
| `67e1d55` | OC migrada; retirada de `OrdenesCompraService` legacy |
| `e372d61` | Compras migrada y contratos simplificados/duplicados retirados |
| `82868c7` | Inventario migrado; `KardexService` y `KardexInventarioService` sustituidos |
| `343ea67` | Gastos migrado; implementaciones administrativas/proyecto/terreno anteriores retiradas |
| `5b0b756` | Presupuestos migrado; pantalla bancaria e indicador de tipo de cambio retirados |
| `53768f2` | Control de accesos migrado; `SeguridadService` y tarjeta anterior sustituidos |
| `be3285d` | Pantalla, servicio y modelos de Valorizaciones retirados, más consumidores del Dashboard |
| `3fcc02c` | `AlmacenService` huérfano retirado |
| Árbol local de cierre del 2026-11-03 | `CatalogosService`, `CotizacionesService`, `SunatService` y modelos exclusivos retirados; `src/app` eliminada y consumidores migrados |

Para recuperar una fuente eliminada se puede usar `git show <commit-de-retirada>^:<ruta-anterior>`. Las referencias exactas están en los CSV. Las rutas de archivos se consignan relativas a la raíz del repositorio frontend.

## 8. Verificación realizada para este reporte

- Revisión del historial de retiradas sin detección de renombrados, contraste con los archivos del árbol local y clasificación de los 186 paths ausentes. El CSV registra si un archivo existía en `49dfb84` o fue introducido en una entrega intermedia.
- Lectura de los diez servicios retirados que declaran los 42 endpoints, además del método antecedente de Requerimientos y la consulta auxiliar retirada de Partidas. Contraste de método/ruta con el contrato local, sin dar por existente un endpoint que solo aparecía en código antiguo.
- Extracción estática de expresiones de URLs actuales, resolución de bases/plantillas habituales y normalización de parámetros para comparar las rutas exactas. Se revisaron aparte router, URLs de descarga y metadatos dinámicos de importación. No se usa una búsqueda de prefijos para declarar retirada toda una familia activa.
- Revisión de enlaces locales, CSV, conteos, ausencia de las rutas de archivos inventariadas y `git diff --check`. Entrega exclusivamente documental: no se repitieron pruebas, compilaciones ni validación funcional, y no se enviaron mensajes al equipo backend.
