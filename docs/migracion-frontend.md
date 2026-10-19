# Registro de migración del frontend

## Propósito y estado

- **Fecha del acuerdo:** 2026-10-16.
- **Contrato para agentes:** [AGENTS.md](../AGENTS.md).
- **Estado:** preparación técnica y migración de autenticación realizadas el 2026-10-19. Autenticación verificada funcionalmente con backend por el usuario. Dashboard y los cinco catálogos generales migrados y validados funcionalmente y en navegador por el usuario; las demás funcionalidades continúan pendientes de migración.
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
| Autenticación | `src/autenticacion`, `src/core/sesion` y `src/core/config` | `src/autenticacion`; infraestructura transversal en `src/core` | Verificada | Código y consumidores migrados; 202 pruebas pasan en total. Login sin Zone.js comprobado en jsdom; el usuario confirmó el flujo completo con backend el 2026-10-19 |
| Dashboard | `src/dashboard`, agrupado por concepto | `src/dashboard` | Verificada | El usuario confirmó validación con backend y revisión en navegador. Vista, gráficos, carga e indicadores agrupados en subdirectorios; retirada futura prevista, sin fecha definida |
| Catálogos | `src/catalogos/{especialidades,materiales,proveedores,proyectos,unidades-medida}` | `src/catalogos`, por concepto | Verificada | Cinco catálogos generales migrados, servicios y consumidores actualizados. Validación funcional y en navegador confirmada por el usuario el 2026-10-19. Categorías y proveedores específicos de gasto/terreno se reservan para Gastos. Proveedor único y sus filtros dependen de la transición del backend |
| Requerimientos | `src/app/pages/requerimientos` | `src/requerimientos` | Pendiente | Sin entrega de migración registrada |
| Órdenes de compra | `src/app/pages/ordenes-compra` | `src/ordenes-compra` | Pendiente | Sin entrega de migración registrada |
| Compras | `src/app/pages/compras` | `src/compras` | Pendiente | Sin entrega de migración registrada |
| Inventario | Páginas `kardex`, `kardex-entradas`, `kardex-salidas` y `stock-actual` | `src/inventario` y sus subfuncionalidades | Pendiente | Sin entrega de migración registrada |
| Gastos | Páginas `gastos-seccion`, `gastos-administrativos`, `gastos-proyecto`, `terreno`, `categorias-gasto`, `proveedores-gasto` y `proveedores-terreno` | `src/gastos` | Pendiente | Los tres registros específicos de gastos pertenecen a esta entrega futura; conservar contratos hasta confirmar la unificación de proveedores. Confirmar código activo antes de retirar implementaciones |
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
| 2026-10-19 | Validación funcional de autenticación | Estado actualizado a Verificada | El usuario confirmó haber comprobado el flujo completo con backend y que todo está correcto. No se modificó código ni se repitieron verificaciones técnicas en esta actualización documental. |
| 2026-10-19 | Migración de dashboard | Pruebas de caracterización, tipado de tres consultas públicas, separación de cálculos/carga/gráficos, nueva ubicación y ruta diferida | Verificaciones técnicas y limitaciones en las evidencias de esta entrega. Pendiente de validación funcional; intención de retirada futura documentada. |
| 2026-10-19 | Validación y organización por conceptos de dashboard | Validación funcional registrada y archivos agrupados con sus pruebas | El usuario confirmó backend y navegador correctos. Reorganización de rutas de archivos sin cambios de lógica; verificaciones técnicas registradas al cierre. |
| 2026-10-19 | Migración de catálogos generales | Cinco conceptos con servicios y contratos propios, listas/formularios separados y navegación contextual. Subcotizaciones de Proyectos retiradas por indicación del usuario | Verificaciones técnicas y pendientes en las evidencias de la entrega. Los catálogos siguen vigentes; los registros específicos de gastos y la unificación de proveedores quedan delimitados para sus próximas entregas. |
| 2026-10-19 | Validación de catálogos generales | El usuario confirmó «Validación funcional y navegador OK» | Catálogos pasa a Verificada. La confirmación cierra la validación humana pendiente de esta entrega; los alcances futuros de Gastos y proveedor único se conservan. |

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

**Estado: Verificada.** El usuario confirmó el 2026-10-19 que comprobó el flujo completo con backend y que todo funciona correctamente. Esta confirmación completa la validación funcional pendiente de la entrega. No hay commit ni PR creado por el agente en esta entrega.

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
- Validación funcional posterior, 2026-10-19: el usuario informó que comprobó el flujo completo con backend y que todo está correcto. Se marca autenticación **Verificada** con esa evidencia. No se aportó un desglose por navegador, dispositivo o escenario; el agente no realizó llamadas a la API real ni pruebas manuales adicionales.

## Entrega de dashboard — 2026-10-19

**Estado: Verificada.** Se realizaron las cinco fases en una entrega: caracterización, tipado, separación de responsabilidades, migración y registro. Posteriormente, el usuario confirmó validación con backend y revisión en navegador correctas para el dashboard.

### Alcance y decisión del desarrollador responsable

- El desarrollador responsable considera estas pantallas poco útiles y prevé que desaparecerán. Se registra la intención de retirada futura, sin fecha ni sustitución definida. El dashboard y su acceso continúan operativos; una retirada posterior deberá revisar ruta, redirecciones y consumidores.
- Se conservan los indicadores existentes y su significado: «Compras registradas» muestra una suma monetaria, los materiales se agrupan por nombre recortado sensible a mayúsculas y la frecuencia cuenta líneas de detalle, incluso repetidas dentro de la misma compra.
- Se conserva la deuda funcional monetaria: se suman importes nominales sin agrupar por moneda y se presentan como PEN, aunque compras y valorizaciones incluyen moneda. No se incorporan conversiones, tipos de cambio ni una redefinición de métricas. Este comportamiento está documentado y cubierto por pruebas; la migración no lo valida como criterio de negocio.

### Archivos, contratos y responsabilidades

- Se retiraron `src/app/pages/dashboard/dashboard.page.ts`, `.html` y `.css` tras actualizar la ruta y comprobar consumidores. No se mantuvieron duplicados ni puentes de la página anterior.
- `src/dashboard/resumen-compras/resumen-compras.*`: componente coordinador `ResumenCompras`, selector `resumen-compras`, estado con signals y derivados con `computed`. La URL `/dashboard` y `protegerRuta` se conservan; el componente se carga de forma diferida. La suscripción al router se retira para evitar una segunda carga al entrar.
- `src/dashboard/carga-dashboard/cargar-dashboard.*`: servicio `CargarDashboard`, responsable de coordinar las consultas, emitir primero indicadores y luego materiales, comunicar fallos parciales y limitar a cuatro las consultas simultáneas de detalles. Conserva el timeout de 12 segundos por detalle. Deduplica IDs de compra y restablece el orden original antes de agregar, aunque las respuestas lleguen fuera de orden.
- `src/dashboard/indicadores/calculos-dashboard.*`: funciones de suma, agrupación, redondeo, orden y formato. Conservan el redondeo acumulativo de dos decimales, el cálculo cantidad × precio cuando el subtotal es cero y el orden de entrada ante empates. No dependen de componentes ni servicios HTTP.
- `src/dashboard/grafico-materiales/grafico-materiales.*`: componente con entradas tipadas y `input.required`, reutilizado para cantidad, monto y frecuencia. Se trasladan los estilos locales; se mantienen colores, disposición y adaptación móvil. Las barras son decorativas y los valores continúan accesibles como texto; se añaden títulos semánticos y estados de carga/error accesibles.
- `src/dashboard/contratos-dashboard.ts` contiene los modelos de presentación. `src/dashboard/pruebas/muestras-dashboard.ts` reúne muestras tipadas usadas solo por las pruebas del dashboard.
- Contrato de API consultado de forma acotada: convenciones JSON, GET `/api/compras/compras`, GET `/api/compras/compras/{id}` y GET `/api/contable/valorizaciones`, con sus esquemas de filas, ítems, documentos y listado de valorizaciones. Se respeta PascalCase de las filas Dapper de compras y camelCase de valorizaciones, sin inventar envoltorios alternativos.
- Se tiparon las respuestas, retornos `Observable` y filtros de `ComprasService.compras`, `ComprasService.compra` y `ValorizacionesService.valorizaciones`, usando `HttpParams`. Los DTO confirmados se añadieron a los modelos actuales de esos dominios pendientes (`app/models/compras.models.ts` y `app/models/valorizaciones.models.ts`). Se reutilizan sus servicios públicos; no se migra incidentalmente compras o valorizaciones, ni se duplican endpoints. Sus otros consumidores siguen compilando.

### Carga, errores y pruebas

- Las recargas se componen con `switchMap`: una actualización cancela las peticiones activas y las encoladas de la carga anterior. `takeUntilDestroyed` cancela al salir de la vista. No hay suscripciones anidadas ni `detectChanges` manuales.
- Cambio explícito del manejo de fallos: se conservan los datos parciales disponibles, pero se muestra que los indicadores pueden estar incompletos junto con las fuentes fallidas. Los fallos ya no aparecen como un estado vacío exitoso. Al comenzar una nueva respuesta de indicadores se reinician los materiales, evitando mezclar datos de dos cargas.
- Antes de modificar la página se ejecutaron cuatro pruebas de caracterización: totales y agrupación/frecuencia, listas vacías sin detalles, conservación de valorizaciones ante fallo de compras y descarte de respuestas anteriores. Las cuatro pasaron con la implementación original; sus comportamientos quedan cubiertos por las pruebas definitivas junto a los conceptos migrados.
- Las pruebas definitivas cubren cálculos y redondeo, semántica histórica de frecuencia/moneda, orden estable, contratos y filtros HTTP, emisión de las dos etapas, fallos parciales, concurrencia y orden invertido, deduplicación, timeout, cancelación de peticiones activas y encoladas, recargas, destrucción y vista sin Zone.js. Se usa `HttpTestingController`, sin llamar al backend real. Los tests del DOM usan `provideZonelessChangeDetection()` y `whenStable()` sin detección manual.
- No se añadieron dependencias ni se modificó el lockfile. `AGENTS.md` refleja la ubicación migrada. `git diff --check` y Prettier del alcance nuevo son correctos. No se creó commit ni PR en esta entrega.
- El usuario confirmó posteriormente validación con backend y revisión en navegador correctas. No se aportó un desglose por dispositivo. No se ejecutaron pruebas automatizadas de navegador ni se instaló un framework e2e.

### Resultados técnicos de cierre

- Caracterización de la implementación previa: **4 pruebas correctas** en un archivo temporal, reemplazado por las pruebas definitivas al retirar la página anterior.
- `npm test -- --watch=false`: **230 pruebas correctas en 20 archivos**, incluidas **28 nuevas** del dashboard y de los contratos HTTP que consume; las 202 pruebas previas siguen pasando.
- ESLint de `src/dashboard` con `--max-warnings=0`: sin errores ni advertencias. `npm run lint` global: **0 errores y 1977 advertencias**, frente a 2005 antes de esta entrega. No se relajaron reglas.
- `npm run build` y `npm run build -- --configuration staging`: ambas compilaciones correctas con acceso autorizado a Google Fonts. Conservan el aviso del bundle inicial de 500 kB y las siete advertencias de CSS previas; respetan los presupuestos máximos de error. Dashboard queda como chunk diferido.
- No quedan referencias a `DashboardPage`, `app-dashboard-page` o `dashboard.page` en la aplicación ni en `angular.json`. La configuración de autenticación y sus reglas de acceso permanecen operativas según sus pruebas; el dashboard conserva su guard.

## Organización por conceptos de dashboard — 2026-10-19

A petición del usuario, la separación de responsabilidades se refleja también en carpetas. Cada componente o concepto conserva juntos su implementación, plantilla, estilos y pruebas cuando corresponden:

```text
src/dashboard/
├─ resumen-compras/
│  ├─ resumen-compras.ts
│  ├─ resumen-compras.html
│  ├─ resumen-compras.css
│  └─ resumen-compras.spec.ts
├─ grafico-materiales/
│  ├─ grafico-materiales.ts
│  ├─ grafico-materiales.html
│  └─ grafico-materiales.css
├─ carga-dashboard/
│  ├─ cargar-dashboard.ts
│  └─ cargar-dashboard.spec.ts
├─ indicadores/
│  ├─ calculos-dashboard.ts
│  └─ calculos-dashboard.spec.ts
├─ pruebas/
│  └─ muestras-dashboard.ts
└─ contratos-dashboard.ts
```

- El contrato de presentación compartido permanece en la raíz del dashboard y las muestras compartidas en `pruebas`. No se crean capas ni carpetas globales por tipo de archivo.
- Se actualizaron imports, la carga diferida en `app.routes.ts` y las referencias documentales. Las plantillas y estilos permanecen junto a su componente; no se cambiaron selectores, cálculos, consultas, estados ni comportamiento.
- El usuario confirmó la validación funcional con backend y navegador antes de esta reorganización. Autenticación y dashboard permanecen **Verificadas**; la intención de retirada futura y las limitaciones de moneda/frecuencia se conservan.

- Verificaciones de la reorganización: **230 pruebas correctas en 20 archivos**, ESLint de `src/dashboard` con `--max-warnings=0` correcto, formato aplicado y `git diff --check` correcto. Producción y staging compilan con las advertencias previas de tamaño y acceso autorizado a Google Fonts. No se añadieron pruebas nuevas porque el cambio solo mueve archivos y ajusta referencias.

## Entrega de catálogos generales — 2026-10-19

**Estado: Verificada.** El usuario confirmó el 2026-10-19 «Validación funcional y navegador OK», cerrando la validación humana pendiente de los cinco catálogos generales. Autenticación y dashboard conservan sus validaciones previas. La confirmación no amplía el alcance a la futura migración de Gastos ni a la unificación de proveedores.

### Decisiones confirmadas y alcance

- El desarrollador responsable confirmó que los mantenimientos son datos de referencia vigentes para compras, gastos, inventario y control presupuestario. Delegó la organización interna y la ubicación de sus accesos, considerando que un módulo de UI «Mantenimiento» no expresa el contexto de trabajo de un ERP.
- Se migran cinco conceptos transversales: especialidades, materiales, proveedores generales, proyectos y unidades de medida. Permanecen juntos como propietarios de sus datos en `src/catalogos`, agrupados por concepto. Las categorías de gasto y los proveedores específicos de gasto y terreno se reservan para `src/gastos` al migrar ese dominio.
- La separación actual de proveedores responde a un diseño histórico: proveedores generales para materiales y otros dos registros para gastos directos. El responsable confirmó que API y base de datos están transitando hacia un único proveedor. Este frontend conserva los endpoints e identificadores vigentes del contrato disponible; no mezcla IDs, agrega heurísticas de clasificación ni inventa filtros o campos del contrato unificado. Queda pendiente confirmar con backend cómo seleccionar proveedores por operación cuando esa transición esté lista. Las pantallas de referencia siguen siendo necesarias.
- Se detectaron llamadas de Proyectos a `/api/contable/cotizacion-materiales`, ausentes del contrato consultado y del backend local revisado de forma acotada. El usuario indicó expresamente **retirar las subcotizaciones de esta pantalla**. Se retiraron tabla, edición, lecturas y guardados adicionales y su servicio sin otros consumidores. Proyecto conserva nombre, descripción, cotización general y estado. No se modificó el backend ni se implementó un reemplazo financiero.

### Organización y contratos públicos

```text
src/catalogos/
├─ especialidades/
├─ materiales/
├─ proveedores/
├─ proyectos/
├─ unidades-medida/
├─ dialogo-catalogo/
├─ pruebas/
├─ busqueda-catalogo.ts
├─ busqueda-catalogo.spec.ts
└─ mensaje-catalogo.ts
```

Cada uno de los cinco conceptos contiene su contrato temático (`contratos-<concepto>.ts`), servicio público (`catalogo-<concepto>.ts`) y prueba HTTP, una subcarpeta `lista-<concepto>/` y otra `formulario-<entidad>/`, con TypeScript, HTML, estilos cuando corresponden y pruebas colocadas junto a cada concepto. No hay componentes internos importados por otros dominios.

- Se sustituyó y retiró `MaestraService`: sus consumidores en compras, requerimientos, inventario, valorizaciones, gastos y presupuestos inyectan los servicios públicos concretos. También se actualizó el doble de prueba de Requerimientos. Se retiró `maestra.models.ts` al actualizar su consumidor real de `Material`; no hay reexports ni adaptadores puente permanentes.
- Los contratos se consultaron únicamente en convenciones JSON, endpoints de los cinco catálogos y sus esquemas, detalle de proveedor con especialidades, consulta RUC y siguiente código de material. Se preservan rutas `/api/maestra/...`, filtros `activo` e `idEspecialidad`, métodos GET/POST/PUT, identificadores y campos. Los filtros usan `HttpParams`, incluidas las selecciones `false`.
- Los tipos de respuesta describen los datos consumidos de esos contratos, incluidos los campos bancarios, de contacto y de partida. Los campos SUNAT consumidos mantienen sus nombres `razon_social`, `numero_documento`, `direccion` y `estado`. No se añadieron dependencias, librerías de estado ni generación OpenAPI.
- Se reutilizan `ApiService`, notificaciones, la utilidad de errores y el modal de importación desde sus ubicaciones públicas actuales. Los servicios legacy de gastos y `/api/catalogos` que no pertenecen a estos cinco conceptos permanecen operativos en sus ubicaciones actuales; no se los presenta como migrados ni como parte de la unificación de proveedores.

### Interfaz, asincronía y preservación del dato

- Listas coordinadoras con `inject()`, dependencias `readonly`, estado visual con signals, derivados con `computed`, miembros de plantilla `protected`, recargas cancelables con RxJS y suscripciones liberadas mediante `takeUntilDestroyed`. Se muestran carga, vacío, fallo y éxito, y se impiden guardados duplicados con restauración de estado en éxito/error.
- Formularios extraídos: especialidades, unidades y proyectos conservan `ngModel` con contratos explícitos y validación básica; materiales y proveedores usan formularios reactivos tipados por su coordinación de campos y operaciones asíncronas. No se creó un CRUD genérico configurable que mezcle las reglas de las entidades.
- Se comparte la búsqueda sin distinguir tildes/mayúsculas y el diálogo nativo accesible, con título asociado, cancelación por Escape, cierre desde el fondo, foco y tabulación a cargo del navegador. Las etiquetas de los campos están asociadas a sus controles. Se mantienen estilos locales y tablas desplazables; Proyectos se adapta a sus cinco columnas vigentes tras retirar las subcotizaciones.
- Materiales conserva formatos de importación, especialidad, unidad, código sugerido, stock mínimo y partida presupuestal por defecto. Si la partida ya no está disponible en el listado de hojas, sigue como opción para reenviarla en el PUT. Editar exige recuperar el detalle completo; si falla, el guardado queda bloqueado para no borrar campos por omisión. El código de alta definitivo sigue asignándolo el backend; respuestas antiguas de la previsualización no pisan un material editado.
- El listado presupuestario de partidas sigue en un servicio legacy sin tipado. Su respuesta se trata como `unknown` y se valida antes de proyectarla a opciones estáticas del formulario; esta es una frontera real con código pendiente, no una aserción para ocultar incompatibilidades. Sin acceso a ese listado, una partida existente del material se conserva.
- Proveedores conserva los datos bancarios y de contacto. La consulta RUC se compone con `switchMap`, libera su suscripción al cerrar y descarta respuestas que correspondan a otro RUC. Los mensajes de validación, errores HTTP y reintentos conservan el formulario.
- Navegación: se retira el grupo «Mantenimiento». Proyectos, Especialidades y Proveedores quedan en Gestión de obra; Materiales y Unidades de medida, en Inventario; Categorías de gasto y proveedores específicos de gasto/terreno, en Gastos del proyecto. Se mantienen las URLs, guards y reglas de acceso existentes. Las cinco listas se cargan de forma diferida desde sus rutas actuales.

### Verificaciones y pendientes

- Antes de retirar MaestraService pasaron tres pruebas de caracterización: filtro `false`, PUT de material conservando su partida y alta de proveedor/consulta RUC. Sus casos quedan cubiertos por las pruebas definitivas por concepto.
- Las pruebas nuevas cubren contratos HTTP, errores, filtros, altas y edición; validaciones y normalización; conservación de partida no disponible y bloqueo por detalle fallido; consulta RUC y respuesta tardía; código de material tardío; carga/búsqueda sin Zone.js; guardados duplicados, error y éxito con recarga; diálogo y navegación contextual. No llaman a la API real.
- jsdom no implementa `HTMLDialogElement.showModal/close`: los tests simulan únicamente ese límite nativo. El usuario confirmó la validación funcional y en navegador de la entrega el 2026-10-19. No se dispone de un desglose individual de comprobaciones de foco, Escape, teclado o importaciones; la evidencia corresponde a su confirmación general, no a pruebas automatizadas de navegador.
- La búsqueda de consumidores incluyó páginas sin menú y rutas diferidas. Se retiraron únicamente las cinco implementaciones sustituidas, el servicio global de maestras, su depósito de contratos y el servicio de subcotizaciones sin otros consumidores. No se retiraron otras páginas legacy por falta de un enlace en el menú.
- Pruebas: **305 correctas en 37 archivos** en la suite completa. Después de los últimos ajustes de estilos y bloqueo de controles, se repitieron los casos afectados: **77 correctas en 18 archivos** (catálogos y contenedor de navegación).
- ESLint de `src/catalogos` con `--max-warnings=0`: **sin errores ni advertencias**. Lint global: **0 errores y 1782 advertencias** de deuda pendiente, frente a las 1977 registradas antes de esta entrega. No se relajaron reglas para el código migrado. Formato aplicado y `git diff --check` correcto.
- Producción y staging compilan correctamente sobre el código final, con acceso autorizado a Google Fonts. Persisten las advertencias de presupuesto del bundle inicial (849.92 kB frente al umbral de aviso de 500 kB) y de estilos de pantallas pendientes de migración; no se modificaron los presupuestos. No se creó commit ni PR.
