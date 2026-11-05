# Filtro de exclusión de partidas — Frontend

Fecha: 5 de noviembre de 2026.

## 1. Resumen funcional

Se implementó **Partidas incluidas** en el Panel de Control Presupuestario, a la derecha de
**Nivel de anidamiento**. El desplegable permite buscar por código/nombre, marcar partidas o
categorías completas y seleccionar/deseleccionar todo el catálogo. Muestra las exclusiones y
los estados parciales de las categorías mediante checkboxes indeterminados.

Las exclusiones afectan exclusivamente al donut y a su tabla de distribución. Los widgets,
árbol presupuestario, evolución semanal, desviaciones y demás reportes conservan sus fuentes
de datos. No se modificó el backend ni se corrigieron discrepancias históricas.

## 2. Archivos creados y modificados

Rutas de código relativas a `cobranza-vittoria/src/presupuestos/`:

| Archivo                                       | Estado y responsabilidad                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `partidas/selector-partidas.ts`               | Nuevo componente de selección, búsqueda y eventos.                                            |
| `partidas/selector-partidas.html`             | Nuevo desplegable semántico con checkboxes y acciones.                                        |
| `partidas/selector-partidas.css`              | Nuevos estilos locales, límites de tamaño y adaptación móvil.                                 |
| `partidas/seleccion-partidas.ts`              | Nuevas funciones puras de jerarquía y selección.                                              |
| `partidas/selector-partidas.spec.ts`          | Nuevas pruebas de selección, jerarquía, búsqueda y cierre.                                    |
| `consultas/control-presupuestario.ts`         | Estado de exclusiones, carga única del catálogo, permisos y comparación de filtros.           |
| `consultas/control-presupuestario.html`       | Integración del selector y nuevos inputs del tablero.                                         |
| `consultas/control-presupuestario.css`        | Distribución de cuatro filtros, dos columnas y una columna según ancho.                       |
| `consultas/control-presupuestario.spec.ts`    | Pruebas adicionales de reinicio, permisos, catálogo, errores e integración entre componentes. |
| `consultas/consultas-presupuestarias.ts`      | Parámetros repetidos de exclusión en `dashboard`.                                             |
| `consultas/consultas-presupuestarias.spec.ts` | Pruebas adicionales del contrato HTTP.                                                        |
| `tablero/contratos-tablero-presupuestario.ts` | Miembro obligatorio `rubrosFiltrados`.                                                        |
| `tablero/tablero-presupuestario.ts`           | Distribución filtrada, total incluido, concurrencia y reutilización del catálogo.             |
| `tablero/tablero-presupuestario.html`         | Total central filtrado, tabla, estados vacíos y reintento.                                    |
| `tablero/tablero-presupuestario.css`          | Distribución de tabla/resumen cuando no se puede dibujar el donut.                            |
| `tablero/tablero-presupuestario.spec.ts`      | Nuevas pruebas de distribución, navegación, importes con signo, errores y concurrencia.       |

Este reporte se creó en la raíz del repositorio como
`IMPLEMENTACION_FILTRO_PARTIDAS_FRONTEND.md`. No se modificaron dependencias, lockfiles,
configuración de ambientes ni documentación de la migración de carpetas.

## 3. Componentes, servicios y estado

- **ControlPresupuestario:** mantiene `partidasExcluidas` y el catálogo en signals. Compara los
  IDs normalizados de centro y presupuesto antes de reiniciar exclusiones o recargar reportes.
  `null` representa todos los presupuestos. Repetir la misma selección no dispara recargas.
- **SelectorPartidas:** recibe catálogo y exclusiones mediante `input()`, emite cambios mediante
  `output()` y mantiene únicamente la búsqueda local. Los valores derivados utilizan `computed()`.
- **CatalogoPartidas:** se reutiliza sin cambios. Una carga sin filtros incluye el catálogo completo,
  también las partidas inactivas. La carga se comparte con el tablero y se conserva durante la vida
  del contenedor; no se repite por búsquedas, niveles, ramas o cambios de centro/presupuesto.
- **ConsultasPresupuestarias:** conserva el endpoint y los filtros anteriores y añade la colección
  opcional de exclusiones al método `dashboard`.
- **TableroPresupuestario:** recibe las exclusiones y el catálogo del contenedor. Utiliza este último
  para identificar categorías navegables, sustituyendo la petición independiente anterior de
  categorías. Esa consulta ya no tiene consumidores dentro del tablero.

Se consulta `SesionUsuario.hasPermission('control_presupuestario.partida.ver')` antes de cargar
el catálogo. Si el usuario solo tiene permiso de reportes, el selector queda deshabilitado con
una explicación y el resto del panel continúa consultándose. No se infiere el catálogo desde los
rubros visibles. Sin acceso al catálogo, las categorías del donut no ofrecen descenso; el árbol
presupuestario conserva su funcionamiento y permiso de reportes.

## 4. Integración HTTP

El modelo `Tablero` declara `rubrosFiltrados: TableroRubro[]` como miembro obligatorio.
No se utiliza `rubros` como respaldo de la distribución filtrada.

```http
GET /api/control-presupuestario/consultas/dashboard?idCentroCosto=5&idPresupuesto=10&nivel=2&partidasExcluidas=3&partidasExcluidas=7
```

Cada ID corresponde a `idCatalogoPartida` y se agrega mediante `HttpParams.append()`,
conservando la nueva instancia inmutable de parámetros. Con selección vacía se omite la clave;
no se envían comas, JSON ni valores vacíos. Se mantienen `idCentroCosto`, `idPresupuesto`,
`nivel` e `idPartidaPadre` y la respuesta directa del endpoint.

Los errores de validación `errors` y los errores del módulo `error`/`message` se presentan con
`extraerMensajeError`. Los errores de catálogo permiten reintentar su carga; los del dashboard
permiten reintentar con las exclusiones actuales. Ante un error del dashboard se retira la
distribución anterior para evitar presentarla como resultado de la selección nueva.

## 5. Decisiones técnicas y selección jerárquica

1. El árbol se construye exclusivamente con `idPartidaPadre`. El código se usa para buscar y
   ordenar hermanos, nunca para deducir parentescos.
2. Todos los nodos comienzan incluidos. Desmarcar una categoría excluye su ID y los de todos
   sus descendientes. El backend admite esta redundancia sin duplicar restas.
3. Al excluir el último descendiente incluido de una categoría se excluye también su padre,
   propagando el estado hacia arriba. Al reincorporar un descendiente se retiran sus ancestros
   de la colección de exclusiones, conservando los hermanos excluidos. Así el backend no vuelve
   a excluir el descendiente por tener un padre excluido.
4. Una categoría parcialmente incluida muestra `indeterminate`. Marcarla reincorpora toda
   su rama. El contador incluye todos los IDs excluidos, tanto categorías como descendientes.
5. Seleccionar/deseleccionar todas se aplica siempre al catálogo completo. El desplegable lo
   explica explícitamente, también durante una búsqueda. Buscar o cerrar no altera la selección.
6. Cambiar nivel o navegar por ramas conserva las exclusiones, incluso si algún ID está fuera de
   la rama actual. Un cambio exclusivo de exclusiones conserva la rama del donut. Cambiar nivel
   mantiene el comportamiento anterior de volver a la vista completa, conservando el filtro.
7. Cada petición del dashboard cancela la suscripción anterior antes de iniciarse. Esto cancela
   HTTP con `HttpClient` y descarta emisiones anteriores. La destrucción también cancela la
   petición pendiente. Se conserva el patrón de suscripción existente, sin añadir otro almacén
   de estado ni caché de consultas.
8. Un cambio exclusivo de exclusiones, sobre un contexto ya cargado, reemplaza únicamente
   `rubrosFiltrados`: conserva las referencias de los otros miembros y las curvas construidas.
   Si cambia la selección durante una carga de otro contexto, la última respuesta completa
   establece correctamente el centro, presupuesto, nivel y rama pendientes.
9. El backend resuelve exclusiones y agrupación presupuestaria. Angular mantiene únicamente
   los cinco principales rubros y «Otros» como agrupación visual, después del filtrado.
   El centro del donut y los porcentajes de sus segmentos usan la suma de `ejecutado` incluido.
   La tabla conserva los porcentajes del backend y añade el total incluido.
10. Con distribución vacía se muestra un mensaje. Con importes negativos o total neto no
    positivo se omiten los arcos y se conserva la tabla con ceros, negativos y porcentajes
    originales. No se recortan importes ni se toman valores absolutos para dibujar el donut.
    El resumen y la evolución permanecen visibles incluso sin segmentos.
11. El desplegable usa `details`/`summary` y controles nativos. Escape lo cierra y devuelve
    el foco al resumen. La lista tiene desplazamiento y el panel limita ancho y altura;
    los estilos del contenedor pasan de cuatro columnas a dos y luego a una.

## 6. Pruebas y resultados

Comandos ejecutados desde `cobranza-vittoria/`:

```bash
npm test -- --watch=false --include='src/presupuestos/**/*.spec.ts'
npm test -- --watch=false
npm run lint
npm run build
```

También se revisaron el diff, los archivos afectados con `prettier --check` y
`git diff --check` desde la raíz del repositorio.

| Verificación                    | Resultado                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suite completa final            | **823 pruebas correctas en 118 archivos; ninguna fallida.**                                                                                                                                                         |
| Pruebas nuevas añadidas         | **28**, distribuidas entre selector, tablero, contenedor y HTTP.                                                                                                                                                    |
| Compilación de producción final | Correcta; bundle inicial de 343,53 kB. Advertencias de CSS en `aplicacion.css` (5,50 kB) y `tablero-presupuestario.css` (5,96 kB), por encima del umbral de aviso de 4 kB y por debajo del límite de error de 8 kB. |
| ESLint final                    | Correcto, sin errores.                                                                                                                                                                                              |
| Prettier y revisión del diff    | Correctos, sin errores de formato.                                                                                                                                                                                  |

Las pruebas cubren selección inicial, hojas y categorías a varias profundidades, estados
parciales, exclusión del último descendiente, reincorporación, búsqueda sin pérdida de selección,
cierre con Escape, acciones globales, partidas inactivas, exclusiones dentro de «Otros»,
persistencia por nivel/rama, reinicio por IDs reales, vacíos, signos y totales no positivos,
cancelación de respuestas antiguas, cancelación al destruir, errores 400/404 y reintentos.

Una prueba integra la plantilla real del contenedor, el selector y sus componentes hijos con
servicios simulados: verifica la actualización mediante signals sin Zone.js y que cambiar
exclusiones consulta solo el dashboard, conservando las consultas del árbol y demás reportes.
Las pruebas HTTP usan `HttpTestingController`; no se llamó a la API real.

Evidencia de la suite completa final: `/tmp/filtro-partidas-frontend-tests.log`.

La compilación restringida falló inicialmente con `EAI_AGAIN fonts.googleapis.com` al descargar
las fuentes externas de `styles.css`. Hubo un fallo transitorio adicional de descarga con acceso
ampliado; el último `npm run build`, con acceso de red autorizado, terminó correctamente.
No se modificaron las fuentes ni la configuración de compilación para evitar esa dependencia.

## 7. Limitaciones y consideraciones

- La API desplegada debe incluir el nuevo miembro obligatorio `rubrosFiltrados` y aceptar las
  exclusiones antes de publicar este frontend.
- No se ejecutó una comprobación visual en navegador ni una integración contra la API real.
  La interacción automatizada se verificó con Angular TestBed y jsdom. La adaptación móvil
  se revisó en CSS; quedan pendientes la inspección visual a distintos anchos y la validación
  manual con datos reales y permisos del entorno destino.
- Las exclusiones se mantienen durante la vida del contenedor; no se persisten al recargar
  la página. Cambiar realmente centro/presupuesto las reinicia, según el alcance solicitado.
- La representación de datos con signo conserva la tabla como vista completa; el donut
  solo se dibuja cuando los importes son no negativos y su total es positivo.
