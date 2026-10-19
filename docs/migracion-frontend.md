# Registro de migración del frontend

## Propósito y estado

- **Fecha del acuerdo:** 2026-10-16.
- **Contrato para agentes:** [AGENTS.md](../AGENTS.md).
- **Estado:** preparación técnica y migración de autenticación realizadas el 2026-10-19. Autenticación queda pendiente de validación funcional con backend; las demás funcionalidades continúan pendientes de migración.
- **Alcance:** refactor progresivo del frontend manteniendo comportamiento, contratos, permisos, importes y apariencia, con mejoras locales de accesibilidad y adaptación móvil. No incluye cambios de negocio en backend o base de datos ni pruebas automatizadas de navegador por ahora.

Las rutas de la aplicación de este documento son relativas a `cobranza-vittoria/`, salvo indicación contraria. `AGENTS.md` contiene las reglas; este registro conserva decisiones, avance y evidencias sin sustituir ese contrato.

## Decisiones acordadas

| Tema | Estado actual | Objetivo y transición |
| --- | --- | --- |
| Estructura | `src/app/pages`, servicios y modelos globales | Funcionalidades directamente en `src/<funcionalidad>/`, sin `app/` ni carpeta contenedora `features/`. Agrupar subfuncionalidades por concepto según crezcan. |
| Servicios y modelos | `src/app/core/services` y `src/app/models` | Permanecen dentro de `src`, junto a la funcionalidad que los posee. No trasladarlos fuera de `src` por no ser componentes visuales. |
| Infraestructura y reutilización | `src/app/core` y `src/app/shared/components` | `src/core` para infraestructura transversal y `src/shared` para conceptos reutilizados. Evitar nuevos depósitos globales por tipo de archivo. |
| Código fuera de `src` | Configuración de herramientas en la raíz de la aplicación | Mantener fuera scripts, documentación y configuración de herramientas. La configuración consumida por el frontend permanece en `src`. No crear carpetas vacías. |
| Dependencias | Separación parcial entre páginas, modelos y servicios | Colaboración mediante contratos o servicios públicos explícitos; no importar componentes internos entre funcionalidades. Automatizar los límites en una etapa posterior si procede. |
| Vistas y componentes | Páginas que acumulan responsabilidades | Vistas contenedoras/coordinadoras, componentes propios para formularios, detalles y diálogos, funciones o servicios para lógica independiente de UI. Fachadas solo cuando se justifiquen. |
| Migración | Código existente operativo | Boy Scout y Strangler: sustituir conceptos delimitados y actualizar consumidores, manteniendo el resto operativo. Sin capas obligatorias ni máximo rígido de líneas. |
| Estado | Estado imperativo y actualización mediante mecanismos existentes | Signals para estado visual nuevo o extraído, `computed` para derivados y RxJS para HTTP y composición. Mantener funcionamiento sin Zone.js. |
| Formularios | `FormsModule` y `ngModel` | Elegir por complejidad: `ngModel` para sencillos y formularios reactivos tipados para complejos refactorizados. |
| APIs de Angular | Inyección por constructor y decoradores existentes | Adoptar progresivamente `inject()`, dependencias `readonly`, miembros de plantilla `protected`, `input()`/`output()` e interfaces de ciclos de vida. |
| Nombres | Español, kebab-case y sufijos por tipo | Conservar español y kebab-case; nombres temáticos alineados con identificadores, sin los sufijos tipológicos actuales. Conservar `.spec.ts` y convenciones de herramientas. |
| Selectores | Prefijo `app-` | Eliminarlo sin otro prefijo global; nombres descriptivos, únicos y con guion para elementos. Decisión propia del proyecto, independiente de retirar la carpeta `app/`. |
| Tipado | `any` en servicios y páginas | Tipos estáticos para el código propio, `unknown` para datos desconocidos que se validan y excepciones inevitables justificadas localmente, incluidas pruebas. Sin aserciones o supresiones que oculten incompatibilidades. |
| Contrato de API | Modelos manuales | Contratos confirmados con el desarrollador responsable. OpenAPI será la única fuente de verdad en una futura iteración; no está implementado como parte de este acuerdo. |
| Verificación | Vitest y ESLint para TypeScript y plantillas Angular; sin framework e2e | Mantener verificaciones progresivas: advertencias en `src/app/`, errores fuera de esa carpeta. Comprobar compilaciones de producción y staging, pruebas relevantes y validación funcional humana. |
| Limpieza | Estilos y componentes repetidos y posible código obsoleto | Consolidar equivalencias comprobadas y retirar código solo tras verificar ausencia de consumidores. Conservar apariencia y comportamiento. |

La aclaración posterior al acuerdo inicial mantiene servicios y modelos dentro de `src`. Eliminar `app/` es una elección de organización, no una obligación de Angular. La ausencia de prefijo global en selectores es una elección distinta de la recomendación oficial de usar uno consistente.

## Organización objetivo ilustrativa

```text
cobranza-vittoria/
├─ angular.json
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ main.ts
   ├─ styles.css
   ├─ autenticacion/
   ├─ dashboard/
   ├─ catalogos/
   ├─ requerimientos/
   │  ├─ formulario-requerimiento/
   │  └─ detalle-requerimiento/
   ├─ ordenes-compra/
   ├─ compras/
   ├─ inventario/
   │  ├─ entradas/
   │  ├─ salidas/
   │  ├─ stock/
   │  └─ kardex/
   ├─ gastos/
   ├─ presupuestos/
   ├─ valorizaciones/
   ├─ control-accesos/
   ├─ core/
   └─ shared/
```

El árbol ilustra agrupaciones acordadas, no directorios ya creados ni una obligación de crearlos todos antes de migrar. Los archivos del contenedor principal, rutas y proveedores de arranque también quedarán en `src`. Definir sus nombres concretos al migrarlos, conforme a `AGENTS.md`. Servicios, contratos y pruebas se ubican junto a su concepto; la estructura interna se adapta al tamaño real de cada funcionalidad.

## Seguimiento por funcionalidad

Las ubicaciones actuales indican el punto de partida; no prueban que todos sus archivos sigan activos. Confirmar consumidores antes de mover o retirar código.

| Funcionalidad | Ubicación actual de referencia | Destino | Estado | Evidencias |
| --- | --- | --- | --- | --- |
| Autenticación | `src/autenticacion`, `src/core/sesion` y `src/core/config` | `src/autenticacion`; infraestructura transversal en `src/core` | Pendiente de validación funcional | Código y consumidores migrados; 202 pruebas pasan en total. Login sin Zone.js comprobado en jsdom; validación humana contra backend pendiente |
| Dashboard | `src/app/pages/dashboard` | `src/dashboard` | Pendiente | Sin entrega de migración registrada |
| Catálogos | Páginas de especialidades, materiales, proveedores, proyectos, unidades de medida y catálogos de gasto | `src/catalogos` | Pendiente | Confirmar qué conceptos pertenecen a catálogos y cuáles a un dominio específico al delimitar la entrega |
| Requerimientos | `src/app/pages/requerimientos` | `src/requerimientos` | Pendiente | Sin entrega de migración registrada |
| Órdenes de compra | `src/app/pages/ordenes-compra` | `src/ordenes-compra` | Pendiente | Sin entrega de migración registrada |
| Compras | `src/app/pages/compras` | `src/compras` | Pendiente | Sin entrega de migración registrada |
| Inventario | Páginas `kardex`, `kardex-entradas`, `kardex-salidas` y `stock-actual` | `src/inventario` y sus subfuncionalidades | Pendiente | Sin entrega de migración registrada |
| Gastos | Páginas `gastos-seccion`, `gastos-administrativos`, `gastos-proyecto` y `terreno` | `src/gastos` | Pendiente | Confirmar código activo y posibles implementaciones reemplazadas antes de retirar archivos |
| Presupuestos | Páginas `presupuesto`, `presupuestos`, `control-presupuestario`, `centros-costo` y `partidas` | `src/presupuestos` y sus subfuncionalidades | Pendiente | Sin entrega de migración registrada |
| Valorizaciones | `src/app/pages/valorizaciones` | `src/valorizaciones` | Pendiente | Sin entrega de migración registrada |
| Control de accesos | Páginas `usuarios`, `roles` y `permisos` | `src/control-accesos` | Pendiente | Sin entrega de migración registrada |
| Infraestructura y elementos compartidos | Sesión y ambientes en `src/core`; servicios, modelos, compartidos y contenedor pendientes en `src/app` | Distribuir por propietario; conservar infraestructura en `src/core` y reutilización real en `src/shared` | En curso | Sesión y ambientes migrados con consumidores; notificaciones y utilidades compartidas se reutilizan desde su ubicación actual. Retirar `src/app` al finalizar |

Estados de seguimiento: **Pendiente**, **En curso**, **Pendiente de validación funcional** y **Verificada**. Si existe una limitación o bloqueo, describirlo con su causa y siguiente paso; no marcar como verificada una entrega por haber movido archivos o por haber compilado únicamente.

## Herramientas e iteraciones pendientes

- ESLint incorporado el 2026-10-19 mediante `npm run lint`. Resolver las advertencias de cada concepto durante su migración; la configuración transitoria de `src/app/` se retirará al completar la migración. No añadir nuevas advertencias al código pendiente.
- La automatización de los límites entre funcionalidades puede implementarse después; la convención ya está acordada.
- OpenAPI es una futura iteración del contrato backend. La generación de tipos y sus herramientas se definirán entonces.
- No incorporar pruebas automatizadas de navegador en el alcance actual. Mantener validación funcional humana de los flujos críticos y registrar las comprobaciones que no puedan realizarse.

## Registro de entregas

| Fecha | Entrega | Cambios | Verificaciones y limitaciones |
| --- | --- | --- | --- |
| 2026-10-16 | Acuerdo documental | Actualización de `AGENTS.md` y creación de este registro | Entrega exclusivamente documental; no migra código ni acredita validación funcional. |
| 2026-10-19 | Preparación técnica | Línea base, instalación de ESLint y angular-eslint, configuración progresiva y actualización de comandos | Producción y staging compilan con advertencias previas; 125 pruebas pasan en 13 archivos; lint termina con 0 errores y 2013 advertencias del código pendiente. Sin migración funcional ni comprobación en navegador. |
| 2026-10-19 | Pruebas base de autenticación | Cuatro archivos de pruebas junto al servicio, interceptor, guard y login actuales; sin cambios de producción | 182 pruebas pasan en 17 archivos (57 nuevas); compilación de producción satisfactoria con advertencias previas; ESLint sin errores ni advertencias en los cuatro archivos nuevos. Migración y validación funcional pendientes. |
| 2026-10-19 | Migración de autenticación | Login, sesión, contratos, claims, guard, interceptor y ambientes migrados; consumidores y herramientas actualizados | 202 pruebas pasan en 17 archivos; código migrado sin errores ni advertencias de lint. Producción y staging comprobados según las evidencias de esta entrega. Pendiente de validación funcional con backend. |

En cada entrega futura registrar:

1. Funcionalidad o concepto, alcance y estado; referencia al commit o PR si existe.
2. Archivos movidos o retirados, consumidores actualizados y decisiones adicionales.
3. Contratos y comportamiento preservados, con excepciones de tipado justificadas si existen.
4. Comandos ejecutados y resultados reales; validaciones funcionales, responsable y pendientes.
5. Limitaciones, bloqueos y siguiente paso. Actualizar las ubicaciones actuales de `AGENTS.md` cuando dejen de describir el código real.

## Cierre global

La migración termina cuando todas las funcionalidades acordadas satisfagan los criterios de la sección 8 de `AGENTS.md`: estructura objetivo, responsabilidades separadas, tipado, consumidores actualizados, verificaciones técnicas y validación funcional del desarrollador responsable. No atribuir el cierre a esta entrega documental.

Referencias: [estructura y estilo de Angular](https://angular.dev/style-guide), [selectores](https://angular.dev/guide/components/selectors) y [TypeScript de Google](https://google.github.io/styleguide/tsguide.html).

## Evidencias de preparación técnica — 2026-10-19

- Entorno observado: Node.js 22.23.1 y npm 10.9.8. `package.json` declara npm 11.6.2; no se cambió esa declaración ni se instaló otra versión de npm.
- Línea base previa a cambios: `npm test -- --watch=false` pasó con 125 pruebas en 13 archivos; `npm run build` compiló con un bundle inicial de 897.07 kB.
- `npm run build -- --configuration staging` también compiló, con un bundle inicial de 897.08 kB. Ambos superan el umbral de advertencia de 500 kB, pero respetan el máximo de error de 1 MB. También hay advertencias previas de CSS en `app`, requerimientos, compras, tablero presupuestario, valorizaciones, gastos de proyecto y terreno. No se modificaron los presupuestos.
- Las compilaciones fallaron inicialmente por acceso de red a Google Fonts (`EAI_AGAIN`); al repetir con acceso autorizado terminaron correctamente. La compilación actual descarga fuentes externas y necesita acceso a ellas.
- Instalación mediante `npx ng add angular-eslint@21 --skip-confirmation`, siguiendo la [documentación oficial](https://github.com/angular-eslint/angular-eslint). Dependencias de desarrollo añadidas: angular-eslint 21.4.0, ESLint 10.13.0, @eslint/js 10.0.1 y typescript-eslint 8.59.2, con sus dependencias transitivas y lockfile actualizado. Las dependencias directas de ejecución permanecen iguales.
- `eslint.config.js` aplica los conjuntos recomendados de JavaScript, TypeScript y Angular, además de accesibilidad de plantillas. Analiza TypeScript, HTML y plantillas inline; omite salidas generadas. Prettier sigue gestionando formato. Las reglas de selectores no exigen un prefijo global; la retirada de `app-` se hará con cada componente migrado.
- Transición explícita: las reglas recomendadas reportan advertencias en `src/app/`; fuera de esa carpeta conservan severidad de error. `npm run lint` termina correctamente con **0 errores y 2013 advertencias**, incluidas 777 de `any` y 611 de control de flujo antiguo en plantillas. Este resultado acredita configuración operativa, no ausencia de deuda técnica. No hay comprobación automatizada que impida aumentar las advertencias existentes; revisarlo en cada entrega.
- Se verificó mediante la API de ESLint, con entradas en memoria, que un `any` produce error en `src/autenticacion/` y advertencia en `src/app/`, y que una plantilla nueva con clic sin soporte de teclado ni foco produce dos errores. No se crearon archivos ficticios dentro de la aplicación.
- Después de instalar las herramientas, `npm test -- --watch=false` volvió a pasar: 125 pruebas en 13 archivos.
- Corrección del tipado de la configuración: `comoAdvertencias` construye un acumulador y declara su retorno mediante `Linter.RulesRecord` en JSDoc, evitando que `Object.fromEntries` infiera arreglos genéricos incompatibles con las tuplas de ESLint. Verificación específica satisfactoria: `./node_modules/.bin/tsc --allowJs --checkJs --noEmit --skipLibCheck --module nodenext --target es2022 eslint.config.js`. No se cambiaron reglas ni severidades.
- No se movieron archivos de aplicación ni se modificaron autenticación, contratos HTTP, almacenamiento de tokens o reglas de acceso. Autenticación continúa pendiente. La validación de flujos en navegador y contra backend no forma parte de esta comprobación técnica y sigue pendiente.

## Evidencias de pruebas base de autenticación — 2026-10-19

- Alcance: `auth.service.spec.ts`, `auth.interceptor.spec.ts`, `auth.guard.spec.ts` y `login.page.spec.ts`, junto a sus implementaciones actuales. Se conservan las pruebas previas de claims JWT y reglas de acceso. No se movieron archivos ni se cambiaron implementaciones, contratos, permisos o almacenamiento de tokens.
- Contrato consultado de forma acotada: autenticación y permisos, login, refresh y logout de `docs/ContratoApi.md`. Las pruebas HTTP utilizan `HttpTestingController`; las de navegación, `RouterTestingHarness`; el login utiliza un `Subject<Session>` controlado. Ninguna prueba llama a la API real.
- Servicio: credenciales y payloads, restauración completa o incompleta, claims, persistencia, rotación, rechazo de respuestas incompletas sin reemplazar la sesión anterior, errores de credenciales, expiración con margen, cierre incluso con fallo HTTP y limpieza de claves antiguas sin borrar preferencias ajenas.
- Interceptor: Bearer restringido a la API, exclusión de endpoints públicos, ausencia de sesión, distinción entre 401 y otros errores, renovación compartida entre peticiones concurrentes, renovación preventiva, un solo reintento, conservación de método/cuerpo/parámetros/cabeceras, limpieza al fallar refresh y liberación de la renovación compartida para operaciones posteriores.
- Guard: navegación real de prueba con restauración de sesión, ruta de retorno completa, reglas de rol o permiso, alternativa de `AccessRule` y redirección por acceso denegado. Se conserva el comportamiento actual que permite continuar con JWT vencido y refresh disponible, delegando la renovación al interceptor.
- Login: campos vacíos, usuario recortado y contraseña exacta, bloqueo de duplicados, carga, retorno o dashboard, errores del servidor y mensaje por defecto, posibilidad de reenvío, alternancia de contraseña y envío con Enter. Los controles se prueban en jsdom; no equivale a validación manual en navegador. La comprobación del botón durante la carga usa `detectChanges`; la actualización automática del DOM tras respuestas asíncronas sin Zone.js sigue pendiente para la migración.
- Contratos y dobles de prueba tipados mediante `LoginPayload`, `AuthTokensResponse`, `Session`, `AccessRule`, `Pick` y funciones de Vitest con firmas explícitas, sin introducir `any` ni aserciones que oculten incompatibilidades.
- `npm test -- --watch=false`: **182 pruebas correctas en 17 archivos**, incluidas **57 nuevas**. Compila también las pruebas con la configuración estricta de Angular.
- ESLint de los cuatro archivos nuevos con `--max-warnings=0`: satisfactorio, sin errores ni advertencias. `npm run lint` global: 0 errores y las mismas 2013 advertencias previas. Prettier aplicado y diff revisado con `git diff --check`.
- `npm run build`: satisfactorio al repetir con acceso autorizado a Google Fonts tras el fallo inicial `EAI_AGAIN`; conserva advertencias previas de tamaños. No se repitió staging en esta entrega, que solo añade pruebas y documentación; su resultado previo está registrado en la preparación técnica.
- Siguiente entrega: migrar autenticación y la infraestructura asociada, adaptar estas pruebas a las nuevas ubicaciones y comprobar los flujos críticos con el responsable. Esta entrega deja la funcionalidad en estado **Pendiente** de migración.

## Entrega de autenticación — 2026-10-19

**Estado: Pendiente de validación funcional.** La migración del código está implementada; la validación humana del flujo con backend no se ha realizado. No hay commit ni PR creado en esta entrega.

### Archivos y consumidores

| Concepto anterior | Ubicación actual |
| --- | --- |
| `app/pages/login/login.page.*` | `autenticacion/inicio-sesion.*`, componente `InicioSesion`, selector `inicio-sesion` |
| `app/core/services/auth.service.*` | `core/sesion/sesion-usuario.*`, servicio público `SesionUsuario` |
| `app/core/auth/session.models.ts` y `LoginPayload` antes definido en el servicio | `core/sesion/contratos-sesion.ts` |
| `app/core/auth/jwt-claims.util.*` | `core/sesion/claims-jwt.*` |
| Funciones genéricas de `app/core/auth/access-control.util.*` | `core/sesion/control-acceso.*` |
| Constantes `ACCESS_RULES` | `app/reglas-acceso.ts`, configuración compartida por menú y rutas del contenedor pendiente |
| `app/core/guards/auth.guard.*` | `core/sesion/proteger-ruta.*`, función `protegerRuta` |
| `app/core/interceptors/auth.interceptor.*` | `core/sesion/interceptar-sesion.*`, función `interceptarSesion` |
| `app/core/config/environment*.ts` | `core/config/environment*.ts` |

- Se actualizaron rutas y proveedores de arranque, contenedor, compras, órdenes de compra, requerimientos, gastos, modal de importación y sus pruebas. Los servicios y pruebas que usan ambientes apuntan a `src/core/config`; producción y staging usan los nuevos reemplazos de `angular.json`.
- El login se carga de forma diferida en la misma URL `/login`. El contenedor, sus otras rutas y funcionalidades permanecen en `src/app`.
- El nuevo `core` no importa desde funcionalidades ni desde el código pendiente en `app`. El login reutiliza las APIs públicas de `NotificationService` y `extraerMensajeError` desde sus ubicaciones actuales en `app/core`: esas herramientas transversales conservan sus otros consumidores y se migrarán como conceptos delimitados más adelante. No hay duplicados ni archivos puente de autenticación.
- La búsqueda de consumidores, incluidas rutas dinámicas, no encuentra referencias a las ubicaciones retiradas dentro de la aplicación ni de `angular.json`. Las pruebas se movieron junto a cada concepto. Los registros anteriores conservan los nombres históricos de cada entrega.

### Responsabilidades, tipado y comportamiento

- `InicioSesion` conserva `ngModel` por tratarse de un formulario sencillo; coordina envío y navegación. Usa `inject()`, dependencias `readonly`, miembros de plantilla `protected`, contrato explícito `LoginPayload` y signals para carga y visibilidad de contraseña. `finalize` restaura la carga y `takeUntilDestroyed` libera la suscripción al abandonar la página.
- El formulario es semántico, con `ngSubmit`, etiquetas asociadas, controles de autocompletado, estado `aria-busy` y botón de contraseña con estado accesible. Se conserva la presentación y se ajustan mínimos y espaciado local para pantallas pequeñas. La comprobación física de teclado/Enter y adaptación móvil en navegador sigue pendiente.
- Sesión, restauración, persistencia y llamadas de autenticación siguen agrupadas en `SesionUsuario`; no se añadieron fachadas, repositorios ni dependencias. La renovación compartida pertenece a esa instancia del servicio, eliminando el estado mutable global del interceptor. Conserva una sola petición de refresh concurrente y un solo reintento de la petición original.
- Los DTO y contratos se agrupan con la sesión transversal. Se validan los valores recibidos y los datos sin contrato estático del router y de JSON antes de usarlos; se retiraron las aserciones que asumían un payload JWT o una regla de acceso válidos. Un payload JWT no objeto o claims de roles/permisos ajenos a strings se descartan; una regla de ruta malformada deniega acceso. Las entradas válidas conservan su comportamiento.
- Se conservan endpoints, métodos, nombres de campos, rotación, claves de localStorage y flujo login/refresh/logout. Las reglas de visibilidad mantienen sus valores y su alternativa OR entre roles y permisos; no se convierten en una garantía de autorización del backend. Se conserva la comparación actual de permisos en frontend, sensible a mayúsculas; su diferencia con el backend queda documentada para una entrega específica de coherencia de permisos.
- El login usa la utilidad compartida de errores para mensajes y errores de modelo; si no hay cuerpo útil conserva el mensaje por defecto y evita mostrar la descripción técnica de HttpClient.
- Angular CLI genera sin prefijo global mediante `prefix: ""`. ESLint declara explícitamente `prefix: []`: omitir esa opción hereda el valor `app` de angular-eslint. Los componentes pendientes mantienen sus selectores actuales. No se desactivaron reglas ni se cambió su severidad para el código migrado.

### Verificaciones y pendientes

- `npm test -- --watch=false`: **202 pruebas correctas en 17 archivos**. Las 182 previas continúan cubiertas; la entrega añade o refuerza casos de DOM asíncrono sin Zone.js, destrucción de la vista, errores de modelo, payloads JWT malformados/UTF-8, reglas de ruta inválidas, tipos incorrectos en respuestas y renovación compartida desde el servicio.
- Las pruebas de login interactúan con controles y formulario, usan explícitamente `provideZonelessChangeDetection()` y verifican el DOM tras `whenStable()`, sin llamadas manuales a `detectChanges()`. Esto comprueba la actualización automática al cargar, completar o fallar la respuesta, dentro de jsdom.
- ESLint del alcance migrado (`src/autenticacion`, `src/core` y `src/app/reglas-acceso.ts`) con `--max-warnings=0`: correcto. `npm run lint`: **0 errores y 2005 advertencias** del código pendiente, frente a 2013 en la línea base.
- El chequeo TypeScript de `eslint.config.js`, Prettier de los archivos migrados y `git diff --check` son correctos. No se cambiaron dependencias ni lockfile.
- `npm run build` y `npm run build -- --configuration staging`: ambas correctas, con bundle inicial de 898.01 kB y chunk diferido de login de 6.89 kB. Se conservan la advertencia del umbral inicial de 500 kB y las siete advertencias previas de CSS; no se supera el máximo de error de 1 MB ni se cambiaron presupuestos. El primer intento de producción encontró el bloqueo de Google Fonts (`EAI_AGAIN`); ambas compilaciones definitivas se completaron con acceso autorizado a las fuentes.
- Pendiente del desarrollador responsable: validar login válido e inválido, restauración al recargar, navegación y acciones por rol, expiración/refresh, logout y acceso denegado contra el backend, además de apariencia y teclado en escritorio/móvil. No se ejecutaron pruebas manuales en navegador ni llamadas a la API real. Por eso la funcionalidad no se marca **Verificada**.
