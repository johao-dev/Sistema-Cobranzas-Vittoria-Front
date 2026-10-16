# Registro de migración del frontend

## Propósito y estado

- **Fecha del acuerdo:** 2026-10-16.
- **Contrato para agentes:** [AGENTS.md](../AGENTS.md).
- **Estado:** decisiones documentadas; migración del código pendiente. Este registro no acredita compilaciones, pruebas ni validación funcional.
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
| Verificación | Vitest; sin script de lint ni framework e2e | Conservar Vitest e incorporar ESLint para Angular y TypeScript. Comprobar compilaciones de producción y staging, pruebas relevantes y validación funcional humana. |
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
| Autenticación | `src/app/pages/login`, sesión e infraestructura en `src/app/core` | `src/autenticacion`; infraestructura transversal en `src/core` | Pendiente | Sin entrega de migración registrada |
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
| Infraestructura y elementos compartidos | `src/app/core`, `src/app/models`, `src/app/shared` y contenedor en `src/app` | Distribuir por propietario; conservar infraestructura en `src/core` y reutilización real en `src/shared` | Pendiente | Migrar con sus consumidores; retirar `src/app` al finalizar |

Estados de seguimiento: **Pendiente**, **En curso**, **Pendiente de validación funcional** y **Verificada**. Si existe una limitación o bloqueo, describirlo con su causa y siguiente paso; no marcar como verificada una entrega por haber movido archivos o por haber compilado únicamente.

## Herramientas e iteraciones pendientes

- Incorporar ESLint con reglas de Angular y TypeScript y registrar su comando real en `AGENTS.md` cuando exista. No hay comando de lint configurado al crear este registro.
- La automatización de los límites entre funcionalidades puede implementarse después; la convención ya está acordada.
- OpenAPI es una futura iteración del contrato backend. La generación de tipos y sus herramientas se definirán entonces.
- No incorporar pruebas automatizadas de navegador en el alcance actual. Mantener validación funcional humana de los flujos críticos y registrar las comprobaciones que no puedan realizarse.

## Registro de entregas

| Fecha | Entrega | Cambios | Verificaciones y limitaciones |
| --- | --- | --- | --- |
| 2026-10-16 | Acuerdo documental | Actualización de `AGENTS.md` y creación de este registro | Entrega exclusivamente documental; no migra código ni acredita validación funcional. |

En cada entrega futura registrar:

1. Funcionalidad o concepto, alcance y estado; referencia al commit o PR si existe.
2. Archivos movidos o retirados, consumidores actualizados y decisiones adicionales.
3. Contratos y comportamiento preservados, con excepciones de tipado justificadas si existen.
4. Comandos ejecutados y resultados reales; validaciones funcionales, responsable y pendientes.
5. Limitaciones, bloqueos y siguiente paso. Actualizar las ubicaciones actuales de `AGENTS.md` cuando dejen de describir el código real.

## Cierre global

La migración termina cuando todas las funcionalidades acordadas satisfagan los criterios de la sección 8 de `AGENTS.md`: estructura objetivo, responsabilidades separadas, tipado, consumidores actualizados, verificaciones técnicas y validación funcional del desarrollador responsable. No atribuir el cierre a esta entrega documental.

Referencias: [estructura y estilo de Angular](https://angular.dev/style-guide), [selectores](https://angular.dev/guide/components/selectors) y [TypeScript de Google](https://google.github.io/styleguide/tsguide.html).
