# Guía del proyecto para agentes — Frontend

## 1. Resumen del proyecto y alcance

- **Nombre:** Sistema de Gastos Vittoria.
- **Descripción:** Sistema interno para gestionar operaciones relacionadas con obras, compras, inventario, gastos y control presupuestario.
- **Usuarios principales:** Administrador, Residente, Almacén, Coordinador y Comprador.
- **Funcionalidades principales:** Flujo de Requerimientos -> OC -> Compras, inventario y kardex, gastos directos, presupuestos, control presupuestario y control de accesos.
- **Objetivo:** Convertirse en el ERP interno de la empresa.
- **Alcance de este contrato:** Todo este repositorio frontend. Conservar los criterios generales de legibilidad, código limpio y SOLID del sistema, adaptados a Angular y TypeScript.
- **Límite con el backend:** El frontend consume la API. La persistencia, las validaciones definitivas de negocio y la autorización del servidor pertenecen al backend.

## 2. Stack y ubicación del proyecto

- **Aplicación Angular:** `cobranza-vittoria/`. Ejecutar los comandos npm dentro de esa carpeta; el `package.json` de la raíz solo declara una dependencia local.
- **Lenguaje:** TypeScript 5.9 con modo estricto y plantillas Angular estrictas.
- **Framework:** Angular y Angular CLI 21.2, componentes standalone y detección de cambios sin Zone.js mediante `provideZonelessChangeDetection()`.
- **HTTP y asincronía:** `HttpClient` y RxJS 7.8.
- **Formularios actuales:** `FormsModule` y `ngModel`. Mantener el patrón de la funcionalidad que se modifica mientras no se migre; en código nuevo o migrado, elegir según complejidad conforme a la sección 4.
- **Presentación:** HTML y CSS; estilos globales en `src/styles.css` y estilos por componente.
- **Pruebas:** Vitest 4, jsdom y utilidades de Angular TestBed mediante `ng test`.
- **Formato:** Prettier y `.editorconfig` dentro de `cobranza-vittoria/`.

## 3. Arquitectura y responsabilidades

**Arquitectura actual:** en transición: autenticación está en `src/autenticacion`, el dashboard en `src/dashboard`, los cinco catálogos generales en `src/catalogos`, Requerimientos en `src/requerimientos`, Órdenes de compra en `src/ordenes-compra`, Compras en `src/compras`, la sesión en `src/core/sesion` y los ambientes en `src/core/config`. El código pendiente conserva páginas en `src/app/pages`, servicios en `src/app/core/services` y modelos en `src/app/models`. No asumir que ya implementa un monolito modular o todas las capas de arquitectura limpia.

**Futura migración:** arquitectura por funcionalidades directamente en `src/<funcionalidad>/`, sin la carpeta `app/` ni una carpeta contenedora `features/`. La tabla siguiente describe las ubicaciones actuales, que siguen vigentes para el código no migrado; no representa la estructura objetivo.

Todas las rutas de esta sección son relativas a `cobranza-vittoria/src/`:

| Ubicación | Responsabilidad |
| --- | --- |
| `main.ts`, `app/app.config.ts` | Arranque, proveedores globales, router, HTTP e interceptores. |
| `app/app.ts`, `app/app.html`, `app/app.css` | Contenedor principal, navegación y estructura general de la aplicación. |
| `app/app.routes.ts` | Rutas, redirecciones, carga de páginas y reglas de acceso. |
| `app/pages/<funcionalidad>/` | Páginas y componentes específicos de cada funcionalidad. |
| `app/shared/components/` | Componentes reutilizables, como notificaciones, importación y tipo de cambio. |
| `app/core/services/` | Servicios de dominios pendientes e infraestructura reutilizada. `MaestraService` fue sustituido por los servicios públicos de cada concepto en `src/catalogos`. |
| `autenticacion/` | Inicio de sesión, plantilla, estilos y pruebas migrados. |
| `catalogos/<concepto>/` | Especialidades, materiales, proveedores generales, proyectos y unidades de medida; contratos y servicio público propios, con listas y formularios en sus subcarpetas. |
| `dashboard/` | Conceptos en `resumen-compras/`, `grafico-materiales/`, `carga-dashboard/` e `indicadores/`, con sus pruebas colocadas junto al concepto. Contratos compartidos en la raíz del dashboard. |
| `requerimientos/` | Registro HTTP y contratos públicos; listado, detalle, formularios e impresión. Coordinador local con borrador, editor de ítem, operaciones de almacén, flujo, consultas y referencias separados por concepto; consultas presupuestarias propias del editor. |
| `ordenes-compra/` | Registro HTTP y contratos públicos; bandeja y consultas, formulario con proveedores por línea, alta de proveedor, detalle, transiciones y documentos separados por concepto. Compras consume el registro público de órdenes. |
| `compras/` | Registro HTTP y contratos públicos; bandeja, formulario de cierre, editor de importes, detalle/documentos, aceptación y exportación separados por concepto. Dashboard y Presupuesto consumen su registro público. |
| `shared/dialogos/`, `shared/presentacion/` | Diálogo nativo reutilizado por Requerimientos, Órdenes de compra y Compras; presentación del solicitante compartida por Requerimientos y Órdenes de compra. |
| `core/sesion/` | Sesión y contratos públicos, claims, reglas genéricas de acceso, protección de rutas e interceptor HTTP. |
| `core/config/` | Configuración de API por ambiente; consumidores y reemplazos de compilación actualizados. |
| `app/reglas-acceso.ts` | Reglas concretas compartidas por rutas y menú del contenedor pendiente de migración. |
| `app/core/utils/` | Utilidades compartidas de errores y descarga de archivos. |
| `app/models/` | Contratos de petición, respuesta y tipos compartidos. |
| `styles.css` | Variables de diseño y estilos globales reutilizables. |

- Las páginas coordinan interacción, formularios y estado visual; los servicios encapsulan las llamadas HTTP y la adaptación de datos de su dominio.
- Los componentes reutilizables comunican eventos y datos mediante entradas y salidas; evitar acoplarlos a una página concreta.
- Los modelos no deben depender de páginas o componentes. Los servicios de `core` no deben importar desde `pages`. Los dominios pendientes consumen los servicios públicos `CatalogoEspecialidades`, `CatalogoMateriales`, `CatalogoProveedores`, `CatalogoProyectos` y `CatalogoUnidadesMedida` desde sus conceptos en `src/catalogos`; no recrear un servicio global de maestras.
- Reutilizar servicios, modelos y utilidades existentes antes de crear otros. Mantener los componentes propios de una funcionalidad junto a su página.
- Aplicar patrones GoF y principios SOLID cuando resuelvan una necesidad concreta. Evitar capas, repositorios, interfaces o dependencias nuevas sin justificación.
- No reorganizar toda la aplicación ni migrar patrones como parte incidental de una corrección.

### Arquitectura objetivo y convivencia durante la migración

- Agrupar por funcionalidad y, cuando crezca, por subfuncionalidad o concepto. Dominios iniciales: `autenticacion`, `dashboard`, `catalogos`, `requerimientos`, `ordenes-compra`, `compras`, `inventario`, `gastos`, `presupuestos`, `valorizaciones` y `control-accesos`. Por ejemplo, `src/inventario/entradas/` y `src/inventario/salidas/`; presupuesto y control presupuestario se agrupan en `src/presupuestos/` con sus propios conceptos.
- Mantener dentro de `src` todo el código de la aplicación frontend, incluidos servicios, modelos, validaciones y utilidades utilizadas en ejecución. Servicios y modelos de negocio se ubican junto a la funcionalidad que los posee. Sacar de componentes una responsabilidad no implica sacarla de `src`.
- Reservar `src/core/` para infraestructura transversal, como HTTP, sesión, guards, interceptores y configuración de ejecución. Reservar `src/shared/` para conceptos realmente reutilizados, agrupados por propósito. No trasladar los actuales directorios globales de servicios, modelos o componentes en bloque a otra carpeta global equivalente.
- Mantener `main.ts` directamente en `src`. El contenedor principal, las rutas y los proveedores de arranque estarán en `src` al retirar `app/`. Scripts, documentación y configuración de herramientas permanecen fuera de `src`, dentro del proyecto o repositorio según su alcance; crear `scripts/` solo cuando existan scripts que alojar. La configuración importada por la aplicación, como los ambientes, sigue siendo código de ejecución dentro de `src`.
- Colocar juntos TypeScript, plantilla, estilos y pruebas del mismo concepto. No imponer carpetas vacías ni capas `domain/application/infrastructure`, repositorios o fachadas en todas las funcionalidades.
- Prohibir que una funcionalidad importe componentes internos de otra. La colaboración entre funcionalidades utiliza contratos y servicios públicos explícitos; los modelos no dependen de componentes. `core` no depende de funcionalidades y `shared` no depende de funcionalidades concretas. Extraer elementos compartidos cuando exista reutilización real; no crear abstracciones anticipadas.
- Las vistas generales son contenedores/coordinadores. Delegar formularios, detalles y diálogos en componentes propios con responsabilidad concreta. Extraer transformaciones y validaciones independientes de la UI a funciones o servicios; introducir una fachada de estado solo cuando la complejidad lo justifique. No imponer un máximo arbitrario de líneas por archivo.
- Aplicar Boy Scout y Strangler de forma progresiva: mantener operativa la implementación actual mientras se sustituyen funcionalidades o conceptos delimitados. En una corrección ordinaria, conservar el patrón local; en una entrega de migración, aplicar las convenciones objetivo al alcance migrado, actualizar sus consumidores y comprobar el flujo afectado.
- Conservar las ubicaciones actuales hasta migrar también sus consumidores. No duplicar contratos o lógica como implementación permanente ni renombrar masivamente código ajeno a la entrega. Ajustar imports, rutas, referencias de plantillas, selectores, configuración y pruebas cuando un movimiento lo requiera.
- Las convenciones objetivo prevalecen en código nuevo o migrado; las reglas identificadas como actuales siguen describiendo el código pendiente. Los límites de dependencias se aplican por convención desde ahora; su automatización puede incorporarse después.
- Consultar y actualizar el [registro de migración](docs/migracion-frontend.md) en cada entrega. Documentar decisiones y evidencias reales; mover archivos o actualizar este contrato no significa que una funcionalidad haya sido migrada o verificada.

## 4. Convenciones de código

### Nombres y formato

- **Carpetas y archivos:** Usar minúsculas y kebab-case. En código pendiente, conservar nombres como `ordenes-compra/`, `requerimientos.service.ts` e `import-modal.component.ts` hasta migrar el concepto correspondiente.
- **Sufijos actuales:** `.page.ts` para páginas, `.component.ts` para componentes compartidos o secundarios, `.service.ts`, `.models.ts`, `.guard.ts`, `.interceptor.ts` y `.util.ts` según su responsabilidad. Mantener las excepciones existentes del arranque, como `app.ts`, mientras no se migren.
- **Nombrado objetivo:** usar nombres que describan el concepto y coincidan con su identificador TypeScript, sin los sufijos tipológicos actuales. Por ejemplo, `FormularioRequerimiento` en `formulario-requerimiento.ts`, con `formulario-requerimiento.html`, `formulario-requerimiento.css` y `formulario-requerimiento.spec.ts`. Para contratos con varios tipos, usar un nombre temático como `contratos-requerimientos.ts`; evitar `common.ts`, `helpers.ts` o `utils.ts` genéricos. Conservar `.spec.ts` y las convenciones requeridas por las herramientas.
- **Clases, interfaces y tipos:** PascalCase. El frontend usa interfaces sin prefijo `I`, por ejemplo `RequerimientoRequest` y `ImportResumen`; mantener esa convención sin renombrados masivos.
- **Variables, propiedades y métodos:** lowerCamelCase. Constantes de dominio en UPPER_SNAKE_CASE, como `ACCESS_RULES` y `IMPORT_MODULOS_META`.
- **Selectores actuales:** prefijo `app-` y kebab-case, hasta migrar sus componentes y consumidores.
- **Selectores objetivo:** eliminar `app-` sin sustituirlo por otro prefijo global. Es una decisión del proyecto, independiente de retirar `app/`, y difiere de la recomendación de Angular de mantener un prefijo consistente. Usar nombres de elemento descriptivos y únicos en kebab-case con al menos un guion, como `requerimiento-detalle`; no usar nombres de elementos HTML nativos ni el prefijo reservado `ng`. Para directivas de atributo, usar nombres descriptivos en camelCase. Al migrar, actualizar consumidores, estilos, pruebas y la configuración de generación correspondiente.
- **Idioma:** Código, comentarios y textos de interfaz en español; conservar el uso de inglés o spanglish establecido y los nombres exigidos por Angular o la API.
- Respetar dos espacios, comillas simples en TypeScript y la configuración de Prettier (`printWidth: 100`, parser Angular para HTML). Evitar reformatear archivos ajenos al cambio.

### Tipos explícitos y legibilidad

- Priorizar la claridad para humanos por encima de reducir líneas o caracteres.
- Preferir tipos explícitos en contratos, propiedades, parámetros, retornos y resultados asíncronos cuando aclaren su intención. Permitir inferencia local cuando el tipo sea evidente.
- Usar `const` por defecto y `let` solo cuando exista reasignación; no usar `var`.
- No introducir `any` para eludir el compilador. Reutilizar o definir modelos; para datos desconocidos, usar `unknown` y validar antes de acceder a sus propiedades.
- **Objetivo de tipado:** reemplazar los `any` existentes del código propio de producción por contratos estáticos. Reservar `unknown` para datos genuinamente desconocidos y límites que requieran validación. Admitir excepciones inevitables, incluidas las de pruebas, solo con justificación localizada; no reemplazar `any` por aserciones, `$any`, `@ts-ignore` o `@ts-nocheck` que oculten incompatibilidades. La migración no exige tipar código interno de dependencias externas.
- Respetar `strict`, `strictTemplates` y las demás opciones de `tsconfig.json`. No desactivarlas para resolver errores.
- Mantener contratos coherentes, incluidos valores opcionales, `null`, identificadores, estados y formatos de fecha. Evitar aserciones de tipo que oculten incompatibilidades con la API.
- Separar con líneas en blanco las validaciones, obtención de datos, transformación, envío y actualización visual.
- Mantener métodos con una responsabilidad concreta. Escribir comentarios sobre decisiones y motivos, sin repetir lo evidente.

### Componentes, estado y asincronía

- Mantener componentes standalone e importar explícitamente lo que requiere su plantilla.
- **Inyección actual:** respetar el patrón existente en el archivo, ya sea constructor o `inject()`, fuera del alcance de migración. **Objetivo:** preferir `inject()` y dependencias `readonly` en código nuevo o migrado, agrupadas antes de los métodos.
- La aplicación funciona sin Zone.js: garantizar que los cambios asíncronos se reflejen en pantalla. Usar signals, `AsyncPipe` o el mecanismo de `ChangeDetectorRef` correspondiente al patrón local; no agregar Zone.js como solución.
- **Estado actual:** conservar el patrón de la funcionalidad fuera del alcance de migración; no migrar pantallas completas a signals como parte incidental de una corrección ni introducir una biblioteca de estado sin necesidad concreta. **Objetivo:** signals para estado visual nuevo o extraído, `computed` para valores derivados y RxJS para HTTP y composición asíncrona, manteniendo la actualización visual sin Zone.js.
- En componentes nuevos o migrados, preferir `protected` para miembros usados exclusivamente por la plantilla, `readonly` para referencias que no deban reasignarse y `input()`/`output()` para sus contratos cuando correspondan. Conservar los contratos existentes hasta actualizar sus consumidores. Implementar las interfaces de los ciclos de vida utilizados y mantener sus métodos breves, delegando en operaciones con nombres descriptivos.
- **Formularios objetivo:** decidir según complejidad. Mantener `ngModel` para formularios sencillos; preferir formularios reactivos tipados en formularios complejos que se refactoricen. La complejidad depende de validaciones, estructura dinámica y coordinación de campos, no solo del número de controles. No migrar todos los formularios a un único patrón por uniformidad.
- Componer operaciones con RxJS y evitar suscripciones anidadas. Liberar suscripciones que sobrevivan al componente mediante `takeUntilDestroyed`, `AsyncPipe` o el mecanismo existente.
- Restaurar los estados de carga y guardado tanto en éxito como en error; utilizar `finalize` cuando corresponda. Impedir envíos duplicados durante una operación.

## 5. API, validaciones, errores y acceso

### Integración con el backend

- Reutilizar `ApiService` y el servicio del dominio para las llamadas de negocio. La base de la API se obtiene de `environment.apiUrl`; no duplicar URLs en componentes.
- Los ambientes están en `core/config/environment.ts`, `environment.staging.ts` y `environment.production.ts`. `angular.json` configura sus reemplazos al compilar.
- Mantener endpoints, métodos HTTP, parámetros y DTOs acordes al contrato disponible. No inventar campos o respuestas ni convertir una falla en un éxito aparente.
- **Contratos actuales:** tipar peticiones y respuestas en `app/models/` para las funcionalidades pendientes. **Objetivo:** colocarlos junto a su funcionalidad y compartir únicamente los contratos que tengan consumidores reales en varios dominios. Conservar los estados y permisos del backend, incluidos sus valores exactos; separar DTO de API y modelos de formulario cuando sus responsabilidades difieran.
- **Fuente de verdad actual:** contratos del backend confirmados con el desarrollador responsable, mantenidos manualmente y reflejados en modelos frontend. No inferir respuestas definitivas a partir de usos con `any`. **Futura iteración:** adoptar OpenAPI como única fuente de verdad del contrato; la generación y sus herramientas se definirán cuando exista ese estándar. No presentar OpenAPI ni generación de tipos como implementados actualmente.
- Usar `HttpParams` para filtros y las utilidades existentes para descargas. Para importación, reutilizar `ImportService`, `ImportModalComponent` y los metadatos de `import.models.ts`.
- No incluir secretos, contraseñas o claves privadas en código, configuración de ambientes ni archivos públicos; la configuración del frontend es visible en el navegador.

### Validaciones y manejo de errores

- Validar los formularios para dar respuesta inmediata al usuario: campos requeridos, formatos, rangos y coherencia básica. El backend conserva la validación definitiva de negocio.
- Consumir los errores HTTP en la capa que pueda dar una respuesta útil al usuario; los servicios propagan el error salvo que su contrato modele explícitamente un resultado de éxito o error, como en importación.
- Reutilizar `extraerMensajeError`, `esCodigoError` y `obtenerErrores` de `core/utils/api-error.util.ts` para los contratos compatibles. Esta utilidad contempla `errores[]`, errores de modelo en `errors` y mensajes del servidor.
- Mostrar mensajes claros mediante `NotificationService` o los errores de formulario existentes. No silenciar errores ni exponer tokens, datos sensibles o detalles internos en mensajes o registros.
- Las reglas de `ApiMiddlewareException` y DataAnnotations corresponden al backend; el frontend interpreta sus respuestas y presenta los errores.

### Autenticación y permisos

- Reutilizar `SesionUsuario`, `interceptarSesion` y `protegerRuta` de `src/core/sesion/`. Las reglas genéricas de acceso están en `control-acceso.ts`; las reglas concretas del menú y rutas se conservan en `src/app/reglas-acceso.ts` hasta migrar sus conceptos.
- Mantener coherencia entre rutas (`data.access`), menú y acciones visibles usando `canAccess`, `hasPermission` o `hasRole` según la regla existente. El backend conserva la decisión final de autorización.
- No enviar tokens a servicios externos ni duplicar manualmente cabeceras Bearer en los componentes. Preservar la renovación compartida de sesión y el control de reintentos del interceptor.
- No alterar el almacenamiento o el flujo de tokens como parte incidental de otros cambios; cualquier modificación debe considerar login, refresh y logout.

## 6. Interfaz y experiencia de usuario

- Reutilizar las variables CSS y clases globales de `src/styles.css` para conservar colores, tipografía, paneles, tablas y formularios.
- Colocar estilos específicos en el CSS de la página o componente. Evitar reglas globales que afecten pantallas ajenas al cambio.
- Mantener estados de carga, vacío, error y éxito, y conservar filtros y selecciones cuando el flujo lo requiera.
- Usar controles semánticos, etiquetas de formulario, nombres accesibles en botones y navegación por teclado. Cuidar el foco al abrir o cerrar diálogos.
- Revisar que tablas, formularios y modales sigan siendo utilizables en pantallas pequeñas.
- Mantener la moneda, precisión y significado de los importes recibidos. No introducir conversiones de moneda o fecha implícitas que cambien el dato del negocio.
- Durante la migración, conservar apariencia y comportamiento; mejorar accesibilidad y adaptación móvil en los componentes afectados y consolidar estilos o componentes repetidos cuando exista equivalencia comprobada. No incluir un rediseño general como parte incidental del refactor.
- Retirar código obsoleto solo después de confirmar que no tiene consumidores, incluidas rutas con carga dinámica. Registrar la retirada y su verificación; no tratar una página sin acceso directo desde el menú como prueba suficiente de desuso.

## 7. Comandos y verificación de cambios

Desde `cobranza-vittoria/`:

```bash
npm ci
npm start
npm run build
npm run build -- --configuration staging
npm test -- --watch=false
npm run lint
```

- `npm start` sirve el frontend en `http://localhost:4200`; el entorno de desarrollo actual espera la API en `http://localhost:5000`.
- `npm run build` usa producción por defecto. Usar la configuración correspondiente al cambio y respetar los presupuestos de tamaño de `angular.json`.
- **Estado actual:** ESLint configurado para TypeScript y plantillas Angular mediante `npm run lint`; Vitest se conserva. Los conjuntos recomendados y las reglas de accesibilidad reportan advertencias en `src/app/` mientras se migra; fuera de esa carpeta se aplican como errores. No añadir nuevas advertencias al código pendiente; corregir las del concepto migrado al moverlo. Prettier conserva la responsabilidad de formato. No hay framework e2e configurado; las pruebas automatizadas de navegador no forman parte del alcance acordado por ahora.

Como alternativa, desde la raíz del repositorio:

```bash
docker compose up -d app
docker compose exec app npm run build
docker compose --profile test run --rm test
```

- Para cambios de código, ejecutar la compilación y las pruebas pertinentes. Para cambios solo de documentación, revisar contenido, rutas y comandos; no es necesario compilar la aplicación.
- Agregar o ajustar pruebas cuando cambien contratos HTTP, permisos, validaciones o comportamiento relevante. Evitar pruebas que solo repliquen la implementación o cambios visuales triviales.
- Mantener las pruebas junto al archivo probado como `*.spec.ts`, siguiendo los ejemplos existentes de TestBed y `HttpTestingController`; no llamar a la API real desde pruebas unitarias.
- Para cambios de interfaz, comprobar el flujo afectado y la actualización visual sin Zone.js cuando se disponga de navegador. Informar si esa comprobación no pudo realizarse.
- Revisar el diff, preservar cambios previos del usuario y no modificar dependencias, lockfile ni archivos generados salvo que la tarea lo requiera.
- Al terminar, indicar qué cambió, qué verificaciones se ejecutaron y cualquier limitación real. No afirmar que una comprobación pasó si no se ejecutó.

## 8. Criterios de cierre de la migración y referencias

- Todas las funcionalidades acordadas están en la estructura objetivo y sus consumidores actualizados; retirar `src/app/` solo cuando no queden dependencias de esa ubicación.
- Los contratos HTTP, formularios y estados del código migrado están tipados, con las excepciones de `any` justificadas conforme a esta guía. Las vistas coordinan y sus componentes y servicios tienen responsabilidades concretas.
- Pasan compilaciones de producción y staging, pruebas pertinentes y reglas estáticas efectivamente configuradas. Las pruebas cubren contratos HTTP, permisos, validaciones y comportamiento relevante; no se exige una cifra arbitraria de cobertura ni pruebas que solo repliquen la implementación.
- El desarrollador responsable valida los flujos críticos: autenticación y acceso por rol, requerimientos → OC → compras, entradas y salidas de inventario y kardex, gastos, presupuestos y valorizaciones, con importaciones y descargas donde existan. Registrar qué se verificó y qué sigue pendiente.
- El [registro de migración](docs/migracion-frontend.md) refleja el estado real, las verificaciones y las limitaciones de cada entrega. Documentación acordada, configuración pendiente y migración terminada son estados distintos.
- Referencias: [guía de estilo de Angular](https://angular.dev/style-guide), [selectores de Angular](https://angular.dev/guide/components/selectors) y [guía de TypeScript de Google](https://google.github.io/styleguide/tsguide.html). Estas fuentes orientan las convenciones; las decisiones explícitas del proyecto y las instrucciones del usuario prevalecen. No atribuir a las guías decisiones propias, como retirar `app/` o prescindir de un prefijo global de selectores.
