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
- **Formularios actuales:** `FormsModule` y `ngModel`. Mantener el patrón de la funcionalidad que se modifica.
- **Presentación:** HTML y CSS; estilos globales en `src/styles.css` y estilos por componente.
- **Pruebas:** Vitest 4, jsdom y utilidades de Angular TestBed mediante `ng test`.
- **Formato:** Prettier y `.editorconfig` dentro de `cobranza-vittoria/`.

## 3. Arquitectura y responsabilidades

La aplicación tiene una arquitectura basada en componentes, parcialmente organizada por funcionalidad. Mantener la estructura existente; no asumir que ya implementa un monolito modular o todas las capas de arquitectura limpia.

Todas las rutas de esta sección son relativas a `cobranza-vittoria/src/`:

| Ubicación | Responsabilidad |
| --- | --- |
| `main.ts`, `app/app.config.ts` | Arranque, proveedores globales, router, HTTP e interceptores. |
| `app/app.ts`, `app/app.html`, `app/app.css` | Contenedor principal, navegación y estructura general de la aplicación. |
| `app/app.routes.ts` | Rutas, redirecciones, carga de páginas y reglas de acceso. |
| `app/pages/<funcionalidad>/` | Páginas y componentes específicos de cada funcionalidad. |
| `app/shared/components/` | Componentes reutilizables, como notificaciones, importación y tipo de cambio. |
| `app/core/services/` | Acceso a API por dominio y servicios transversales de sesión y notificación. |
| `app/core/auth/`, `app/core/guards/`, `app/core/interceptors/` | Sesión, claims, permisos, protección de rutas y autenticación HTTP. |
| `app/core/config/` | Configuración de API por ambiente. |
| `app/core/utils/` | Utilidades compartidas de errores y descarga de archivos. |
| `app/models/` | Contratos de petición, respuesta y tipos compartidos. |
| `styles.css` | Variables de diseño y estilos globales reutilizables. |

- Las páginas coordinan interacción, formularios y estado visual; los servicios encapsulan las llamadas HTTP y la adaptación de datos de su dominio.
- Los componentes reutilizables comunican eventos y datos mediante entradas y salidas; evitar acoplarlos a una página concreta.
- Los modelos no deben depender de páginas o componentes. Los servicios de `core` no deben importar desde `pages`.
- Reutilizar servicios, modelos y utilidades existentes antes de crear otros. Mantener los componentes propios de una funcionalidad junto a su página.
- Aplicar patrones GoF y principios SOLID cuando resuelvan una necesidad concreta. Evitar capas, repositorios, interfaces o dependencias nuevas sin justificación.
- No reorganizar toda la aplicación ni migrar patrones como parte incidental de una corrección.

## 4. Convenciones de código

### Nombres y formato

- **Carpetas y archivos:** Usar minúsculas y kebab-case, siguiendo el código existente: `ordenes-compra/`, `requerimientos.service.ts`, `import-modal.component.ts`.
- **Sufijos:** `.page.ts` para páginas, `.component.ts` para componentes compartidos o secundarios, `.service.ts`, `.models.ts`, `.guard.ts`, `.interceptor.ts`, `.util.ts` y `.spec.ts` según su responsabilidad. Mantener las excepciones existentes del arranque, como `app.ts`.
- **Clases, interfaces y tipos:** PascalCase. El frontend usa interfaces sin prefijo `I`, por ejemplo `RequerimientoRequest` y `ImportResumen`; mantener esa convención sin renombrados masivos.
- **Variables, propiedades y métodos:** lowerCamelCase. Constantes de dominio en UPPER_SNAKE_CASE, como `ACCESS_RULES` y `IMPORT_MODULOS_META`.
- **Selectores:** Prefijo `app-` y kebab-case.
- **Idioma:** Código, comentarios y textos de interfaz en español; conservar el uso de inglés o spanglish establecido y los nombres exigidos por Angular o la API.
- Respetar dos espacios, comillas simples en TypeScript y la configuración de Prettier (`printWidth: 100`, parser Angular para HTML). Evitar reformatear archivos ajenos al cambio.

### Tipos explícitos y legibilidad

- Priorizar la claridad para humanos por encima de reducir líneas o caracteres.
- Preferir tipos explícitos en contratos, propiedades, parámetros, retornos y resultados asíncronos cuando aclaren su intención. Permitir inferencia local cuando el tipo sea evidente.
- Usar `const` por defecto y `let` solo cuando exista reasignación; no usar `var`.
- No introducir `any` para eludir el compilador. Reutilizar o definir modelos; para datos desconocidos, usar `unknown` y validar antes de acceder a sus propiedades.
- Respetar `strict`, `strictTemplates` y las demás opciones de `tsconfig.json`. No desactivarlas para resolver errores.
- Mantener contratos coherentes, incluidos valores opcionales, `null`, identificadores, estados y formatos de fecha. Evitar aserciones de tipo que oculten incompatibilidades con la API.
- Separar con líneas en blanco las validaciones, obtención de datos, transformación, envío y actualización visual.
- Mantener métodos con una responsabilidad concreta. Escribir comentarios sobre decisiones y motivos, sin repetir lo evidente.

### Componentes, estado y asincronía

- Mantener componentes standalone e importar explícitamente lo que requiere su plantilla.
- Respetar el patrón de inyección existente en el archivo, ya sea constructor o `inject()`.
- La aplicación funciona sin Zone.js: garantizar que los cambios asíncronos se reflejen en pantalla. Usar signals, `AsyncPipe` o el mecanismo de `ChangeDetectorRef` correspondiente al patrón local; no agregar Zone.js como solución.
- Conservar el patrón de estado de la funcionalidad. No migrar pantallas completas a signals ni introducir una biblioteca de estado sin necesidad concreta.
- Componer operaciones con RxJS y evitar suscripciones anidadas. Liberar suscripciones que sobrevivan al componente mediante `takeUntilDestroyed`, `AsyncPipe` o el mecanismo existente.
- Restaurar los estados de carga y guardado tanto en éxito como en error; utilizar `finalize` cuando corresponda. Impedir envíos duplicados durante una operación.

## 5. API, validaciones, errores y acceso

### Integración con el backend

- Reutilizar `ApiService` y el servicio del dominio para las llamadas de negocio. La base de la API se obtiene de `environment.apiUrl`; no duplicar URLs en componentes.
- Los ambientes están en `core/config/environment.ts`, `environment.staging.ts` y `environment.production.ts`. `angular.json` configura sus reemplazos al compilar.
- Mantener endpoints, métodos HTTP, parámetros y DTOs acordes al contrato disponible. No inventar campos o respuestas ni convertir una falla en un éxito aparente.
- Tipar peticiones y respuestas en `app/models/`. Conservar los estados y permisos del backend, incluidos sus valores exactos.
- Usar `HttpParams` para filtros y las utilidades existentes para descargas. Para importación, reutilizar `ImportService`, `ImportModalComponent` y los metadatos de `import.models.ts`.
- No incluir secretos, contraseñas o claves privadas en código, configuración de ambientes ni archivos públicos; la configuración del frontend es visible en el navegador.

### Validaciones y manejo de errores

- Validar los formularios para dar respuesta inmediata al usuario: campos requeridos, formatos, rangos y coherencia básica. El backend conserva la validación definitiva de negocio.
- Consumir los errores HTTP en la capa que pueda dar una respuesta útil al usuario; los servicios propagan el error salvo que su contrato modele explícitamente un resultado de éxito o error, como en importación.
- Reutilizar `extraerMensajeError`, `esCodigoError` y `obtenerErrores` de `core/utils/api-error.util.ts` para los contratos compatibles. Esta utilidad contempla `errores[]`, errores de modelo en `errors` y mensajes del servidor.
- Mostrar mensajes claros mediante `NotificationService` o los errores de formulario existentes. No silenciar errores ni exponer tokens, datos sensibles o detalles internos en mensajes o registros.
- Las reglas de `ApiMiddlewareException` y DataAnnotations corresponden al backend; el frontend interpreta sus respuestas y presenta los errores.

### Autenticación y permisos

- Reutilizar `AuthService`, `authInterceptor`, `authGuard` y las reglas de `core/auth/access-control.util.ts`.
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

## 7. Comandos y verificación de cambios

Desde `cobranza-vittoria/`:

```bash
npm ci
npm start
npm run build
npm run build -- --configuration staging
npm test -- --watch=false
```

- `npm start` sirve el frontend en `http://localhost:4200`; el entorno de desarrollo actual espera la API en `http://localhost:5000`.
- `npm run build` usa producción por defecto. Usar la configuración correspondiente al cambio y respetar los presupuestos de tamaño de `angular.json`.
- No hay script de lint ni framework e2e configurado. No presentar esos checks como existentes.

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
