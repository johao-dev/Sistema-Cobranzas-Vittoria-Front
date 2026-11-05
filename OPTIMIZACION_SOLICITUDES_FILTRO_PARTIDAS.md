# Optimización de solicitudes del filtro de partidas

Fecha: 5 de noviembre de 2026.

## 1. Archivos modificados

Rutas relativas a `cobranza-vittoria/src/presupuestos/`:

| Archivo                                    | Ajuste                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `tablero/tablero-presupuestario.ts`        | Debounce de selección, deduplicación e invalidación de esperas y peticiones obsoletas.      |
| `tablero/tablero-presupuestario.spec.ts`   | Pruebas del intervalo, conjuntos equivalentes, contexto, cancelación, errores y reintentos. |
| `partidas/selector-partidas.ts`            | Cierre al salir el foco o pulsar fuera del componente.                                      |
| `partidas/selector-partidas.spec.ts`       | Pruebas de foco interno/externo y pulsación fuera.                                          |
| `consultas/control-presupuestario.spec.ts` | Comprobación de selección visual inmediata y consulta diferida con la plantilla real.       |

Se creó este reporte en la raíz del repositorio. Se conservaron los cambios de la feature anterior.
No se modificaron backend, servicios HTTP, DTOs, lógica financiera, plantillas, estilos,
dependencias ni los demás reportes como parte de este ajuste.

## 2. Flujo RxJS

El contenedor y el selector siguen actualizando inmediatamente las exclusiones y sus checkboxes.
El tablero distingue cambios de selección de cambios de centro, presupuesto o nivel.

Para una selección distinta, el tablero cancela inmediatamente su petición anterior y publica
una clave normalizada en un `Subject`. `debounceTime(250)` espera 250 ms desde el último cambio
real antes de llamar al método de carga existente. Durante esa espera no se inicia HTTP.
El estado `cargando` se activa al iniciar la consulta; al cancelar una consulta anterior se libera.

Se conserva una única suscripción HTTP activa, `consulta`, administrada por `cargar`.
La suscripción adicional `esperaSeleccion` solo coordina el debounce y delega en ese mismo
método; no abre una vía HTTP paralela. Ambas suscripciones se liberan al destruir el componente,
y también se completa el `Subject` para cancelar cualquier espera pendiente.

## 3. Solicitudes redundantes y condiciones de carrera

- Las claves de selección se construyen eliminando duplicados y ordenando los IDs numéricamente.
  Cambiar solamente el orden o repetir un ID no reinicia la espera ni genera una petición.
- Cada cambio real cancela la petición anterior desde el comienzo del debounce. Así una respuesta
  antigua tampoco puede sobrescribir los datos durante los 250 ms de espera.
- Si el usuario deshace sus cambios y la selección final coincide con la distribución válida ya
  cargada para el mismo contexto, se reutilizan esos datos sin consultar nuevamente.
- Un error invalida esa referencia de selección válida, porque la distribución anterior se retira.
  Volver después a sus IDs exige consultar de nuevo y no reutiliza una distribución vacía por error.
- Centro de costo, presupuesto, nivel, descenso por categorías, breadcrumb y reintentos llaman
  inmediatamente a `cargar`. Este método publica una invalidación `null`, reemplazando cualquier
  selección pendiente. El debounce ignora esa invalidación y no emite otra petición después.
- La carga toma una copia normalizada de las exclusiones actuales junto al contexto vigente.
  Se conserva el reinicio de exclusiones por cambio real de centro/presupuesto del contenedor,
  y su conservación al cambiar nivel o rama.
- Los errores HTTP, la presentación de mensajes, la conservación de los demás miembros del
  dashboard y los reintentos mantienen su flujo existente. Un reintento explícito es inmediato.

El desplegable también escucha `focusout`: si el siguiente destino está fuera del componente,
o no existe, se cierra. `document:pointerdown` cubre pulsaciones fuera sobre áreas sin foco y
el inicio de interacción con otro selector. Mover el foco entre búsqueda, checkboxes y botones
internos lo mantiene abierto. El cierre exterior conserva búsqueda y exclusiones y no devuelve
el foco al selector; Escape mantiene su comportamiento anterior de devolverlo al resumen.

## 4. Pruebas ejecutadas y resultados

Desde `cobranza-vittoria/`:

```bash
npm test -- --watch=false --include='src/presupuestos/**/*.spec.ts'
npm run lint
npm run build
```

También se ejecutaron `prettier --check` sobre los cinco archivos afectados y este reporte,
y `git diff --check` desde la raíz del repositorio.

| Verificación                 | Resultado                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pruebas de Presupuestos      | 109 correctas en 10 archivos; ninguna fallida.                                                                                                                                                 |
| ESLint                       | Correcto, sin errores.                                                                                                                                                                         |
| Prettier y revisión del diff | Correctos, sin errores de formato.                                                                                                                                                             |
| Compilación de producción    | Correcta; bundle inicial de 343,91 kB. Dos advertencias existentes de tamaño CSS: `aplicacion.css` (5,50 kB) y `tablero-presupuestario.css` (5,96 kB), por debajo del límite de error de 8 kB. |

Cobertura del ajuste:

- Ninguna consulta a los 249 ms y una consulta al cumplir 250 ms.
- Cambios rápidos que reinician el intervalo y consultan exclusivamente la selección final.
- Actualización inmediata de checkbox, contador y exclusiones con la plantilla real y sin Zone.js.
- Conjuntos equivalentes, cambios deshechos y selección vacía.
- Cambios de centro, presupuesto y nivel durante una espera; descenso de rama y breadcrumb inmediatos.
- Cancelación de respuestas anteriores tanto durante el debounce como con la petición nueva activa.
- Estados de carga, errores 400/404, reintento inmediato y recuperación tras errores y cancelaciones.
- Cancelación de la petición y del debounce al destruir el componente.
- Foco entre controles internos, salida por teclado, pérdida de foco sin destino, apertura de otro
  seleccionable y pulsación en una zona exterior sin foco.

Las pruebas temporales del tablero usan los temporizadores simulados de Vitest. Las interacciones
se verifican con Angular TestBed y jsdom; los servicios son simulados y no se llama a la API real.
El registro de la ejecución final está en `/tmp/optimizacion-filtro-partidas-tests.log`.

La compilación restringida falló con `EAI_AGAIN fonts.googleapis.com`. El primer intento con
acceso de red también falló al descargar las fuentes; el reintento autorizado terminó
correctamente. No se alteró la configuración de compilación para resolverlo.

## 5. Limitaciones

- No se ejecutó una comprobación manual en navegador ni contra el backend desplegado.
- Cancelar HTTP evita aplicar respuestas obsoletas; una petición que ya llegó al servidor puede
  haber empezado a procesarse. El debounce reduce ese caso al agrupar cambios rápidos antes del envío.
- La compilación depende de la descarga de Google Fonts existente en `styles.css`; sus fallos
  de red se documentan con el resultado final sin alterar la configuración del proyecto.
