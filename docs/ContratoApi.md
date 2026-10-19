# Contrato de API — Sistema de Gastos Vittoria

Fecha de revisión: **19 de octubre de 2026**. Plataforma: ASP.NET Core / .NET 8. Este documento describe la implementación del repositorio en esa fecha: rutas, autorización efectiva, entradas, salidas, archivos, validaciones y errores. Incluye endpoints legacy y operaciones publicadas todavía sin implementar.

Las rutas son relativas al origen del despliegue (`{BASE_URL}`); no hay un prefijo `/v1` en las rutas de negocio. El nombre `v1` corresponde al documento Swagger. La URL y el puerto dependen del entorno.

## Índice

- [Convenciones HTTP y JSON](#convenciones)
- [Autenticación y permisos](#seguridad)
- [Inventario y detalle de endpoints](#endpoints)
- [Esquemas de request y response](#esquemas)
- [Reglas de negocio y archivos](#reglas)
- [Errores y códigos](#errores)
- [Ejemplos de consumo](#ejemplos)
- [Alcance y verificación](#verificacion)

<a id="convenciones"></a>
## Convenciones HTTP y JSON

| Aspecto | Contrato actual |
|---|---|
| Cuerpo de operaciones con DTO | JSON; enviar `Content-Type: application/json`. Los campos de un DTO constituyen el cuerpo directamente, sin envolverlos en el nombre del parámetro C#. |
| Formularios y archivos | `multipart/form-data`, con `boundary` generado por el cliente. Repetir `files` para adjuntar varios archivos; las importaciones usan `archivo`. |
| Respuestas ordinarias | `application/json`, salvo archivos, respuestas de texto de algunos controladores legacy y respuestas sin contenido. |
| Nombres JSON | Los objetos C# tipados y anónimos usan `camelCase`, excepto propiedades con `JsonPropertyName`. Las filas Dapper dinámicas son diccionarios y conservan los nombres/alias SQL, frecuentemente `PascalCase`. El apartado de esquemas conserva esas diferencias. |
| Nulos | No hay una opción global para omitir propiedades nulas. `T?` indica que el contrato C# admite `null`; las validaciones pueden imponer condiciones adicionales. |
| Fechas | `DateOnly`: cadena `yyyy-MM-dd`. `DateTime`: cadena ISO 8601; usar fecha y hora con zona cuando corresponda. `expiration` de autenticación se calcula en UTC. No todas las fechas de negocio se normalizan a UTC. |
| Importes | `decimal` es un número JSON, sin símbolo monetario ni separador de miles. La escala y los límites se especifican en las validaciones y reglas de negocio. |
| Booleanos | JSON `true` / `false`; en query y formularios usar `true` / `false`. |
| Colecciones en query | Repetir el nombre, por ejemplo `?idCategoriaGasto=1&idCategoriaGasto=2`. Un DTO `[FromQuery]` se descompone en sus propiedades de query; no se envía como JSON. |
| Colecciones en response | `T[]` representa un arreglo, sin paginación global ni envoltorio estándar. Seguridad sí devuelve envoltorios como `{ usuarios: [...] }`. |
| Campos omitidos | Para clases se conservan los inicializadores o valores CLR (`0`, `false`, `null`, fecha por defecto). Un tipo valor no nullable por sí solo no obliga a que la clave venga en el JSON; `Range` u otras reglas pueden rechazar el valor por defecto. Las referencias no nullable participan en la validación implícita de MVC. |
| Validación de entrada | `[ApiController]` aplica model binding y DataAnnotations. JSON mal formado, tipos incompatibles y validación de modelo fallida generan `400` con `ValidationProblemDetails`, antes de ejecutar la acción. |
| PUT y PATCH | La semántica depende del endpoint. Varios PUT legacy son upserts; los PUT de Seguridad permiten campos parciales. El PATCH de ítems distingue omisión y `null`. |
| Creación | No se debe asumir `201` en todos los POST: muchos endpoints legacy devuelven `200`. Los que usan `Created*` devuelven `201` y encabezado `Location`; el listado de respuestas indica cada caso. |
| Eliminación | Algunas operaciones devuelven `200 { "ok": true }`; otras `204` sin cuerpo. |
| Rutas tipadas | `{id:int}` y `{idMovimiento:long}` muestran las restricciones de ASP.NET; en la URL real solo se envía el valor. Una ruta que no satisface la restricción no selecciona esa acción. |
| Descargas | Cuerpo binario y `Content-Disposition` con nombre de archivo. El cliente debe tratarlas como archivo/blob. |
| CORS | La política AngularCors permite cualquier origen, encabezado y método. No habilita AllowCredentials para cookies entre orígenes. |
| Fallos del framework | También pueden producirse `404` por ruta inexistente, `405` por verbo no permitido, `413` por límite de transporte y `415` por tipo de contenido incompatible. No usan necesariamente el JSON del middleware de excepciones. |
| Respuestas sin entidad | Un `NotFound()` sin argumento se transforma normalmente en `ProblemDetails` por `[ApiController]`. Un `Ok(null)` puede convertirse en `204` por el formateador predeterminado. |

No existe configuración global de paginación, versionado de rutas, idempotency key ni un envoltorio común de éxito. Tampoco se declara una política global que requiera autenticación para todos los controladores.

Fuentes: [Program.cs](../Cobranzas_Vittoria/Program.cs), [SeguridadModule.cs](../Cobranzas_Vittoria/Seguridad/SeguridadModule.cs), [ApiExceptionMiddleware.cs](../Cobranzas_Vittoria/Middleware/ApiExceptionMiddleware.cs).

<a id="seguridad"></a>
## Autenticación y permisos

Enviar `Authorization: Bearer <access_token>`. También se acepta la cookie `access_token`: si tiene valor, el evento JWT la utiliza con prioridad sobre el encabezado. Los endpoints de login/refresh devuelven los tokens en JSON; sus acciones no crean esa cookie.

El servidor valida emisor, audiencia, firma y vigencia del JWT. La expiración depende de `Jwt:ExpireMinutes`; la vigencia del refresh depende de `Jwt:RefreshExpireDays`. Los valores por defecto del tipo de opciones son 60 minutos y 7 días, respectivamente, pero la configuración del despliegue puede modificarlos.

Login busca por usuario de acceso y luego por correo. Rechaza usuarios ausentes, inactivos o contraseñas inválidas con `401 CREDENCIALES_INVALIDAS`. Refresh valida el token y al usuario, emite un nuevo par de tokens y revoca el refresh anterior. Logout recibe el refresh en el cuerpo y lo revoca si existe y está activo; devuelve `204` incluso si no encuentra un refresh activo. No hay revocación inmediata del access token JWT en logout.

Los roles activos aportan claims de rol y los permisos activos de esos roles aportan claims `permission`, sin duplicados. `[AuthorizePermission("recurso.accion")]` exige sesión autenticada y el claim con ese valor, comparado sin distinguir mayúsculas. Varios atributos de permiso sobre una acción se acumulan: se requieren **todos**. El rol Administrador no tiene una excepción automática en el handler de autorización: debe aportar los permisos necesarios.

| Marcación en el catálogo | Requisito |
|---|---|
| Público | No hay atributo de autorización en la acción/controlador, o existe `AllowAnonymous`. |
| JWT | Requiere usuario autenticado; no declara un permiso ni un rol adicional. |
| JWT + código de permiso | Requiere autenticación y cada uno de los permisos listados. |

Usuarios, roles y permisos de Seguridad solo tienen `[Authorize]`; el código no exige el rol Administrador para administrarlos. Maestros legacy, compras, órdenes de compra, valorizaciones, Kardex e importaciones genéricas no declaran autorización. Requerimientos, edición de sus ítems, gastos directos y Control Presupuestario sí tienen los requisitos que figuran por endpoint. Esto describe las restricciones actuales, sin inferirlas a partir del nombre del módulo.

Una petición protegida sin credenciales válidas recibe `401` del esquema JWT; una sesión válida sin los permisos recibe `403`. No hay handlers personalizados que impongan un sobre JSON en esas respuestas. No confundirlas con el `401` de `AutenticacionException`, que sí usa el sobre del middleware.

Fuentes: [autorización](../Cobranzas_Vittoria/Seguridad/Authorization/), [JwtService.cs](../Cobranzas_Vittoria/Seguridad/Infrastructure/Services/JwtService.cs), [autenticación](../Cobranzas_Vittoria/Seguridad/Application/Auth/).


### Catálogo de permisos declarados

| Permiso | Uso HTTP |
|---|---|
| `control_presupuestario.centro_costo.actualizar` | 1 operación(es) |
| `control_presupuestario.centro_costo.crear` | 3 operación(es) |
| `control_presupuestario.centro_costo.ver` | 2 operación(es) |
| `control_presupuestario.movimiento.ver` | 2 operación(es) |
| `control_presupuestario.partida.actualizar` | 1 operación(es) |
| `control_presupuestario.partida.crear` | 4 operación(es) |
| `control_presupuestario.partida.ver` | 2 operación(es) |
| `control_presupuestario.presupuesto.actualizar` | 1 operación(es) |
| `control_presupuestario.presupuesto.crear` | 1 operación(es) |
| `control_presupuestario.presupuesto.editar_detalle` | 8 operación(es) |
| `control_presupuestario.presupuesto.registrar_ajuste` | 1 operación(es) |
| `control_presupuestario.presupuesto.ver` | 6 operación(es) |
| `control_presupuestario.reporte.ver` | 9 operación(es) |
| `control_presupuestario.version.anular` | 1 operación(es) |
| `control_presupuestario.version.aprobar` | 1 operación(es) |
| `control_presupuestario.version.crear` | 1 operación(es) |
| `gasto_directo.operar` | 7 operación(es) |
| `gasto_directo.ver` | 8 operación(es) |
| `requerimientos.aprobar` | 1 operación(es) |
| `requerimientos.crear` | 1 operación(es) |
| `requerimientos.editar_borrador` | 1 operación(es) |
| `requerimientos.enviar` | 1 operación(es) |
| `requerimientos.enviar_compras` | 1 operación(es) |
| `requerimientos.gestionar_items_almacen` | 3 operación(es) |
| `requerimientos.procesar_stock` | 1 operación(es) |
| `requerimientos.rechazar` | 1 operación(es) |
| `requerimientos.ver` | 2 operación(es) |

<a id="endpoints"></a>
## Inventario y detalle de endpoints

**167 operaciones HTTP en 27 controladores.** Los parámetros de servicios inyectados y CancellationToken no forman parte del contrato HTTP. Los errores indicados por familia son condicionales: no implican que cada lectura ejecute todas sus validaciones.

| Grupo | Operaciones |
|---|---|
| [Seguridad: autenticación](#grupo-seguridad-autenticaci-n) | 3 |
| [Seguridad: usuarios](#grupo-seguridad-usuarios) | 6 |
| [Seguridad: roles](#grupo-seguridad-roles) | 7 |
| [Seguridad: permisos](#grupo-seguridad-permisos) | 5 |
| [Maestros](#grupo-maestros) | 32 |
| [Servicios externos](#grupo-servicios-externos) | 1 |
| [Compras: requerimientos](#grupo-compras-requerimientos) | 9 |
| [Compras: ítems de requerimiento](#grupo-compras-tems-de-requerimiento) | 3 |
| [Compras: órdenes de compra](#grupo-compras-rdenes-de-compra) | 5 |
| [Compras: compras y documentos](#grupo-compras-compras-y-documentos) | 8 |
| [Almacén: Kardex manual](#grupo-almac-n-kardex-manual) | 10 |
| [Almacén: Kardex legacy](#grupo-almac-n-kardex-legacy) | 2 |
| [Contable: gastos directos](#grupo-contable-gastos-directos) | 15 |
| [Contable: valorizaciones](#grupo-contable-valorizaciones) | 11 |
| [Importación genérica](#grupo-importaci-n-gen-rica) | 2 |
| [Control Presupuestario: catálogos auxiliares](#grupo-control-presupuestario-cat-logos-auxiliares) | 5 |
| [Control Presupuestario: centros de costo](#grupo-control-presupuestario-centros-de-costo) | 6 |
| [Control Presupuestario: catálogo de partidas](#grupo-control-presupuestario-cat-logo-de-partidas) | 6 |
| [Control Presupuestario: presupuestos, versiones y movimientos](#grupo-control-presupuestario-presupuestos-versiones-y-movimientos) | 22 |
| [Control Presupuestario: consultas](#grupo-control-presupuestario-consultas) | 9 |

<a id="grupo-seguridad-autenticaci-n"></a>
### Seguridad: autenticación

| Método | Ruta | Acceso |
|---|---|---|
| POST | [`/api/seguridad/auth/login`](#endpoint-authcontroller-login) | Público |
| POST | [`/api/seguridad/auth/logout`](#endpoint-authcontroller-logout) | Público |
| POST | [`/api/seguridad/auth/refresh`](#endpoint-authcontroller-refresh) | Público |

<a id="endpoint-authcontroller-login"></a>
#### POST `/api/seguridad/auth/login`

**Acceso:** Público. **Acción:** `AuthController.Login`.

Credenciales inválidas o usuario inactivo: 401 CREDENCIALES_INVALIDAS. Respuesta con access token y refresh token; no se emiten cookies en esta acción.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `request` | cuerpo JSON | [LoginRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-loginrequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [LoginResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-loginresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: CREDENCIALES_INVALIDAS. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [AuthController.cs, acción Login](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/AuthController.cs).

<a id="endpoint-authcontroller-logout"></a>
#### POST `/api/seguridad/auth/logout`

**Acceso:** Público. **Acción:** `AuthController.Logout`.

Revoca el refresh activo si lo encuentra. No revoca inmediatamente el access token JWT.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `request` | cuerpo JSON | [RefreshRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-refreshrequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 204 | sin cuerpo |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [AuthController.cs, acción Logout](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/AuthController.cs).

<a id="endpoint-authcontroller-refresh"></a>
#### POST `/api/seguridad/auth/refresh`

**Acceso:** Público. **Acción:** `AuthController.Refresh`.

Rota el refresh token. Un refresh ausente en BD, vencido, revocado o de usuario inactivo produce 401 CREDENCIALES_INVALIDAS.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `request` | cuerpo JSON | [RefreshRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-refreshrequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [LoginResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-loginresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: CREDENCIALES_INVALIDAS. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [AuthController.cs, acción Refresh](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/AuthController.cs).

<a id="grupo-seguridad-usuarios"></a>
### Seguridad: usuarios

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/seguridad/usuarios/{idUsuario}`](#endpoint-usuariocontroller-getbyid) | JWT |
| GET | [`/api/seguridad/usuarios`](#endpoint-usuariocontroller-getall) | JWT |
| POST | [`/api/seguridad/usuarios`](#endpoint-usuariocontroller-add) | JWT |
| PUT | [`/api/seguridad/usuarios/{idUsuario}`](#endpoint-usuariocontroller-update) | JWT |
| POST | [`/api/seguridad/usuarios/{idUsuario}/roles`](#endpoint-usuariocontroller-asignarroles) | JWT |
| DELETE | [`/api/seguridad/usuarios/{idUsuario}/roles/{idRol}`](#endpoint-usuariocontroller-quitarrol) | JWT |

<a id="endpoint-usuariocontroller-getbyid"></a>
#### GET `/api/seguridad/usuarios/{idUsuario}`

**Acceso:** JWT. **Acción:** `UsuarioController.GetById`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idUsuario` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [UsuarioResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-usuarioresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [UsuarioController.cs, acción GetById](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/UsuarioController.cs).

<a id="endpoint-usuariocontroller-getall"></a>
#### GET `/api/seguridad/usuarios`

**Acceso:** JWT. **Acción:** `UsuarioController.GetAll`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Omitido/null → true (aplicado por la acción) |

| HTTP | Cuerpo |
|---|---|
| 200 | [ListarUsuarioResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-listarusuarioresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [UsuarioController.cs, acción GetAll](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/UsuarioController.cs).

<a id="endpoint-usuariocontroller-add"></a>
#### POST `/api/seguridad/usuarios`

**Acceso:** JWT. **Acción:** `UsuarioController.Add`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `request` | cuerpo JSON | [CreateUsuarioRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-createusuariorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 201 | [UsuarioResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-usuarioresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [UsuarioController.cs, acción Add](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/UsuarioController.cs).

<a id="endpoint-usuariocontroller-update"></a>
#### PUT `/api/seguridad/usuarios/{idUsuario}`

**Acceso:** JWT. **Acción:** `UsuarioController.Update`.

Actualización parcial. El campo se llama passwordHash y el handler lo asigna como hash existente; no es el campo password del alta ni se vuelve a hashear aquí.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idUsuario` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [UpdateUsuarioRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-updateusuariorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 204 | sin cuerpo |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [UsuarioController.cs, acción Update](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/UsuarioController.cs).

<a id="endpoint-usuariocontroller-asignarroles"></a>
#### POST `/api/seguridad/usuarios/{idUsuario}/roles`

**Acceso:** JWT. **Acción:** `UsuarioController.AsignarRoles`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idUsuario` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [AsignarRolesRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-asignarrolesrequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 204 | sin cuerpo |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [UsuarioController.cs, acción AsignarRoles](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/UsuarioController.cs).

<a id="endpoint-usuariocontroller-quitarrol"></a>
#### DELETE `/api/seguridad/usuarios/{idUsuario}/roles/{idRol}`

**Acceso:** JWT. **Acción:** `UsuarioController.QuitarRol`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idUsuario` | ruta | int | Segmento obligatorio |
| `idRol` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 204 | sin cuerpo |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [UsuarioController.cs, acción QuitarRol](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/UsuarioController.cs).

<a id="grupo-seguridad-roles"></a>
### Seguridad: roles

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/seguridad/roles/{idRol}`](#endpoint-rolcontroller-getbyid) | JWT |
| GET | [`/api/seguridad/roles/{idRol}/permisos`](#endpoint-rolcontroller-getbyidconpermisos) | JWT |
| GET | [`/api/seguridad/roles`](#endpoint-rolcontroller-getall) | JWT |
| POST | [`/api/seguridad/roles`](#endpoint-rolcontroller-add) | JWT |
| PUT | [`/api/seguridad/roles/{idRol}`](#endpoint-rolcontroller-update) | JWT |
| POST | [`/api/seguridad/roles/{idRol}/permisos`](#endpoint-rolcontroller-asignarpermisos) | JWT |
| DELETE | [`/api/seguridad/roles/{idRol}/permisos/{idPermiso}`](#endpoint-rolcontroller-quitarpermiso) | JWT |

<a id="endpoint-rolcontroller-getbyid"></a>
#### GET `/api/seguridad/roles/{idRol}`

**Acceso:** JWT. **Acción:** `RolController.GetById`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idRol` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [RolResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-rolresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RolController.cs, acción GetById](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/RolController.cs).

<a id="endpoint-rolcontroller-getbyidconpermisos"></a>
#### GET `/api/seguridad/roles/{idRol}/permisos`

**Acceso:** JWT. **Acción:** `RolController.GetByIdConPermisos`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idRol` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [RolConPermisosResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-rolconpermisosresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RolController.cs, acción GetByIdConPermisos](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/RolController.cs).

<a id="endpoint-rolcontroller-getall"></a>
#### GET `/api/seguridad/roles`

**Acceso:** JWT. **Acción:** `RolController.GetAll`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Omitido/null → true (aplicado por la acción) |

| HTTP | Cuerpo |
|---|---|
| 200 | [ListarRolResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-listarrolresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RolController.cs, acción GetAll](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/RolController.cs).

<a id="endpoint-rolcontroller-add"></a>
#### POST `/api/seguridad/roles`

**Acceso:** JWT. **Acción:** `RolController.Add`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `request` | cuerpo JSON | [CreateRolRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-createrolrequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 201 | [RolResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-rolresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RolController.cs, acción Add](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/RolController.cs).

<a id="endpoint-rolcontroller-update"></a>
#### PUT `/api/seguridad/roles/{idRol}`

**Acceso:** JWT. **Acción:** `RolController.Update`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idRol` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [UpdateRolRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-updaterolrequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 204 | sin cuerpo |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RolController.cs, acción Update](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/RolController.cs).

<a id="endpoint-rolcontroller-asignarpermisos"></a>
#### POST `/api/seguridad/roles/{idRol}/permisos`

**Acceso:** JWT. **Acción:** `RolController.AsignarPermisos`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idRol` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [AsignarPermisosRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-asignarpermisosrequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 204 | sin cuerpo |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RolController.cs, acción AsignarPermisos](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/RolController.cs).

<a id="endpoint-rolcontroller-quitarpermiso"></a>
#### DELETE `/api/seguridad/roles/{idRol}/permisos/{idPermiso}`

**Acceso:** JWT. **Acción:** `RolController.QuitarPermiso`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idRol` | ruta | int | Segmento obligatorio |
| `idPermiso` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 204 | sin cuerpo |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RolController.cs, acción QuitarPermiso](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/RolController.cs).

<a id="grupo-seguridad-permisos"></a>
### Seguridad: permisos

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/seguridad/permisos/{idPermiso}`](#endpoint-permisocontroller-getbyid) | JWT |
| GET | [`/api/seguridad/permisos`](#endpoint-permisocontroller-getall) | JWT |
| PUT | [`/api/seguridad/permisos/{idPermiso}`](#endpoint-permisocontroller-update) | JWT |
| PATCH | [`/api/seguridad/permisos/{idPermiso}/enable`](#endpoint-permisocontroller-enable) | JWT |
| PATCH | [`/api/seguridad/permisos/{idPermiso}/disable`](#endpoint-permisocontroller-disable) | JWT |

<a id="endpoint-permisocontroller-getbyid"></a>
#### GET `/api/seguridad/permisos/{idPermiso}`

**Acceso:** JWT. **Acción:** `PermisoController.GetById`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idPermiso` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [PermisoResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-permisoresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PermisoController.cs, acción GetById](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/PermisoController.cs).

<a id="endpoint-permisocontroller-getall"></a>
#### GET `/api/seguridad/permisos`

**Acceso:** JWT. **Acción:** `PermisoController.GetAll`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Omitido/null → true (aplicado por la acción) |

| HTTP | Cuerpo |
|---|---|
| 200 | [ListarPermisoResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-listarpermisoresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PermisoController.cs, acción GetAll](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/PermisoController.cs).

<a id="endpoint-permisocontroller-update"></a>
#### PUT `/api/seguridad/permisos/{idPermiso}`

**Acceso:** JWT. **Acción:** `PermisoController.Update`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idPermiso` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [UpdatePermisoRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-updatepermisorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 204 | sin cuerpo |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PermisoController.cs, acción Update](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/PermisoController.cs).

<a id="endpoint-permisocontroller-enable"></a>
#### PATCH `/api/seguridad/permisos/{idPermiso}/enable`

**Acceso:** JWT. **Acción:** `PermisoController.Enable`.

**Sin implementar:** la acción lanza `NotImplementedException`; con autenticación válida devuelve `500 UNHANDLED_ERROR`. No tiene respuesta funcional de éxito.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idPermiso` | ruta | int | Segmento obligatorio |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PermisoController.cs, acción Enable](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/PermisoController.cs).

<a id="endpoint-permisocontroller-disable"></a>
#### PATCH `/api/seguridad/permisos/{idPermiso}/disable`

**Acceso:** JWT. **Acción:** `PermisoController.Disable`.

**Sin implementar:** la acción lanza `NotImplementedException`; con autenticación válida devuelve `500 UNHANDLED_ERROR`. No tiene respuesta funcional de éxito.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idPermiso` | ruta | int | Segmento obligatorio |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Seguridad; 404 cuando se lanza KeyNotFoundException. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PermisoController.cs, acción Disable](../Cobranzas_Vittoria/Seguridad/Presentation/Controller/PermisoController.cs).

<a id="grupo-maestros"></a>
### Maestros

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/maestra/categorias-gasto`](#endpoint-categoriasgastocontroller-list) | Público |
| POST | [`/api/maestra/categorias-gasto`](#endpoint-categoriasgastocontroller-create) | Público |
| PUT | [`/api/maestra/categorias-gasto/{categoriaId:int}`](#endpoint-categoriasgastocontroller-update) | Público |
| DELETE | [`/api/maestra/categorias-gasto/{categoriaId:int}`](#endpoint-categoriasgastocontroller-delete) | Público |
| GET | [`/api/maestra/especialidades`](#endpoint-especialidadescontroller-list) | Público |
| POST | [`/api/maestra/especialidades`](#endpoint-especialidadescontroller-upsert) | Público |
| PUT | [`/api/maestra/especialidades/{id:int}`](#endpoint-especialidadescontroller-update) | Público |
| GET | [`/api/maestra/materiales`](#endpoint-materialescontroller-list) | Público |
| GET | [`/api/maestra/materiales/siguiente-codigo`](#endpoint-materialescontroller-siguientecodigo) | Público |
| GET | [`/api/maestra/materiales/{id:int}`](#endpoint-materialescontroller-get) | Público |
| POST | [`/api/maestra/materiales`](#endpoint-materialescontroller-upsert) | Público |
| PUT | [`/api/maestra/materiales/{id:int}`](#endpoint-materialescontroller-update) | Público |
| GET | [`/api/maestra/proveedores`](#endpoint-proveedorescontroller-list) | Público |
| GET | [`/api/maestra/proveedores/{id:int}`](#endpoint-proveedorescontroller-get) | Público |
| GET | [`/api/maestra/proveedores/consulta-ruc/{ruc}`](#endpoint-proveedorescontroller-getporruc) | Público |
| POST | [`/api/maestra/proveedores`](#endpoint-proveedorescontroller-upsert) | Público |
| PUT | [`/api/maestra/proveedores/{id:int}`](#endpoint-proveedorescontroller-update) | Público |
| POST | [`/api/maestra/proveedores/{id:int}/especialidades`](#endpoint-proveedorescontroller-setespecialidad) | Público |
| GET | [`/api/maestra/proveedores-gasto`](#endpoint-proveedoresgastocontroller-list) | Público |
| POST | [`/api/maestra/proveedores-gasto`](#endpoint-proveedoresgastocontroller-create) | Público |
| PUT | [`/api/maestra/proveedores-gasto/{proveedorGastoId:int}`](#endpoint-proveedoresgastocontroller-update) | Público |
| DELETE | [`/api/maestra/proveedores-gasto/{proveedorGastoId:int}`](#endpoint-proveedoresgastocontroller-delete) | Público |
| GET | [`/api/maestra/proveedores-terreno`](#endpoint-proveedoresterrenocontroller-list) | Público |
| POST | [`/api/maestra/proveedores-terreno`](#endpoint-proveedoresterrenocontroller-create) | Público |
| PUT | [`/api/maestra/proveedores-terreno/{proveedorId:int}`](#endpoint-proveedoresterrenocontroller-update) | Público |
| DELETE | [`/api/maestra/proveedores-terreno/{proveedorId:int}`](#endpoint-proveedoresterrenocontroller-delete) | Público |
| GET | [`/api/maestra/proyectos`](#endpoint-proyectoscontroller-list) | Público |
| POST | [`/api/maestra/proyectos`](#endpoint-proyectoscontroller-create) | Público |
| PUT | [`/api/maestra/proyectos/{id:int}`](#endpoint-proyectoscontroller-update) | Público |
| GET | [`/api/maestra/unidades-medida`](#endpoint-unidadmedidacontroller-list) | Público |
| POST | [`/api/maestra/unidades-medida`](#endpoint-unidadmedidacontroller-create) | Público |
| PUT | [`/api/maestra/unidades-medida/{unidadId:int}`](#endpoint-unidadmedidacontroller-update) | Público |

<a id="endpoint-categoriasgastocontroller-list"></a>
#### GET `/api/maestra/categorias-gasto`

**Acceso:** Público. **Acción:** `CategoriasGastoController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [CategoriaGasto](#schema-cobranzas-vittoria-entities-categoriagasto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CategoriasGastoController.cs, acción List](../Cobranzas_Vittoria/Controllers/CategoriasGastoController.cs).

<a id="endpoint-categoriasgastocontroller-create"></a>
#### POST `/api/maestra/categorias-gasto`

**Acceso:** Público. **Acción:** `CategoriasGastoController.Create`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [CategoriaGastoUpsertDto](#schema-cobranzas-vittoria-dtos-gastosadministrativos-categoriagastoupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idCategoriaGasto: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CategoriasGastoController.cs, acción Create](../Cobranzas_Vittoria/Controllers/CategoriasGastoController.cs).

<a id="endpoint-categoriasgastocontroller-update"></a>
#### PUT `/api/maestra/categorias-gasto/{categoriaId:int}`

**Acceso:** Público. **Acción:** `CategoriasGastoController.Update`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `categoriaId` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [CategoriaGastoUpsertDto](#schema-cobranzas-vittoria-dtos-gastosadministrativos-categoriagastoupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idCategoriaGasto: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CategoriasGastoController.cs, acción Update](../Cobranzas_Vittoria/Controllers/CategoriasGastoController.cs).

<a id="endpoint-categoriasgastocontroller-delete"></a>
#### DELETE `/api/maestra/categorias-gasto/{categoriaId:int}`

**Acceso:** Público. **Acción:** `CategoriasGastoController.Delete`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `categoriaId` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CategoriasGastoController.cs, acción Delete](../Cobranzas_Vittoria/Controllers/CategoriasGastoController.cs).

<a id="endpoint-especialidadescontroller-list"></a>
#### GET `/api/maestra/especialidades`

**Acceso:** Público. **Acción:** `EspecialidadesController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [Especialidad](#schema-cobranzas-vittoria-entities-especialidad)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [EspecialidadesController.cs, acción List](../Cobranzas_Vittoria/Controllers/EspecialidadesController.cs).

<a id="endpoint-especialidadescontroller-upsert"></a>
#### POST `/api/maestra/especialidades`

**Acceso:** Público. **Acción:** `EspecialidadesController.Upsert`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [EspecialidadUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-especialidadupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idEspecialidad: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [EspecialidadesController.cs, acción Upsert](../Cobranzas_Vittoria/Controllers/EspecialidadesController.cs).

<a id="endpoint-especialidadescontroller-update"></a>
#### PUT `/api/maestra/especialidades/{id:int}`

**Acceso:** Público. **Acción:** `EspecialidadesController.Update`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [EspecialidadUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-especialidadupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idEspecialidad: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [EspecialidadesController.cs, acción Update](../Cobranzas_Vittoria/Controllers/EspecialidadesController.cs).

<a id="endpoint-materialescontroller-list"></a>
#### GET `/api/maestra/materiales`

**Acceso:** Público. **Acción:** `MaterialesController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Admite null / omisión según binding |
| `idEspecialidad` | query | int? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [Material](#schema-cobranzas-vittoria-entities-material)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [MaterialesController.cs, acción List](../Cobranzas_Vittoria/Controllers/MaterialesController.cs).

<a id="endpoint-materialescontroller-siguientecodigo"></a>
#### GET `/api/maestra/materiales/siguiente-codigo`

**Acceso:** Público. **Acción:** `MaterialesController.SiguienteCodigo`.

**Entrada:** sin parámetros HTTP ni cuerpo.

| HTTP | Cuerpo |
|---|---|
| 200 | { codigo: string } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [MaterialesController.cs, acción SiguienteCodigo](../Cobranzas_Vittoria/Controllers/MaterialesController.cs).

<a id="endpoint-materialescontroller-get"></a>
#### GET `/api/maestra/materiales/{id:int}`

**Acceso:** Público. **Acción:** `MaterialesController.Get`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 404 | ProblemDetails (NotFound sin payload; filtro de ApiController) |
| 200 | [Material](#schema-cobranzas-vittoria-entities-material) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [MaterialesController.cs, acción Get](../Cobranzas_Vittoria/Controllers/MaterialesController.cs).

<a id="endpoint-materialescontroller-upsert"></a>
#### POST `/api/maestra/materiales`

**Acceso:** Público. **Acción:** `MaterialesController.Upsert`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [MaterialUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-materialupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idMaterial: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [MaterialesController.cs, acción Upsert](../Cobranzas_Vittoria/Controllers/MaterialesController.cs).

<a id="endpoint-materialescontroller-update"></a>
#### PUT `/api/maestra/materiales/{id:int}`

**Acceso:** Público. **Acción:** `MaterialesController.Update`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [MaterialUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-materialupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idMaterial: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [MaterialesController.cs, acción Update](../Cobranzas_Vittoria/Controllers/MaterialesController.cs).

<a id="endpoint-proveedorescontroller-list"></a>
#### GET `/api/maestra/proveedores`

**Acceso:** Público. **Acción:** `ProveedoresController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Admite null / omisión según binding |
| `idEspecialidad` | query | int? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [Proveedor](#schema-cobranzas-vittoria-entities-proveedor)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresController.cs, acción List](../Cobranzas_Vittoria/Controllers/ProveedoresController.cs).

<a id="endpoint-proveedorescontroller-get"></a>
#### GET `/api/maestra/proveedores/{id:int}`

**Acceso:** Público. **Acción:** `ProveedoresController.Get`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 404 | ProblemDetails (NotFound sin payload; filtro de ApiController) |
| 200 | [Proveedores_GetResponse](#schema-adicional-proveedores-getresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresController.cs, acción Get](../Cobranzas_Vittoria/Controllers/ProveedoresController.cs).

<a id="endpoint-proveedorescontroller-getporruc"></a>
#### GET `/api/maestra/proveedores/consulta-ruc/{ruc}`

**Acceso:** Público. **Acción:** `ProveedoresController.GetPorRuc`.

El RUC debe tener 11 caracteres. Los errores directos 400/404 de esta acción son texto.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `ruc` | ruta | string | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 400 | string; texto: `"El RUC debe tener 11 digitos."` |
| 404 | string; texto: `"No se encontraron datos para el RUC ingresado."` |
| 200 | [ProveedorConsultaSunatDto](#schema-cobranzas-vittoria-dtos-maestra-proveedorconsultasunatdto) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresController.cs, acción GetPorRuc](../Cobranzas_Vittoria/Controllers/ProveedoresController.cs).

<a id="endpoint-proveedorescontroller-upsert"></a>
#### POST `/api/maestra/proveedores`

**Acceso:** Público. **Acción:** `ProveedoresController.Upsert`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [ProveedorUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-proveedorupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idProveedor: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresController.cs, acción Upsert](../Cobranzas_Vittoria/Controllers/ProveedoresController.cs).

<a id="endpoint-proveedorescontroller-update"></a>
#### PUT `/api/maestra/proveedores/{id:int}`

**Acceso:** Público. **Acción:** `ProveedoresController.Update`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [ProveedorUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-proveedorupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idProveedor: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresController.cs, acción Update](../Cobranzas_Vittoria/Controllers/ProveedoresController.cs).

<a id="endpoint-proveedorescontroller-setespecialidad"></a>
#### POST `/api/maestra/proveedores/{id:int}/especialidades`

**Acceso:** Público. **Acción:** `ProveedoresController.SetEspecialidad`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [ProveedorEspecialidadDto](#schema-cobranzas-vittoria-dtos-maestra-proveedorespecialidaddto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresController.cs, acción SetEspecialidad](../Cobranzas_Vittoria/Controllers/ProveedoresController.cs).

<a id="endpoint-proveedoresgastocontroller-list"></a>
#### GET `/api/maestra/proveedores-gasto`

**Acceso:** Público. **Acción:** `ProveedoresGastoController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Admite null / omisión según binding |
| `idCategoriaGasto` | query | int? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [ProveedorGastoAdministrativo](#schema-cobranzas-vittoria-entities-proveedorgastoadministrativo)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresGastoController.cs, acción List](../Cobranzas_Vittoria/Controllers/ProveedoresGastoController.cs).

<a id="endpoint-proveedoresgastocontroller-create"></a>
#### POST `/api/maestra/proveedores-gasto`

**Acceso:** Público. **Acción:** `ProveedoresGastoController.Create`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [ProveedorGastoAdministrativoUpsertDto](#schema-cobranzas-vittoria-dtos-gastosadministrativos-proveedorgastoadministrativoupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idProveedorGastoAdministrativo: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresGastoController.cs, acción Create](../Cobranzas_Vittoria/Controllers/ProveedoresGastoController.cs).

<a id="endpoint-proveedoresgastocontroller-update"></a>
#### PUT `/api/maestra/proveedores-gasto/{proveedorGastoId:int}`

**Acceso:** Público. **Acción:** `ProveedoresGastoController.Update`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `proveedorGastoId` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [ProveedorGastoAdministrativoUpsertDto](#schema-cobranzas-vittoria-dtos-gastosadministrativos-proveedorgastoadministrativoupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idProveedorGastoAdministrativo: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresGastoController.cs, acción Update](../Cobranzas_Vittoria/Controllers/ProveedoresGastoController.cs).

<a id="endpoint-proveedoresgastocontroller-delete"></a>
#### DELETE `/api/maestra/proveedores-gasto/{proveedorGastoId:int}`

**Acceso:** Público. **Acción:** `ProveedoresGastoController.Delete`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `proveedorGastoId` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresGastoController.cs, acción Delete](../Cobranzas_Vittoria/Controllers/ProveedoresGastoController.cs).

<a id="endpoint-proveedoresterrenocontroller-list"></a>
#### GET `/api/maestra/proveedores-terreno`

**Acceso:** Público. **Acción:** `ProveedoresTerrenoController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [ProveedorTerreno](#schema-cobranzas-vittoria-entities-proveedorterreno)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresTerrenoController.cs, acción List](../Cobranzas_Vittoria/Controllers/ProveedoresTerrenoController.cs).

<a id="endpoint-proveedoresterrenocontroller-create"></a>
#### POST `/api/maestra/proveedores-terreno`

**Acceso:** Público. **Acción:** `ProveedoresTerrenoController.Create`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [ProveedorTerrenoUpsertDto](#schema-cobranzas-vittoria-dtos-contable-proveedorterrenoupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idProveedorTerreno: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresTerrenoController.cs, acción Create](../Cobranzas_Vittoria/Controllers/ProveedoresTerrenoController.cs).

<a id="endpoint-proveedoresterrenocontroller-update"></a>
#### PUT `/api/maestra/proveedores-terreno/{proveedorId:int}`

**Acceso:** Público. **Acción:** `ProveedoresTerrenoController.Update`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `proveedorId` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [ProveedorTerrenoUpsertDto](#schema-cobranzas-vittoria-dtos-contable-proveedorterrenoupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idProveedorTerreno: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresTerrenoController.cs, acción Update](../Cobranzas_Vittoria/Controllers/ProveedoresTerrenoController.cs).

<a id="endpoint-proveedoresterrenocontroller-delete"></a>
#### DELETE `/api/maestra/proveedores-terreno/{proveedorId:int}`

**Acceso:** Público. **Acción:** `ProveedoresTerrenoController.Delete`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `proveedorId` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProveedoresTerrenoController.cs, acción Delete](../Cobranzas_Vittoria/Controllers/ProveedoresTerrenoController.cs).

<a id="endpoint-proyectoscontroller-list"></a>
#### GET `/api/maestra/proyectos`

**Acceso:** Público. **Acción:** `ProyectosController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [Proyecto](#schema-cobranzas-vittoria-entities-proyecto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProyectosController.cs, acción List](../Cobranzas_Vittoria/Controllers/ProyectosController.cs).

<a id="endpoint-proyectoscontroller-create"></a>
#### POST `/api/maestra/proyectos`

**Acceso:** Público. **Acción:** `ProyectosController.Create`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [ProyectoUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-proyectoupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idProyecto: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProyectosController.cs, acción Create](../Cobranzas_Vittoria/Controllers/ProyectosController.cs).

<a id="endpoint-proyectoscontroller-update"></a>
#### PUT `/api/maestra/proyectos/{id:int}`

**Acceso:** Público. **Acción:** `ProyectosController.Update`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [ProyectoUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-proyectoupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idProyecto: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ProyectosController.cs, acción Update](../Cobranzas_Vittoria/Controllers/ProyectosController.cs).

<a id="endpoint-unidadmedidacontroller-list"></a>
#### GET `/api/maestra/unidades-medida`

**Acceso:** Público. **Acción:** `UnidadMedidaController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [UnidadMedidaDto](#schema-cobranzas-vittoria-dtos-maestra-unidadmedidadto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [UnidadMedidaController.cs, acción List](../Cobranzas_Vittoria/Controllers/UnidadMedidaController.cs).

<a id="endpoint-unidadmedidacontroller-create"></a>
#### POST `/api/maestra/unidades-medida`

**Acceso:** Público. **Acción:** `UnidadMedidaController.Create`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [UnidadMedidaUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-unidadmedidaupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idUnidadMedida: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [UnidadMedidaController.cs, acción Create](../Cobranzas_Vittoria/Controllers/UnidadMedidaController.cs).

<a id="endpoint-unidadmedidacontroller-update"></a>
#### PUT `/api/maestra/unidades-medida/{unidadId:int}`

**Acceso:** Público. **Acción:** `UnidadMedidaController.Update`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `unidadId` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [UnidadMedidaUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-unidadmedidaupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idUnidadMedida: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [UnidadMedidaController.cs, acción Update](../Cobranzas_Vittoria/Controllers/UnidadMedidaController.cs).

<a id="grupo-servicios-externos"></a>
### Servicios externos

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/tipo-cambio`](#endpoint-tipocambiocontroller-gettipocambio) | Público |

<a id="endpoint-tipocambiocontroller-gettipocambio"></a>
#### GET `/api/tipo-cambio`

**Acceso:** Público. **Acción:** `TipoCambioController.GetTipoCambio`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `fecha` | query | string? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [TipoCambioResponseDto](#schema-cobranzas-vittoria-dtos-sunat-tipocambioresponsedto) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [TipoCambioController.cs, acción GetTipoCambio](../Cobranzas_Vittoria/Controllers/TipoCambioController.cs).

<a id="grupo-compras-requerimientos"></a>
### Compras: requerimientos

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/compras/requerimientos`](#endpoint-requerimientoscontroller-list) | JWT + `requerimientos.ver` |
| GET | [`/api/compras/requerimientos/{id:int}`](#endpoint-requerimientoscontroller-get) | JWT + `requerimientos.ver` |
| POST | [`/api/compras/requerimientos`](#endpoint-requerimientoscontroller-crear) | JWT + `requerimientos.crear` |
| PUT | [`/api/compras/requerimientos/{id:int}`](#endpoint-requerimientoscontroller-update) | JWT + `requerimientos.editar_borrador` |
| POST | [`/api/compras/requerimientos/{id:int}/enviar`](#endpoint-requerimientoscontroller-enviar) | JWT + `requerimientos.enviar` |
| POST | [`/api/compras/requerimientos/{id:int}/validacion-almacen`](#endpoint-requerimientoscontroller-procesarstock) | JWT + `requerimientos.procesar_stock` |
| POST | [`/api/compras/requerimientos/{id:int}/aprobar`](#endpoint-requerimientoscontroller-aprobar) | JWT + `requerimientos.aprobar` |
| POST | [`/api/compras/requerimientos/{id:int}/rechazar`](#endpoint-requerimientoscontroller-rechazar) | JWT + `requerimientos.rechazar` |
| POST | [`/api/compras/requerimientos/{id:int}/enviar-compras`](#endpoint-requerimientoscontroller-enviarcompras) | JWT + `requerimientos.enviar_compras` |

<a id="endpoint-requerimientoscontroller-list"></a>
#### GET `/api/compras/requerimientos`

**Acceso:** JWT + `requerimientos.ver`. **Acción:** `RequerimientosController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `estado` | query | string? | Admite null / omisión según binding |
| `idEspecialidad` | query | int? | Admite null / omisión según binding |
| `idProyecto` | query | int? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [Requerimiento](#schema-cobranzas-vittoria-entities-requerimiento)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Compras / transición inválida; 409: conflicto económico SQL 514xx si aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientosController.cs, acción List](../Cobranzas_Vittoria/Controllers/RequerimientosController.cs).

<a id="endpoint-requerimientoscontroller-get"></a>
#### GET `/api/compras/requerimientos/{id:int}`

**Acceso:** JWT + `requerimientos.ver`. **Acción:** `RequerimientosController.Get`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 404 | ProblemDetails (NotFound sin payload; filtro de ApiController) |
| 200 | [Requerimientos_GetResponse](#schema-adicional-requerimientos-getresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Compras / transición inválida; 409: conflicto económico SQL 514xx si aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientosController.cs, acción Get](../Cobranzas_Vittoria/Controllers/RequerimientosController.cs).

<a id="endpoint-requerimientoscontroller-crear"></a>
#### POST `/api/compras/requerimientos`

**Acceso:** JWT + `requerimientos.crear`. **Acción:** `RequerimientosController.Crear`.

idUsuarioSolicitante del cuerpo se sobrescribe con el usuario autenticado. Respuesta 200, no 201.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [RequerimientoCreateDto](#schema-cobranzas-vittoria-dtos-compras-requerimientocreatedto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idRequerimiento: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Compras / transición inválida; 409: conflicto económico SQL 514xx si aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientosController.cs, acción Crear](../Cobranzas_Vittoria/Controllers/RequerimientosController.cs).

<a id="endpoint-requerimientoscontroller-update"></a>
#### PUT `/api/compras/requerimientos/{id:int}`

**Acceso:** JWT + `requerimientos.editar_borrador`. **Acción:** `RequerimientosController.Update`.

Solo el solicitante puede modificarlo; el controlador sustituye idUsuarioSolicitante por la identidad actual.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [RequerimientoUpdateDto](#schema-cobranzas-vittoria-dtos-compras-requerimientoupdatedto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Compras / transición inválida; 409: conflicto económico SQL 514xx si aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientosController.cs, acción Update](../Cobranzas_Vittoria/Controllers/RequerimientosController.cs).

<a id="endpoint-requerimientoscontroller-enviar"></a>
#### POST `/api/compras/requerimientos/{id:int}/enviar`

**Acceso:** JWT + `requerimientos.enviar`. **Acción:** `RequerimientosController.Enviar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [EnviarRequerimientoRequest](#schema-cobranzas-vittoria-dtos-compras-requerimientos-enviarrequerimientorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Compras / transición inválida; 409: conflicto económico SQL 514xx si aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientosController.cs, acción Enviar](../Cobranzas_Vittoria/Controllers/RequerimientosController.cs).

<a id="endpoint-requerimientoscontroller-procesarstock"></a>
#### POST `/api/compras/requerimientos/{id:int}/validacion-almacen`

**Acceso:** JWT + `requerimientos.procesar_stock`. **Acción:** `RequerimientosController.ProcesarStock`.

resultado admite Conforme u Observado. Ver las transiciones y los errores 422 de Requerimientos.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [ProcesarStockRequerimientoRequest](#schema-cobranzas-vittoria-dtos-compras-requerimientos-procesarstockrequerimientorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Compras / transición inválida; 409: conflicto económico SQL 514xx si aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientosController.cs, acción ProcesarStock](../Cobranzas_Vittoria/Controllers/RequerimientosController.cs).

<a id="endpoint-requerimientoscontroller-aprobar"></a>
#### POST `/api/compras/requerimientos/{id:int}/aprobar`

**Acceso:** JWT + `requerimientos.aprobar`. **Acción:** `RequerimientosController.Aprobar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [AprobarRequerimientoRequest](#schema-cobranzas-vittoria-dtos-compras-requerimientos-aprobarrequerimientorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Compras / transición inválida; 409: conflicto económico SQL 514xx si aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientosController.cs, acción Aprobar](../Cobranzas_Vittoria/Controllers/RequerimientosController.cs).

<a id="endpoint-requerimientoscontroller-rechazar"></a>
#### POST `/api/compras/requerimientos/{id:int}/rechazar`

**Acceso:** JWT + `requerimientos.rechazar`. **Acción:** `RequerimientosController.Rechazar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [RechazarRequerimientoRequest](#schema-cobranzas-vittoria-dtos-compras-requerimientos-rechazarrequerimientorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Compras / transición inválida; 409: conflicto económico SQL 514xx si aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientosController.cs, acción Rechazar](../Cobranzas_Vittoria/Controllers/RequerimientosController.cs).

<a id="endpoint-requerimientoscontroller-enviarcompras"></a>
#### POST `/api/compras/requerimientos/{id:int}/enviar-compras`

**Acceso:** JWT + `requerimientos.enviar_compras`. **Acción:** `RequerimientosController.EnviarCompras`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [EnviarRequerimientoComprasRequest](#schema-cobranzas-vittoria-dtos-compras-requerimientos-enviarrequerimientocomprasrequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 422: validación de Compras / transición inválida; 409: conflicto económico SQL 514xx si aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientosController.cs, acción EnviarCompras](../Cobranzas_Vittoria/Controllers/RequerimientosController.cs).

<a id="grupo-compras-tems-de-requerimiento"></a>
### Compras: ítems de requerimiento

| Método | Ruta | Acceso |
|---|---|---|
| POST | [`/api/compras/requerimientos/{idRequerimiento:int}/items`](#endpoint-requerimientoitemcontroller-agregar) | JWT + `requerimientos.gestionar_items_almacen` |
| PATCH | [`/api/compras/requerimientos/{idRequerimiento:int}/items/{idDetalle:int}`](#endpoint-requerimientoitemcontroller-actualizar) | JWT + `requerimientos.gestionar_items_almacen` |
| DELETE | [`/api/compras/requerimientos/{idRequerimiento:int}/items/{idDetalle:int}`](#endpoint-requerimientoitemcontroller-eliminar) | JWT + `requerimientos.gestionar_items_almacen` |

<a id="endpoint-requerimientoitemcontroller-agregar"></a>
#### POST `/api/compras/requerimientos/{idRequerimiento:int}/items`

**Acceso:** JWT + `requerimientos.gestionar_items_almacen`. **Acción:** `RequerimientoItemController.Agregar`.

Rechaza campos JSON desconocidos. Material fijo al crear. Devuelve 201 con Location.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idRequerimiento` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [AgregarItemRequerimientoRequest](#schema-cobranzas-vittoria-compras-presentation-dto-agregaritemrequerimientorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 201 | [RequerimientoItemResponse](#schema-cobranzas-vittoria-compras-presentation-dto-requerimientoitemresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación de ítem/PATCH; 404: requerimiento/ítem ausente; 409: estado, duplicidad o referencias. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientoItemController.cs, acción Agregar](../Cobranzas_Vittoria/Compras/Presentation/Controller/RequerimientoItemController.cs).

<a id="endpoint-requerimientoitemcontroller-actualizar"></a>
#### PATCH `/api/compras/requerimientos/{idRequerimiento:int}/items/{idDetalle:int}`

**Acceso:** JWT + `requerimientos.gestionar_items_almacen`. **Acción:** `RequerimientoItemController.Actualizar`.

Omisión conserva; null limpia partida/observación. cantidad:null y un objeto sin campos editables se rechazan. Rechaza claves desconocidas.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idRequerimiento` | ruta | int | Segmento obligatorio |
| `idDetalle` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [ActualizarItemRequerimientoRequest](#schema-cobranzas-vittoria-compras-presentation-dto-actualizaritemrequerimientorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [RequerimientoItemResponse](#schema-cobranzas-vittoria-compras-presentation-dto-requerimientoitemresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación de ítem/PATCH; 404: requerimiento/ítem ausente; 409: estado, duplicidad o referencias. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientoItemController.cs, acción Actualizar](../Cobranzas_Vittoria/Compras/Presentation/Controller/RequerimientoItemController.cs).

<a id="endpoint-requerimientoitemcontroller-eliminar"></a>
#### DELETE `/api/compras/requerimientos/{idRequerimiento:int}/items/{idDetalle:int}`

**Acceso:** JWT + `requerimientos.gestionar_items_almacen`. **Acción:** `RequerimientoItemController.Eliminar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idRequerimiento` | ruta | int | Segmento obligatorio |
| `idDetalle` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 204 | sin cuerpo |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación de ítem/PATCH; 404: requerimiento/ítem ausente; 409: estado, duplicidad o referencias. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [RequerimientoItemController.cs, acción Eliminar](../Cobranzas_Vittoria/Compras/Presentation/Controller/RequerimientoItemController.cs).

<a id="grupo-compras-rdenes-de-compra"></a>
### Compras: órdenes de compra

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/compras/ordenes-compra`](#endpoint-ordenescompracontroller-list) | Público |
| GET | [`/api/compras/ordenes-compra/{id:int}`](#endpoint-ordenescompracontroller-get) | Público |
| POST | [`/api/compras/ordenes-compra`](#endpoint-ordenescompracontroller-crear) | Público |
| PUT | [`/api/compras/ordenes-compra/{id:int}`](#endpoint-ordenescompracontroller-update) | Público |
| PATCH | [`/api/compras/ordenes-compra/{id:int}/estado`](#endpoint-ordenescompracontroller-updateestado) | Público |

<a id="endpoint-ordenescompracontroller-list"></a>
#### GET `/api/compras/ordenes-compra`

**Acceso:** Público. **Acción:** `OrdenesCompraController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `estado` | query | string? | Admite null / omisión según binding |
| `idProveedor` | query | int? | Admite null / omisión según binding |
| `idProyecto` | query | int? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [OrdenCompra](#schema-cobranzas-vittoria-entities-ordencompra)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [OrdenesCompraController.cs, acción List](../Cobranzas_Vittoria/Controllers/OrdenesCompraController.cs).

<a id="endpoint-ordenescompracontroller-get"></a>
#### GET `/api/compras/ordenes-compra/{id:int}`

**Acceso:** Público. **Acción:** `OrdenesCompraController.Get`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 404 | ProblemDetails (NotFound sin payload; filtro de ApiController) |
| 200 | [OrdenesCompra_GetResponse](#schema-adicional-ordenescompra-getresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [OrdenesCompraController.cs, acción Get](../Cobranzas_Vittoria/Controllers/OrdenesCompraController.cs).

<a id="endpoint-ordenescompracontroller-crear"></a>
#### POST `/api/compras/ordenes-compra`

**Acceso:** Público. **Acción:** `OrdenesCompraController.Crear`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [OrdenCompraCreateDto](#schema-cobranzas-vittoria-dtos-compras-ordencompracreatedto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [OrdenesCompra_CrearResponse](#schema-adicional-ordenescompra-crearresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [OrdenesCompraController.cs, acción Crear](../Cobranzas_Vittoria/Controllers/OrdenesCompraController.cs).

<a id="endpoint-ordenescompracontroller-update"></a>
#### PUT `/api/compras/ordenes-compra/{id:int}`

**Acceso:** Público. **Acción:** `OrdenesCompraController.Update`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [OrdenCompraUpdateDto](#schema-cobranzas-vittoria-dtos-compras-ordencompraupdatedto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [OrdenesCompraController.cs, acción Update](../Cobranzas_Vittoria/Controllers/OrdenesCompraController.cs).

<a id="endpoint-ordenescompracontroller-updateestado"></a>
#### PATCH `/api/compras/ordenes-compra/{id:int}/estado`

**Acceso:** Público. **Acción:** `OrdenesCompraController.UpdateEstado`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [OrdenCompraEstadoDto](#schema-cobranzas-vittoria-dtos-compras-ordencompraestadodto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [OrdenesCompraController.cs, acción UpdateEstado](../Cobranzas_Vittoria/Controllers/OrdenesCompraController.cs).

<a id="grupo-compras-compras-y-documentos"></a>
### Compras: compras y documentos

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/compras/compras`](#endpoint-comprascontroller-list) | Público |
| GET | [`/api/compras/compras/pendientes-desde-oc`](#endpoint-comprascontroller-pendientesdesdeoc) | Público |
| GET | [`/api/compras/compras/{id:int}`](#endpoint-comprascontroller-get) | Público |
| POST | [`/api/compras/compras`](#endpoint-comprascontroller-crear) | Público |
| POST | [`/api/compras/compras/{id:int}/aceptar`](#endpoint-comprascontroller-aceptar) | Público |
| GET | [`/api/compras/compras/{id:int}/documentos`](#endpoint-comprascontroller-getdocumentos) | Público |
| POST | [`/api/compras/compras/{id:int}/documentos`](#endpoint-comprascontroller-uploaddocumentos) | Público |
| GET | [`/api/compras/compras/{id:int}/documentos/{docId:int}/download`](#endpoint-comprascontroller-downloaddocumento) | Público |

<a id="endpoint-comprascontroller-list"></a>
#### GET `/api/compras/compras`

**Acceso:** Público. **Acción:** `ComprasController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `aceptada` | query | bool? | Admite null / omisión según binding |
| `idProveedor` | query | int? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [CompraFilaSql](#schema-adicional-comprafilasql)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ComprasController.cs, acción List](../Cobranzas_Vittoria/Controllers/ComprasController.cs).

<a id="endpoint-comprascontroller-pendientesdesdeoc"></a>
#### GET `/api/compras/compras/pendientes-desde-oc`

**Acceso:** Público. **Acción:** `ComprasController.PendientesDesdeOc`.

**Entrada:** sin parámetros HTTP ni cuerpo.

| HTTP | Cuerpo |
|---|---|
| 200 | [CompraPendienteOcFilaSql](#schema-adicional-comprapendienteocfilasql)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ComprasController.cs, acción PendientesDesdeOc](../Cobranzas_Vittoria/Controllers/ComprasController.cs).

<a id="endpoint-comprascontroller-get"></a>
#### GET `/api/compras/compras/{id:int}`

**Acceso:** Público. **Acción:** `ComprasController.Get`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 404 | ProblemDetails (NotFound sin payload; filtro de ApiController) |
| 200 | [CompraDetalleResponse](#schema-adicional-compradetalleresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ComprasController.cs, acción Get](../Cobranzas_Vittoria/Controllers/ComprasController.cs).

<a id="endpoint-comprascontroller-crear"></a>
#### POST `/api/compras/compras`

**Acceso:** Público. **Acción:** `ComprasController.Crear`.

Los totales se calculan en el servidor a partir de los ítems; ver reglas de Compras.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [CompraCreateDto](#schema-cobranzas-vittoria-dtos-compras-compracreatedto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [Compras_CrearResponse](#schema-adicional-compras-crearresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ComprasController.cs, acción Crear](../Cobranzas_Vittoria/Controllers/ComprasController.cs).

<a id="endpoint-comprascontroller-aceptar"></a>
#### POST `/api/compras/compras/{id:int}/aceptar`

**Acceso:** Público. **Acción:** `ComprasController.Aceptar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [CompraAceptarDto](#schema-cobranzas-vittoria-dtos-compras-compraaceptardto)? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ComprasController.cs, acción Aceptar](../Cobranzas_Vittoria/Controllers/ComprasController.cs).

<a id="endpoint-comprascontroller-getdocumentos"></a>
#### GET `/api/compras/compras/{id:int}/documentos`

**Acceso:** Público. **Acción:** `ComprasController.GetDocumentos`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [CompraDocumentoFilaSql](#schema-adicional-compradocumentofilasql)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ComprasController.cs, acción GetDocumentos](../Cobranzas_Vittoria/Controllers/ComprasController.cs).

<a id="endpoint-comprascontroller-uploaddocumentos"></a>
#### POST `/api/compras/compras/{id:int}/documentos`

**Acceso:** Público. **Acción:** `ComprasController.UploadDocumentos`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `files` | formulario multipart | archivo binario[] | Sin default explícito; validar según esquema |

**Máximo del cuerpo HTTP:** `50000000` bytes. Los límites de archivo adicionales se describen en [reglas](#reglas).

| HTTP | Cuerpo |
|---|---|
| 400 | { message: string } |
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica; 413: límite del cuerpo multipart. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ComprasController.cs, acción UploadDocumentos](../Cobranzas_Vittoria/Controllers/ComprasController.cs).

<a id="endpoint-comprascontroller-downloaddocumento"></a>
#### GET `/api/compras/compras/{id:int}/documentos/{docId:int}/download`

**Acceso:** Público. **Acción:** `ComprasController.DownloadDocumento`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `docId` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 404 | { message: string } |
| 200 | archivo binario; `application/octet-stream` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 422: validación numérica / materiales; 409: conflicto de integración presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ComprasController.cs, acción DownloadDocumento](../Cobranzas_Vittoria/Controllers/ComprasController.cs).

<a id="grupo-almac-n-kardex-manual"></a>
### Almacén: Kardex manual

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/almacen/kardex/entradas`](#endpoint-kardexinventariocontroller-listarentradas) | Público |
| POST | [`/api/almacen/kardex/entradas`](#endpoint-kardexinventariocontroller-registrarentrada) | Público |
| PUT | [`/api/almacen/kardex/entradas/{id:int}`](#endpoint-kardexinventariocontroller-actualizarentrada) | Público |
| DELETE | [`/api/almacen/kardex/entradas/{id:int}`](#endpoint-kardexinventariocontroller-eliminarentrada) | Público |
| GET | [`/api/almacen/kardex/salidas`](#endpoint-kardexinventariocontroller-listarsalidas) | Público |
| POST | [`/api/almacen/kardex/salidas`](#endpoint-kardexinventariocontroller-registrarsalida) | Público |
| PUT | [`/api/almacen/kardex/salidas/{id:int}`](#endpoint-kardexinventariocontroller-actualizarsalida) | Público |
| DELETE | [`/api/almacen/kardex/salidas/{id:int}`](#endpoint-kardexinventariocontroller-eliminarsalida) | Público |
| GET | [`/api/almacen/kardex/stock-actual`](#endpoint-kardexinventariocontroller-listarstockactual) | Público |
| GET | [`/api/almacen/kardex/stock-actual/exportar-excel`](#endpoint-kardexinventariocontroller-exportarstockactual) | Público |

<a id="endpoint-kardexinventariocontroller-listarentradas"></a>
#### GET `/api/almacen/kardex/entradas`

**Acceso:** Público. **Acción:** `KardexInventarioController.ListarEntradas`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idEspecialidad` | query | int? | Admite null / omisión según binding |
| `idProyecto` | query | int? | Admite null / omisión según binding |
| `idProveedor` | query | int? | Admite null / omisión según binding |
| `fechaDesde` | query | DateOnly? | Admite null / omisión según binding |
| `fechaHasta` | query | DateOnly? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [KardexEntradaResponseDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexentradaresponsedto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: ID_RUTA_INCONSISTENTE en PUT; 404: KARDEX_NO_ENCONTRADO; 422: validación / stock cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexInventarioController.cs, acción ListarEntradas](../Cobranzas_Vittoria/Controllers/KardexInventarioController.cs).

<a id="endpoint-kardexinventariocontroller-registrarentrada"></a>
#### POST `/api/almacen/kardex/entradas`

**Acceso:** Público. **Acción:** `KardexInventarioController.RegistrarEntrada`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [KardexEntradaCreateDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexentradacreatedto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [KardexEntradaResponseDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexentradaresponsedto) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: ID_RUTA_INCONSISTENTE en PUT; 404: KARDEX_NO_ENCONTRADO; 422: validación / stock cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexInventarioController.cs, acción RegistrarEntrada](../Cobranzas_Vittoria/Controllers/KardexInventarioController.cs).

<a id="endpoint-kardexinventariocontroller-actualizarentrada"></a>
#### PUT `/api/almacen/kardex/entradas/{id:int}`

**Acceso:** Público. **Acción:** `KardexInventarioController.ActualizarEntrada`.

idKardexEntrada del cuerpo debe coincidir con id de ruta; en caso contrario, 400 ID_RUTA_INCONSISTENTE.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [KardexEntradaCreateDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexentradacreatedto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [KardexEntradaResponseDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexentradaresponsedto) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: ID_RUTA_INCONSISTENTE en PUT; 404: KARDEX_NO_ENCONTRADO; 422: validación / stock cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexInventarioController.cs, acción ActualizarEntrada](../Cobranzas_Vittoria/Controllers/KardexInventarioController.cs).

<a id="endpoint-kardexinventariocontroller-eliminarentrada"></a>
#### DELETE `/api/almacen/kardex/entradas/{id:int}`

**Acceso:** Público. **Acción:** `KardexInventarioController.EliminarEntrada`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: ID_RUTA_INCONSISTENTE en PUT; 404: KARDEX_NO_ENCONTRADO; 422: validación / stock cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexInventarioController.cs, acción EliminarEntrada](../Cobranzas_Vittoria/Controllers/KardexInventarioController.cs).

<a id="endpoint-kardexinventariocontroller-listarsalidas"></a>
#### GET `/api/almacen/kardex/salidas`

**Acceso:** Público. **Acción:** `KardexInventarioController.ListarSalidas`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idEspecialidad` | query | int? | Admite null / omisión según binding |
| `idProyecto` | query | int? | Admite null / omisión según binding |
| `fechaDesde` | query | DateOnly? | Admite null / omisión según binding |
| `fechaHasta` | query | DateOnly? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [KardexSalidaResponseDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidaresponsedto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: ID_RUTA_INCONSISTENTE en PUT; 404: KARDEX_NO_ENCONTRADO; 422: validación / stock cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexInventarioController.cs, acción ListarSalidas](../Cobranzas_Vittoria/Controllers/KardexInventarioController.cs).

<a id="endpoint-kardexinventariocontroller-registrarsalida"></a>
#### POST `/api/almacen/kardex/salidas`

**Acceso:** Público. **Acción:** `KardexInventarioController.RegistrarSalida`.

Devuelve un arreglo con una fila por ítem y cabecera repetida.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [KardexSalidaCreateDto (Inventario)](#schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidacreatedto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [KardexSalidaResponseDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidaresponsedto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: ID_RUTA_INCONSISTENTE en PUT; 404: KARDEX_NO_ENCONTRADO; 422: validación / stock cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexInventarioController.cs, acción RegistrarSalida](../Cobranzas_Vittoria/Controllers/KardexInventarioController.cs).

<a id="endpoint-kardexinventariocontroller-actualizarsalida"></a>
#### PUT `/api/almacen/kardex/salidas/{id:int}`

**Acceso:** Público. **Acción:** `KardexInventarioController.ActualizarSalida`.

idKardexSalida debe coincidir con la ruta; sustituye cabecera e ítems. La respuesta es un arreglo de filas.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `dto` | cuerpo JSON | [KardexSalidaCreateDto (Inventario)](#schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidacreatedto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [KardexSalidaResponseDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidaresponsedto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: ID_RUTA_INCONSISTENTE en PUT; 404: KARDEX_NO_ENCONTRADO; 422: validación / stock cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexInventarioController.cs, acción ActualizarSalida](../Cobranzas_Vittoria/Controllers/KardexInventarioController.cs).

<a id="endpoint-kardexinventariocontroller-eliminarsalida"></a>
#### DELETE `/api/almacen/kardex/salidas/{id:int}`

**Acceso:** Público. **Acción:** `KardexInventarioController.EliminarSalida`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: ID_RUTA_INCONSISTENTE en PUT; 404: KARDEX_NO_ENCONTRADO; 422: validación / stock cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexInventarioController.cs, acción EliminarSalida](../Cobranzas_Vittoria/Controllers/KardexInventarioController.cs).

<a id="endpoint-kardexinventariocontroller-listarstockactual"></a>
#### GET `/api/almacen/kardex/stock-actual`

**Acceso:** Público. **Acción:** `KardexInventarioController.ListarStockActual`.

No acepta idProyecto. Las fechas filtran la última fecha de movimiento del consolidado.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idEspecialidad` | query | int? | Admite null / omisión según binding |
| `fechaDesde` | query | DateOnly? | Admite null / omisión según binding |
| `fechaHasta` | query | DateOnly? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [KardexStockActualResponseDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexstockactualresponsedto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: ID_RUTA_INCONSISTENTE en PUT; 404: KARDEX_NO_ENCONTRADO; 422: validación / stock cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexInventarioController.cs, acción ListarStockActual](../Cobranzas_Vittoria/Controllers/KardexInventarioController.cs).

<a id="endpoint-kardexinventariocontroller-exportarstockactual"></a>
#### GET `/api/almacen/kardex/stock-actual/exportar-excel`

**Acceso:** Público. **Acción:** `KardexInventarioController.ExportarStockActual`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idEspecialidad` | query | int? | Admite null / omisión según binding |
| `fechaDesde` | query | DateOnly? | Admite null / omisión según binding |
| `fechaHasta` | query | DateOnly? | Admite null / omisión según binding |
| `incluirTotales` | query | bool? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | archivo binario; `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: ID_RUTA_INCONSISTENTE en PUT; 404: KARDEX_NO_ENCONTRADO; 422: validación / stock cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexInventarioController.cs, acción ExportarStockActual](../Cobranzas_Vittoria/Controllers/KardexInventarioController.cs).

<a id="grupo-almac-n-kardex-legacy"></a>
### Almacén: Kardex legacy

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/almacen/kardex/movimientos`](#endpoint-kardexcontroller-movimientos) | Público |
| POST | [`/api/almacen/kardex/salidas-manuales`](#endpoint-kardexcontroller-registrarsalidamanuallegacy) | Público |

<a id="endpoint-kardexcontroller-movimientos"></a>
#### GET `/api/almacen/kardex/movimientos`

**Acceso:** Público. **Acción:** `KardexController.Movimientos`.

**Obsoleto, todavía publicado.** Endpoint legacy de KardexMovimiento acoplado a Compras. No tiene reemplazo directo; se conserva mientras pantallas frontend lo consuman. Para kardex manual usar KardexInventarioController.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idCompra` | query | int? | Admite null / omisión según binding |
| `idMaterial` | query | int? | Admite null / omisión según binding |
| `idEspecialidad` | query | int? | Admite null / omisión según binding |
| `fechaDesde` | query | string? | Admite null / omisión según binding |
| `fechaHasta` | query | string? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [KardexMovimientoLegacyFilaSql](#schema-adicional-kardexmovimientolegacyfilasql)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexController.cs, acción Movimientos](../Cobranzas_Vittoria/Controllers/KardexController.cs).

<a id="endpoint-kardexcontroller-registrarsalidamanuallegacy"></a>
#### POST `/api/almacen/kardex/salidas-manuales`

**Acceso:** Público. **Acción:** `KardexController.RegistrarSalidaManualLegacy`.

**Obsoleto, todavía publicado.** Endpoint legacy. Use POST /api/almacen/kardex/salidas del KardexInventarioController (modulo Inventario / Kardex manual).

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [KardexSalidaCreateDto (legacy)](#schema-cobranzas-vittoria-dtos-almacen-kardexsalidacreatedto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [Kardex_RegistrarSalidaManualLegacyResponse](#schema-adicional-kardex-registrarsalidamanuallegacyresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [KardexController.cs, acción RegistrarSalidaManualLegacy](../Cobranzas_Vittoria/Controllers/KardexController.cs).

<a id="grupo-contable-gastos-directos"></a>
### Contable: gastos directos

| Método | Ruta | Acceso |
|---|---|---|
| POST | [`/api/contable/gastos-directos/importar`](#endpoint-gastodirectocontroller-importar) | JWT + `gasto_directo.operar` |
| GET | [`/api/contable/gastos-directos/plantilla`](#endpoint-gastodirectocontroller-plantilla) | JWT + `gasto_directo.operar` |
| GET | [`/api/contable/gastos-directos`](#endpoint-gastodirectocontroller-listar) | JWT + `gasto_directo.ver` |
| GET | [`/api/contable/gastos-directos/categorias`](#endpoint-gastodirectocontroller-categorias) | JWT + `gasto_directo.ver` |
| GET | [`/api/contable/gastos-directos/centros-costo`](#endpoint-gastodirectocontroller-centroscosto) | JWT + `gasto_directo.ver` |
| GET | [`/api/contable/gastos-directos/proveedores`](#endpoint-gastodirectocontroller-proveedores) | JWT + `gasto_directo.ver` |
| GET | [`/api/contable/gastos-directos/partidas-disponibles`](#endpoint-gastodirectocontroller-partidasdisponibles) | JWT + `gasto_directo.ver` |
| GET | [`/api/contable/gastos-directos/{id:int}`](#endpoint-gastodirectocontroller-obtener) | JWT + `gasto_directo.ver` |
| POST | [`/api/contable/gastos-directos`](#endpoint-gastodirectocontroller-crear) | JWT + `gasto_directo.operar` |
| PUT | [`/api/contable/gastos-directos/{id:int}`](#endpoint-gastodirectocontroller-actualizar) | JWT + `gasto_directo.operar` |
| POST | [`/api/contable/gastos-directos/{id:int}/confirmar`](#endpoint-gastodirectocontroller-confirmar) | JWT + `gasto_directo.operar` |
| POST | [`/api/contable/gastos-directos/{id:int}/anular`](#endpoint-gastodirectocontroller-anular) | JWT + `gasto_directo.operar` |
| GET | [`/api/contable/gastos-directos/{id:int}/documentos`](#endpoint-gastodirectocontroller-listardocumentos) | JWT + `gasto_directo.ver` |
| POST | [`/api/contable/gastos-directos/{id:int}/documentos`](#endpoint-gastodirectocontroller-subirdocumentos) | JWT + `gasto_directo.operar` |
| GET | [`/api/contable/gastos-directos/{id:int}/documentos/{documentoId:int}/download`](#endpoint-gastodirectocontroller-descargardocumento) | JWT + `gasto_directo.ver` |

<a id="endpoint-gastodirectocontroller-importar"></a>
#### POST `/api/contable/gastos-directos/importar`

**Acceso:** JWT + `gasto_directo.operar`. **Acción:** `GastoDirectoController.Importar`.

Solo XLSX, 10 MiB, hoja Carga masiva, encabezados en fila 5, máximo 200 registros. El 422 incluye resumen de filas.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `archivo` | formulario multipart | archivo binario | Sin default explícito; validar según esquema |

**Máximo del cuerpo HTTP:** `11000000` bytes. Los límites de archivo adicionales se describen en [reglas](#reglas).

| HTTP | Cuerpo |
|---|---|
| 200 | [ResultadoImportacionGastosDirectos](#schema-cobranzas-vittoria-contable-gastosdirectos-application-importar-resultadoimportaciongastosdirectos) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica; 400: archivo/estructura; 413: tamaño; 415: Content-Type; 422: errores del lote sin persistencia parcial. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción Importar](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-plantilla"></a>
#### GET `/api/contable/gastos-directos/plantilla`

**Acceso:** JWT + `gasto_directo.operar`. **Acción:** `GastoDirectoController.Plantilla`.

**Entrada:** sin parámetros HTTP ni cuerpo.

| HTTP | Cuerpo |
|---|---|
| 200 | archivo binario; `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica; 400: FORMATO_PLANTILLA_INVALIDO si admite formato. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción Plantilla](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-listar"></a>
#### GET `/api/contable/gastos-directos`

**Acceso:** JWT + `gasto_directo.ver`. **Acción:** `GastoDirectoController.Listar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `estado` | query | string? | Admite null / omisión según binding |
| `idProveedor` | query | int? | Admite null / omisión según binding |
| `idCentroCosto` | query | int? | Admite null / omisión según binding |
| `desde` | query | DateTime? | Admite null / omisión según binding |
| `hasta` | query | DateTime? | Admite null / omisión según binding |
| `idCategoriaGasto` | query | int[] | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [GastoDirecto](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-gastodirecto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción Listar](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-categorias"></a>
#### GET `/api/contable/gastos-directos/categorias`

**Acceso:** JWT + `gasto_directo.ver`. **Acción:** `GastoDirectoController.Categorias`.

**Entrada:** sin parámetros HTTP ni cuerpo.

| HTTP | Cuerpo |
|---|---|
| 200 | [CategoriaGastoDirecto](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-categoriagastodirecto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción Categorias](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-centroscosto"></a>
#### GET `/api/contable/gastos-directos/centros-costo`

**Acceso:** JWT + `gasto_directo.ver`. **Acción:** `GastoDirectoController.CentrosCosto`.

**Entrada:** sin parámetros HTTP ni cuerpo.

| HTTP | Cuerpo |
|---|---|
| 200 | [CentroCostoGastoDirecto](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-centrocostogastodirecto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción CentrosCosto](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-proveedores"></a>
#### GET `/api/contable/gastos-directos/proveedores`

**Acceso:** JWT + `gasto_directo.ver`. **Acción:** `GastoDirectoController.Proveedores`.

**Entrada:** sin parámetros HTTP ni cuerpo.

| HTTP | Cuerpo |
|---|---|
| 200 | [ProveedorGastoDirecto](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-proveedorgastodirecto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción Proveedores](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-partidasdisponibles"></a>
#### GET `/api/contable/gastos-directos/partidas-disponibles`

**Acceso:** JWT + `gasto_directo.ver`. **Acción:** `GastoDirectoController.PartidasDisponibles`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idCentroCosto` | query | int | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [PartidaDisponibleGasto](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-partidadisponiblegasto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción PartidasDisponibles](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-obtener"></a>
#### GET `/api/contable/gastos-directos/{id:int}`

**Acceso:** JWT + `gasto_directo.ver`. **Acción:** `GastoDirectoController.Obtener`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | { gasto: [GastoDirecto](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-gastodirecto), documentos: [GastoDirectoDocumento](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-gastodirectodocumento)[] } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción Obtener](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-crear"></a>
#### POST `/api/contable/gastos-directos`

**Acceso:** JWT + `gasto_directo.operar`. **Acción:** `GastoDirectoController.Crear`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `r` | cuerpo JSON | [GastoDirectoUpsertRequest](#schema-cobranzas-vittoria-contable-gastosdirectos-presentation-dto-gastodirectoupsertrequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 201 | { idGastoDirecto: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción Crear](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-actualizar"></a>
#### PUT `/api/contable/gastos-directos/{id:int}`

**Acceso:** JWT + `gasto_directo.operar`. **Acción:** `GastoDirectoController.Actualizar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `r` | cuerpo JSON | [GastoDirectoUpsertRequest](#schema-cobranzas-vittoria-contable-gastosdirectos-presentation-dto-gastodirectoupsertrequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | { idGastoDirecto: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción Actualizar](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-confirmar"></a>
#### POST `/api/contable/gastos-directos/{id:int}/confirmar`

**Acceso:** JWT + `gasto_directo.operar`. **Acción:** `GastoDirectoController.Confirmar`.

La propiedad estado de éxito tiene el literal CONFIRMADO.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool, idGastoDirecto: int, estado: string } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción Confirmar](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-anular"></a>
#### POST `/api/contable/gastos-directos/{id:int}/anular`

**Acceso:** JWT + `gasto_directo.operar`. **Acción:** `GastoDirectoController.Anular`.

La propiedad estado de éxito tiene el literal ANULADO.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool, idGastoDirecto: int, estado: string } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción Anular](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-listardocumentos"></a>
#### GET `/api/contable/gastos-directos/{id:int}/documentos`

**Acceso:** JWT + `gasto_directo.ver`. **Acción:** `GastoDirectoController.ListarDocumentos`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [GastoDirectoDocumento](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-gastodirectodocumento)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción ListarDocumentos](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-subirdocumentos"></a>
#### POST `/api/contable/gastos-directos/{id:int}/documentos`

**Acceso:** JWT + `gasto_directo.operar`. **Acción:** `GastoDirectoController.SubirDocumentos`.

Solo PDF. tipoDocumento es obligatorio para la regla de negocio: Factura o Pago. Devuelve cantidad de archivos registrados.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `tipoDocumento` | formulario multipart | string? | Admite null / omisión según binding |
| `files` | formulario multipart | archivo binario[] | Sin default explícito; validar según esquema |

**Máximo del cuerpo HTTP:** `50000000` bytes. Los límites de archivo adicionales se describen en [reglas](#reglas).

| HTTP | Cuerpo |
|---|---|
| 200 | { ok: bool, cantidad: int } |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica; 413: límite del cuerpo multipart. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción SubirDocumentos](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="endpoint-gastodirectocontroller-descargardocumento"></a>
#### GET `/api/contable/gastos-directos/{id:int}/documentos/{documentoId:int}/download`

**Acceso:** JWT + `gasto_directo.ver`. **Acción:** `GastoDirectoController.DescargarDocumento`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `documentoId` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | archivo binario; `application/pdf` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: SOLICITUD_INVALIDA; 404: recurso/documento ausente; 409: regla contable cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [GastoDirectoController.cs, acción DescargarDocumento](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Controller/GastoDirectoController.cs).

<a id="grupo-contable-valorizaciones"></a>
### Contable: valorizaciones

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/contable/valorizaciones/configuraciones`](#endpoint-valorizacionescontroller-listconfiguraciones) | Público |
| POST | [`/api/contable/valorizaciones/configuraciones`](#endpoint-valorizacionescontroller-upsertconfiguracion) | Público |
| POST | [`/api/contable/valorizaciones/reglas-proveedor`](#endpoint-valorizacionescontroller-upsertreglaproveedor) | Público |
| GET | [`/api/contable/valorizaciones`](#endpoint-valorizacionescontroller-list) | Público |
| GET | [`/api/contable/valorizaciones/configuracion/{idConfiguracion:int}`](#endpoint-valorizacionescontroller-getbyconfiguracion) | Público |
| GET | [`/api/contable/valorizaciones/{id:int}`](#endpoint-valorizacionescontroller-get) | Público |
| POST | [`/api/contable/valorizaciones`](#endpoint-valorizacionescontroller-upsert) | Público |
| POST | [`/api/contable/valorizaciones/detalle`](#endpoint-valorizacionescontroller-upsertdetalle) | Público |
| DELETE | [`/api/contable/valorizaciones/detalle/{id:int}`](#endpoint-valorizacionescontroller-deletedetalle) | Público |
| POST | [`/api/contable/valorizaciones/detalle/{idDetalle:int}/archivos`](#endpoint-valorizacionescontroller-uploadarchivos) | Público |
| GET | [`/api/contable/valorizaciones/detalle/{idDetalle:int}/archivos/{idArchivo:int}/download`](#endpoint-valorizacionescontroller-downloadarchivo) | Público |

<a id="endpoint-valorizacionescontroller-listconfiguraciones"></a>
#### GET `/api/contable/valorizaciones/configuraciones`

**Acceso:** Público. **Acción:** `ValorizacionesController.ListConfiguraciones`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idProyecto` | query | int? | Admite null / omisión según binding |
| `idProveedor` | query | int? | Admite null / omisión según binding |
| `idEspecialidad` | query | int? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [Valorizaciones_ListConfiguracionesResponse](#schema-adicional-valorizaciones-listconfiguracionesresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ValorizacionesController.cs, acción ListConfiguraciones](../Cobranzas_Vittoria/Controllers/ValorizacionesController.cs).

<a id="endpoint-valorizacionescontroller-upsertconfiguracion"></a>
#### POST `/api/contable/valorizaciones/configuraciones`

**Acceso:** Público. **Acción:** `ValorizacionesController.UpsertConfiguracion`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [ProveedorEspecialidadCotizacionUpsertDto](#schema-cobranzas-vittoria-dtos-valorizaciones-proveedorespecialidadcotizacionupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [Valorizaciones_UpsertConfiguracionResponse](#schema-adicional-valorizaciones-upsertconfiguracionresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ValorizacionesController.cs, acción UpsertConfiguracion](../Cobranzas_Vittoria/Controllers/ValorizacionesController.cs).

<a id="endpoint-valorizacionescontroller-upsertreglaproveedor"></a>
#### POST `/api/contable/valorizaciones/reglas-proveedor`

**Acceso:** Público. **Acción:** `ValorizacionesController.UpsertReglaProveedor`.

Incompatibilidad por inspección: el repositorio pasa Usuario a un SP que no lo declara y espera una fila que el SP no retorna. Con las definiciones actuales puede producir 500; ver Alcance y verificación.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [ProveedorReglaValorizacionUpsertDto](#schema-cobranzas-vittoria-dtos-valorizaciones-proveedorreglavalorizacionupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | Sin esquema de éxito materializable con el SP actual; ver incompatibilidad documentada (200 es el resultado previsto por el controlador, no validado por el SP) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ValorizacionesController.cs, acción UpsertReglaProveedor](../Cobranzas_Vittoria/Controllers/ValorizacionesController.cs).

<a id="endpoint-valorizacionescontroller-list"></a>
#### GET `/api/contable/valorizaciones`

**Acceso:** Público. **Acción:** `ValorizacionesController.List`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idProyecto` | query | int? | Admite null / omisión según binding |
| `idProveedor` | query | int? | Admite null / omisión según binding |
| `idEspecialidad` | query | int? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [Valorizaciones_ListResponse](#schema-adicional-valorizaciones-listresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ValorizacionesController.cs, acción List](../Cobranzas_Vittoria/Controllers/ValorizacionesController.cs).

<a id="endpoint-valorizacionescontroller-getbyconfiguracion"></a>
#### GET `/api/contable/valorizaciones/configuracion/{idConfiguracion:int}`

**Acceso:** Público. **Acción:** `ValorizacionesController.GetByConfiguracion`.

Sin configuración devuelve 200 con cabecera:null, detalle:[], resumen:null. Si existe configuración sin valorización, puede retornar cabecera con idValorizacion nulo.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idConfiguracion` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [Valorizaciones_GetByConfiguracionResponse](#schema-adicional-valorizaciones-getbyconfiguracionresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ValorizacionesController.cs, acción GetByConfiguracion](../Cobranzas_Vittoria/Controllers/ValorizacionesController.cs).

<a id="endpoint-valorizacionescontroller-get"></a>
#### GET `/api/contable/valorizaciones/{id:int}`

**Acceso:** Público. **Acción:** `ValorizacionesController.Get`.

Sin cabecera devuelve 200 con cabecera:null, detalle:[], resumen:null. El esquema muestra el caso con datos.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [Valorizaciones_GetResponse](#schema-adicional-valorizaciones-getresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ValorizacionesController.cs, acción Get](../Cobranzas_Vittoria/Controllers/ValorizacionesController.cs).

<a id="endpoint-valorizacionescontroller-upsert"></a>
#### POST `/api/contable/valorizaciones`

**Acceso:** Público. **Acción:** `ValorizacionesController.Upsert`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [ValorizacionUpsertDto](#schema-cobranzas-vittoria-dtos-valorizaciones-valorizacionupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [Valorizaciones_UpsertResponse](#schema-adicional-valorizaciones-upsertresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ValorizacionesController.cs, acción Upsert](../Cobranzas_Vittoria/Controllers/ValorizacionesController.cs).

<a id="endpoint-valorizacionescontroller-upsertdetalle"></a>
#### POST `/api/contable/valorizaciones/detalle`

**Acceso:** Público. **Acción:** `ValorizacionesController.UpsertDetalle`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `dto` | cuerpo JSON | [ValorizacionDetalleUpsertDto](#schema-cobranzas-vittoria-dtos-valorizaciones-valorizaciondetalleupsertdto) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [Valorizaciones_UpsertDetalleResponse](#schema-adicional-valorizaciones-upsertdetalleresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ValorizacionesController.cs, acción UpsertDetalle](../Cobranzas_Vittoria/Controllers/ValorizacionesController.cs).

<a id="endpoint-valorizacionescontroller-deletedetalle"></a>
#### DELETE `/api/contable/valorizaciones/detalle/{id:int}`

**Acceso:** Público. **Acción:** `ValorizacionesController.DeleteDetalle`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `usuario` | query | string | Default: `"system"` |

| HTTP | Cuerpo |
|---|---|
| 200 | [Valorizaciones_DeleteDetalleResponse](#schema-adicional-valorizaciones-deletedetalleresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ValorizacionesController.cs, acción DeleteDetalle](../Cobranzas_Vittoria/Controllers/ValorizacionesController.cs).

<a id="endpoint-valorizacionescontroller-uploadarchivos"></a>
#### POST `/api/contable/valorizaciones/detalle/{idDetalle:int}/archivos`

**Acceso:** Público. **Acción:** `ValorizacionesController.UploadArchivos`.

Solo extensión .pdf (sin distinguir mayúsculas). Los rechazos directos contienen message.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idDetalle` | ruta | int | Segmento obligatorio |
| `files` | formulario multipart | archivo binario[] | Sin default explícito; validar según esquema |

**Máximo del cuerpo HTTP:** `50000000` bytes. Los límites de archivo adicionales se describen en [reglas](#reglas).

| HTTP | Cuerpo |
|---|---|
| 400 | { message: string } |
| 200 | { ok: bool }; `{"ok": true}` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 413: límite del cuerpo multipart. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ValorizacionesController.cs, acción UploadArchivos](../Cobranzas_Vittoria/Controllers/ValorizacionesController.cs).

<a id="endpoint-valorizacionescontroller-downloadarchivo"></a>
#### GET `/api/contable/valorizaciones/detalle/{idDetalle:int}/archivos/{idArchivo:int}/download`

**Acceso:** Público. **Acción:** `ValorizacionesController.DownloadArchivo`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idDetalle` | ruta | int | Segmento obligatorio |
| `idArchivo` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 404 | { message: string } |
| 200 | archivo binario; `application/pdf` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ValorizacionesController.cs, acción DownloadArchivo](../Cobranzas_Vittoria/Controllers/ValorizacionesController.cs).

<a id="grupo-importaci-n-gen-rica"></a>
### Importación genérica

| Método | Ruta | Acceso |
|---|---|---|
| POST | [`/api/import/{modulo}`](#endpoint-importcontroller-importar) | Público |
| GET | [`/api/import/{modulo}/plantilla`](#endpoint-importcontroller-descargarplantilla) | Público |

<a id="endpoint-importcontroller-importar"></a>
#### POST `/api/import/{modulo}`

**Acceso:** Público. **Acción:** `ImportController.Importar`.

Módulos: unidad-medida, especialidad, material, proveedor, categoria-gasto. Límite efectivo de archivo: 5 MiB. usuario se recibe en formulario.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `modulo` | ruta | string | Segmento obligatorio |
| `archivo` | formulario multipart | archivo binario | Sin default explícito; validar según esquema |
| `usuario` | formulario multipart | string | Sin default explícito; validar según esquema |

**Máximo del cuerpo HTTP:** `11000000` bytes. Los límites de archivo adicionales se describen en [reglas](#reglas).

| HTTP | Cuerpo |
|---|---|
| 200 | [ResultadoImportacion](#schema-cobranzas-vittoria-application-importacion-processors-resultadoimportacion) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: archivo/estructura; 413: tamaño; 415: Content-Type; 422: errores del lote sin persistencia parcial. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ImportController.cs, acción Importar](../Cobranzas_Vittoria/Controllers/ImportController.cs).

<a id="endpoint-importcontroller-descargarplantilla"></a>
#### GET `/api/import/{modulo}/plantilla`

**Acceso:** Público. **Acción:** `ImportController.DescargarPlantilla`.

Solo material tiene plantilla. Otros módulos producen 404 PLANTILLA_NO_DISPONIBLE. Formatos csv/xlsx; default xlsx.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `modulo` | ruta | string | Segmento obligatorio |
| `formato` | query | string? | Default: `"xlsx"` |

| HTTP | Cuerpo |
|---|---|
| 200 | archivo binario; `text/csv; charset=utf-8` |
| 200 | archivo binario; `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 400: FORMATO_PLANTILLA_INVALIDO si admite formato. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ImportController.cs, acción DescargarPlantilla](../Cobranzas_Vittoria/Controllers/ImportController.cs).

<a id="grupo-control-presupuestario-cat-logos-auxiliares"></a>
### Control Presupuestario: catálogos auxiliares

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/control-presupuestario/catalogos/estados-presupuesto`](#endpoint-catalogocontrolpresupuestariocontroller-estadospresupuesto) | JWT |
| GET | [`/api/control-presupuestario/catalogos/tipos-centro-costo`](#endpoint-catalogocontrolpresupuestariocontroller-tiposcentrocosto) | JWT |
| GET | [`/api/control-presupuestario/catalogos/tipos-partida`](#endpoint-catalogocontrolpresupuestariocontroller-tipospartida) | JWT |
| GET | [`/api/control-presupuestario/catalogos/tipos-movimiento`](#endpoint-catalogocontrolpresupuestariocontroller-tiposmovimiento) | JWT |
| GET | [`/api/control-presupuestario/catalogos/monedas`](#endpoint-catalogocontrolpresupuestariocontroller-monedas) | JWT |

<a id="endpoint-catalogocontrolpresupuestariocontroller-estadospresupuesto"></a>
#### GET `/api/control-presupuestario/catalogos/estados-presupuesto`

**Acceso:** JWT. **Acción:** `CatalogoControlPresupuestarioController.EstadosPresupuesto`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Default: `true` |

| HTTP | Cuerpo |
|---|---|
| 200 | [EstadoPresupuesto](#schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-estadopresupuesto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CatalogoControlPresupuestarioController.cs, acción EstadosPresupuesto](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CatalogoControlPresupuestarioController.cs).

<a id="endpoint-catalogocontrolpresupuestariocontroller-tiposcentrocosto"></a>
#### GET `/api/control-presupuestario/catalogos/tipos-centro-costo`

**Acceso:** JWT. **Acción:** `CatalogoControlPresupuestarioController.TiposCentroCosto`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Default: `true` |

| HTTP | Cuerpo |
|---|---|
| 200 | [TipoCentroCosto](#schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-tipocentrocosto)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CatalogoControlPresupuestarioController.cs, acción TiposCentroCosto](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CatalogoControlPresupuestarioController.cs).

<a id="endpoint-catalogocontrolpresupuestariocontroller-tipospartida"></a>
#### GET `/api/control-presupuestario/catalogos/tipos-partida`

**Acceso:** JWT. **Acción:** `CatalogoControlPresupuestarioController.TiposPartida`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Default: `true` |

| HTTP | Cuerpo |
|---|---|
| 200 | [TipoPartida](#schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-tipopartida)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CatalogoControlPresupuestarioController.cs, acción TiposPartida](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CatalogoControlPresupuestarioController.cs).

<a id="endpoint-catalogocontrolpresupuestariocontroller-tiposmovimiento"></a>
#### GET `/api/control-presupuestario/catalogos/tipos-movimiento`

**Acceso:** JWT. **Acción:** `CatalogoControlPresupuestarioController.TiposMovimiento`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Default: `true` |

| HTTP | Cuerpo |
|---|---|
| 200 | [TipoMovimientoPresupuestal](#schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-tipomovimientopresupuestal)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CatalogoControlPresupuestarioController.cs, acción TiposMovimiento](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CatalogoControlPresupuestarioController.cs).

<a id="endpoint-catalogocontrolpresupuestariocontroller-monedas"></a>
#### GET `/api/control-presupuestario/catalogos/monedas`

**Acceso:** JWT. **Acción:** `CatalogoControlPresupuestarioController.Monedas`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Default: `true` |

| HTTP | Cuerpo |
|---|---|
| 200 | [Moneda](#schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-moneda)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CatalogoControlPresupuestarioController.cs, acción Monedas](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CatalogoControlPresupuestarioController.cs).

<a id="grupo-control-presupuestario-centros-de-costo"></a>
### Control Presupuestario: centros de costo

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/control-presupuestario/centros-costo`](#endpoint-centrocostocontroller-listar) | JWT + `control_presupuestario.centro_costo.ver` |
| GET | [`/api/control-presupuestario/centros-costo/{id:int}`](#endpoint-centrocostocontroller-obtener) | JWT + `control_presupuestario.centro_costo.ver` |
| POST | [`/api/control-presupuestario/centros-costo`](#endpoint-centrocostocontroller-crear) | JWT + `control_presupuestario.centro_costo.crear` |
| PUT | [`/api/control-presupuestario/centros-costo/{id:int}`](#endpoint-centrocostocontroller-actualizar) | JWT + `control_presupuestario.centro_costo.actualizar` |
| POST | [`/api/control-presupuestario/centros-costo/importar`](#endpoint-centrocostocontroller-importar) | JWT + `control_presupuestario.centro_costo.crear` |
| GET | [`/api/control-presupuestario/centros-costo/plantilla`](#endpoint-centrocostocontroller-plantilla) | JWT + `control_presupuestario.centro_costo.crear` |

<a id="endpoint-centrocostocontroller-listar"></a>
#### GET `/api/control-presupuestario/centros-costo`

**Acceso:** JWT + `control_presupuestario.centro_costo.ver`. **Acción:** `CentroCostoController.Listar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Admite null / omisión según binding |
| `idTipoCentroCosto` | query | int? | Admite null / omisión según binding |
| `idProyecto` | query | int? | Admite null / omisión según binding |
| `busqueda` | query | string? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [CentroCostoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-centrocostoresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CentroCostoController.cs, acción Listar](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CentroCostoController.cs).

<a id="endpoint-centrocostocontroller-obtener"></a>
#### GET `/api/control-presupuestario/centros-costo/{id:int}`

**Acceso:** JWT + `control_presupuestario.centro_costo.ver`. **Acción:** `CentroCostoController.Obtener`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [CentroCostoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-centrocostoresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CentroCostoController.cs, acción Obtener](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CentroCostoController.cs).

<a id="endpoint-centrocostocontroller-crear"></a>
#### POST `/api/control-presupuestario/centros-costo`

**Acceso:** JWT + `control_presupuestario.centro_costo.crear`. **Acción:** `CentroCostoController.Crear`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `request` | cuerpo JSON | [CrearCentroCostoRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-crearcentrocostorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 201 | [CentroCostoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-centrocostoresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CentroCostoController.cs, acción Crear](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CentroCostoController.cs).

<a id="endpoint-centrocostocontroller-actualizar"></a>
#### PUT `/api/control-presupuestario/centros-costo/{id:int}`

**Acceso:** JWT + `control_presupuestario.centro_costo.actualizar`. **Acción:** `CentroCostoController.Actualizar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [ActualizarCentroCostoRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-actualizarcentrocostorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [CentroCostoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-centrocostoresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CentroCostoController.cs, acción Actualizar](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CentroCostoController.cs).

<a id="endpoint-centrocostocontroller-importar"></a>
#### POST `/api/control-presupuestario/centros-costo/importar`

**Acceso:** JWT + `control_presupuestario.centro_costo.crear`. **Acción:** `CentroCostoController.Importar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `archivo` | formulario multipart | archivo binario? | Admite null / omisión según binding |

**Máximo del cuerpo HTTP:** `11000000` bytes. Los límites de archivo adicionales se describen en [reglas](#reglas).

| HTTP | Cuerpo |
|---|---|
| 200 | [ResultadoImportacion](#schema-cobranzas-vittoria-controlpresupuestario-application-common-resultadoimportacion) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica; 400: archivo/estructura; 413: tamaño; 415: Content-Type; 422: errores del lote sin persistencia parcial. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CentroCostoController.cs, acción Importar](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CentroCostoController.cs).

<a id="endpoint-centrocostocontroller-plantilla"></a>
#### GET `/api/control-presupuestario/centros-costo/plantilla`

**Acceso:** JWT + `control_presupuestario.centro_costo.crear`. **Acción:** `CentroCostoController.Plantilla`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `formato` | query | string? | Default: `"csv"` |

| HTTP | Cuerpo |
|---|---|
| 200 | archivo binario; `text/csv; charset=utf-8` |
| 200 | archivo binario; `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica; 400: FORMATO_PLANTILLA_INVALIDO si admite formato. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CentroCostoController.cs, acción Plantilla](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CentroCostoController.cs).

<a id="grupo-control-presupuestario-cat-logo-de-partidas"></a>
### Control Presupuestario: catálogo de partidas

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/control-presupuestario/partidas`](#endpoint-catalogopartidacontroller-listar) | JWT + `control_presupuestario.partida.ver` |
| GET | [`/api/control-presupuestario/partidas/{id:int}`](#endpoint-catalogopartidacontroller-obtener) | JWT + `control_presupuestario.partida.ver` |
| POST | [`/api/control-presupuestario/partidas`](#endpoint-catalogopartidacontroller-crear) | JWT + `control_presupuestario.partida.crear` |
| PUT | [`/api/control-presupuestario/partidas/{id:int}`](#endpoint-catalogopartidacontroller-actualizar) | JWT + `control_presupuestario.partida.actualizar` |
| POST | [`/api/control-presupuestario/partidas/importar`](#endpoint-catalogopartidacontroller-importar) | JWT + `control_presupuestario.partida.crear` |
| GET | [`/api/control-presupuestario/partidas/plantilla`](#endpoint-catalogopartidacontroller-plantilla) | JWT + `control_presupuestario.partida.crear` |

<a id="endpoint-catalogopartidacontroller-listar"></a>
#### GET `/api/control-presupuestario/partidas`

**Acceso:** JWT + `control_presupuestario.partida.ver`. **Acción:** `CatalogoPartidaController.Listar`.

soloRaices=true e idPartidaPadre no se pueden combinar: 400 FILTRO_INVALIDO.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Admite null / omisión según binding |
| `idTipoPartida` | query | int? | Admite null / omisión según binding |
| `idPartidaPadre` | query | int? | Admite null / omisión según binding |
| `soloRaices` | query | bool | Default: `false` |
| `esHoja` | query | bool? | Admite null / omisión según binding |
| `busqueda` | query | string? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [CatalogoPartidaResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-catalogopartidaresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CatalogoPartidaController.cs, acción Listar](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CatalogoPartidaController.cs).

<a id="endpoint-catalogopartidacontroller-obtener"></a>
#### GET `/api/control-presupuestario/partidas/{id:int}`

**Acceso:** JWT + `control_presupuestario.partida.ver`. **Acción:** `CatalogoPartidaController.Obtener`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [CatalogoPartidaResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-catalogopartidaresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CatalogoPartidaController.cs, acción Obtener](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CatalogoPartidaController.cs).

<a id="endpoint-catalogopartidacontroller-crear"></a>
#### POST `/api/control-presupuestario/partidas`

**Acceso:** JWT + `control_presupuestario.partida.crear`. **Acción:** `CatalogoPartidaController.Crear`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `request` | cuerpo JSON | [CrearCatalogoPartidaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-crearcatalogopartidarequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 201 | [CatalogoPartidaResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-catalogopartidaresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CatalogoPartidaController.cs, acción Crear](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CatalogoPartidaController.cs).

<a id="endpoint-catalogopartidacontroller-actualizar"></a>
#### PUT `/api/control-presupuestario/partidas/{id:int}`

**Acceso:** JWT + `control_presupuestario.partida.actualizar`. **Acción:** `CatalogoPartidaController.Actualizar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `request` | cuerpo JSON | [ActualizarCatalogoPartidaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-actualizarcatalogopartidarequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [CatalogoPartidaResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-catalogopartidaresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CatalogoPartidaController.cs, acción Actualizar](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CatalogoPartidaController.cs).

<a id="endpoint-catalogopartidacontroller-importar"></a>
#### POST `/api/control-presupuestario/partidas/importar`

**Acceso:** JWT + `control_presupuestario.partida.crear`. **Acción:** `CatalogoPartidaController.Importar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `archivo` | formulario multipart | archivo binario? | Admite null / omisión según binding |

**Máximo del cuerpo HTTP:** `11000000` bytes. Los límites de archivo adicionales se describen en [reglas](#reglas).

| HTTP | Cuerpo |
|---|---|
| 200 | [ResultadoImportacion](#schema-cobranzas-vittoria-controlpresupuestario-application-common-resultadoimportacion) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica; 400: archivo/estructura; 413: tamaño; 415: Content-Type; 422: errores del lote sin persistencia parcial. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CatalogoPartidaController.cs, acción Importar](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CatalogoPartidaController.cs).

<a id="endpoint-catalogopartidacontroller-plantilla"></a>
#### GET `/api/control-presupuestario/partidas/plantilla`

**Acceso:** JWT + `control_presupuestario.partida.crear`. **Acción:** `CatalogoPartidaController.Plantilla`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `formato` | query | string? | Default: `"csv"` |

| HTTP | Cuerpo |
|---|---|
| 200 | archivo binario; `text/csv; charset=utf-8` |
| 200 | archivo binario; `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica; 400: FORMATO_PLANTILLA_INVALIDO si admite formato. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [CatalogoPartidaController.cs, acción Plantilla](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/CatalogoPartidaController.cs).

<a id="grupo-control-presupuestario-presupuestos-versiones-y-movimientos"></a>
### Control Presupuestario: presupuestos, versiones y movimientos

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/control-presupuestario/presupuestos`](#endpoint-presupuestocontroller-listar) | JWT + `control_presupuestario.presupuesto.ver` |
| GET | [`/api/control-presupuestario/presupuestos/{id:int}`](#endpoint-presupuestocontroller-obtener) | JWT + `control_presupuestario.presupuesto.ver` |
| POST | [`/api/control-presupuestario/presupuestos`](#endpoint-presupuestocontroller-crear) | JWT + `control_presupuestario.presupuesto.crear` |
| PUT | [`/api/control-presupuestario/presupuestos/{id:int}`](#endpoint-presupuestocontroller-actualizar) | JWT + `control_presupuestario.presupuesto.actualizar` |
| GET | [`/api/control-presupuestario/presupuestos/{id:int}/versiones`](#endpoint-presupuestocontroller-listarversiones) | JWT + `control_presupuestario.presupuesto.ver` |
| POST | [`/api/control-presupuestario/presupuestos/{id:int}/versiones`](#endpoint-presupuestocontroller-crearversion) | JWT + `control_presupuestario.version.crear` |
| GET | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}`](#endpoint-presupuestocontroller-obtenerversion) | JWT + `control_presupuestario.presupuesto.ver` |
| POST | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/aprobar`](#endpoint-presupuestocontroller-aprobarversion) | JWT + `control_presupuestario.version.aprobar` |
| POST | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/anular`](#endpoint-presupuestocontroller-anularversion) | JWT + `control_presupuestario.version.anular` |
| GET | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/arbol`](#endpoint-presupuestocontroller-arbolversion) | JWT + `control_presupuestario.presupuesto.ver` |
| GET | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas`](#endpoint-presupuestocontroller-listarpartidas) | JWT + `control_presupuestario.presupuesto.ver` |
| POST | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas`](#endpoint-presupuestocontroller-agregarpartida) | JWT + `control_presupuestario.presupuesto.editar_detalle` |
| PUT | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/lote`](#endpoint-presupuestocontroller-cargarlote) | JWT + `control_presupuestario.presupuesto.editar_detalle` |
| POST | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/importar`](#endpoint-presupuestocontroller-importarpartidas) | JWT + `control_presupuestario.presupuesto.editar_detalle` |
| GET | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/plantilla`](#endpoint-presupuestocontroller-plantillapartidas) | JWT + `control_presupuestario.presupuesto.editar_detalle` |
| POST | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/importar-estructura`](#endpoint-presupuestocontroller-importarestructura) | JWT + `control_presupuestario.presupuesto.editar_detalle` + `control_presupuestario.partida.crear` |
| GET | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/plantilla-estructura`](#endpoint-presupuestocontroller-plantillaestructura) | JWT + `control_presupuestario.presupuesto.editar_detalle` |
| PUT | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/{detalleId:int}`](#endpoint-presupuestocontroller-actualizarpartida) | JWT + `control_presupuestario.presupuesto.editar_detalle` |
| DELETE | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/{detalleId:int}`](#endpoint-presupuestocontroller-eliminarpartida) | JWT + `control_presupuestario.presupuesto.editar_detalle` |
| GET | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/{detalleId:int}/movimientos`](#endpoint-presupuestocontroller-listarmovimientos) | JWT + `control_presupuestario.movimiento.ver` |
| POST | [`/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/{detalleId:int}/ajustes`](#endpoint-presupuestocontroller-registrarajuste) | JWT + `control_presupuestario.presupuesto.registrar_ajuste` |
| GET | [`/api/control-presupuestario/movimientos/{idMovimiento:long}`](#endpoint-presupuestocontroller-obtenermovimiento) | JWT + `control_presupuestario.movimiento.ver` |

<a id="endpoint-presupuestocontroller-listar"></a>
#### GET `/api/control-presupuestario/presupuestos`

**Acceso:** JWT + `control_presupuestario.presupuesto.ver`. **Acción:** `PresupuestoController.Listar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `activo` | query | bool? | Admite null / omisión según binding |
| `idCentroCosto` | query | int? | Admite null / omisión según binding |
| `idMoneda` | query | int? | Admite null / omisión según binding |
| `busqueda` | query | string? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [PresupuestoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-presupuestoresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción Listar](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-obtener"></a>
#### GET `/api/control-presupuestario/presupuestos/{id:int}`

**Acceso:** JWT + `control_presupuestario.presupuesto.ver`. **Acción:** `PresupuestoController.Obtener`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [PresupuestoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-presupuestoresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción Obtener](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-crear"></a>
#### POST `/api/control-presupuestario/presupuestos`

**Acceso:** JWT + `control_presupuestario.presupuesto.crear`. **Acción:** `PresupuestoController.Crear`.

Crea el presupuesto y su versión 1 BORRADOR en una transacción. Incluye Location.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `r` | cuerpo JSON | [CrearPresupuestoRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-crearpresupuestorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 201 | [CrearPresupuestoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-crearpresupuestoresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción Crear](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-actualizar"></a>
#### PUT `/api/control-presupuestario/presupuestos/{id:int}`

**Acceso:** JWT + `control_presupuestario.presupuesto.actualizar`. **Acción:** `PresupuestoController.Actualizar`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `r` | cuerpo JSON | [ActualizarPresupuestoRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-actualizarpresupuestorequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [PresupuestoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-presupuestoresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción Actualizar](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-listarversiones"></a>
#### GET `/api/control-presupuestario/presupuestos/{id:int}/versiones`

**Acceso:** JWT + `control_presupuestario.presupuesto.ver`. **Acción:** `PresupuestoController.ListarVersiones`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [PresupuestoVersionResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-presupuestoversionresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción ListarVersiones](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-crearversion"></a>
#### POST `/api/control-presupuestario/presupuestos/{id:int}/versiones`

**Acceso:** JWT + `control_presupuestario.version.crear`. **Acción:** `PresupuestoController.CrearVersion`.

Copia la versión APROBADO vigente. El código contempla r nullable; enviar al menos {} cuando no haya descripción ni motivo.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `r` | cuerpo JSON | [CrearVersionRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-crearversionrequest)? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 201 | [CrearVersionResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-crearversionresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción CrearVersion](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-obtenerversion"></a>
#### GET `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}`

**Acceso:** JWT + `control_presupuestario.presupuesto.ver`. **Acción:** `PresupuestoController.ObtenerVersion`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [PresupuestoVersionResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-presupuestoversionresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción ObtenerVersion](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-aprobarversion"></a>
#### POST `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/aprobar`

**Acceso:** JWT + `control_presupuestario.version.aprobar`. **Acción:** `PresupuestoController.AprobarVersion`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [PresupuestoVersionResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-presupuestoversionresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción AprobarVersion](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-anularversion"></a>
#### POST `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/anular`

**Acceso:** JWT + `control_presupuestario.version.anular`. **Acción:** `PresupuestoController.AnularVersion`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |
| `r` | cuerpo JSON | [AnularVersionRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-anularversionrequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [PresupuestoVersionResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-presupuestoversionresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción AnularVersion](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-arbolversion"></a>
#### GET `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/arbol`

**Acceso:** JWT + `control_presupuestario.presupuesto.ver`. **Acción:** `PresupuestoController.ArbolVersion`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [ArbolPresupuestarioResult](#schema-cobranzas-vittoria-controlpresupuestario-application-consultapresupuestaria-arbol-arbolpresupuestarioresult) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción ArbolVersion](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-listarpartidas"></a>
#### GET `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas`

**Acceso:** JWT + `control_presupuestario.presupuesto.ver`. **Acción:** `PresupuestoController.ListarPartidas`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [PartidaVersionResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-partidaversionresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción ListarPartidas](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-agregarpartida"></a>
#### POST `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas`

**Acceso:** JWT + `control_presupuestario.presupuesto.editar_detalle`. **Acción:** `PresupuestoController.AgregarPartida`.

Incluye Location del detalle creado. No existe un GET individual de partida con esa misma ruta; se consulta en el listado de la versión.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |
| `r` | cuerpo JSON | [AgregarPartidaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-agregarpartidarequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 201 | [PartidaVersionResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-partidaversionresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción AgregarPartida](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-cargarlote"></a>
#### PUT `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/lote`

**Acceso:** JWT + `control_presupuestario.presupuesto.editar_detalle`. **Acción:** `PresupuestoController.CargarLote`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |
| `r` | cuerpo JSON | [CargaLoteRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-cargaloterequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [CargaLoteResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-cargaloteresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción CargarLote](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-importarpartidas"></a>
#### POST `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/importar`

**Acceso:** JWT + `control_presupuestario.presupuesto.editar_detalle`. **Acción:** `PresupuestoController.ImportarPartidas`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |
| `archivo` | formulario multipart | archivo binario? | Admite null / omisión según binding |
| `quitarAusentes` | formulario multipart | bool | Sin default explícito; validar según esquema |

**Máximo del cuerpo HTTP:** `11000000` bytes. Los límites de archivo adicionales se describen en [reglas](#reglas).

| HTTP | Cuerpo |
|---|---|
| 200 | [CargaLoteResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-cargaloteresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica; 400: archivo/estructura; 413: tamaño; 415: Content-Type; 422: errores del lote sin persistencia parcial. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción ImportarPartidas](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-plantillapartidas"></a>
#### GET `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/plantilla`

**Acceso:** JWT + `control_presupuestario.presupuesto.editar_detalle`. **Acción:** `PresupuestoController.PlantillaPartidas`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |
| `formato` | query | string? | Default: `"csv"` |

| HTTP | Cuerpo |
|---|---|
| 200 | archivo binario; `text/csv; charset=utf-8` |
| 200 | archivo binario; `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica; 400: FORMATO_PLANTILLA_INVALIDO si admite formato. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción PlantillaPartidas](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-importarestructura"></a>
#### POST `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/importar-estructura`

**Acceso:** JWT + `control_presupuestario.presupuesto.editar_detalle` + `control_presupuestario.partida.crear`. **Acción:** `PresupuestoController.ImportarEstructura`.

Requiere ambos permisos. Crea las partidas faltantes y carga montos de hojas de forma atómica.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |
| `archivo` | formulario multipart | archivo binario? | Admite null / omisión según binding |
| `quitarAusentes` | formulario multipart | bool | Sin default explícito; validar según esquema |

**Máximo del cuerpo HTTP:** `11000000` bytes. Los límites de archivo adicionales se describen en [reglas](#reglas).

| HTTP | Cuerpo |
|---|---|
| 200 | [ImportarEstructuraResult](#schema-cobranzas-vittoria-controlpresupuestario-application-presupuestodetalle-importarestructura-importarestructuraresult) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica; 400: archivo/estructura; 413: tamaño; 415: Content-Type; 422: errores del lote sin persistencia parcial. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción ImportarEstructura](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-plantillaestructura"></a>
#### GET `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/plantilla-estructura`

**Acceso:** JWT + `control_presupuestario.presupuesto.editar_detalle`. **Acción:** `PresupuestoController.PlantillaEstructura`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |
| `formato` | query | string? | Default: `"xlsx"` |

| HTTP | Cuerpo |
|---|---|
| 200 | archivo binario; `text/csv; charset=utf-8` |
| 200 | archivo binario; `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica; 400: FORMATO_PLANTILLA_INVALIDO si admite formato. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción PlantillaEstructura](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-actualizarpartida"></a>
#### PUT `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/{detalleId:int}`

**Acceso:** JWT + `control_presupuestario.presupuesto.editar_detalle`. **Acción:** `PresupuestoController.ActualizarPartida`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |
| `detalleId` | ruta | int | Segmento obligatorio |
| `r` | cuerpo JSON | [ActualizarPartidaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-actualizarpartidarequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [PartidaVersionResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-partidaversionresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción ActualizarPartida](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-eliminarpartida"></a>
#### DELETE `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/{detalleId:int}`

**Acceso:** JWT + `control_presupuestario.presupuesto.editar_detalle`. **Acción:** `PresupuestoController.EliminarPartida`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |
| `detalleId` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 204 | sin cuerpo |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción EliminarPartida](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-listarmovimientos"></a>
#### GET `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/{detalleId:int}/movimientos`

**Acceso:** JWT + `control_presupuestario.movimiento.ver`. **Acción:** `PresupuestoController.ListarMovimientos`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |
| `detalleId` | ruta | int | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [MovimientoPresupuestalResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-movimientopresupuestal-movimientopresupuestalresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción ListarMovimientos](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-registrarajuste"></a>
#### POST `/api/control-presupuestario/presupuestos/{id:int}/versiones/{versionId:int}/partidas/{detalleId:int}/ajustes`

**Acceso:** JWT + `control_presupuestario.presupuesto.registrar_ajuste`. **Acción:** `PresupuestoController.RegistrarAjuste`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `id` | ruta | int | Segmento obligatorio |
| `versionId` | ruta | int | Segmento obligatorio |
| `detalleId` | ruta | int | Segmento obligatorio |
| `r` | cuerpo JSON | [RegistrarAjusteRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-registrarajusterequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 201 | [MovimientoPresupuestalResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-movimientopresupuestal-movimientopresupuestalresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción RegistrarAjuste](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="endpoint-presupuestocontroller-obtenermovimiento"></a>
#### GET `/api/control-presupuestario/movimientos/{idMovimiento:long}`

**Acceso:** JWT + `control_presupuestario.movimiento.ver`. **Acción:** `PresupuestoController.ObtenerMovimiento`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idMovimiento` | ruta | long | Segmento obligatorio |

| HTTP | Cuerpo |
|---|---|
| 200 | [MovimientoPresupuestalResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-movimientopresupuestal-movimientopresupuestalresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [PresupuestoController.cs, acción ObtenerMovimiento](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/PresupuestoController.cs).

<a id="grupo-control-presupuestario-consultas"></a>
### Control Presupuestario: consultas

| Método | Ruta | Acceso |
|---|---|---|
| GET | [`/api/control-presupuestario/consultas/resumen`](#endpoint-consultapresupuestariacontroller-resumen) | JWT + `control_presupuestario.reporte.ver` |
| GET | [`/api/control-presupuestario/consultas/presupuesto-vs-comprometido`](#endpoint-consultapresupuestariacontroller-presupuestovscomprometido) | JWT + `control_presupuestario.reporte.ver` |
| GET | [`/api/control-presupuestario/consultas/presupuesto-vs-ejecutado`](#endpoint-consultapresupuestariacontroller-presupuestovsejecutado) | JWT + `control_presupuestario.reporte.ver` |
| GET | [`/api/control-presupuestario/consultas/saldo`](#endpoint-consultapresupuestariacontroller-saldo) | JWT + `control_presupuestario.reporte.ver` |
| GET | [`/api/control-presupuestario/consultas/gastos-por-partida`](#endpoint-consultapresupuestariacontroller-gastosporpartida) | JWT + `control_presupuestario.reporte.ver` |
| GET | [`/api/control-presupuestario/consultas/gastos-por-centro-costo`](#endpoint-consultapresupuestariacontroller-gastosporcentrocosto) | JWT + `control_presupuestario.reporte.ver` |
| GET | [`/api/control-presupuestario/consultas/vigente`](#endpoint-consultapresupuestariacontroller-vigente) | JWT + `control_presupuestario.reporte.ver` |
| GET | [`/api/control-presupuestario/consultas/dashboard`](#endpoint-consultapresupuestariacontroller-dashboard) | JWT + `control_presupuestario.reporte.ver` |
| GET | [`/api/control-presupuestario/consultas/arbol`](#endpoint-consultapresupuestariacontroller-arbol) | JWT + `control_presupuestario.reporte.ver` |

<a id="endpoint-consultapresupuestariacontroller-resumen"></a>
#### GET `/api/control-presupuestario/consultas/resumen`

**Acceso:** JWT + `control_presupuestario.reporte.ver`. **Acción:** `ConsultaPresupuestariaController.Resumen`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `filtro` | query (propiedades del DTO) | [ConsultaPresupuestariaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-consultapresupuestariarequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [ResumenResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-resumenresponse) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ConsultaPresupuestariaController.cs, acción Resumen](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/ConsultaPresupuestariaController.cs).

<a id="endpoint-consultapresupuestariacontroller-presupuestovscomprometido"></a>
#### GET `/api/control-presupuestario/consultas/presupuesto-vs-comprometido`

**Acceso:** JWT + `control_presupuestario.reporte.ver`. **Acción:** `ConsultaPresupuestariaController.PresupuestoVsComprometido`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `filtro` | query (propiedades del DTO) | [ConsultaPresupuestariaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-consultapresupuestariarequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [PresupuestoVsComprometidoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-presupuestovscomprometidoresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ConsultaPresupuestariaController.cs, acción PresupuestoVsComprometido](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/ConsultaPresupuestariaController.cs).

<a id="endpoint-consultapresupuestariacontroller-presupuestovsejecutado"></a>
#### GET `/api/control-presupuestario/consultas/presupuesto-vs-ejecutado`

**Acceso:** JWT + `control_presupuestario.reporte.ver`. **Acción:** `ConsultaPresupuestariaController.PresupuestoVsEjecutado`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `filtro` | query (propiedades del DTO) | [ConsultaPresupuestariaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-consultapresupuestariarequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [PresupuestoVsEjecutadoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-presupuestovsejecutadoresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ConsultaPresupuestariaController.cs, acción PresupuestoVsEjecutado](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/ConsultaPresupuestariaController.cs).

<a id="endpoint-consultapresupuestariacontroller-saldo"></a>
#### GET `/api/control-presupuestario/consultas/saldo`

**Acceso:** JWT + `control_presupuestario.reporte.ver`. **Acción:** `ConsultaPresupuestariaController.Saldo`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `filtro` | query (propiedades del DTO) | [ConsultaPresupuestariaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-consultapresupuestariarequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [SaldoPartidaResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-saldopartidaresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ConsultaPresupuestariaController.cs, acción Saldo](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/ConsultaPresupuestariaController.cs).

<a id="endpoint-consultapresupuestariacontroller-gastosporpartida"></a>
#### GET `/api/control-presupuestario/consultas/gastos-por-partida`

**Acceso:** JWT + `control_presupuestario.reporte.ver`. **Acción:** `ConsultaPresupuestariaController.GastosPorPartida`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `filtro` | query (propiedades del DTO) | [ConsultaPresupuestariaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-consultapresupuestariarequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [GastoPorPartidaResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-gastoporpartidaresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ConsultaPresupuestariaController.cs, acción GastosPorPartida](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/ConsultaPresupuestariaController.cs).

<a id="endpoint-consultapresupuestariacontroller-gastosporcentrocosto"></a>
#### GET `/api/control-presupuestario/consultas/gastos-por-centro-costo`

**Acceso:** JWT + `control_presupuestario.reporte.ver`. **Acción:** `ConsultaPresupuestariaController.GastosPorCentroCosto`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `filtro` | query (propiedades del DTO) | [ConsultaPresupuestariaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-consultapresupuestariarequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [GastoPorCentroCostoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-gastoporcentrocostoresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ConsultaPresupuestariaController.cs, acción GastosPorCentroCosto](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/ConsultaPresupuestariaController.cs).

<a id="endpoint-consultapresupuestariacontroller-vigente"></a>
#### GET `/api/control-presupuestario/consultas/vigente`

**Acceso:** JWT + `control_presupuestario.reporte.ver`. **Acción:** `ConsultaPresupuestariaController.Vigente`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `filtro` | query (propiedades del DTO) | [ConsultaPresupuestariaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-consultapresupuestariarequest) | Sin default explícito; validar según esquema |

| HTTP | Cuerpo |
|---|---|
| 200 | [SaldoPartidaResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-saldopartidaresponse)[] |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ConsultaPresupuestariaController.cs, acción Vigente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/ConsultaPresupuestariaController.cs).

<a id="endpoint-consultapresupuestariacontroller-dashboard"></a>
#### GET `/api/control-presupuestario/consultas/dashboard`

**Acceso:** JWT + `control_presupuestario.reporte.ver`. **Acción:** `ConsultaPresupuestariaController.Dashboard`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idCentroCosto` | query | int | Sin default explícito; validar según esquema |
| `idPresupuesto` | query | int? | Admite null / omisión según binding |
| `nivel` | query | int? | Admite null / omisión según binding |
| `idPartidaPadre` | query | int? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [Tablero](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablero) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ConsultaPresupuestariaController.cs, acción Dashboard](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/ConsultaPresupuestariaController.cs).

<a id="endpoint-consultapresupuestariacontroller-arbol"></a>
#### GET `/api/control-presupuestario/consultas/arbol`

**Acceso:** JWT + `control_presupuestario.reporte.ver`. **Acción:** `ConsultaPresupuestariaController.Arbol`.

| Parámetro | Ubicación | Tipo / esquema | Nulabilidad / valor por defecto |
|---|---|---|---|
| `idCentroCosto` | query | int | Sin default explícito; validar según esquema |
| `idPresupuesto` | query | int? | Admite null / omisión según binding |

| HTTP | Cuerpo |
|---|---|
| 200 | [ArbolPresupuestarioResult](#schema-cobranzas-vittoria-controlpresupuestario-application-consultapresupuestaria-arbol-arbolpresupuestarioresult) |

**Errores:** 400: binding/DataAnnotations; 500: fallo no controlado o SQL; 401: JWT; 403: autorización; 400: validación presupuestaria; 404: recurso ausente; 409: regla presupuestaria cuando aplica. Los códigos dependen de la condición encontrada; ver el catálogo de errores.

Fuente: [ConsultaPresupuestariaController.cs, acción Arbol](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Controller/ConsultaPresupuestariaController.cs).

<a id="esquemas"></a>
## Esquemas de request y response

**164 esquemas alcanzables** desde los endpoints, incluidos objetos anidados y respuestas legacy reconstruidas desde servicios/repositorios. Los nombres de campo son los que se serializan en JSON. Los nombres de los esquemas `Adicional.*` son etiquetas documentales para objetos anónimos o filas SQL, no nuevas clases del proyecto.

Los tipos son notación de contrato: `int` = entero de 32 bits, `long` = entero de 64 bits, `decimal` = número decimal JSON, `bool` = booleano, `string` = texto, `DateOnly` / `DateTime` = cadenas de fecha, `T[]` = arreglo. `?` permite null en C#. La columna de nulabilidad no sustituye a las restricciones de DataAnnotations ni implica que siempre pueda omitirse una propiedad requerida. Inicializadores `new()` representan la colección/objeto vacío del tipo indicado.

| Esquema | Origen |
|---|---|
| [CompraDetalleResponse](#schema-adicional-compradetalleresponse) | `Adicional.CompraDetalleResponse` |
| [CompraDocumentoFilaSql](#schema-adicional-compradocumentofilasql) | `Adicional.CompraDocumentoFilaSql` |
| [CompraFilaSql](#schema-adicional-comprafilasql) | `Adicional.CompraFilaSql` |
| [CompraItemFilaSql](#schema-adicional-compraitemfilasql) | `Adicional.CompraItemFilaSql` |
| [CompraPendienteOcFilaSql](#schema-adicional-comprapendienteocfilasql) | `Adicional.CompraPendienteOcFilaSql` |
| [Compras_CrearResponse](#schema-adicional-compras-crearresponse) | `Adicional.Compras_CrearResponse` |
| [KardexMovimientoLegacyFilaSql](#schema-adicional-kardexmovimientolegacyfilasql) | `Adicional.KardexMovimientoLegacyFilaSql` |
| [Kardex_RegistrarSalidaManualLegacyResponse](#schema-adicional-kardex-registrarsalidamanuallegacyresponse) | `Adicional.Kardex_RegistrarSalidaManualLegacyResponse` |
| [OrdenesCompra_CrearResponse](#schema-adicional-ordenescompra-crearresponse) | `Adicional.OrdenesCompra_CrearResponse` |
| [OrdenesCompra_GetResponse](#schema-adicional-ordenescompra-getresponse) | `Adicional.OrdenesCompra_GetResponse` |
| [Proveedores_GetResponse](#schema-adicional-proveedores-getresponse) | `Adicional.Proveedores_GetResponse` |
| [Requerimientos_GetResponse](#schema-adicional-requerimientos-getresponse) | `Adicional.Requerimientos_GetResponse` |
| [Valorizaciones_DeleteDetalleResponse](#schema-adicional-valorizaciones-deletedetalleresponse) | `Adicional.Valorizaciones_DeleteDetalleResponse` |
| [Valorizaciones_GetByConfiguracionResponse](#schema-adicional-valorizaciones-getbyconfiguracionresponse) | `Adicional.Valorizaciones_GetByConfiguracionResponse` |
| [Valorizaciones_GetByConfiguracionResponse_cabecera](#schema-adicional-valorizaciones-getbyconfiguracionresponse-cabecera) | `Adicional.Valorizaciones_GetByConfiguracionResponse_cabecera` |
| [Valorizaciones_GetByConfiguracionResponse_detalle](#schema-adicional-valorizaciones-getbyconfiguracionresponse-detalle) | `Adicional.Valorizaciones_GetByConfiguracionResponse_detalle` |
| [Valorizaciones_GetByConfiguracionResponse_detalle_archivos](#schema-adicional-valorizaciones-getbyconfiguracionresponse-detalle-archivos) | `Adicional.Valorizaciones_GetByConfiguracionResponse_detalle_archivos` |
| [Valorizaciones_GetByConfiguracionResponse_resumen](#schema-adicional-valorizaciones-getbyconfiguracionresponse-resumen) | `Adicional.Valorizaciones_GetByConfiguracionResponse_resumen` |
| [Valorizaciones_GetByConfiguracionResponse_resumen_facturas](#schema-adicional-valorizaciones-getbyconfiguracionresponse-resumen-facturas) | `Adicional.Valorizaciones_GetByConfiguracionResponse_resumen_facturas` |
| [Valorizaciones_GetResponse](#schema-adicional-valorizaciones-getresponse) | `Adicional.Valorizaciones_GetResponse` |
| [Valorizaciones_GetResponse_cabecera](#schema-adicional-valorizaciones-getresponse-cabecera) | `Adicional.Valorizaciones_GetResponse_cabecera` |
| [Valorizaciones_GetResponse_detalle](#schema-adicional-valorizaciones-getresponse-detalle) | `Adicional.Valorizaciones_GetResponse_detalle` |
| [Valorizaciones_GetResponse_detalle_archivos](#schema-adicional-valorizaciones-getresponse-detalle-archivos) | `Adicional.Valorizaciones_GetResponse_detalle_archivos` |
| [Valorizaciones_GetResponse_resumen](#schema-adicional-valorizaciones-getresponse-resumen) | `Adicional.Valorizaciones_GetResponse_resumen` |
| [Valorizaciones_GetResponse_resumen_facturas](#schema-adicional-valorizaciones-getresponse-resumen-facturas) | `Adicional.Valorizaciones_GetResponse_resumen_facturas` |
| [Valorizaciones_ListConfiguracionesResponse](#schema-adicional-valorizaciones-listconfiguracionesresponse) | `Adicional.Valorizaciones_ListConfiguracionesResponse` |
| [Valorizaciones_ListResponse](#schema-adicional-valorizaciones-listresponse) | `Adicional.Valorizaciones_ListResponse` |
| [Valorizaciones_UpsertConfiguracionResponse](#schema-adicional-valorizaciones-upsertconfiguracionresponse) | `Adicional.Valorizaciones_UpsertConfiguracionResponse` |
| [Valorizaciones_UpsertDetalleResponse](#schema-adicional-valorizaciones-upsertdetalleresponse) | `Adicional.Valorizaciones_UpsertDetalleResponse` |
| [Valorizaciones_UpsertResponse](#schema-adicional-valorizaciones-upsertresponse) | `Adicional.Valorizaciones_UpsertResponse` |
| [DetalleErrorFila](#schema-cobranzas-vittoria-application-importacion-excepciones-detalleerrorfila) | `Cobranzas_Vittoria.Application.Importacion.Excepciones.DetalleErrorFila` |
| [ResultadoImportacion](#schema-cobranzas-vittoria-application-importacion-processors-resultadoimportacion) | `Cobranzas_Vittoria.Application.Importacion.Processors.ResultadoImportacion` |
| [KardexEntradaCreateDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexentradacreatedto) | `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexEntradaCreateDto` |
| [KardexEntradaResponseDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexentradaresponsedto) | `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexEntradaResponseDto` |
| [KardexSalidaCreateDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidacreatedto) | `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexSalidaCreateDto` |
| [KardexSalidaItemCreateDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidaitemcreatedto) | `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexSalidaItemCreateDto` |
| [KardexSalidaResponseDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidaresponsedto) | `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexSalidaResponseDto` |
| [KardexStockActualResponseDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexstockactualresponsedto) | `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexStockActualResponseDto` |
| [ActualizarItemRequerimientoRequest](#schema-cobranzas-vittoria-compras-presentation-dto-actualizaritemrequerimientorequest) | `Cobranzas_Vittoria.Compras.Presentation.Dto.ActualizarItemRequerimientoRequest` |
| [AgregarItemRequerimientoRequest](#schema-cobranzas-vittoria-compras-presentation-dto-agregaritemrequerimientorequest) | `Cobranzas_Vittoria.Compras.Presentation.Dto.AgregarItemRequerimientoRequest` |
| [RequerimientoItemResponse](#schema-cobranzas-vittoria-compras-presentation-dto-requerimientoitemresponse) | `Cobranzas_Vittoria.Compras.Presentation.Dto.RequerimientoItemResponse` |
| [ResultadoImportacionGastosDirectos](#schema-cobranzas-vittoria-contable-gastosdirectos-application-importar-resultadoimportaciongastosdirectos) | `Cobranzas_Vittoria.Contable.GastosDirectos.Application.Importar.ResultadoImportacionGastosDirectos` |
| [CategoriaGastoDirecto](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-categoriagastodirecto) | `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.CategoriaGastoDirecto` |
| [CentroCostoGastoDirecto](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-centrocostogastodirecto) | `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.CentroCostoGastoDirecto` |
| [GastoDirecto](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-gastodirecto) | `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.GastoDirecto` |
| [GastoDirectoDocumento](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-gastodirectodocumento) | `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.GastoDirectoDocumento` |
| [PartidaDisponibleGasto](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-partidadisponiblegasto) | `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.PartidaDisponibleGasto` |
| [ProveedorGastoDirecto](#schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-proveedorgastodirecto) | `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.ProveedorGastoDirecto` |
| [GastoDirectoUpsertRequest](#schema-cobranzas-vittoria-contable-gastosdirectos-presentation-dto-gastodirectoupsertrequest) | `Cobranzas_Vittoria.Contable.GastosDirectos.Presentation.Dto.GastoDirectoUpsertRequest` |
| [ResultadoImportacion](#schema-cobranzas-vittoria-controlpresupuestario-application-common-resultadoimportacion) | `Cobranzas_Vittoria.ControlPresupuestario.Application.Common.ResultadoImportacion` |
| [ArbolPresupuestarioResult](#schema-cobranzas-vittoria-controlpresupuestario-application-consultapresupuestaria-arbol-arbolpresupuestarioresult) | `Cobranzas_Vittoria.ControlPresupuestario.Application.ConsultaPresupuestaria.Arbol.ArbolPresupuestarioResult` |
| [EncabezadoArbol](#schema-cobranzas-vittoria-controlpresupuestario-application-consultapresupuestaria-arbol-encabezadoarbol) | `Cobranzas_Vittoria.ControlPresupuestario.Application.ConsultaPresupuestaria.Arbol.EncabezadoArbol` |
| [ResumenTotales](#schema-cobranzas-vittoria-controlpresupuestario-application-consultapresupuestaria-resumen-resumentotales) | `Cobranzas_Vittoria.ControlPresupuestario.Application.ConsultaPresupuestaria.Resumen.ResumenTotales` |
| [ImportarEstructuraResult](#schema-cobranzas-vittoria-controlpresupuestario-application-presupuestodetalle-importarestructura-importarestructuraresult) | `Cobranzas_Vittoria.ControlPresupuestario.Application.PresupuestoDetalle.ImportarEstructura.ImportarEstructuraResult` |
| [NodoArbol](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-nodoarbol) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.NodoArbol` |
| [Tablero](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablero) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.Tablero` |
| [TableroAlCorte](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableroalcorte) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroAlCorte` |
| [TableroDesviacionRubro](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablerodesviacionrubro) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroDesviacionRubro` |
| [TableroEncabezado](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableroencabezado) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroEncabezado` |
| [TableroPuntoSemana](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableropuntosemana) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroPuntoSemana` |
| [TableroRama](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablerorama) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroRama` |
| [TableroResumen](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableroresumen) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroResumen` |
| [TableroRubro](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablerorubro) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroRubro` |
| [TotalesArbol](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-totalesarbol) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TotalesArbol` |
| [EstadoPresupuesto](#schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-estadopresupuesto) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.ValueObject.EstadoPresupuesto` |
| [Moneda](#schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-moneda) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.ValueObject.Moneda` |
| [TipoCentroCosto](#schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-tipocentrocosto) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.ValueObject.TipoCentroCosto` |
| [TipoMovimientoPresupuestal](#schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-tipomovimientopresupuestal) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.ValueObject.TipoMovimientoPresupuestal` |
| [TipoPartida](#schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-tipopartida) | `Cobranzas_Vittoria.ControlPresupuestario.Domain.ValueObject.TipoPartida` |
| [ActualizarCatalogoPartidaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-actualizarcatalogopartidarequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CatalogoPartida.ActualizarCatalogoPartidaRequest` |
| [CatalogoPartidaResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-catalogopartidaresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CatalogoPartida.CatalogoPartidaResponse` |
| [CrearCatalogoPartidaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-crearcatalogopartidarequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CatalogoPartida.CrearCatalogoPartidaRequest` |
| [ActualizarCentroCostoRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-actualizarcentrocostorequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CentroCosto.ActualizarCentroCostoRequest` |
| [CentroCostoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-centrocostoresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CentroCosto.CentroCostoResponse` |
| [CrearCentroCostoRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-crearcentrocostorequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CentroCosto.CrearCentroCostoRequest` |
| [ConsultaPresupuestariaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-consultapresupuestariarequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.ConsultaPresupuestariaRequest` |
| [GastoPorCentroCostoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-gastoporcentrocostoresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.GastoPorCentroCostoResponse` |
| [GastoPorPartidaResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-gastoporpartidaresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.GastoPorPartidaResponse` |
| [PresupuestoVsComprometidoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-presupuestovscomprometidoresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.PresupuestoVsComprometidoResponse` |
| [PresupuestoVsEjecutadoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-presupuestovsejecutadoresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.PresupuestoVsEjecutadoResponse` |
| [ResumenResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-resumenresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.ResumenResponse` |
| [SaldoPartidaResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-saldopartidaresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.SaldoPartidaResponse` |
| [MovimientoPresupuestalResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-movimientopresupuestal-movimientopresupuestalresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.MovimientoPresupuestal.MovimientoPresupuestalResponse` |
| [ActualizarPresupuestoRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-actualizarpresupuestorequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.Presupuesto.ActualizarPresupuestoRequest` |
| [CrearPresupuestoRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-crearpresupuestorequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.Presupuesto.CrearPresupuestoRequest` |
| [CrearPresupuestoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-crearpresupuestoresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.Presupuesto.CrearPresupuestoResponse` |
| [PresupuestoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-presupuestoresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.Presupuesto.PresupuestoResponse` |
| [ActualizarPartidaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-actualizarpartidarequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.ActualizarPartidaRequest` |
| [AgregarPartidaRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-agregarpartidarequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.AgregarPartidaRequest` |
| [CargaLoteItemRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-cargaloteitemrequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.CargaLoteItemRequest` |
| [CargaLoteRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-cargaloterequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.CargaLoteRequest` |
| [CargaLoteResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-cargaloteresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.CargaLoteResponse` |
| [PartidaVersionResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-partidaversionresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.PartidaVersionResponse` |
| [RegistrarAjusteRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-registrarajusterequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.RegistrarAjusteRequest` |
| [AnularVersionRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-anularversionrequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoVersion.AnularVersionRequest` |
| [CrearVersionRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-crearversionrequest) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoVersion.CrearVersionRequest` |
| [CrearVersionResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-crearversionresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoVersion.CrearVersionResponse` |
| [PresupuestoVersionResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-presupuestoversionresponse) | `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoVersion.PresupuestoVersionResponse` |
| [KardexSalidaCreateDto](#schema-cobranzas-vittoria-dtos-almacen-kardexsalidacreatedto) | `Cobranzas_Vittoria.Dtos.Almacen.KardexSalidaCreateDto` |
| [CompraAceptarDto](#schema-cobranzas-vittoria-dtos-compras-compraaceptardto) | `Cobranzas_Vittoria.Dtos.Compras.CompraAceptarDto` |
| [CompraCreateDto](#schema-cobranzas-vittoria-dtos-compras-compracreatedto) | `Cobranzas_Vittoria.Dtos.Compras.CompraCreateDto` |
| [CompraDetalleCreateDto](#schema-cobranzas-vittoria-dtos-compras-compradetallecreatedto) | `Cobranzas_Vittoria.Dtos.Compras.CompraDetalleCreateDto` |
| [OrdenCompraCreateDto](#schema-cobranzas-vittoria-dtos-compras-ordencompracreatedto) | `Cobranzas_Vittoria.Dtos.Compras.OrdenCompraCreateDto` |
| [OrdenCompraDetalleCreateDto](#schema-cobranzas-vittoria-dtos-compras-ordencompradetallecreatedto) | `Cobranzas_Vittoria.Dtos.Compras.OrdenCompraDetalleCreateDto` |
| [OrdenCompraDetalleUpdateDto](#schema-cobranzas-vittoria-dtos-compras-ordencompradetalleupdatedto) | `Cobranzas_Vittoria.Dtos.Compras.OrdenCompraDetalleUpdateDto` |
| [OrdenCompraEstadoDto](#schema-cobranzas-vittoria-dtos-compras-ordencompraestadodto) | `Cobranzas_Vittoria.Dtos.Compras.OrdenCompraEstadoDto` |
| [OrdenCompraUpdateDto](#schema-cobranzas-vittoria-dtos-compras-ordencompraupdatedto) | `Cobranzas_Vittoria.Dtos.Compras.OrdenCompraUpdateDto` |
| [RequerimientoCreateDto](#schema-cobranzas-vittoria-dtos-compras-requerimientocreatedto) | `Cobranzas_Vittoria.Dtos.Compras.RequerimientoCreateDto` |
| [RequerimientoDetalleCreateDto](#schema-cobranzas-vittoria-dtos-compras-requerimientodetallecreatedto) | `Cobranzas_Vittoria.Dtos.Compras.RequerimientoDetalleCreateDto` |
| [RequerimientoDetalleUpdateDto](#schema-cobranzas-vittoria-dtos-compras-requerimientodetalleupdatedto) | `Cobranzas_Vittoria.Dtos.Compras.RequerimientoDetalleUpdateDto` |
| [RequerimientoUpdateDto](#schema-cobranzas-vittoria-dtos-compras-requerimientoupdatedto) | `Cobranzas_Vittoria.Dtos.Compras.RequerimientoUpdateDto` |
| [AprobarRequerimientoRequest](#schema-cobranzas-vittoria-dtos-compras-requerimientos-aprobarrequerimientorequest) | `Cobranzas_Vittoria.Dtos.Compras.Requerimientos.AprobarRequerimientoRequest` |
| [EnviarRequerimientoComprasRequest](#schema-cobranzas-vittoria-dtos-compras-requerimientos-enviarrequerimientocomprasrequest) | `Cobranzas_Vittoria.Dtos.Compras.Requerimientos.EnviarRequerimientoComprasRequest` |
| [EnviarRequerimientoRequest](#schema-cobranzas-vittoria-dtos-compras-requerimientos-enviarrequerimientorequest) | `Cobranzas_Vittoria.Dtos.Compras.Requerimientos.EnviarRequerimientoRequest` |
| [ProcesarStockRequerimientoRequest](#schema-cobranzas-vittoria-dtos-compras-requerimientos-procesarstockrequerimientorequest) | `Cobranzas_Vittoria.Dtos.Compras.Requerimientos.ProcesarStockRequerimientoRequest` |
| [RechazarRequerimientoRequest](#schema-cobranzas-vittoria-dtos-compras-requerimientos-rechazarrequerimientorequest) | `Cobranzas_Vittoria.Dtos.Compras.Requerimientos.RechazarRequerimientoRequest` |
| [ProveedorTerrenoUpsertDto](#schema-cobranzas-vittoria-dtos-contable-proveedorterrenoupsertdto) | `Cobranzas_Vittoria.Dtos.Contable.ProveedorTerrenoUpsertDto` |
| [CategoriaGastoUpsertDto](#schema-cobranzas-vittoria-dtos-gastosadministrativos-categoriagastoupsertdto) | `Cobranzas_Vittoria.Dtos.GastosAdministrativos.CategoriaGastoUpsertDto` |
| [ProveedorGastoAdministrativoUpsertDto](#schema-cobranzas-vittoria-dtos-gastosadministrativos-proveedorgastoadministrativoupsertdto) | `Cobranzas_Vittoria.Dtos.GastosAdministrativos.ProveedorGastoAdministrativoUpsertDto` |
| [EspecialidadUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-especialidadupsertdto) | `Cobranzas_Vittoria.Dtos.Maestra.EspecialidadUpsertDto` |
| [MaterialUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-materialupsertdto) | `Cobranzas_Vittoria.Dtos.Maestra.MaterialUpsertDto` |
| [ProveedorConsultaSunatDto](#schema-cobranzas-vittoria-dtos-maestra-proveedorconsultasunatdto) | `Cobranzas_Vittoria.Dtos.Maestra.ProveedorConsultaSunatDto` |
| [ProveedorEspecialidadDto](#schema-cobranzas-vittoria-dtos-maestra-proveedorespecialidaddto) | `Cobranzas_Vittoria.Dtos.Maestra.ProveedorEspecialidadDto` |
| [ProveedorUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-proveedorupsertdto) | `Cobranzas_Vittoria.Dtos.Maestra.ProveedorUpsertDto` |
| [ProyectoUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-proyectoupsertdto) | `Cobranzas_Vittoria.Dtos.Maestra.ProyectoUpsertDto` |
| [UnidadMedidaDto](#schema-cobranzas-vittoria-dtos-maestra-unidadmedidadto) | `Cobranzas_Vittoria.Dtos.Maestra.UnidadMedidaDto` |
| [UnidadMedidaUpsertDto](#schema-cobranzas-vittoria-dtos-maestra-unidadmedidaupsertdto) | `Cobranzas_Vittoria.Dtos.Maestra.UnidadMedidaUpsertDto` |
| [TipoCambioResponseDto](#schema-cobranzas-vittoria-dtos-sunat-tipocambioresponsedto) | `Cobranzas_Vittoria.Dtos.Sunat.TipoCambioResponseDto` |
| [ProveedorEspecialidadCotizacionUpsertDto](#schema-cobranzas-vittoria-dtos-valorizaciones-proveedorespecialidadcotizacionupsertdto) | `Cobranzas_Vittoria.Dtos.Valorizaciones.ProveedorEspecialidadCotizacionUpsertDto` |
| [ProveedorReglaValorizacionUpsertDto](#schema-cobranzas-vittoria-dtos-valorizaciones-proveedorreglavalorizacionupsertdto) | `Cobranzas_Vittoria.Dtos.Valorizaciones.ProveedorReglaValorizacionUpsertDto` |
| [ValorizacionDetalleUpsertDto](#schema-cobranzas-vittoria-dtos-valorizaciones-valorizaciondetalleupsertdto) | `Cobranzas_Vittoria.Dtos.Valorizaciones.ValorizacionDetalleUpsertDto` |
| [ValorizacionUpsertDto](#schema-cobranzas-vittoria-dtos-valorizaciones-valorizacionupsertdto) | `Cobranzas_Vittoria.Dtos.Valorizaciones.ValorizacionUpsertDto` |
| [CategoriaGasto](#schema-cobranzas-vittoria-entities-categoriagasto) | `Cobranzas_Vittoria.Entities.CategoriaGasto` |
| [Especialidad](#schema-cobranzas-vittoria-entities-especialidad) | `Cobranzas_Vittoria.Entities.Especialidad` |
| [Material](#schema-cobranzas-vittoria-entities-material) | `Cobranzas_Vittoria.Entities.Material` |
| [OrdenCompra](#schema-cobranzas-vittoria-entities-ordencompra) | `Cobranzas_Vittoria.Entities.OrdenCompra` |
| [OrdenCompraDetalle](#schema-cobranzas-vittoria-entities-ordencompradetalle) | `Cobranzas_Vittoria.Entities.OrdenCompraDetalle` |
| [OrdenCompraHistorial](#schema-cobranzas-vittoria-entities-ordencomprahistorial) | `Cobranzas_Vittoria.Entities.OrdenCompraHistorial` |
| [Proveedor](#schema-cobranzas-vittoria-entities-proveedor) | `Cobranzas_Vittoria.Entities.Proveedor` |
| [ProveedorEspecialidad](#schema-cobranzas-vittoria-entities-proveedorespecialidad) | `Cobranzas_Vittoria.Entities.ProveedorEspecialidad` |
| [ProveedorGastoAdministrativo](#schema-cobranzas-vittoria-entities-proveedorgastoadministrativo) | `Cobranzas_Vittoria.Entities.ProveedorGastoAdministrativo` |
| [ProveedorTerreno](#schema-cobranzas-vittoria-entities-proveedorterreno) | `Cobranzas_Vittoria.Entities.ProveedorTerreno` |
| [Proyecto](#schema-cobranzas-vittoria-entities-proyecto) | `Cobranzas_Vittoria.Entities.Proyecto` |
| [Requerimiento](#schema-cobranzas-vittoria-entities-requerimiento) | `Cobranzas_Vittoria.Entities.Requerimiento` |
| [RequerimientoDetalle](#schema-cobranzas-vittoria-entities-requerimientodetalle) | `Cobranzas_Vittoria.Entities.RequerimientoDetalle` |
| [RequerimientoValidacion](#schema-cobranzas-vittoria-entities-requerimientovalidacion) | `Cobranzas_Vittoria.Entities.RequerimientoValidacion` |
| [AsignarPermisosRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-asignarpermisosrequest) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.AsignarPermisosRequest` |
| [AsignarRolesRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-asignarrolesrequest) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.AsignarRolesRequest` |
| [CreateRolRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-createrolrequest) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.CreateRolRequest` |
| [CreateUsuarioRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-createusuariorequest) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.CreateUsuarioRequest` |
| [ListarPermisoResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-listarpermisoresponse) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.ListarPermisoResponse` |
| [ListarRolResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-listarrolresponse) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.ListarRolResponse` |
| [ListarUsuarioResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-listarusuarioresponse) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.ListarUsuarioResponse` |
| [LoginRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-loginrequest) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.LoginRequest` |
| [LoginResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-loginresponse) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.LoginResponse` |
| [PermisoAsignadoResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-permisoasignadoresponse) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.PermisoAsignadoResponse` |
| [PermisoResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-permisoresponse) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.PermisoResponse` |
| [RefreshRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-refreshrequest) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.RefreshRequest` |
| [RolConPermisosResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-rolconpermisosresponse) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.RolConPermisosResponse` |
| [RolResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-rolresponse) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.RolResponse` |
| [UpdatePermisoRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-updatepermisorequest) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.UpdatePermisoRequest` |
| [UpdateRolRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-updaterolrequest) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.UpdateRolRequest` |
| [UpdateUsuarioRequest](#schema-cobranzas-vittoria-seguridad-presentation-dto-updateusuariorequest) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.UpdateUsuarioRequest` |
| [UsuarioResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-usuarioresponse) | `Cobranzas_Vittoria.Seguridad.Presentation.Dto.UsuarioResponse` |

<a id="schema-adicional-compradetalleresponse"></a>
### CompraDetalleResponse

Tipo/origen: `Adicional.CompraDetalleResponse`. [Fuente](../Cobranzas_Vittoria/Repositories/CompraRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `compra` | [CompraFilaSql](#schema-adicional-comprafilasql) | No | — |
| `items` | [CompraItemFilaSql](#schema-adicional-compraitemfilasql)[] | No | — |
| `documentos` | [CompraDocumentoFilaSql](#schema-adicional-compradocumentofilasql)[] | No | — |

<a id="schema-adicional-compradocumentofilasql"></a>
### CompraDocumentoFilaSql

Tipo/origen: `Adicional.CompraDocumentoFilaSql`. [Fuente](../Cobranzas_Vittoria/Repositories/CompraRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `IdCompraDocumento` | int | No | — |
| `IdCompra` | int | No | — |
| `NombreArchivo` | string? | Sí | — |
| `RutaArchivo` | string? | Sí | — |
| `Extension` | string? | Sí | — |
| `FechaCreacion` | DateTime | No | — |

<a id="schema-adicional-comprafilasql"></a>
### CompraFilaSql

Tipo/origen: `Adicional.CompraFilaSql`. [Fuente](../Cobranzas_Vittoria/Repositories/CompraRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `IdCompra` | int | No | — |
| `NumeroCompra` | string | No | — |
| `FechaCompra` | DateTime | No | — |
| `Estado` | string | No | — |
| `Aceptada` | bool | No | — |
| `IncluyeIGV` | bool | No | — |
| `SubtotalSinIGV` | decimal | No | — |
| `MontoIGV` | decimal | No | — |
| `MontoTotal` | decimal | No | — |
| `Observacion` | string? | Sí | — |
| `IdOrdenCompra` | int | No | — |
| `NumeroOrdenCompra` | string | No | — |
| `IdMoneda` | int | No | — |
| `CodigoMoneda` | string | No | — |
| `SimboloMoneda` | string? | Sí | — |
| `Proveedores` | string? | Sí | — |
| `NumeroRequerimiento` | string | No | — |
| `NombreProyecto` | string | No | — |
| `Especialidades` | string | No | — |

<a id="schema-adicional-compraitemfilasql"></a>
### CompraItemFilaSql

Tipo/origen: `Adicional.CompraItemFilaSql`. [Fuente](../Cobranzas_Vittoria/Repositories/CompraRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `IdCompraDetalle` | int | No | — |
| `IdCompra` | int | No | — |
| `IdMaterial` | int | No | — |
| `Material` | string | No | — |
| `UnidadMedida` | string? | Sí | — |
| `Cantidad` | decimal | No | — |
| `PrecioUnitario` | decimal | No | — |
| `Subtotal` | decimal | No | — |
| `IdProveedor` | int? | Sí | — |
| `Proveedor` | string? | Sí | — |

<a id="schema-adicional-comprapendienteocfilasql"></a>
### CompraPendienteOcFilaSql

Tipo/origen: `Adicional.CompraPendienteOcFilaSql`. [Fuente](../Cobranzas_Vittoria/Repositories/CompraRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `IdOrdenCompra` | int | No | — |
| `NumeroOrdenCompra` | string | No | — |
| `IdMoneda` | int | No | — |
| `CodigoMoneda` | string | No | — |
| `SimboloMoneda` | string? | Sí | — |
| `FechaOrdenCompra` | DateTime | No | — |
| `Estado` | string | No | — |
| `Total` | decimal | No | — |
| `Proveedores` | string? | Sí | — |
| `IdRequerimiento` | int? | Sí | — |
| `NumeroRequerimiento` | string | No | — |
| `Especialidades` | string | No | — |
| `NombreProyecto` | string | No | — |

<a id="schema-adicional-compras-crearresponse"></a>
### Compras_CrearResponse

Tipo/origen: `Adicional.Compras_CrearResponse`. [Fuente](../Cobranzas_Vittoria/Services/CompraService.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCompra` | int | No | — |
| `montoTotal` | decimal | No | — |

<a id="schema-adicional-kardexmovimientolegacyfilasql"></a>
### KardexMovimientoLegacyFilaSql

Tipo/origen: `Adicional.KardexMovimientoLegacyFilaSql`. [Fuente](../Cobranzas_Vittoria/Repositories/KardexRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `IdCompra` | int? | Sí | — |
| `NumeroCompra` | string? | Sí | — |
| `NumeroRequerimiento` | string | No | — |
| `IdMaterial` | int | No | — |
| `IdEspecialidad` | int? | Sí | — |
| `Especialidad` | string? | Sí | — |
| `FechaMovimiento` | DateTime | No | — |
| `Material` | string | No | — |
| `Entrada` | decimal | No | — |
| `Salida` | decimal | No | — |
| `Stock` | decimal | No | — |
| `Observacion` | string | No | — |

<a id="schema-adicional-kardex-registrarsalidamanuallegacyresponse"></a>
### Kardex_RegistrarSalidaManualLegacyResponse

Tipo/origen: `Adicional.Kardex_RegistrarSalidaManualLegacyResponse`. [Fuente](../Cobranzas_Vittoria/Repositories/KardexRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `ok` | bool | No | — |
| `stockActual` | decimal | No | — |
| `mensaje` | string | No | — |

<a id="schema-adicional-ordenescompra-crearresponse"></a>
### OrdenesCompra_CrearResponse

Tipo/origen: `Adicional.OrdenesCompra_CrearResponse`. [Fuente](../Cobranzas_Vittoria/Services/OrdenCompraService.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idOrdenCompra` | int | No | — |
| `total` | decimal | No | — |

<a id="schema-adicional-ordenescompra-getresponse"></a>
### OrdenesCompra_GetResponse

Tipo/origen: `Adicional.OrdenesCompra_GetResponse`. [Fuente](../Cobranzas_Vittoria/Services/OrdenCompraService.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `ordenCompra` | [OrdenCompra](#schema-cobranzas-vittoria-entities-ordencompra) | No | — |
| `items` | [OrdenCompraDetalle](#schema-cobranzas-vittoria-entities-ordencompradetalle)[] | No | — |
| `historial` | [OrdenCompraHistorial](#schema-cobranzas-vittoria-entities-ordencomprahistorial)[] | No | — |

<a id="schema-adicional-proveedores-getresponse"></a>
### Proveedores_GetResponse

Tipo/origen: `Adicional.Proveedores_GetResponse`. [Fuente](../Cobranzas_Vittoria/Services/ProveedorService.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `proveedor` | [Proveedor](#schema-cobranzas-vittoria-entities-proveedor) | No | — |
| `especialidades` | [ProveedorEspecialidad](#schema-cobranzas-vittoria-entities-proveedorespecialidad)[] | No | — |

<a id="schema-adicional-requerimientos-getresponse"></a>
### Requerimientos_GetResponse

Tipo/origen: `Adicional.Requerimientos_GetResponse`. [Fuente](../Cobranzas_Vittoria/Services/RequerimientoService.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `requerimiento` | [Requerimiento](#schema-cobranzas-vittoria-entities-requerimiento) | No | — |
| `items` | [RequerimientoDetalle](#schema-cobranzas-vittoria-entities-requerimientodetalle)[] | No | — |
| `validaciones` | [RequerimientoValidacion](#schema-cobranzas-vittoria-entities-requerimientovalidacion)[] | No | — |
| `puedeEditar` | bool | No | — |

<a id="schema-adicional-valorizaciones-deletedetalleresponse"></a>
### Valorizaciones_DeleteDetalleResponse

Tipo/origen: `Adicional.Valorizaciones_DeleteDetalleResponse`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `ok` | bool | No | — |

<a id="schema-adicional-valorizaciones-getbyconfiguracionresponse"></a>
### Valorizaciones_GetByConfiguracionResponse

Tipo/origen: `Adicional.Valorizaciones_GetByConfiguracionResponse`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `cabecera` | [Valorizaciones_GetByConfiguracionResponse_cabecera](#schema-adicional-valorizaciones-getbyconfiguracionresponse-cabecera) | No | — |
| `detalle` | [Valorizaciones_GetByConfiguracionResponse_detalle](#schema-adicional-valorizaciones-getbyconfiguracionresponse-detalle)[] | No | — |
| `resumen` | [Valorizaciones_GetByConfiguracionResponse_resumen](#schema-adicional-valorizaciones-getbyconfiguracionresponse-resumen) | No | — |

<a id="schema-adicional-valorizaciones-getbyconfiguracionresponse-cabecera"></a>
### Valorizaciones_GetByConfiguracionResponse_cabecera

Tipo/origen: `Adicional.Valorizaciones_GetByConfiguracionResponse_cabecera`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idValorizacion` | int? | Sí | — |
| `idConfiguracion` | int? | Sí | — |
| `periodo` | string? | Sí | — |
| `proyecto` | string? | Sí | — |
| `proveedor` | string? | Sí | — |
| `especialidad` | string? | Sí | — |
| `empresa` | string? | Sí | — |
| `servicio` | string? | Sí | — |
| `moneda` | string | No | — |
| `cotizacion` | decimal | No | — |
| `montoCotizacion` | decimal | No | — |
| `porcentajeGarantia` | decimal | No | — |
| `porcentajeDetraccion` | decimal | No | — |
| `observacion` | string? | Sí | — |

<a id="schema-adicional-valorizaciones-getbyconfiguracionresponse-detalle"></a>
### Valorizaciones_GetByConfiguracionResponse_detalle

Tipo/origen: `Adicional.Valorizaciones_GetByConfiguracionResponse_detalle`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idDetalle` | int? | Sí | — |
| `idValorizacion` | int? | Sí | — |
| `idConfiguracion` | int? | Sí | — |
| `periodo` | string? | Sí | — |
| `proveedor` | string? | Sí | — |
| `especialidad` | string? | Sí | — |
| `fechaFactura` | DateTime? | Sí | — |
| `numeroFactura` | string? | Sí | — |
| `montoFactura` | decimal | No | — |
| `descripcion` | string? | Sí | — |
| `tipoDetraccion` | string? | Sí | — |
| `detraccion` | decimal | No | — |
| `garantia` | decimal | No | — |
| `montoAbonar` | decimal | No | — |
| `montoDeuda` | decimal | No | — |
| `montoTransferido` | decimal | No | — |
| `fechaTransferencia` | DateTime? | Sí | — |
| `archivos` | [Valorizaciones_GetByConfiguracionResponse_detalle_archivos](#schema-adicional-valorizaciones-getbyconfiguracionresponse-detalle-archivos)[] | No | — |

<a id="schema-adicional-valorizaciones-getbyconfiguracionresponse-detalle-archivos"></a>
### Valorizaciones_GetByConfiguracionResponse_detalle_archivos

Tipo/origen: `Adicional.Valorizaciones_GetByConfiguracionResponse_detalle_archivos`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idArchivo` | int? | Sí | — |
| `idDetalle` | int? | Sí | — |
| `nombreArchivo` | string? | Sí | — |
| `rutaArchivo` | string? | Sí | — |
| `extension` | string? | Sí | — |

<a id="schema-adicional-valorizaciones-getbyconfiguracionresponse-resumen"></a>
### Valorizaciones_GetByConfiguracionResponse_resumen

Tipo/origen: `Adicional.Valorizaciones_GetByConfiguracionResponse_resumen`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `cotizacion` | decimal | No | — |
| `facturas` | [Valorizaciones_GetByConfiguracionResponse_resumen_facturas](#schema-adicional-valorizaciones-getbyconfiguracionresponse-resumen-facturas)[] | No | — |

<a id="schema-adicional-valorizaciones-getbyconfiguracionresponse-resumen-facturas"></a>
### Valorizaciones_GetByConfiguracionResponse_resumen_facturas

Tipo/origen: `Adicional.Valorizaciones_GetByConfiguracionResponse_resumen_facturas`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `numeroFactura` | string? | Sí | — |
| `descripcion` | string? | Sí | — |
| `facturado` | decimal | No | — |
| `transferido` | decimal | No | — |
| `garantia` | decimal | No | — |
| `detraccion` | decimal | No | — |
| `resta` | decimal | No | — |

<a id="schema-adicional-valorizaciones-getresponse"></a>
### Valorizaciones_GetResponse

Tipo/origen: `Adicional.Valorizaciones_GetResponse`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `cabecera` | [Valorizaciones_GetResponse_cabecera](#schema-adicional-valorizaciones-getresponse-cabecera) | No | — |
| `detalle` | [Valorizaciones_GetResponse_detalle](#schema-adicional-valorizaciones-getresponse-detalle)[] | No | — |
| `resumen` | [Valorizaciones_GetResponse_resumen](#schema-adicional-valorizaciones-getresponse-resumen) | No | — |

<a id="schema-adicional-valorizaciones-getresponse-cabecera"></a>
### Valorizaciones_GetResponse_cabecera

Tipo/origen: `Adicional.Valorizaciones_GetResponse_cabecera`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idValorizacion` | int? | Sí | — |
| `idConfiguracion` | int? | Sí | — |
| `periodo` | string? | Sí | — |
| `proyecto` | string? | Sí | — |
| `proveedor` | string? | Sí | — |
| `especialidad` | string? | Sí | — |
| `empresa` | string? | Sí | — |
| `servicio` | string? | Sí | — |
| `moneda` | string? | Sí | — |
| `cotizacion` | decimal | No | — |
| `porcentajeGarantia` | decimal | No | — |
| `porcentajeDetraccion` | decimal | No | — |
| `observacion` | string? | Sí | — |

<a id="schema-adicional-valorizaciones-getresponse-detalle"></a>
### Valorizaciones_GetResponse_detalle

Tipo/origen: `Adicional.Valorizaciones_GetResponse_detalle`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idDetalle` | int? | Sí | — |
| `idValorizacion` | int? | Sí | — |
| `idConfiguracion` | int? | Sí | — |
| `periodo` | string? | Sí | — |
| `proveedor` | string? | Sí | — |
| `especialidad` | string? | Sí | — |
| `fechaFactura` | DateTime? | Sí | — |
| `numeroFactura` | string? | Sí | — |
| `montoFactura` | decimal | No | — |
| `descripcion` | string? | Sí | — |
| `tipoDetraccion` | string? | Sí | — |
| `detraccion` | decimal | No | — |
| `garantia` | decimal | No | — |
| `montoAbonar` | decimal | No | — |
| `montoDeuda` | decimal | No | — |
| `montoTransferido` | decimal | No | — |
| `fechaTransferencia` | DateTime? | Sí | — |
| `archivos` | [Valorizaciones_GetResponse_detalle_archivos](#schema-adicional-valorizaciones-getresponse-detalle-archivos)[] | No | — |

<a id="schema-adicional-valorizaciones-getresponse-detalle-archivos"></a>
### Valorizaciones_GetResponse_detalle_archivos

Tipo/origen: `Adicional.Valorizaciones_GetResponse_detalle_archivos`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idArchivo` | int? | Sí | — |
| `idDetalle` | int? | Sí | — |
| `nombreArchivo` | string? | Sí | — |
| `rutaArchivo` | string? | Sí | — |
| `extension` | string? | Sí | — |

<a id="schema-adicional-valorizaciones-getresponse-resumen"></a>
### Valorizaciones_GetResponse_resumen

Tipo/origen: `Adicional.Valorizaciones_GetResponse_resumen`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `cotizacion` | decimal | No | — |
| `facturas` | [Valorizaciones_GetResponse_resumen_facturas](#schema-adicional-valorizaciones-getresponse-resumen-facturas)[] | No | — |

<a id="schema-adicional-valorizaciones-getresponse-resumen-facturas"></a>
### Valorizaciones_GetResponse_resumen_facturas

Tipo/origen: `Adicional.Valorizaciones_GetResponse_resumen_facturas`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `numeroFactura` | string? | Sí | — |
| `descripcion` | string? | Sí | — |
| `facturado` | decimal | No | — |
| `transferido` | decimal | No | — |
| `garantia` | decimal | No | — |
| `detraccion` | decimal | No | — |
| `resta` | decimal | No | — |

<a id="schema-adicional-valorizaciones-listconfiguracionesresponse"></a>
### Valorizaciones_ListConfiguracionesResponse

Tipo/origen: `Adicional.Valorizaciones_ListConfiguracionesResponse`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idConfiguracion` | int? | Sí | — |
| `idProyecto` | int? | Sí | — |
| `proyecto` | string? | Sí | — |
| `idProveedor` | int? | Sí | — |
| `proveedor` | string? | Sí | — |
| `idEspecialidad` | int? | Sí | — |
| `especialidad` | string? | Sí | — |
| `empresa` | string? | Sí | — |
| `servicio` | string? | Sí | — |
| `moneda` | string? | Sí | — |
| `montoCotizacion` | decimal | No | — |
| `porcentajeGarantia` | decimal | No | — |
| `porcentajeDetraccion` | decimal | No | — |

<a id="schema-adicional-valorizaciones-listresponse"></a>
### Valorizaciones_ListResponse

Tipo/origen: `Adicional.Valorizaciones_ListResponse`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idValorizacion` | int? | Sí | — |
| `periodo` | string? | Sí | — |
| `proyecto` | string? | Sí | — |
| `proveedor` | string? | Sí | — |
| `especialidad` | string? | Sí | — |
| `empresa` | string? | Sí | — |
| `servicio` | string? | Sí | — |
| `moneda` | string? | Sí | — |
| `cotizacion` | decimal | No | — |
| `facturado` | decimal | No | — |
| `transferido` | decimal | No | — |
| `garantia` | decimal | No | — |
| `detraccion` | decimal | No | — |
| `resta` | decimal | No | — |
| `liquidar` | decimal | No | — |

<a id="schema-adicional-valorizaciones-upsertconfiguracionresponse"></a>
### Valorizaciones_UpsertConfiguracionResponse

Tipo/origen: `Adicional.Valorizaciones_UpsertConfiguracionResponse`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idConfiguracion` | int? | Sí | — |

<a id="schema-adicional-valorizaciones-upsertdetalleresponse"></a>
### Valorizaciones_UpsertDetalleResponse

Tipo/origen: `Adicional.Valorizaciones_UpsertDetalleResponse`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idDetalle` | int? | Sí | — |

<a id="schema-adicional-valorizaciones-upsertresponse"></a>
### Valorizaciones_UpsertResponse

Tipo/origen: `Adicional.Valorizaciones_UpsertResponse`. [Fuente](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idValorizacion` | int? | Sí | — |
| `numeroValorizacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-application-importacion-excepciones-detalleerrorfila"></a>
### DetalleErrorFila

Tipo/origen: `Cobranzas_Vittoria.Application.Importacion.Excepciones.DetalleErrorFila`. [Fuente](../Cobranzas_Vittoria/Application/Importacion/Excepciones/DetalleErrorFila.cs).

Detalle de un error de validación a nivel de fila dentro del archivo importado. Se serializa dentro de la respuesta 422 que produce .

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `fila` | int | No | — |
| `campo` | string | No | — |
| `codigoError` | string | No | — |
| `mensaje` | string | No | — |

<a id="schema-cobranzas-vittoria-application-importacion-processors-resultadoimportacion"></a>
### ResultadoImportacion

Tipo/origen: `Cobranzas_Vittoria.Application.Importacion.Processors.ResultadoImportacion`. [Fuente](../Cobranzas_Vittoria/Application/Importacion/Processors/ResultadoImportacion.cs).

Resultado de una importacion masiva exitosa. Se devuelve en la respuesta HTTP 200 con la cantidad de filas insertadas y el formato del archivo origen (util para logging y diagnostico).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `modulo` | string | No | Identificador del modulo importado (ej: "unidad-medida", "especialidad"). Coincide con el segmento de URL /api/import/{modulo}. |
| `formato` | string | No | Formato del archivo: "csv", "xlsx" o "xls". |
| `filasInsertadas` | int | No | Cantidad de filas efectivamente insertadas en BD. |

<a id="schema-cobranzas-vittoria-application-inventario-dtos-kardexentradacreatedto"></a>
### KardexEntradaCreateDto

Tipo/origen: `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexEntradaCreateDto`. [Fuente](../Cobranzas_Vittoria/Application/Inventario/Dtos/KardexEntradaCreateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idKardexEntrada` | int? | Sí | PK. Null en POST (lo asigna la BD); obligatorio en PUT (validado contra la ruta). |
| `idEspecialidad` | int | No | FK a maestra.Especialidad (REQUERIDO). |
| `idMaterial` | int | No | FK a maestra.Material (REQUERIDO). |
| `idProveedor` | int? | Sí | FK a maestra.Proveedor (OPCIONAL). |
| `idProyecto` | int? | Sí | FK a maestra.Proyecto (REQUERIDO). Etiqueta informativa; no segmenta stock. |
| `numeroDocumento` | string? | Sí | Numero de documento soporte, ej: "F001-12345" (OPCIONAL, max 50 chars). |
| `fecha` | DateOnly | No | Fecha del movimiento (REQUERIDO). |
| `cantidad` | decimal | No | Cantidad ingresada (REQUERIDO, &gt;= 0). |
| `observacion` | string? | Sí | Observacion libre (OPCIONAL, max 250 chars). |

<a id="schema-cobranzas-vittoria-application-inventario-dtos-kardexentradaresponsedto"></a>
### KardexEntradaResponseDto

Tipo/origen: `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexEntradaResponseDto`. [Fuente](../Cobranzas_Vittoria/Application/Inventario/Dtos/KardexEntradaResponseDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idKardexEntrada` | int | No | — |
| `idEspecialidad` | int | No | — |
| `especialidad` | string? | Sí | — |
| `idMaterial` | int | No | — |
| `codigoMaterial` | string? | Sí | — |
| `nombre` | string? | Sí | — |
| `idProveedor` | int? | Sí | — |
| `proveedor` | string? | Sí | — |
| `idProyecto` | int? | Sí | — |
| `proyecto` | string? | Sí | — |
| `numeroDocumento` | string? | Sí | — |
| `fecha` | DateOnly | No | — |
| `cantidad` | decimal | No | — |
| `observacion` | string? | Sí | — |
| `fechaCreacion` | DateTime | No | — |

<a id="schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidacreatedto"></a>
### KardexSalidaCreateDto

Tipo/origen: `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexSalidaCreateDto`. [Fuente](../Cobranzas_Vittoria/Application/Inventario/Dtos/KardexSalidaCreateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idKardexSalida` | int? | Sí | PK. Null en POST; obligatorio en PUT (validado contra la ruta). |
| `idEspecialidad` | int | No | FK a maestra.Especialidad (REQUERIDO). |
| `idProyecto` | int? | Sí | FK a maestra.Proyecto (REQUERIDO). Etiqueta informativa; no segmenta stock. |
| `numeroDocumento` | string? | Sí | Numero de documento soporte, ej: "S001-12345" (OPCIONAL, max 50 chars). |
| `fecha` | DateOnly | No | Fecha del movimiento (REQUERIDO). |
| `solicitante` | string | No | Inicial: string.Empty; Nombre de quien solicita la salida (REQUERIDO, no vacio, max 150 chars). |
| `observacion` | string? | Sí | Observacion general (OPCIONAL, max 250 chars). |
| `items` | [KardexSalidaItemCreateDto](#schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidaitemcreatedto)[] | No | Inicial: new(); Lista de 1..N items de la salida. REQUERIDO, no vacia. |

<a id="schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidaitemcreatedto"></a>
### KardexSalidaItemCreateDto

Tipo/origen: `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexSalidaItemCreateDto`. [Fuente](../Cobranzas_Vittoria/Application/Inventario/Dtos/KardexSalidaItemCreateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idMaterial` | int | No | FK a maestra.Material (REQUERIDO). |
| `cantidad` | decimal | No | Cantidad despachada (REQUERIDO, &gt;= 0). |
| `observacion` | string? | Sí | Observacion del item (OPCIONAL, max 250 chars). |

<a id="schema-cobranzas-vittoria-application-inventario-dtos-kardexsalidaresponsedto"></a>
### KardexSalidaResponseDto

Tipo/origen: `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexSalidaResponseDto`. [Fuente](../Cobranzas_Vittoria/Application/Inventario/Dtos/KardexSalidaResponseDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idKardexSalida` | int | No | — |
| `idEspecialidad` | int | No | — |
| `especialidad` | string? | Sí | — |
| `idProyecto` | int? | Sí | — |
| `proyecto` | string? | Sí | — |
| `numeroDocumento` | string? | Sí | — |
| `fecha` | DateOnly | No | — |
| `solicitante` | string | No | Inicial: string.Empty |
| `observacion` | string? | Sí | — |
| `idKardexSalidaDetalle` | int | No | — |
| `idMaterial` | int | No | — |
| `codigoMaterial` | string? | Sí | — |
| `nombre` | string? | Sí | — |
| `cantidad` | decimal | No | — |
| `detalleObservacion` | string? | Sí | — |
| `fechaCreacion` | DateTime | No | — |

<a id="schema-cobranzas-vittoria-application-inventario-dtos-kardexstockactualresponsedto"></a>
### KardexStockActualResponseDto

Tipo/origen: `Cobranzas_Vittoria.Application.Inventario.Dtos.KardexStockActualResponseDto`. [Fuente](../Cobranzas_Vittoria/Application/Inventario/Dtos/KardexStockActualResponseDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idKardexStock` | int | No | — |
| `idMaterial` | int | No | — |
| `codigoMaterial` | string? | Sí | — |
| `nombre` | string? | Sí | — |
| `unidadMedida` | string? | Sí | — |
| `idEspecialidad` | int | No | — |
| `especialidad` | string? | Sí | — |
| `totalEntrada` | decimal | No | — |
| `totalSalida` | decimal | No | — |
| `stock` | decimal | No | — |
| `fechaUltimaMovimiento` | DateOnly | No | — |

<a id="schema-cobranzas-vittoria-compras-presentation-dto-actualizaritemrequerimientorequest"></a>
### ActualizarItemRequerimientoRequest

Tipo/origen: `Cobranzas_Vittoria.Compras.Presentation.Dto.ActualizarItemRequerimientoRequest`. [Fuente](../Cobranzas_Vittoria/Compras/Presentation/Dto/ActualizarItemRequerimientoRequest.cs).

Omitir conserva; null limpia partida/observación. La cantidad informada nunca puede ser null.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `cantidad` | decimal? | Sí | Range("0.01", "9999999999999999.99") |
| `idPresupuestoDetalle` | int? | Sí | Range(1, 2147483647) |
| `observacion` | string? | Sí | StringLength(250) |

<a id="schema-cobranzas-vittoria-compras-presentation-dto-agregaritemrequerimientorequest"></a>
### AgregarItemRequerimientoRequest

Tipo/origen: `Cobranzas_Vittoria.Compras.Presentation.Dto.AgregarItemRequerimientoRequest`. [Fuente](../Cobranzas_Vittoria/Compras/Presentation/Dto/AgregarItemRequerimientoRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idMaterial` | int | No | Range(1, 2147483647) |
| `cantidad` | decimal? | Sí | Required; Range("0.01", "9999999999999999.99") |
| `idPresupuestoDetalle` | int? | Sí | Range(1, 2147483647) |
| `observacion` | string? | Sí | StringLength(250) |

<a id="schema-cobranzas-vittoria-compras-presentation-dto-requerimientoitemresponse"></a>
### RequerimientoItemResponse

Tipo/origen: `Cobranzas_Vittoria.Compras.Presentation.Dto.RequerimientoItemResponse`. [Fuente](../Cobranzas_Vittoria/Compras/Presentation/Dto/RequerimientoItemResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idRequerimientoDetalle` | int | No | — |
| `idRequerimiento` | int | No | — |
| `idMaterial` | int | No | — |
| `cantidad` | decimal | No | — |
| `idPresupuestoDetalle` | int? | Sí | — |
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-contable-gastosdirectos-application-importar-resultadoimportaciongastosdirectos"></a>
### ResultadoImportacionGastosDirectos

Tipo/origen: `Cobranzas_Vittoria.Contable.GastosDirectos.Application.Importar.ResultadoImportacionGastosDirectos`. [Fuente](../Cobranzas_Vittoria/Contable/GastosDirectos/Application/Importar/ResultadoImportacionGastosDirectos.cs).

Extiende los campos del resultado compartido con el resumen completo del lote.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `modulo` | string | No | — |
| `formato` | string | No | — |
| `filasInsertadas` | int | No | — |
| `totalFilas` | int | No | — |
| `filasValidas` | int | No | — |
| `filasInvalidas` | int | No | — |
| `ok` | bool | No | — |
| `resultado` | string | No | — |
| `errores` | [DetalleErrorFila](#schema-cobranzas-vittoria-application-importacion-excepciones-detalleerrorfila)[] | No | — |

<a id="schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-categoriagastodirecto"></a>
### CategoriaGastoDirecto

Tipo/origen: `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.CategoriaGastoDirecto`. [Fuente](../Cobranzas_Vittoria/Contable/GastosDirectos/Domain/Model/GastoDirecto.cs).

Categoría descriptiva activa disponible para clasificar un gasto directo.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCategoriaGasto` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |

<a id="schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-centrocostogastodirecto"></a>
### CentroCostoGastoDirecto

Tipo/origen: `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.CentroCostoGastoDirecto`. [Fuente](../Cobranzas_Vittoria/Contable/GastosDirectos/Domain/Model/GastoDirecto.cs).

Centro de costo activo disponible para registrar un gasto directo.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCentroCosto` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `idProyecto` | int? | Sí | — |
| `codigoTipoCentroCosto` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-gastodirecto"></a>
### GastoDirecto

Tipo/origen: `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.GastoDirecto`. [Fuente](../Cobranzas_Vittoria/Contable/GastosDirectos/Domain/Model/GastoDirecto.cs).

Gasto directo imputado a una partida de la versión aprobada, con su contexto presupuestal.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idGastoDirecto` | int | No | — |
| `idPresupuestoDetalle` | int | No | — |
| `idCategoriaGasto` | int? | Sí | — |
| `codigoCategoriaGasto` | string? | Sí | — |
| `nombreCategoriaGasto` | string? | Sí | — |
| `idProveedor` | int? | Sí | — |
| `proveedor` | string? | Sí | — |
| `idMoneda` | int | No | — |
| `moneda` | string | No | Inicial: string.Empty |
| `fecha` | DateTime | No | — |
| `concepto` | string | No | Inicial: string.Empty |
| `descripcion` | string? | Sí | — |
| `monto` | decimal | No | — |
| `estado` | string | No | Inicial: string.Empty |
| `fechaCreacion` | DateTime | No | — |
| `fechaActualizacion` | DateTime? | Sí | — |
| `usuarioCreacion` | string? | Sí | — |
| `idPresupuesto` | int | No | — |
| `codigoPresupuesto` | string | No | Inicial: string.Empty |
| `idCentroCosto` | int | No | — |
| `codigoCentroCosto` | string | No | Inicial: string.Empty |
| `centroCosto` | string | No | Inicial: string.Empty |
| `idProyecto` | int? | Sí | — |
| `idCatalogoPartida` | int | No | — |
| `codigoPartida` | string | No | Inicial: string.Empty |
| `partida` | string | No | Inicial: string.Empty |
| `totalDocumentos` | int | No | — |
| `idMonedaOriginal` | int? | Sí | — |
| `monedaOriginal` | string? | Sí | — |
| `montoOriginal` | decimal? | Sí | — |
| `tipoCambio` | decimal? | Sí | — |
| `fechaTipoCambio` | DateTime? | Sí | — |

<a id="schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-gastodirectodocumento"></a>
### GastoDirectoDocumento

Tipo/origen: `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.GastoDirectoDocumento`. [Fuente](../Cobranzas_Vittoria/Contable/GastosDirectos/Domain/Model/GastoDirecto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idGastoDirectoDocumento` | int | No | — |
| `idGastoDirecto` | int | No | — |
| `tipoDocumento` | string | No | — |
| `nombreArchivo` | string | No | — |
| `rutaArchivo` | string? | Sí | — |
| `extension` | string? | Sí | — |
| `fechaCreacion` | DateTime | No | — |
| `numeroFactura` | string? | Sí | — |
| `tieneArchivo` | bool | No | — |

<a id="schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-partidadisponiblegasto"></a>
### PartidaDisponibleGasto

Tipo/origen: `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.PartidaDisponibleGasto`. [Fuente](../Cobranzas_Vittoria/Contable/GastosDirectos/Domain/Model/GastoDirecto.cs).

Partida hoja activa con su saldo en la versión aprobada del centro de costo.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPresupuestoDetalle` | int | No | — |
| `idPresupuesto` | int | No | — |
| `codigoPresupuesto` | string | No | — |
| `idPresupuestoVersion` | int | No | — |
| `numeroVersion` | int | No | — |
| `idCatalogoPartida` | int | No | — |
| `codigoPartida` | string | No | — |
| `nombrePartida` | string | No | — |
| `idMoneda` | int | No | — |
| `codigoMoneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |
| `montoPresupuestado` | decimal | No | — |
| `montoComprometido` | decimal | No | — |
| `montoEjecutado` | decimal | No | — |
| `saldoDisponible` | decimal | No | — |

<a id="schema-cobranzas-vittoria-contable-gastosdirectos-domain-model-proveedorgastodirecto"></a>
### ProveedorGastoDirecto

Tipo/origen: `Cobranzas_Vittoria.Contable.GastosDirectos.Domain.Model.ProveedorGastoDirecto`. [Fuente](../Cobranzas_Vittoria/Contable/GastosDirectos/Domain/Model/GastoDirecto.cs).

Proveedor canónico activo disponible para registrar un gasto directo.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProveedor` | int | No | — |
| `razonSocial` | string | No | — |
| `ruc` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-contable-gastosdirectos-presentation-dto-gastodirectoupsertrequest"></a>
### GastoDirectoUpsertRequest

Tipo/origen: `Cobranzas_Vittoria.Contable.GastosDirectos.Presentation.Dto.GastoDirectoUpsertRequest`. [Fuente](../Cobranzas_Vittoria/Contable/GastosDirectos/Presentation/Dto/GastoDirectoUpsertRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPresupuestoDetalle` | int | No | Range(1, 2147483647) |
| `idCategoriaGasto` | int | No | Range(1, 2147483647) |
| `idProveedor` | int? | Sí | Range(1, 2147483647) |
| `idMoneda` | int | No | Range(1, 2147483647) |
| `fecha` | DateTime | No | — |
| `concepto` | string | No | Required; StringLength(250); Inicial: string.Empty |
| `descripcion` | string? | Sí | StringLength(500) |
| `monto` | decimal | No | Range("0.01", "9999999999999999.99") |
| `idMonedaOriginal` | int? | Sí | Range(1, 2147483647); Moneda original de la factura, solo como referencia (no se convierte). |
| `montoOriginal` | decimal? | Sí | Range("0.01", "9999999999999999.99") |
| `tipoCambio` | decimal? | Sí | Range("0.000001", "999999999999.999999") |
| `fechaTipoCambio` | DateTime? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-application-common-resultadoimportacion"></a>
### ResultadoImportacion

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Application.Common.ResultadoImportacion`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Application/Common/IImportadorMaestros.cs).

Resultado de una importación masiva de maestros (todo o nada).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `modulo` | string | No | — |
| `formato` | string | No | — |
| `filasInsertadas` | int | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-application-consultapresupuestaria-arbol-arbolpresupuestarioresult"></a>
### ArbolPresupuestarioResult

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Application.ConsultaPresupuestaria.Arbol.ArbolPresupuestarioResult`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Application/ConsultaPresupuestaria/Arbol/ArbolPresupuestarioResult.cs).

Árbol de partidas con subtotales: nodos en preorden; los padres suman sus hojas descendientes.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `encabezado` | [EncabezadoArbol](#schema-cobranzas-vittoria-controlpresupuestario-application-consultapresupuestaria-arbol-encabezadoarbol) | No | — |
| `totales` | [TotalesArbol](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-totalesarbol) | No | — |
| `nodos` | [NodoArbol](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-nodoarbol)[] | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-application-consultapresupuestaria-arbol-encabezadoarbol"></a>
### EncabezadoArbol

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Application.ConsultaPresupuestaria.Arbol.EncabezadoArbol`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Application/ConsultaPresupuestaria/Arbol/ArbolPresupuestarioResult.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCentroCosto` | int | No | — |
| `codigoCentroCosto` | string? | Sí | — |
| `nombreCentroCosto` | string? | Sí | — |
| `idPresupuesto` | int? | Sí | — |
| `idPresupuestoVersion` | int? | Sí | — |
| `estadoPresupuesto` | string? | Sí | — |
| `codigoMoneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-application-consultapresupuestaria-resumen-resumentotales"></a>
### ResumenTotales

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Application.ConsultaPresupuestaria.Resumen.ResumenTotales`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Application/ConsultaPresupuestaria/Resumen/ResumenResult.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `presupuestado` | decimal | No | — |
| `comprometido` | decimal | No | — |
| `ejecutado` | decimal | No | — |
| `saldoDisponible` | decimal | No | — |
| `porcentajeEjecutado` | decimal | No | — |
| `centrosCosto` | int | No | — |
| `partidas` | int | No | — |
| `partidasExcedidas` | int | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-application-presupuestodetalle-importarestructura-importarestructuraresult"></a>
### ImportarEstructuraResult

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Application.PresupuestoDetalle.ImportarEstructura.ImportarEstructuraResult`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Application/PresupuestoDetalle/ImportarEstructura/ImportarEstructuraHandler.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPresupuestoVersion` | int | No | — |
| `agregados` | int | No | — |
| `actualizados` | int | No | — |
| `eliminados` | int | No | — |
| `partidasEnVersion` | int | No | — |
| `montoTotal` | decimal | No | — |
| `partidasCreadas` | int | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-service-nodoarbol"></a>
### NodoArbol

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.NodoArbol`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Service/ArbolPresupuestario.cs).

Nodo del árbol. En una hoja, IdPresupuesto/IdPresupuestoVersion/IdPresupuestoDetalle identifican su detalle de versión; son null en las categorías y en una hoja que suma detalles de varios presupuestos.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCatalogoPartida` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `idPartidaPadre` | int? | Sí | — |
| `nivel` | int | No | — |
| `esHoja` | bool | No | — |
| `cantidadHijas` | int | No | — |
| `cantidadHojas` | int | No | — |
| `idPresupuesto` | int? | Sí | — |
| `idPresupuestoVersion` | int? | Sí | — |
| `idPresupuestoDetalle` | int? | Sí | — |
| `montoPresupuestado` | decimal | No | — |
| `montoComprometido` | decimal | No | — |
| `montoEjecutado` | decimal | No | — |
| `saldoDisponible` | decimal | No | — |
| `porcentajeComprometido` | decimal | No | — |
| `porcentajeEjecutado` | decimal | No | — |
| `excedido` | bool | No | — |
| `partidasExcedidas` | int | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablero"></a>
### Tablero

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.Tablero`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Service/TableroPresupuestario.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `encabezado` | [TableroEncabezado](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableroencabezado) | No | — |
| `resumen` | [TableroResumen](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableroresumen) | No | — |
| `rubros` | [TableroRubro](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablerorubro)[] | No | — |
| `semanas` | [TableroPuntoSemana](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableropuntosemana)[] | No | — |
| `alCorte` | [TableroAlCorte](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableroalcorte) | No | — |
| `desviacionPorRubro` | [TableroDesviacionRubro](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablerodesviacionrubro)[] | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableroalcorte"></a>
### TableroAlCorte

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroAlCorte`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Service/TableroPresupuestario.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `presupuestoAcumulado` | decimal? | Sí | — |
| `realAcumulado` | decimal | No | — |
| `desviacion` | decimal? | Sí | — |
| `desviacionPorcentaje` | decimal? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablerodesviacionrubro"></a>
### TableroDesviacionRubro

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroDesviacionRubro`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Service/TableroPresupuestario.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `presupuestoAcumulado` | decimal | No | — |
| `realAcumulado` | decimal | No | — |
| `desviacion` | decimal | No | — |
| `desviacionPorcentaje` | decimal? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableroencabezado"></a>
### TableroEncabezado

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroEncabezado`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Service/TableroPresupuestario.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCentroCosto` | int | No | — |
| `codigoCentroCosto` | string | No | — |
| `nombreCentroCosto` | string | No | — |
| `nombreProyecto` | string? | Sí | — |
| `codigoMoneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |
| `cantidadPresupuestos` | int | No | — |
| `fechaInicio` | DateTime | No | — |
| `fechaFin` | DateTime | No | — |
| `fechaCorte` | DateTime | No | — |
| `tieneCronograma` | bool | No | — |
| `nivel` | int? | Sí | Nivel de anidamiento con que se agruparon los rubros; null = partidas finales. |
| `nivelMaximo` | int | No | Nivel más profundo de las partidas del tablero: rango del selector de nivel (1..NivelMaximo). |
| `rama` | [TableroRama](#schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablerorama)[] | No | Inicial: Array.Empty<TableroRama>(); Rama a la que se limitó el tablero y su camino desde la raíz (para el breadcrumb); vacío = todo. |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableropuntosemana"></a>
### TableroPuntoSemana

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroPuntoSemana`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Service/TableroPresupuestario.cs).

Semana puede ser fraccionaria: el punto de la fecha de corte cae entre dos semanas.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `semana` | decimal | No | — |
| `fecha` | DateTime | No | — |
| `realAcumulado` | decimal? | Sí | — |
| `presupuestoAcumulado` | decimal? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablerorama"></a>
### TableroRama

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroRama`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Service/TableroPresupuestario.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCatalogoPartida` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `nivel` | int | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-service-tableroresumen"></a>
### TableroResumen

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroResumen`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Service/TableroPresupuestario.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `presupuestado` | decimal | No | — |
| `comprometido` | decimal | No | — |
| `ejecutado` | decimal | No | — |
| `desviacion` | decimal | No | — |
| `desviacionPorcentaje` | decimal? | Sí | — |
| `porcentajeEjecutado` | decimal? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-service-tablerorubro"></a>
### TableroRubro

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TableroRubro`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Service/TableroPresupuestario.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCatalogoPartida` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `presupuestado` | decimal | No | — |
| `comprometido` | decimal | No | — |
| `ejecutado` | decimal | No | — |
| `porcentajeDelTotal` | decimal | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-service-totalesarbol"></a>
### TotalesArbol

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.Service.TotalesArbol`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Service/ArbolPresupuestario.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `montoPresupuestado` | decimal | No | — |
| `montoComprometido` | decimal | No | — |
| `montoEjecutado` | decimal | No | — |
| `saldoDisponible` | decimal | No | — |
| `porcentajeComprometido` | decimal | No | — |
| `porcentajeEjecutado` | decimal | No | — |
| `cantidadPartidas` | int | No | — |
| `partidasExcedidas` | int | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-estadopresupuesto"></a>
### EstadoPresupuesto

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.ValueObject.EstadoPresupuesto`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/ValueObject/EstadoPresupuesto.cs).

Estado de una versión de presupuesto (catálogo EstadoPresupuesto).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idEstadoPresupuesto` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `descripcion` | string? | Sí | — |
| `activo` | bool | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-moneda"></a>
### Moneda

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.ValueObject.Moneda`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/ValueObject/Moneda.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idMoneda` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `simbolo` | string? | Sí | — |
| `activo` | bool | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-tipocentrocosto"></a>
### TipoCentroCosto

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.ValueObject.TipoCentroCosto`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/ValueObject/TipoCentroCosto.cs).

Tipo de centro de costo. PROYECTO es el único que se asocia a un proyecto.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idTipoCentroCosto` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `descripcion` | string? | Sí | — |
| `activo` | bool | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-tipomovimientopresupuestal"></a>
### TipoMovimientoPresupuestal

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.ValueObject.TipoMovimientoPresupuestal`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/ValueObject/TipoMovimientoPresupuestal.cs).

Tipo de asiento del ledger presupuestal.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idTipoMovimientoPresupuestal` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `descripcion` | string? | Sí | — |
| `activo` | bool | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-domain-valueobject-tipopartida"></a>
### TipoPartida

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Domain.ValueObject.TipoPartida`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Domain/ValueObject/TipoPartida.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idTipoPartida` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `descripcion` | string? | Sí | — |
| `activo` | bool | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-actualizarcatalogopartidarequest"></a>
### ActualizarCatalogoPartidaRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CatalogoPartida.ActualizarCatalogoPartidaRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/CatalogoPartida/ActualizarCatalogoPartidaRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `nombre` | string | No | Required; StringLength(200); MinimumLength=1; Inicial: string.Empty |
| `idTipoPartida` | int | No | Range(1, 2147483647) |
| `activo` | bool | No | Inicial: true |
| `idPartidaPadre` | int? | Sí | Range(1, 2147483647) |
| `descripcion` | string? | Sí | StringLength(500) |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-catalogopartidaresponse"></a>
### CatalogoPartidaResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CatalogoPartida.CatalogoPartidaResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/CatalogoPartida/CatalogoPartidaResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCatalogoPartida` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `descripcion` | string? | Sí | — |
| `idPartidaPadre` | int? | Sí | — |
| `codigoPartidaPadre` | string? | Sí | — |
| `nombrePartidaPadre` | string? | Sí | — |
| `nivel` | int | No | — |
| `idTipoPartida` | int | No | — |
| `codigoTipoPartida` | string? | Sí | — |
| `nombreTipoPartida` | string? | Sí | — |
| `activo` | bool | No | — |
| `esHoja` | bool | No | — |
| `fechaCreacion` | DateTime? | Sí | — |
| `fechaActualizacion` | DateTime? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-catalogopartida-crearcatalogopartidarequest"></a>
### CrearCatalogoPartidaRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CatalogoPartida.CrearCatalogoPartidaRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/CatalogoPartida/CrearCatalogoPartidaRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `codigo` | string | No | Required; StringLength(50); MinimumLength=1; Inicial: string.Empty |
| `nombre` | string | No | Required; StringLength(200); MinimumLength=1; Inicial: string.Empty |
| `idTipoPartida` | int | No | Range(1, 2147483647) |
| `idPartidaPadre` | int? | Sí | Range(1, 2147483647) |
| `descripcion` | string? | Sí | StringLength(500) |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-actualizarcentrocostorequest"></a>
### ActualizarCentroCostoRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CentroCosto.ActualizarCentroCostoRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/CentroCosto/ActualizarCentroCostoRequest.cs).

Codigo e IdTipoCentroCosto son opcionales y no editables: si vienen, deben coincidir con los actuales.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `codigo` | string? | Sí | StringLength(30) |
| `nombre` | string | No | Required; StringLength(150); MinimumLength=1; Inicial: string.Empty |
| `idTipoCentroCosto` | int? | Sí | Range(1, 2147483647) |
| `idProyecto` | int? | Sí | Range(1, 2147483647) |
| `activo` | bool | No | Inicial: true |
| `descripcion` | string? | Sí | StringLength(255) |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-centrocostoresponse"></a>
### CentroCostoResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CentroCosto.CentroCostoResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/CentroCosto/CentroCostoResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCentroCosto` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `descripcion` | string? | Sí | — |
| `idTipoCentroCosto` | int | No | — |
| `codigoTipoCentroCosto` | string? | Sí | — |
| `nombreTipoCentroCosto` | string? | Sí | — |
| `idProyecto` | int? | Sí | — |
| `nombreProyecto` | string? | Sí | — |
| `activo` | bool | No | — |
| `fechaCreacion` | DateTime? | Sí | — |
| `fechaModificacion` | DateTime? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-centrocosto-crearcentrocostorequest"></a>
### CrearCentroCostoRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.CentroCosto.CrearCentroCostoRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/CentroCosto/CrearCentroCostoRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `codigo` | string | No | Required; StringLength(30); MinimumLength=1; Inicial: string.Empty |
| `nombre` | string | No | Required; StringLength(150); MinimumLength=1; Inicial: string.Empty |
| `idTipoCentroCosto` | int | No | Range(1, 2147483647) |
| `idProyecto` | int? | Sí | Range(1, 2147483647); Solo para el tipo PROYECTO; null en centros corporativos. |
| `descripcion` | string? | Sí | StringLength(255) |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-consultapresupuestariarequest"></a>
### ConsultaPresupuestariaRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.ConsultaPresupuestariaRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/ConsultaPresupuestaria/ConsultaPresupuestariaRequest.cs).

Filtros de lectura de las consultas presupuestarias (query string).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCentroCosto` | int? | Sí | — |
| `idPresupuesto` | int? | Sí | — |
| `idPresupuestoVersion` | int? | Sí | — |
| `idCatalogoPartida` | int? | Sí | — |
| `idMoneda` | int? | Sí | — |
| `estadoPresupuesto` | string? | Sí | — |
| `soloExcedidos` | bool? | Sí | — |
| `incluirInactivos` | bool? | Sí | true para incluir presupuestos inactivos (por defecto se descartan). |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-gastoporcentrocostoresponse"></a>
### GastoPorCentroCostoResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.GastoPorCentroCostoResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/ConsultaPresupuestaria/ConsultaPresupuestariaResponses.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCentroCosto` | int | No | — |
| `codigoCentroCosto` | string? | Sí | — |
| `centroCosto` | string? | Sí | — |
| `idPresupuesto` | int | No | — |
| `codigoPresupuesto` | string? | Sí | — |
| `presupuesto` | string? | Sí | — |
| `idMoneda` | int | No | — |
| `moneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |
| `idPresupuestoVersion` | int | No | — |
| `numeroVersion` | int | No | — |
| `estado` | string? | Sí | — |
| `montoPresupuestado` | decimal | No | — |
| `comprometido` | decimal | No | — |
| `ejecutado` | decimal | No | — |
| `saldoDisponible` | decimal | No | — |
| `porcentajeEjecutado` | decimal | No | — |
| `excedido` | bool | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-gastoporpartidaresponse"></a>
### GastoPorPartidaResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.GastoPorPartidaResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/ConsultaPresupuestaria/ConsultaPresupuestariaResponses.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCentroCosto` | int | No | — |
| `codigoCentroCosto` | string? | Sí | — |
| `centroCosto` | string? | Sí | — |
| `idPresupuesto` | int | No | — |
| `codigoPresupuesto` | string? | Sí | — |
| `presupuesto` | string? | Sí | — |
| `idMoneda` | int | No | — |
| `moneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |
| `idPresupuestoVersion` | int | No | — |
| `numeroVersion` | int | No | — |
| `estado` | string? | Sí | — |
| `idCatalogoPartida` | int | No | — |
| `codigoPartida` | string? | Sí | — |
| `partida` | string? | Sí | — |
| `nivel` | int | No | — |
| `montoPresupuestado` | decimal | No | — |
| `ejecutado` | decimal | No | — |
| `diferencia` | decimal | No | — |
| `porcentajeEjecutado` | decimal | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-presupuestovscomprometidoresponse"></a>
### PresupuestoVsComprometidoResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.PresupuestoVsComprometidoResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/ConsultaPresupuestaria/ConsultaPresupuestariaResponses.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCentroCosto` | int | No | — |
| `codigoCentroCosto` | string? | Sí | — |
| `centroCosto` | string? | Sí | — |
| `idPresupuesto` | int | No | — |
| `codigoPresupuesto` | string? | Sí | — |
| `presupuesto` | string? | Sí | — |
| `idMoneda` | int | No | — |
| `moneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |
| `idPresupuestoVersion` | int | No | — |
| `numeroVersion` | int | No | — |
| `estado` | string? | Sí | — |
| `idPresupuestoDetalle` | int | No | — |
| `idCatalogoPartida` | int | No | — |
| `codigoPartida` | string? | Sí | — |
| `partida` | string? | Sí | — |
| `nivel` | int | No | — |
| `montoPresupuestado` | decimal | No | — |
| `comprometido` | decimal | No | — |
| `diferencia` | decimal | No | — |
| `porcentajeComprometido` | decimal | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-presupuestovsejecutadoresponse"></a>
### PresupuestoVsEjecutadoResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.PresupuestoVsEjecutadoResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/ConsultaPresupuestaria/ConsultaPresupuestariaResponses.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCentroCosto` | int | No | — |
| `codigoCentroCosto` | string? | Sí | — |
| `centroCosto` | string? | Sí | — |
| `idPresupuesto` | int | No | — |
| `codigoPresupuesto` | string? | Sí | — |
| `presupuesto` | string? | Sí | — |
| `idMoneda` | int | No | — |
| `moneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |
| `idPresupuestoVersion` | int | No | — |
| `numeroVersion` | int | No | — |
| `estado` | string? | Sí | — |
| `idPresupuestoDetalle` | int | No | — |
| `idCatalogoPartida` | int | No | — |
| `codigoPartida` | string? | Sí | — |
| `partida` | string? | Sí | — |
| `nivel` | int | No | — |
| `montoPresupuestado` | decimal | No | — |
| `ejecutado` | decimal | No | — |
| `diferencia` | decimal | No | — |
| `porcentajeEjecutado` | decimal | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-resumenresponse"></a>
### ResumenResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.ResumenResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/ConsultaPresupuestaria/ConsultaPresupuestariaResponses.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `totales` | [ResumenTotales](#schema-cobranzas-vittoria-controlpresupuestario-application-consultapresupuestaria-resumen-resumentotales) | No | — |
| `porCentroCosto` | [GastoPorCentroCostoResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-gastoporcentrocostoresponse)[] | No | — |
| `partidasExcedidas` | [SaldoPartidaResponse](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-saldopartidaresponse)[] | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-consultapresupuestaria-saldopartidaresponse"></a>
### SaldoPartidaResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.ConsultaPresupuestaria.SaldoPartidaResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/ConsultaPresupuestaria/ConsultaPresupuestariaResponses.cs).

Saldo por partida (saldo y control vigente), con los nombres del contrato.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCentroCosto` | int | No | — |
| `codigoCentroCosto` | string? | Sí | — |
| `centroCosto` | string? | Sí | — |
| `idPresupuesto` | int | No | — |
| `codigoPresupuesto` | string? | Sí | — |
| `presupuesto` | string? | Sí | — |
| `idMoneda` | int | No | — |
| `moneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |
| `idPresupuestoVersion` | int | No | — |
| `numeroVersion` | int | No | — |
| `estado` | string? | Sí | — |
| `idPresupuestoDetalle` | int | No | — |
| `idCatalogoPartida` | int | No | — |
| `codigoPartida` | string? | Sí | — |
| `partida` | string? | Sí | — |
| `nivel` | int | No | — |
| `montoPresupuestado` | decimal | No | — |
| `comprometido` | decimal | No | — |
| `ejecutado` | decimal | No | — |
| `saldoDisponible` | decimal | No | — |
| `montoExcedido` | decimal | No | — |
| `excedido` | bool | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-movimientopresupuestal-movimientopresupuestalresponse"></a>
### MovimientoPresupuestalResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.MovimientoPresupuestal.MovimientoPresupuestalResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/MovimientoPresupuestal/MovimientoPresupuestalResponse.cs).

Asiento del ledger. Partida es el nombre de la partida y Moneda su código.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idMovimientoPresupuestal` | long | No | — |
| `idPresupuestoDetalle` | int | No | — |
| `tipo` | string | No | — |
| `nombreTipo` | string? | Sí | — |
| `origen` | string? | Sí | — |
| `idOrigen` | int | No | — |
| `claveEvento` | string? | Sí | — |
| `fecha` | DateTime | No | — |
| `monto` | decimal | No | — |
| `afectacion` | string? | Sí | — |
| `direccion` | string? | Sí | — |
| `observacion` | string? | Sí | — |
| `idPresupuesto` | int | No | — |
| `idPresupuestoVersion` | int | No | — |
| `numeroVersion` | int | No | — |
| `estadoPresupuesto` | string? | Sí | — |
| `idCatalogoPartida` | int | No | — |
| `codigoPartida` | string? | Sí | — |
| `partida` | string? | Sí | — |
| `codigoPresupuesto` | string? | Sí | — |
| `idMoneda` | int | No | — |
| `moneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |
| `esNuevo` | bool | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-actualizarpresupuestorequest"></a>
### ActualizarPresupuestoRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.Presupuesto.ActualizarPresupuestoRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/Presupuesto/ActualizarPresupuestoRequest.cs).

La moneda y el centro de costo no se editan: definen la historia económica del presupuesto.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `nombre` | string | No | Required; StringLength(200); MinimumLength=1; Inicial: string.Empty |
| `activo` | bool | No | Inicial: true |
| `descripcion` | string? | Sí | StringLength(500) |
| `fechaInicio` | DateTime? | Sí | — |
| `fechaFin` | DateTime? | Sí | — |
| `confirmarInactivacion` | bool | No | true para inactivar aunque tenga gastos, compromisos o requerimientos asociados. |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-crearpresupuestorequest"></a>
### CrearPresupuestoRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.Presupuesto.CrearPresupuestoRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/Presupuesto/CrearPresupuestoRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCentroCosto` | int | No | Range(1, 2147483647) |
| `idMoneda` | int | No | Range(1, 2147483647) |
| `codigo` | string | No | Required; StringLength(50); MinimumLength=1; Inicial: string.Empty |
| `nombre` | string | No | Required; StringLength(200); MinimumLength=1; Inicial: string.Empty |
| `descripcion` | string? | Sí | StringLength(500) |
| `fechaInicio` | DateTime? | Sí | — |
| `fechaFin` | DateTime? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-crearpresupuestoresponse"></a>
### CrearPresupuestoResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.Presupuesto.CrearPresupuestoResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/Presupuesto/CrearPresupuestoResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPresupuesto` | int | No | — |
| `idPresupuestoVersion` | int | No | — |
| `numeroVersion` | int | No | — |
| `estado` | string | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuesto-presupuestoresponse"></a>
### PresupuestoResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.Presupuesto.PresupuestoResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/Presupuesto/PresupuestoResponse.cs).

Presupuesto. CentroCosto es el nombre del centro de costo y Moneda su código (PEN, USD).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPresupuesto` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `descripcion` | string? | Sí | — |
| `idCentroCosto` | int | No | — |
| `codigoCentroCosto` | string? | Sí | — |
| `centroCosto` | string? | Sí | — |
| `idMoneda` | int | No | — |
| `moneda` | string? | Sí | — |
| `nombreMoneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |
| `fechaInicio` | DateTime? | Sí | — |
| `fechaFin` | DateTime? | Sí | — |
| `activo` | bool | No | — |
| `fechaCreacion` | DateTime? | Sí | — |
| `fechaModificacion` | DateTime? | Sí | — |
| `idPresupuestoVersionAprobada` | int? | Sí | — |
| `idPresupuestoVersionBorrador` | int? | Sí | — |
| `cantidadAprobadas` | int | No | — |
| `cantidadBorradores` | int | No | — |
| `estadoElaboracion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-actualizarpartidarequest"></a>
### ActualizarPartidaRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.ActualizarPartidaRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/PresupuestoDetalle/ActualizarPartidaRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `montoPresupuestado` | decimal | No | Range("0", "9999999999999999.99") |
| `observacion` | string? | Sí | StringLength(500) |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-agregarpartidarequest"></a>
### AgregarPartidaRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.AgregarPartidaRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/PresupuestoDetalle/AgregarPartidaRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCatalogoPartida` | int | No | Range(1, 2147483647) |
| `montoPresupuestado` | decimal | No | Range("0", "9999999999999999.99") |
| `observacion` | string? | Sí | StringLength(500) |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-cargaloteitemrequest"></a>
### CargaLoteItemRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.CargaLoteItemRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/PresupuestoDetalle/CargaLoteRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCatalogoPartida` | int | No | Range(1, 2147483647) |
| `montoPresupuestado` | decimal | No | Range("0", "9999999999999999.99") |
| `observacion` | string? | Sí | StringLength(500); NULL o vacío conserva la observación que ya tenía la partida. |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-cargaloterequest"></a>
### CargaLoteRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.CargaLoteRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/PresupuestoDetalle/CargaLoteRequest.cs).

Carga completa de montos (todo o nada). Con QuitarAusentes, las partidas que no vienen se eliminan.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `detalles` | [CargaLoteItemRequest](#schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-cargaloteitemrequest)[] | No | Required; Inicial: new() |
| `quitarAusentes` | bool | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-cargaloteresponse"></a>
### CargaLoteResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.CargaLoteResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/PresupuestoDetalle/PartidaVersionResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPresupuestoVersion` | int | No | — |
| `agregados` | int | No | — |
| `actualizados` | int | No | — |
| `eliminados` | int | No | — |
| `partidasEnVersion` | int | No | — |
| `montoTotal` | decimal | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-partidaversionresponse"></a>
### PartidaVersionResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.PartidaVersionResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/PresupuestoDetalle/PartidaVersionResponse.cs).

Partida incluida en una versión. Codigo y Nombre son los de la partida del catálogo.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPresupuestoDetalle` | int | No | — |
| `idPresupuestoVersion` | int | No | — |
| `idCatalogoPartida` | int | No | — |
| `codigo` | string? | Sí | — |
| `nombre` | string? | Sí | — |
| `montoPresupuestado` | decimal | No | — |
| `observacion` | string? | Sí | — |
| `idPartidaPadre` | int? | Sí | — |
| `nivel` | int | No | — |
| `idTipoPartida` | int | No | — |
| `codigoTipoPartida` | string? | Sí | — |
| `nombreTipoPartida` | string? | Sí | — |
| `partidaActiva` | bool | No | — |
| `esHoja` | bool | No | — |
| `fechaCreacion` | DateTime? | Sí | — |
| `fechaModificacion` | DateTime? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestodetalle-registrarajusterequest"></a>
### RegistrarAjusteRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoDetalle.RegistrarAjusteRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/PresupuestoDetalle/RegistrarAjusteRequest.cs).

Ajuste manual sobre el ledger: corrige compromiso o ejecución sin borrar historia.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `afectacion` | string | No | Required; Inicial: string.Empty; COMPROMISO o EJECUCION. |
| `direccion` | string | No | Required; Inicial: string.Empty; INCREMENTO o DECREMENTO. |
| `monto` | decimal | No | Range("0.01", "9999999999999999.99") |
| `observacion` | string | No | Required; StringLength(500); MinimumLength=1; Inicial: string.Empty |
| `fecha` | DateTime? | Sí | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-anularversionrequest"></a>
### AnularVersionRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoVersion.AnularVersionRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/PresupuestoVersion/AnularVersionRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `motivo` | string | No | Required; StringLength(500); MinimumLength=1; Inicial: string.Empty |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-crearversionrequest"></a>
### CrearVersionRequest

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoVersion.CrearVersionRequest`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/PresupuestoVersion/CrearVersionRequest.cs).

El cuerpo puede ir vacío ({}): el SP copia el snapshot de la versión aprobada vigente.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `descripcion` | string? | Sí | StringLength(500) |
| `motivoCambio` | string? | Sí | StringLength(500) |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-crearversionresponse"></a>
### CrearVersionResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoVersion.CrearVersionResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/PresupuestoVersion/CrearVersionResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPresupuestoVersion` | int | No | — |
| `numeroVersion` | int | No | — |
| `estado` | string | No | — |
| `idPresupuesto` | int | No | — |
| `idPresupuestoVersionBase` | int? | Sí | — |
| `cantidadDetallesCopiados` | int | No | — |

<a id="schema-cobranzas-vittoria-controlpresupuestario-presentation-dto-presupuestoversion-presupuestoversionresponse"></a>
### PresupuestoVersionResponse

Tipo/origen: `Cobranzas_Vittoria.ControlPresupuestario.Presentation.Dto.PresupuestoVersion.PresupuestoVersionResponse`. [Fuente](../Cobranzas_Vittoria/ControlPresupuestario/Presentation/Dto/PresupuestoVersion/PresupuestoVersionResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPresupuestoVersion` | int | No | — |
| `idPresupuesto` | int | No | — |
| `numeroVersion` | int | No | — |
| `estado` | string | No | — |
| `nombreEstado` | string? | Sí | — |
| `descripcion` | string? | Sí | — |
| `motivoCambio` | string? | Sí | — |
| `motivoAnulacion` | string? | Sí | — |
| `fechaCreacion` | DateTime? | Sí | — |
| `fechaAprobacion` | DateTime? | Sí | — |
| `fechaAnulacion` | DateTime? | Sí | — |
| `usuarioCreacion` | string? | Sí | — |
| `usuarioAprobacion` | string? | Sí | — |
| `usuarioAnulacion` | string? | Sí | — |
| `codigoPresupuesto` | string? | Sí | — |
| `nombrePresupuesto` | string? | Sí | — |
| `idCentroCosto` | int | No | — |
| `idMoneda` | int | No | — |
| `moneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-almacen-kardexsalidacreatedto"></a>
### KardexSalidaCreateDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Almacen.KardexSalidaCreateDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Almacen/KardexSalidaCreateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCompra` | int | No | — |
| `idMaterial` | int | No | — |
| `idEspecialidad` | int? | Sí | — |
| `fechaMovimiento` | DateTime | No | — |
| `cantidadSalida` | decimal | No | — |
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-compras-compraaceptardto"></a>
### CompraAceptarDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.CompraAceptarDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/CompraAceptarDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idUsuario` | int? | Sí | — |
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-compras-compracreatedto"></a>
### CompraCreateDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.CompraCreateDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/CompraCreateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `numeroCompra` | string | No | Inicial: string.Empty |
| `idOrdenCompra` | int | No | — |
| `fechaCompra` | DateTime | No | — |
| `incluyeIGV` | bool | No | — |
| `subtotalSinIGV` | decimal | No | — |
| `montoIGV` | decimal | No | — |
| `montoTotal` | decimal | No | — |
| `observacion` | string? | Sí | — |
| `items` | [CompraDetalleCreateDto](#schema-cobranzas-vittoria-dtos-compras-compradetallecreatedto)[] | No | Inicial: new() |

<a id="schema-cobranzas-vittoria-dtos-compras-compradetallecreatedto"></a>
### CompraDetalleCreateDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.CompraDetalleCreateDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/CompraCreateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idMaterial` | int | No | — |
| `cantidad` | decimal | No | — |
| `precioUnitario` | decimal | No | — |

<a id="schema-cobranzas-vittoria-dtos-compras-ordencompracreatedto"></a>
### OrdenCompraCreateDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.OrdenCompraCreateDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/OrdenCompraCreateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `numeroOrdenCompra` | string | No | Inicial: string.Empty |
| `idRequerimiento` | int | No | — |
| `idMoneda` | int? | Sí | Range(1, 2147483647); Opcional: la OC usa la moneda del presupuesto de las partidas del requerimiento. |
| `fechaOrdenCompra` | DateTime | No | — |
| `descripcion` | string? | Sí | — |
| `idUsuarioCreacion` | int? | Sí | — |
| `rutaPdf` | string? | Sí | — |
| `items` | [OrdenCompraDetalleCreateDto](#schema-cobranzas-vittoria-dtos-compras-ordencompradetallecreatedto)[] | No | Inicial: new() |

<a id="schema-cobranzas-vittoria-dtos-compras-ordencompradetallecreatedto"></a>
### OrdenCompraDetalleCreateDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.OrdenCompraDetalleCreateDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/OrdenCompraCreateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idMaterial` | int | No | — |
| `cantidad` | decimal | No | — |
| `idProveedor` | int | No | — |
| `precioUnitario` | decimal | No | Opcional en la OC (0 = sin precio): el precio se registra en la Compra. |

<a id="schema-cobranzas-vittoria-dtos-compras-ordencompradetalleupdatedto"></a>
### OrdenCompraDetalleUpdateDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.OrdenCompraDetalleUpdateDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/OrdenCompraUpdateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idMaterial` | int | No | — |
| `cantidad` | decimal | No | — |
| `idProveedor` | int | No | — |
| `precioUnitario` | decimal | No | — |

<a id="schema-cobranzas-vittoria-dtos-compras-ordencompraestadodto"></a>
### OrdenCompraEstadoDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.OrdenCompraEstadoDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/OrdenCompraEstadoDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `estadoNuevo` | string | No | Inicial: string.Empty |
| `idUsuario` | int? | Sí | — |
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-compras-ordencompraupdatedto"></a>
### OrdenCompraUpdateDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.OrdenCompraUpdateDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/OrdenCompraUpdateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `numeroOrdenCompra` | string | No | Inicial: string.Empty |
| `idRequerimiento` | int | No | — |
| `idMoneda` | int? | Sí | Range(1, 2147483647); Opcional: la OC usa la moneda del presupuesto de las partidas del requerimiento. |
| `fechaOrdenCompra` | DateTime | No | — |
| `descripcion` | string? | Sí | — |
| `idUsuarioCreacion` | int? | Sí | — |
| `rutaPdf` | string? | Sí | — |
| `items` | [OrdenCompraDetalleUpdateDto](#schema-cobranzas-vittoria-dtos-compras-ordencompradetalleupdatedto)[] | No | Inicial: new() |

<a id="schema-cobranzas-vittoria-dtos-compras-requerimientocreatedto"></a>
### RequerimientoCreateDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.RequerimientoCreateDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/RequerimientoCreateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `numeroRequerimiento` | string | No | Inicial: string.Empty |
| `fechaRequerimiento` | DateTime | No | — |
| `idProyecto` | int | No | — |
| `descripcion` | string? | Sí | — |
| `fechaEntrega` | DateTime? | Sí | — |
| `idUsuarioSolicitante` | int | No | — |
| `observacion` | string? | Sí | — |
| `items` | [RequerimientoDetalleCreateDto](#schema-cobranzas-vittoria-dtos-compras-requerimientodetallecreatedto)[] | No | Inicial: new() |

<a id="schema-cobranzas-vittoria-dtos-compras-requerimientodetallecreatedto"></a>
### RequerimientoDetalleCreateDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.RequerimientoDetalleCreateDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/RequerimientoCreateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idMaterial` | int | No | — |
| `idPresupuestoDetalle` | int? | Sí | — |
| `cantidad` | decimal | No | — |
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-compras-requerimientodetalleupdatedto"></a>
### RequerimientoDetalleUpdateDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.RequerimientoDetalleUpdateDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/RequerimientoUpdateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idMaterial` | int | No | — |
| `idPresupuestoDetalle` | int? | Sí | — |
| `cantidad` | decimal | No | — |
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-compras-requerimientoupdatedto"></a>
### RequerimientoUpdateDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.RequerimientoUpdateDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/RequerimientoUpdateDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `numeroRequerimiento` | string | No | Inicial: string.Empty |
| `fechaRequerimiento` | DateTime | No | — |
| `idProyecto` | int | No | — |
| `descripcion` | string? | Sí | — |
| `fechaEntrega` | DateTime? | Sí | — |
| `idUsuarioSolicitante` | int | No | — |
| `observacion` | string? | Sí | — |
| `items` | [RequerimientoDetalleUpdateDto](#schema-cobranzas-vittoria-dtos-compras-requerimientodetalleupdatedto)[] | No | Inicial: new() |

<a id="schema-cobranzas-vittoria-dtos-compras-requerimientos-aprobarrequerimientorequest"></a>
### AprobarRequerimientoRequest

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.Requerimientos.AprobarRequerimientoRequest`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/Requerimientos/AprobarRequerimientoRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-compras-requerimientos-enviarrequerimientocomprasrequest"></a>
### EnviarRequerimientoComprasRequest

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.Requerimientos.EnviarRequerimientoComprasRequest`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/Requerimientos/EnviarRequerimientoComprasRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-compras-requerimientos-enviarrequerimientorequest"></a>
### EnviarRequerimientoRequest

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.Requerimientos.EnviarRequerimientoRequest`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/Requerimientos/EnviarRequerimientoRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-compras-requerimientos-procesarstockrequerimientorequest"></a>
### ProcesarStockRequerimientoRequest

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.Requerimientos.ProcesarStockRequerimientoRequest`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/Requerimientos/ProcesarStockRequerimientoRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `resultado` | string | No | — |
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-compras-requerimientos-rechazarrequerimientorequest"></a>
### RechazarRequerimientoRequest

Tipo/origen: `Cobranzas_Vittoria.Dtos.Compras.Requerimientos.RechazarRequerimientoRequest`. [Fuente](../Cobranzas_Vittoria/Dtos/Compras/Requerimientos/RechazarRequerimientoRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-contable-proveedorterrenoupsertdto"></a>
### ProveedorTerrenoUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Contable.ProveedorTerrenoUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Contable/ProveedorTerrenoUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProveedorTerreno` | int? | Sí | — |
| `razonSocial` | string | No | Inicial: string.Empty |
| `ruc` | string? | Sí | — |
| `contacto` | string? | Sí | — |
| `telefono` | string? | Sí | — |
| `correo` | string? | Sí | — |
| `activo` | bool | No | Inicial: true |

<a id="schema-cobranzas-vittoria-dtos-gastosadministrativos-categoriagastoupsertdto"></a>
### CategoriaGastoUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.GastosAdministrativos.CategoriaGastoUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/GastosAdministrativos/CategoriaGastoUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCategoriaGasto` | int? | Sí | — |
| `codigo` | string | No | Inicial: string.Empty |
| `nombre` | string | No | Inicial: string.Empty |
| `activo` | bool | No | Inicial: true |

<a id="schema-cobranzas-vittoria-dtos-gastosadministrativos-proveedorgastoadministrativoupsertdto"></a>
### ProveedorGastoAdministrativoUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.GastosAdministrativos.ProveedorGastoAdministrativoUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/GastosAdministrativos/ProveedorGastoAdministrativoUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProveedorGastoAdministrativo` | int? | Sí | — |
| `idCategoriaGasto` | int | No | — |
| `razonSocial` | string | No | Inicial: string.Empty |
| `ruc` | string? | Sí | — |
| `contacto` | string? | Sí | — |
| `telefono` | string? | Sí | — |
| `correo` | string? | Sí | — |
| `activo` | bool | No | Inicial: true |

<a id="schema-cobranzas-vittoria-dtos-maestra-especialidadupsertdto"></a>
### EspecialidadUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Maestra.EspecialidadUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Maestra/EspecialidadUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idEspecialidad` | int? | Sí | — |
| `nombre` | string | No | Inicial: string.Empty |
| `descripcion` | string? | Sí | — |
| `activo` | bool | No | Inicial: true |

<a id="schema-cobranzas-vittoria-dtos-maestra-materialupsertdto"></a>
### MaterialUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Maestra.MaterialUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Maestra/MaterialUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idMaterial` | int? | Sí | — |
| `idEspecialidad` | int | No | — |
| `codigo` | string? | Sí | — |
| `codigoProveedor` | string? | Sí | — |
| `descripcion` | string | No | Inicial: string.Empty |
| `unidadMedida` | string | No | Inicial: string.Empty |
| `stockMinimo` | decimal | No | — |
| `activo` | bool | No | Inicial: true |
| `idCatalogoPartida` | int? | Sí | Partida presupuestal por defecto (una hoja del catálogo). NULL = sin partida. El PUT reemplaza el material completo: quien edite debe reenviar la partida. |

<a id="schema-cobranzas-vittoria-dtos-maestra-proveedorconsultasunatdto"></a>
### ProveedorConsultaSunatDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Maestra.ProveedorConsultaSunatDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Maestra/ProveedorConsultaSunatDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `razon_social` | string | No | Inicial: string.Empty |
| `numero_documento` | string | No | Inicial: string.Empty |
| `estado` | string | No | Inicial: string.Empty |
| `condicion` | string | No | Inicial: string.Empty |
| `direccion` | string | No | Inicial: string.Empty |
| `ubigeo` | string | No | Inicial: string.Empty |
| `via_tipo` | string | No | Inicial: string.Empty |
| `via_nombre` | string | No | Inicial: string.Empty |
| `zona_codigo` | string | No | Inicial: string.Empty |
| `zona_tipo` | string | No | Inicial: string.Empty |
| `numero` | string | No | Inicial: string.Empty |
| `interior` | string | No | Inicial: string.Empty |
| `lote` | string | No | Inicial: string.Empty |
| `dpto` | string | No | Inicial: string.Empty |
| `manzana` | string | No | Inicial: string.Empty |
| `kilometro` | string | No | Inicial: string.Empty |
| `distrito` | string | No | Inicial: string.Empty |
| `provincia` | string | No | Inicial: string.Empty |
| `departamento` | string | No | Inicial: string.Empty |
| `es_agente_retencion` | bool | No | — |
| `es_buen_contribuyente` | bool | No | — |
| `locales_anexos` | object[] | Sí | — |

<a id="schema-cobranzas-vittoria-dtos-maestra-proveedorespecialidaddto"></a>
### ProveedorEspecialidadDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Maestra.ProveedorEspecialidadDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Maestra/ProveedorEspecialidadDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProveedor` | int | No | — |
| `idEspecialidad` | int | No | — |
| `activo` | bool | No | Inicial: true |

<a id="schema-cobranzas-vittoria-dtos-maestra-proveedorupsertdto"></a>
### ProveedorUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Maestra.ProveedorUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Maestra/ProveedorUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProveedor` | int? | Sí | — |
| `razonSocial` | string | No | Inicial: string.Empty |
| `ruc` | string? | Sí | — |
| `contacto` | string? | Sí | — |
| `telefono` | string? | Sí | — |
| `correo` | string? | Sí | — |
| `direccion` | string? | Sí | — |
| `banco` | string? | Sí | — |
| `cuentaCorriente` | string? | Sí | — |
| `cci` | string? | Sí | — |
| `cuentaDetraccion` | string? | Sí | — |
| `descripcionServicio` | string? | Sí | — |
| `observacion` | string? | Sí | — |
| `trabajamosConProveedor` | string? | Sí | — |
| `activo` | bool | No | Inicial: true |

<a id="schema-cobranzas-vittoria-dtos-maestra-proyectoupsertdto"></a>
### ProyectoUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Maestra.ProyectoUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Maestra/ProyectoUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProyecto` | int? | Sí | — |
| `nombreProyecto` | string | No | Inicial: string.Empty |
| `descripcion` | string? | Sí | — |
| `cotizacionGeneral` | decimal | No | Inicial: 0 |
| `activo` | bool | No | Inicial: true |

<a id="schema-cobranzas-vittoria-dtos-maestra-unidadmedidadto"></a>
### UnidadMedidaDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Maestra.UnidadMedidaDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Maestra/UnidadMedidaDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idUnidadMedida` | int | No | — |
| `codigo` | string | No | Inicial: string.Empty |
| `nombre` | string | No | Inicial: string.Empty |
| `activo` | bool | No | — |

<a id="schema-cobranzas-vittoria-dtos-maestra-unidadmedidaupsertdto"></a>
### UnidadMedidaUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Maestra.UnidadMedidaUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Maestra/UnidadMedidaUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idUnidadMedida` | int? | Sí | — |
| `codigo` | string | No | Inicial: string.Empty |
| `nombre` | string | No | Inicial: string.Empty |
| `activo` | bool | No | Inicial: true |

<a id="schema-cobranzas-vittoria-dtos-sunat-tipocambioresponsedto"></a>
### TipoCambioResponseDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Sunat.TipoCambioResponseDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Sunat/TipoCambioResponseDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `buy_price` | string | No | Inicial: string.Empty |
| `sell_price` | string | No | Inicial: string.Empty |
| `base_currency` | string | No | Inicial: string.Empty |
| `quote_currency` | string | No | Inicial: string.Empty |
| `date` | string | No | Inicial: string.Empty |

<a id="schema-cobranzas-vittoria-dtos-valorizaciones-proveedorespecialidadcotizacionupsertdto"></a>
### ProveedorEspecialidadCotizacionUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Valorizaciones.ProveedorEspecialidadCotizacionUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Valorizaciones/ProveedorEspecialidadCotizacionUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idConfiguracion` | int? | Sí | — |
| `idProyecto` | int | No | — |
| `idProveedor` | int | No | — |
| `idEspecialidad` | int | No | — |
| `empresa` | string? | Sí | — |
| `servicio` | string? | Sí | — |
| `moneda` | string | No | Inicial: "PEN" |
| `montoCotizacion` | decimal | No | — |
| `usuario` | string | No | Inicial: "system" |

<a id="schema-cobranzas-vittoria-dtos-valorizaciones-proveedorreglavalorizacionupsertdto"></a>
### ProveedorReglaValorizacionUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Valorizaciones.ProveedorReglaValorizacionUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Valorizaciones/ProveedorReglaValorizacionUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProveedor` | int | No | — |
| `porcentajeGarantia` | decimal | No | Inicial: 0.05m |
| `porcentajeDetraccion` | decimal | No | Inicial: 0.04m |
| `usuario` | string | No | Inicial: "system" |

<a id="schema-cobranzas-vittoria-dtos-valorizaciones-valorizaciondetalleupsertdto"></a>
### ValorizacionDetalleUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Valorizaciones.ValorizacionDetalleUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Valorizaciones/ValorizacionDetalleUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idDetalle` | int? | Sí | — |
| `idValorizacion` | int | No | — |
| `idConfiguracion` | int? | Sí | — |
| `fechaFactura` | DateTime? | Sí | — |
| `numeroFactura` | string | No | Inicial: string.Empty |
| `montoFactura` | decimal | No | — |
| `descripcion` | string | No | Inicial: string.Empty |
| `otrosDescuentos` | decimal | No | — |
| `fechaTransferencia` | DateTime? | Sí | — |
| `numeroOperacion` | string | No | Inicial: string.Empty |
| `bancoTransferencia` | string | No | Inicial: string.Empty |
| `bancoDestino` | string | No | Inicial: string.Empty |
| `montoTransferido` | decimal | No | — |
| `tipoDetraccion` | string? | Sí | — |
| `porcentajeDetraccionAplicado` | decimal? | Sí | — |
| `porcentajeGarantiaAplicado` | decimal? | Sí | — |
| `usuario` | string | No | Inicial: "system" |

<a id="schema-cobranzas-vittoria-dtos-valorizaciones-valorizacionupsertdto"></a>
### ValorizacionUpsertDto

Tipo/origen: `Cobranzas_Vittoria.Dtos.Valorizaciones.ValorizacionUpsertDto`. [Fuente](../Cobranzas_Vittoria/Dtos/Valorizaciones/ValorizacionUpsertDto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idValorizacion` | int? | Sí | — |
| `idConfiguracion` | int | No | — |
| `periodo` | string | No | Inicial: string.Empty |
| `empresa` | string? | Sí | — |
| `observacion` | string | No | Inicial: string.Empty |
| `usuario` | string | No | Inicial: "system" |

<a id="schema-cobranzas-vittoria-entities-categoriagasto"></a>
### CategoriaGasto

Tipo/origen: `Cobranzas_Vittoria.Entities.CategoriaGasto`. [Fuente](../Cobranzas_Vittoria/Entities/CategoriaGasto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idCategoriaGasto` | int | No | — |
| `codigo` | string? | Sí | — |
| `nombre` | string | No | Inicial: string.Empty |
| `activo` | bool | No | — |

<a id="schema-cobranzas-vittoria-entities-especialidad"></a>
### Especialidad

Tipo/origen: `Cobranzas_Vittoria.Entities.Especialidad`. [Fuente](../Cobranzas_Vittoria/Entities/Especialidad.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idEspecialidad` | int | No | — |
| `nombre` | string | No | Inicial: string.Empty |
| `descripcion` | string? | Sí | — |
| `activo` | bool | No | — |
| `fechaCreacion` | DateTime | No | — |

<a id="schema-cobranzas-vittoria-entities-material"></a>
### Material

Tipo/origen: `Cobranzas_Vittoria.Entities.Material`. [Fuente](../Cobranzas_Vittoria/Entities/Material.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idMaterial` | int | No | — |
| `idEspecialidad` | int | No | — |
| `especialidad` | string? | Sí | — |
| `codigo` | string? | Sí | — |
| `codigoProveedor` | string? | Sí | — |
| `descripcion` | string | No | Inicial: string.Empty |
| `unidadMedida` | string | No | Inicial: string.Empty |
| `stockMinimo` | decimal | No | — |
| `activo` | bool | No | — |
| `fechaCreacion` | DateTime | No | — |
| `idCatalogoPartida` | int? | Sí | Partida presupuestal por defecto: se propone al agregar el material a un requerimiento. |
| `codigoPartida` | string? | Sí | — |
| `nombrePartida` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-entities-ordencompra"></a>
### OrdenCompra

Tipo/origen: `Cobranzas_Vittoria.Entities.OrdenCompra`. [Fuente](../Cobranzas_Vittoria/Entities/OrdenCompra.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idOrdenCompra` | int | No | — |
| `numeroOrdenCompra` | string | No | Inicial: string.Empty |
| `idRequerimiento` | int | No | — |
| `idMoneda` | int | No | — |
| `codigoMoneda` | string? | Sí | — |
| `simboloMoneda` | string? | Sí | — |
| `numeroRequerimiento` | string? | Sí | — |
| `proveedores` | string? | Sí | — |
| `especialidades` | string? | Sí | — |
| `idProyecto` | int | No | — |
| `nombreProyecto` | string? | Sí | — |
| `fechaOrdenCompra` | DateTime | No | — |
| `descripcion` | string? | Sí | — |
| `estado` | string | No | Inicial: string.Empty |
| `total` | decimal | No | — |
| `rutaPdf` | string? | Sí | — |
| `fechaCreacion` | DateTime | No | — |
| `idUsuarioCreacion` | int? | Sí | — |

<a id="schema-cobranzas-vittoria-entities-ordencompradetalle"></a>
### OrdenCompraDetalle

Tipo/origen: `Cobranzas_Vittoria.Entities.OrdenCompraDetalle`. [Fuente](../Cobranzas_Vittoria/Entities/OrdenCompraDetalle.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idOrdenCompraDetalle` | int | No | — |
| `idOrdenCompra` | int | No | — |
| `idMaterial` | int | No | — |
| `idProveedor` | int | No | — |
| `proveedor` | string? | Sí | — |
| `material` | string? | Sí | — |
| `especialidad` | string? | Sí | — |
| `unidadMedida` | string? | Sí | — |
| `cantidad` | decimal | No | — |
| `precioUnitario` | decimal | No | — |
| `subtotal` | decimal | No | — |

<a id="schema-cobranzas-vittoria-entities-ordencomprahistorial"></a>
### OrdenCompraHistorial

Tipo/origen: `Cobranzas_Vittoria.Entities.OrdenCompraHistorial`. [Fuente](../Cobranzas_Vittoria/Entities/OrdenCompraHistorial.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idOrdenCompraHistorial` | int | No | — |
| `idOrdenCompra` | int | No | — |
| `estadoAnterior` | string? | Sí | — |
| `estadoNuevo` | string | No | Inicial: string.Empty |
| `fechaCambio` | DateTime | No | — |
| `idUsuario` | int? | Sí | — |
| `usuario` | string? | Sí | — |
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-entities-proveedor"></a>
### Proveedor

Tipo/origen: `Cobranzas_Vittoria.Entities.Proveedor`. [Fuente](../Cobranzas_Vittoria/Entities/Proveedor.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProveedor` | int | No | — |
| `razonSocial` | string | No | Inicial: string.Empty |
| `ruc` | string? | Sí | — |
| `contacto` | string? | Sí | — |
| `telefono` | string? | Sí | — |
| `correo` | string? | Sí | — |
| `direccion` | string? | Sí | — |
| `banco` | string? | Sí | — |
| `cuentaCorriente` | string? | Sí | — |
| `cci` | string? | Sí | — |
| `cuentaDetraccion` | string? | Sí | — |
| `descripcionServicio` | string? | Sí | — |
| `observacion` | string? | Sí | — |
| `trabajamosConProveedor` | string? | Sí | — |
| `activo` | bool | No | — |
| `fechaCreacion` | DateTime | No | — |

<a id="schema-cobranzas-vittoria-entities-proveedorespecialidad"></a>
### ProveedorEspecialidad

Tipo/origen: `Cobranzas_Vittoria.Entities.ProveedorEspecialidad`. [Fuente](../Cobranzas_Vittoria/Entities/ProveedorEspecialidad.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProveedorEspecialidad` | int | No | — |
| `idProveedor` | int | No | — |
| `idEspecialidad` | int | No | — |
| `especialidad` | string? | Sí | — |
| `activo` | bool | No | — |

<a id="schema-cobranzas-vittoria-entities-proveedorgastoadministrativo"></a>
### ProveedorGastoAdministrativo

Tipo/origen: `Cobranzas_Vittoria.Entities.ProveedorGastoAdministrativo`. [Fuente](../Cobranzas_Vittoria/Entities/ProveedorGastoAdministrativo.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProveedorGastoAdministrativo` | int | No | — |
| `idCategoriaGasto` | int? | Sí | — |
| `categoria` | string? | Sí | — |
| `razonSocial` | string | No | Inicial: string.Empty |
| `ruc` | string? | Sí | — |
| `contacto` | string? | Sí | — |
| `telefono` | string? | Sí | — |
| `correo` | string? | Sí | — |
| `activo` | bool | No | — |
| `fechaCreacion` | DateTime | No | — |

<a id="schema-cobranzas-vittoria-entities-proveedorterreno"></a>
### ProveedorTerreno

Tipo/origen: `Cobranzas_Vittoria.Entities.ProveedorTerreno`. [Fuente](../Cobranzas_Vittoria/Entities/ProveedorTerreno.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProveedorTerreno` | int | No | — |
| `razonSocial` | string | No | Inicial: string.Empty |
| `ruc` | string? | Sí | — |
| `contacto` | string? | Sí | — |
| `telefono` | string? | Sí | — |
| `correo` | string? | Sí | — |
| `activo` | bool | No | — |
| `fechaCreacion` | DateTime | No | — |

<a id="schema-cobranzas-vittoria-entities-proyecto"></a>
### Proyecto

Tipo/origen: `Cobranzas_Vittoria.Entities.Proyecto`. [Fuente](../Cobranzas_Vittoria/Entities/Proyecto.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idProyecto` | int | No | — |
| `nombreProyecto` | string | No | Inicial: string.Empty |
| `descripcion` | string? | Sí | — |
| `cotizacionGeneral` | decimal | No | — |
| `activo` | bool | No | — |
| `fechaCreacion` | DateTime | No | — |

<a id="schema-cobranzas-vittoria-entities-requerimiento"></a>
### Requerimiento

Tipo/origen: `Cobranzas_Vittoria.Entities.Requerimiento`. [Fuente](../Cobranzas_Vittoria/Entities/Requerimiento.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idRequerimiento` | int | No | — |
| `numeroRequerimiento` | string | No | Inicial: string.Empty |
| `fechaRequerimiento` | DateTime | No | — |
| `especialidades` | string? | Sí | — |
| `idProyecto` | int | No | — |
| `nombreProyecto` | string? | Sí | — |
| `descripcion` | string? | Sí | — |
| `fechaEntrega` | DateTime? | Sí | — |
| `idUsuarioSolicitante` | int | No | — |
| `solicitante` | string? | Sí | — |
| `estado` | string | No | Inicial: string.Empty |
| `observacion` | string? | Sí | — |
| `fechaCreacion` | DateTime | No | — |

<a id="schema-cobranzas-vittoria-entities-requerimientodetalle"></a>
### RequerimientoDetalle

Tipo/origen: `Cobranzas_Vittoria.Entities.RequerimientoDetalle`. [Fuente](../Cobranzas_Vittoria/Entities/RequerimientoDetalle.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idRequerimientoDetalle` | int | No | — |
| `idRequerimiento` | int | No | — |
| `idMaterial` | int | No | — |
| `idPresupuestoDetalle` | int? | Sí | — |
| `codigoPartida` | string? | Sí | Partida imputada; null cuando la línea no está imputada al presupuesto. |
| `nombrePartida` | string? | Sí | — |
| `idEspecialidad` | int? | Sí | — |
| `especialidad` | string? | Sí | — |
| `material` | string? | Sí | — |
| `unidadMedida` | string? | Sí | — |
| `cantidad` | decimal | No | — |
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-entities-requerimientovalidacion"></a>
### RequerimientoValidacion

Tipo/origen: `Cobranzas_Vittoria.Entities.RequerimientoValidacion`. [Fuente](../Cobranzas_Vittoria/Entities/RequerimientoValidacion.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idRequerimientoValidacion` | int | No | — |
| `idRequerimiento` | int | No | — |
| `idUsuario` | int | No | — |
| `usuario` | string? | Sí | — |
| `fechaValidacion` | DateTime | No | — |
| `resultado` | string | No | Inicial: string.Empty |
| `observacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-asignarpermisosrequest"></a>
### AsignarPermisosRequest

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.AsignarPermisosRequest`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/AsignarPermisosRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPermisos` | int[] | No | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-asignarrolesrequest"></a>
### AsignarRolesRequest

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.AsignarRolesRequest`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/AsignarRolesRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idRoles` | int[] | No | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-createrolrequest"></a>
### CreateRolRequest

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.CreateRolRequest`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/CreateRolRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `nombre` | string | No | Required: El nombre es obligatorio |
| `descripcion` | string | No | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-createusuariorequest"></a>
### CreateUsuarioRequest

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.CreateUsuarioRequest`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/CreateUsuarioRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `nombres` | string | No | Required: El nombre es obligatorio |
| `apellidos` | string | No | Required: El apellido es obligatorio |
| `correo` | string | No | Required: El correo es obligatorio; EmailAddress: El correo no tiene un formato valido |
| `usuarioLogin` | string | No | Required: El usuario de login es obligatorio |
| `password` | string | No | Required: La contraseña es obligatoria |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-listarpermisoresponse"></a>
### ListarPermisoResponse

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.ListarPermisoResponse`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/ListarPermisoResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `permisos` | [PermisoResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-permisoresponse)[] | No | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-listarrolresponse"></a>
### ListarRolResponse

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.ListarRolResponse`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/ListarRolResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `roles` | [RolResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-rolresponse)[] | No | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-listarusuarioresponse"></a>
### ListarUsuarioResponse

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.ListarUsuarioResponse`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/ListarUsuarioResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `usuarios` | [UsuarioResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-usuarioresponse)[] | No | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-loginrequest"></a>
### LoginRequest

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.LoginRequest`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/LoginRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `usernameOrEmail` | string | No | — |
| `password` | string | No | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-loginresponse"></a>
### LoginResponse

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.LoginResponse`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/LoginResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `token` | string | No | — |
| `expiration` | DateTime | No | — |
| `refreshToken` | string | No | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-permisoasignadoresponse"></a>
### PermisoAsignadoResponse

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.PermisoAsignadoResponse`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/PermisoAsignadoResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPermiso` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-permisoresponse"></a>
### PermisoResponse

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.PermisoResponse`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/PermisoResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idPermiso` | int | No | — |
| `codigo` | string | No | — |
| `nombre` | string | No | — |
| `descripcion` | string | No | — |
| `activo` | bool | No | — |
| `fechaCreacion` | DateTime? | Sí | — |
| `usuarioCreacion` | string? | Sí | — |
| `fechaModificacion` | DateTime? | Sí | — |
| `usuarioModificacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-refreshrequest"></a>
### RefreshRequest

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.RefreshRequest`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/RefreshRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `refreshToken` | string | No | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-rolconpermisosresponse"></a>
### RolConPermisosResponse

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.RolConPermisosResponse`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/RolConPermisosResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idRol` | int | No | — |
| `nombre` | string | No | — |
| `descripcion` | string | No | — |
| `activo` | bool | No | — |
| `permisos` | [PermisoAsignadoResponse](#schema-cobranzas-vittoria-seguridad-presentation-dto-permisoasignadoresponse)[] | No | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-rolresponse"></a>
### RolResponse

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.RolResponse`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/RolResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idRol` | int | No | — |
| `nombre` | string | No | — |
| `descripcion` | string | No | — |
| `activo` | bool | No | — |
| `fechaCreacion` | DateTime? | Sí | — |
| `usuarioCreacion` | string? | Sí | — |
| `fechaModificacion` | DateTime? | Sí | — |
| `usuarioModificacion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-updatepermisorequest"></a>
### UpdatePermisoRequest

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.UpdatePermisoRequest`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/UpdatePermisoRequest.cs).

Request para actualizar parcialmente un permiso. Solo Nombre y Descripcion son editables.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `nombre` | string? | Sí | — |
| `descripcion` | string? | Sí | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-updaterolrequest"></a>
### UpdateRolRequest

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.UpdateRolRequest`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/UpdateRolRequest.cs).

Request para actualizar parcialmente un rol.

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `nombre` | string? | Sí | — |
| `descripcion` | string? | Sí | — |
| `activo` | bool? | Sí | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-updateusuariorequest"></a>
### UpdateUsuarioRequest

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.UpdateUsuarioRequest`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/UpdateUsuarioRequest.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `nombres` | string? | Sí | — |
| `apellidos` | string? | Sí | — |
| `correo` | string? | Sí | — |
| `usuarioLogin` | string? | Sí | — |
| `passwordHash` | string? | Sí | — |
| `activo` | bool? | Sí | — |

<a id="schema-cobranzas-vittoria-seguridad-presentation-dto-usuarioresponse"></a>
### UsuarioResponse

Tipo/origen: `Cobranzas_Vittoria.Seguridad.Presentation.Dto.UsuarioResponse`. [Fuente](../Cobranzas_Vittoria/Seguridad/Presentation/Dto/UsuarioResponse.cs).

| Campo JSON / query | Tipo / esquema | Admite null | Restricciones / inicialización |
|---|---|---|---|
| `idUsuario` | int | No | — |
| `nombres` | string | No | — |
| `apellidos` | string | No | — |
| `correo` | string | No | — |
| `usuarioLogin` | string | No | — |
| `activo` | bool | No | — |
| `fechaCreacion` | DateTime? | Sí | — |
| `usuarioCreacion` | string? | Sí | — |

<a id="reglas"></a>
## Reglas de negocio y archivos

### Maestros y servicios externos

Los POST denominados upsert pueden crear o actualizar según el ID del cuerpo. En los PUT de especialidades, proyectos, materiales, proveedores, proveedores de gasto y proveedores de terreno, el controlador reemplaza el ID del DTO por el de la ruta. El filtro `activo` nullable de los maestros se entrega al repositorio; no equivale al default `true` aplicado explícitamente en los listados de usuarios, roles y permisos.

La consulta de RUC valida que el texto tenga 11 caracteres; no añade una comprobación de que todos sean dígitos. Devuelve `400` con texto si no cumple y `404` con texto si el proveedor externo no retorna datos. El tipo de cambio usa `fecha` como cadena; si falta o está vacía toma el día actual de `America/Lima`. No valida una fecha ISO mediante DataAnnotations. Consulta un proveedor y luego uno de respaldo; el fallo total termina en `500 UNHANDLED_ERROR`. La respuesta se almacena en caché con expiración absoluta de 6 horas y deslizante de 2 horas.

### Requerimientos e ítems

La identidad solicitante de crear/actualizar y de las acciones del flujo se obtiene de la sesión. `idUsuarioSolicitante` permanece en los DTOs legacy pero el controlador lo sobrescribe. Actualizar la cabecera exige ser el solicitante; el rechazo de esa validación usa `422 DATOS_INVALIDOS` con detalle `REQUERIMIENTO_SOLICITANTE_REQUERIDO`.

| Acción | Condición / transición |
|---|---|
| Enviar | El solicitante envía un requerimiento `Registrado` → `EnviadoAlmacen`. |
| Validación de almacén | Requiere `EnviadoAlmacen`. `resultado = "Conforme"` → `ValidadoAlmacen`; `"Observado"` → `Registrado`. Registra la validación de almacén. |
| Aprobar | `ValidadoAlmacen` → `AprobadoCoordinador`. |
| Rechazar | Desde `ValidadoAlmacen` o `AprobadoCoordinador` → `Rechazado`. |
| Enviar a compras | `AprobadoCoordinador` → `EnviadoOC`. |

Los SP legacy de esas transiciones emiten errores `51051–51058`. El repositorio convierte los errores `51051–51060` de esas acciones a `422 DATOS_INVALIDOS`, con campo `estado` y código de detalle `REQUERIMIENTO_TRANSICION_INVALIDA`. Los permisos HTTP no sustituyen las condiciones de estado del SP.

La edición de ítems de almacén tiene contrato propio:

- POST requiere material positivo y `cantidad` entre `0.01` y `9999999999999999.99`; partida opcional positiva y observación hasta 250 caracteres.
- PATCH admite `cantidad`, `idPresupuestoDetalle` y `observacion`; omitir conserva el dato, `null` limpia partida/observación. `cantidad: null` se rechaza. `{}` se rechaza. No se acepta cambiar `idMaterial` por ese PATCH.
- Ambos DTOs rechazan claves JSON desconocidas (`JsonUnmappedMemberHandling.Disallow`), con `400` de validación/deserialización.
- Las modificaciones de ítems requieren estado `EnviadoAlmacen`; no se puede eliminar el último ítem. El dominio y la base de datos verifican estado, pertenencia, duplicidad del material y referencias. Los rechazos del contrato SQL `51460–51469` se traducen a `400`, `404` o `409`, según el catálogo de errores.

Fuentes: [RequerimientosController.cs](../Cobranzas_Vittoria/Controllers/RequerimientosController.cs), [DTOs de ítems](../Cobranzas_Vittoria/Compras/Presentation/Dto/), [SP del flujo](../Cobranzas_Vittoria/Migrations/Repeatable/2_StoredProcedures/R__Compras_Requerimientos_Flujo_SPs.sql).

### Órdenes de compra y compras

La OC se relaciona con el requerimiento. `idMoneda` puede omitirse para resolver la moneda a partir del presupuesto de las partidas del requerimiento; si se proporciona, debe ser coherente. El precio unitario de una OC es opcional en términos de negocio (`0` significa sin precio); el precio de compra se registra en Compra.

El PATCH de estado de OC normaliza `estadoNuevo` a mayúsculas y acepta `APROBADA`, `ANULADA` o `CERRADA`. Las transiciones admitidas son `REGISTRADA → APROBADA/ANULADA`, `APROBADA → ANULADA` y `ATENDIDA → CERRADA`; reenviar el estado actual retorna sin modificarlo. Una compra se registra contra una OC `APROBADA`; aceptar una compra `REGISTRADA` marca la OC como `ATENDIDA` según el flujo del SP. Una OC aprobada no permite cambiar su requerimiento ni moneda.

Los validadores numéricos de Compras rechazan materiales repetidos y valores con precisión incompatible. Las cantidades/precios se procesan con dos decimales; los detalles de los errores se comunican mediante `422 DATOS_INVALIDOS` cuando se originan en `ValidacionNegocioComprasException`. La integración presupuestaria puede rechazar moneda, partida incompatible o saldo insuficiente con `409` del rango SQL `514xx`.

Al registrar una compra, el repositorio determina número y fecha por defecto cuando corresponde y el SP calcula los importes a partir de los ítems. `subtotalSinIGV`, `montoIGV` y `montoTotal` existen en el DTO de entrada pero no se pasan como importes confiables al SP. La creación devuelve `{ idCompra, montoTotal }`; la OC devuelve `{ idOrdenCompra, total }`.

Los documentos de Compra usan el campo repetido `files`, con un máximo de cuerpo HTTP de **50 000 000 bytes**. Se exige al menos un archivo. El controlador actual no restringe sus extensiones a PDF; la descarga usa `application/octet-stream`. Las rutas relativas devueltas en la metadata no sustituyen al endpoint de descarga.

### Inventario / Kardex

El Kardex manual y el Kardex legacy ligado a Compras coexisten. `GET movimientos` y `POST salidas-manuales` están marcados `Obsolete` pero siguen publicados. El Kardex manual no es un reemplazo directo del historial por compra.

En los PUT manuales, `idKardexEntrada` / `idKardexSalida` del cuerpo debe existir y coincidir con `{id}`; en caso contrario responde `400 ID_RUTA_INCONSISTENTE`. Las salidas contienen uno o más ítems. Las cantidades manuales admiten cero y rechazan negativos; el proyecto es obligatorio para la regla de negocio, aunque idProyecto sea nullable en el DTO. El solicitante de salida es obligatorio, con máximo 150 caracteres. El proyecto es una etiqueta informativa y no segmenta el stock. Sus operaciones devuelven arreglos de filas con la cabecera repetida por ítem, no una única cabecera con un arreglo anidado. Las validaciones de referencias, cantidad y stock producen `422` con detalle por campo; un Kardex inexistente produce `404 KARDEX_NO_ENCONTRADO`. Eliminar una entrada que dejaría stock negativo se rechaza; eliminar una salida repone stock.

`stock-actual` se consolida por material/especialidad. Sus filtros de fecha se aplican a la última fecha de movimiento; **no acepta `idProyecto`**, aunque un comentario antiguo del controlador lo menciona. La exportación añade `incluirTotales`, consulta los mismos datos y devuelve XLSX.

### Control Presupuestario

Un centro de costo de tipo `PROYECTO` requiere un proyecto activo; otros tipos no admiten ese vínculo. El catálogo de partidas es jerárquico. Los filtros `soloRaices=true` e `idPartidaPadre` no se pueden combinar (`400 FILTRO_INVALIDO`). Los identificadores de recursos y filtros validados deben ser positivos.

Crear un presupuesto crea también la versión 1 en `BORRADOR`, en la misma transacción. Crear una nueva versión copia el snapshot de la `APROBADO` vigente. Editar partidas y cargar montos requiere una versión `BORRADOR`; los montos presupuestados admiten cero y rechazan negativos. Solo se presupuestan partidas hoja activas. Aprobar/anular se ejecutan por sus rutas específicas; anular requiere motivo no vacío de hasta 500 caracteres. Al aprobar otra versión, la anterior pasa a `HISTORICO` según las reglas del módulo.

`quitarAusentes` controla la eliminación de detalles ausentes en las cargas de montos/estructura. El ledger se consulta mediante movimientos y se modifica mediante la acción explícita `ajustes`; no existe un CRUD genérico de movimientos. Inactivar un presupuesto puede requerir `confirmarInactivacion` por el estado y los movimientos existentes.

La consulta `dashboard` requiere `idCentroCosto`; `nivel` agrupa por el ancestro de ese nivel (`1` = raíces), e `idPartidaPadre` limita el tablero a una rama. `arbol` retorna un objeto con una lista plana en preorden y subtotales acumulados de descendientes. `arbol` de versión permite consultar cualquier estado. Las consultas comunes usan las propiedades de `ConsultaPresupuestariaRequest` como filtros en la URL.

### Gastos directos y valorizaciones

Gastos directos exige `gasto_directo.ver` para consultar y `gasto_directo.operar` para escribir, importar y descargar la plantilla. El gasto se registra contra una partida presupuestaria; el servidor verifica actividad, compatibilidad de moneda, presupuesto y estado. La confirmación devuelve `estado: "CONFIRMADO"`; la anulación devuelve `estado: "ANULADO"`. Los valores de moneda original, importe original y tipo de cambio son referencias de factura y no sustituyen la moneda ni el monto presupuestario. Se deben enviar los tres o ninguno; la moneda original debe ser distinta de la presupuestaria y fechaTipoCambio solo aplica cuando se informa esa referencia. Un gasto se crea en `REGISTRADO` y solo puede editarse en ese estado.

Subir documentos exige al menos un PDF y `tipoDocumento` igual a `Factura` o `Pago` (sin distinguir mayúsculas). Aunque el parámetro HTTP es nullable, omitirlo se rechaza con `400 SOLICITUD_INVALIDA`. Máximo del cuerpo HTTP: **50 000 000 bytes**. La descarga responde `application/pdf`. El almacenamiento y registro aplican compensación si falla la persistencia de metadata.

Valorizaciones conserva respuestas construidas en el repositorio, documentadas en los esquemas adicionales. Si no hay cabecera/configuración, las consultas de detalle devuelven `200 { "cabecera": null, "detalle": [], "resumen": null }`, no `404`. Solo admite `.pdf` en la carga de archivos, con máximo del cuerpo HTTP de **50 000 000 bytes**. El parámetro `usuario` de eliminar detalle tiene default `"system"`, pero el repositorio actual no lo utiliza en sus DELETE.

### Importaciones y plantillas

Las cargas son atómicas: los errores de fila o de persistencia deben impedir que quede una parte del lote importada. No se debe reintentar una carga exitosa suponiendo idempotencia.

| Familia | Formato y límite efectivo | Campos de formulario |
|---|---|---|
| `/api/import/{modulo}` | CSV / XLSX / XLS; **5 MiB = 5 242 880 bytes** por el procesador base. Sin límite general actual de 100 filas. | `archivo`, `usuario` (texto obligatorio para auditoría). |
| Importar centros de costo / catálogo de partidas | Mismos parsers y procesador base de maestros: CSV / XLSX / XLS; **5 MiB**. | `archivo`; auditoría resuelta por el módulo autenticado. |
| Importar montos / estructura del presupuesto | Lector tabular compartido: CSV / XLSX / XLS; validador de **10 MiB = 10 485 760 bytes**. | `archivo`, `quitarAusentes`. |
| Importar gastos directos | Solo XLSX, **10 MiB**, de **1 a 200 registros no vacíos**. | `archivo`; identidad obtenida de la sesión. |

Los endpoints anteriores tienen además `[RequestSizeLimit(11_000_000)]` para el cuerpo multipart completo. No confundir el máximo del transporte con el máximo del archivo. `FileValidator` permite 10 MiB, pero los procesadores de maestros vuelven a validar a 5 MiB. La descripción estática de Swagger todavía menciona 10 MB/100 filas para importación genérica; esa descripción no refleja el procesador actual.

Los parsers comprueban formato, firma cuando corresponde y estructura. CSV intenta UTF-8 estricto y, sin BOM, admite fallback Windows-1252; detecta `;` o `,` y rechaza tabulador/pipe. Usa encabezados en la primera fila; las plantillas CSV generadas usan `;` y BOM UTF-8. Las plantillas tabulares generadas tienen encabezados en la primera fila. Las validaciones de fila se acumulan en `errores[]`.

| Módulo genérico | Encabezados requeridos | Opcionales |
|---|---|---|
| `unidad-medida` | `Codigo`, `Nombre` | `Activo` (default `true`). |
| `especialidad` | `Nombre` | `Descripcion`, `Activo` (default `true`). |
| `material` | `Especialidad`, `Nombre`, `UnidadMedida`, `Codigo` | `Partida`: código de partida presupuestaria por defecto. Resuelve catálogos por sus valores legibles. |
| `proveedor` | `RazonSocial` | `Ruc`, `Contacto`, `Telefono`, `Correo`, `Direccion`, `Banco`, `CuentaCorriente`, `CCI`, `CuentaDetraccion`, `DescripcionServicio`, `Observacion`, `TrabajamosConProveedor`, `Activo` (default `true`). |
| `categoria-gasto` | `Codigo`, `Nombre` | `Activo` (default `true`). |

Los identificadores de módulo se normalizan sin distinguir mayúsculas. Otros módulos no se exponen en `/api/import/{modulo}`. Su plantilla genérica solo existe para `material`; el resto devuelve `404 PLANTILLA_NO_DISPONIBLE`. `formato=csv|xlsx`, default `xlsx`; otro formato devuelve `400 FORMATO_PLANTILLA_INVALIDO`.

| Plantilla de Control Presupuestario | Columnas |
|---|---|
| Centros de costo | `Codigo`, `Nombre`, `Tipo`, `Proyecto`, `Descripcion`. `Tipo` acepta código o nombre; `Proyecto` es el nombre y es obligatorio solo para el tipo PROYECTO. |
| Catálogo de partidas | `Codigo`, `Nombre`, `Tipo`, `CodigoPadre`, `Descripcion`. Las filas hijas pueden preceder a sus padres. |
| Montos de versión | `CodigoPartida`, `Partida`, `Monto`, `Observacion`. `Partida` es informativa; complete `Monto` incluso con cero. |
| Estructura | `Codigo`, `Nombre`, `Tipo`, `Monto`, `Subtotal`, `Observacion`. También admite columnas de jerarquía `Nivel 1…N` según el lector. `Monto` se completa en hojas; `Subtotal` es informativo. Crea las partidas faltantes y carga montos de hojas en una operación. |

Las plantillas de centros, partidas y montos usan `formato=csv` por defecto; la plantilla de estructura usa `xlsx`. Se admiten `csv` y `xlsx`. La importación de estructura exige simultáneamente `control_presupuestario.presupuesto.editar_detalle` y `control_presupuestario.partida.crear`.

La plantilla de gastos directos usa la hoja **`Carga masiva`**, encabezados en la fila **5**, datos desde la fila **6**:

```text
Registro | Categoría código | Centro de costo | Partida | Fecha | Concepto | Proveedor | Descripción | Monto | Moneda factura | Monto factura | Tipo de cambio | Fecha tipo cambio | Factura(s) | Estado de fila | Observaciones de validación
```

`Registro`, `Estado de fila` y `Observaciones de validación` son auxiliares. Los códigos de categoría admitidos por el importador son `OTROS`, `MARKETING_VENTAS`, `TERRENO`, `ANTEPROYECTO`, `PROYECTO`, `ADMINISTRATIVO`, `MUNICIPAL`. `Factura(s)` es opcional y acepta referencias separadas con `;`; no contiene adjuntos PDF. El rechazo `422` de esta importación incluye un resumen de filas además de `errores[]`.

Fuentes: [procesador base](../Cobranzas_Vittoria/Application/Importacion/Processors/ImportProcessorBase.cs), [FileValidator.cs](../Cobranzas_Vittoria/Application/Importacion/Validators/FileValidator.cs), [lectura tabular](../Cobranzas_Vittoria/ControlPresupuestario/Infrastructure/Importacion/LectorArchivoTabular.cs), [plantilla de gastos](../Cobranzas_Vittoria/Contable/GastosDirectos/Application/Importar/PlantillaGastosDirectos.cs).


<a id="errores"></a>
## Errores y códigos

### Sobre del middleware

El middleware no envuelve los errores que el controlador retorna directamente ni los rechazos del framework. Para las excepciones que captura, la respuesta básica es:

```json
{
  "ok": false,
  "error": "RECURSO_NO_ENCONTRADO",
  "message": "No se encontró el recurso solicitado."
}
```

| Campo | Tipo | Significado |
|---|---|---|
| `ok` | booleano | Siempre `false`. |
| `error` | cadena | Código del error; es la clave a evaluar en el cliente. |
| `message` | cadena | Mensaje contextual para la operación; no asumir que su texto es constante. |

Los `422` de validación de datos incluyen:

```json
{
  "ok": false,
  "error": "DATOS_INVALIDOS",
  "message": "Se encontraron errores de validación.",
  "errores": [
    {
      "fila": null,
      "campo": "cantidad",
      "codigoError": "CANTIDAD_INVALIDA",
      "mensaje": "La cantidad debe ser positiva."
    }
  ]
}
```

`errores` es un arreglo. Cada detalle tiene `fila` (`int?`), `campo` (`string`), `codigoError` (`string`) y `mensaje` (`string`). El campo `fila` puede ser nulo en validaciones de payload y cero en errores de SP sin fila; las importaciones informan la fila según el parser. No todas las familias usan la misma convención de numeración: la importación de gastos conserva la fila de su hoja con datos desde la 6.

Un rechazo de importación de gastos directos con resumen tiene además:

```json
{
  "ok": false,
  "error": "DATOS_INVALIDOS",
  "message": "El lote contiene errores. No se importó ningún gasto.",
  "errores": [
    {
      "fila": 6,
      "campo": "Concepto",
      "codigoError": "CAMPO_REQUERIDO",
      "mensaje": "El concepto es obligatorio."
    }
  ],
  "modulo": "gastos-directos",
  "formato": "xlsx",
  "filasInsertadas": 0,
  "totalFilas": 2,
  "filasValidas": 1,
  "filasInvalidas": 1,
  "resultado": "RECHAZADO"
}
```

El middleware añade ese resumen cuando la excepción lleva `TotalFilas`: `filasInvalidas` cuenta filas distintas con errores, `filasValidas = max(0, totalFilas - filasInvalidas)` y `filasInsertadas` es cero. Una fila válida tampoco se inserta si el lote se rechaza.

### Respuestas del framework y de controladores legacy

Una validación automática de MVC devuelve `400` y `application/problem+json`, con una forma como esta (valores ilustrativos):

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "Concepto": ["The Concepto field is required."]
  },
  "traceId": "identificador-de-la-solicitud"
}
```

`errors` es un diccionario de campo a arreglo de mensajes; la clave puede ser una propiedad C#, un parámetro o una ruta JSON. `type`, `title`, mensajes y `traceId` dependen del framework y de la validación. Los errores `ProblemDetails` sin validación no contienen necesariamente `errors`. `instance`/`detail` pueden aparecer cuando sean provistos. No hay que interpretar estos formatos como el sobre `{ ok, error, message }`.

Los uploads de Compra/Valorización devuelven algunos errores directos `{ "message": "..." }`. La consulta de RUC devuelve errores directos de texto. Los `401/403` emitidos por JWT/autorización no tienen un cuerpo JSON personalizado. Los errores de tamaño rechazados por el servidor/proxy pueden diferir del `413 TAMANIO_EXCEDIDO` del middleware.

### Mapeo de excepciones a HTTP

| Origen | HTTP | `error` / comportamiento |
|---|---|---|
| `AutenticacionException` | 401 | `CREDENCIALES_INVALIDAS`. |
| `ArchivoInvalidoException`, tamaño | 413 | `TAMANIO_EXCEDIDO`. |
| Otras `ArchivoInvalidoException` | 400 | Código de la excepción, por ejemplo `ARCHIVO_VACIO`, `EXTENSION_INVALIDA`, `MIME_INVALIDO`. |
| `EstructuraInvalidaException` | 400 | Código de estructura/parseo. |
| `DatosInvalidosException` | 422 | `DATOS_INVALIDOS` y `errores[]`; resumen si tiene `TotalFilas`. |
| `DatosInvalidosValidacionException` y derivadas de Compras legacy, Seguridad e Inventario | 422 | `DATOS_INVALIDOS` y detalles. Los nombres de constantes `VALIDACION_NEGOCIO` o `VALIDACION_SEGURIDAD` no sustituyen al código superior del middleware. |
| Módulo no soportado | 400 | `MODULO_NO_SOPORTADO`. |
| Formato de plantilla inválido | 400 | `FORMATO_PLANTILLA_INVALIDO`. |
| Plantilla no disponible | 404 | `PLANTILLA_NO_DISPONIBLE`. |
| ID de ruta/cuerpo distinto en Kardex | 400 | `ID_RUTA_INCONSISTENTE`. |
| Kardex no encontrado | 404 | `KARDEX_NO_ENCONTRADO`. |
| `KeyNotFoundException` | 404 | `RECURSO_NO_ENCONTRADO`. |
| `ArgumentException` y derivadas | 400 | `SOLICITUD_INVALIDA`. |
| `ValidacionComprasException` del módulo de ítems | 400 | Código de dominio. |
| `RecursoComprasNoEncontradoException` | 404 | Código de recurso de Compras. |
| Otras `ComprasException` del módulo | 409 | Código de conflicto. |
| `ValidacionGastoDirectoException` | 400 | `SOLICITUD_INVALIDA`. |
| `GastoDirectoNoEncontradoException` | 404 | Código asignado al recurso/documento faltante. |
| Otras `GastoDirectoException` | 409 | Código de negocio contable. |
| `ValidacionPresupuestariaException` | 400 | Código de validación. |
| `RecursoPresupuestarioNoEncontradoException` | 404 | Código del recurso presupuestario. |
| Otras `ControlPresupuestarioException` | 409 | Código de conflicto presupuestario. |
| SQL 51200 / 51201 | 400 | Código antes de `:` en el mensaje SQL. |
| SQL 51203 | 404 | Código antes de `:` en el mensaje SQL. |
| Resto de SQL 51200–51299 | 409 | Código antes de `:`; si falta, `CONFLICTO_NEGOCIO_PRESUPUESTARIO`. |
| SQL 51460 | 400 en el repositorio de ítems | Traducción a validación de Compras. |
| SQL 51461 / 51464 | 404 en el repositorio de ítems | Traducción a recurso no encontrado. |
| Resto SQL 51460–51469 | 409 en el repositorio de ítems | Traducción a conflicto de Compras. |
| SQL 51400–51499 sin traducción previa | 409 | Código antes de `:`; si falta, `CONFLICTO_NEGOCIO_COMPRAS`. |
| SQL 51500–51599, operación ordinaria | 409 | Código antes de `:`; si falta, `CONFLICTO_NEGOCIO_CONTABLE`. Los handlers pueden detectar ausencia antes y dar 404. |
| SQL 515xx al persistir importación de gastos | 422 | El repositorio convierte el rechazo del lote a `DATOS_INVALIDOS` con resumen y rollback. |
| SQL 51051–51060 en transiciones de requerimiento | 422 | El repositorio lo convierte a `DATOS_INVALIDOS`; detalle `REQUERIMIENTO_TRANSICION_INVALIDA`, campo `estado`. |
| SQL 51100–51199 en Kardex manual | 422, excepto Kardex ausente 404 | Se conserva el código del SP en `errores[].codigoError`; si no hay prefijo se usa `ERROR_VALIDACION`, o `ERROR_SQL_VACIO` si no hay mensaje. |
| SQL 50001–50099 dentro del motor de importación | 422 | Se convierte en detalle de datos inválidos; ver equivalencias siguientes. |
| Cualquier otra `SqlException` no traducida | 500 | `SQL_ERROR`. |
| Cualquier otra excepción | 500 | `UNHANDLED_ERROR`; incluye `NotImplementedException`. |

Los errores 500 actuales serializan `ex.Message`; ese texto no constituye un código estable ni debe usarse para decidir la lógica del cliente. Este documento no reproduce detalles internos de conexiones, credenciales ni mensajes reales de un despliegue.

### Códigos de importación y validación

| Contexto | Códigos / equivalencia |
|---|---|
| Archivo y parser (400) | `ARCHIVO_VACIO`, `EXTENSION_INVALIDA`, `MIME_INVALIDO`, `FORMATO_INVALIDO`, `CODIFICACION_INVALIDO`, `ENCABEZADOS_INCORRECTOS`, además del código concreto de la excepción del parser. |
| Archivo excesivo (413) | `TAMANIO_EXCEDIDO`. |
| Estructura / contenido vacío | `ARCHIVO_SIN_DATOS`; distinguir el rechazo de estructura del detalle de datos según el importador. |
| Validación de fila (422, en `codigoError`) | `CAMPO_REQUERIDO`, `FORMATO_INVALIDO`, `REGLA_NEGOCIO`. |
| SQL 50001 en importación | `CAMPO_OBLIGATORIO`. |
| SQL 50002 en importación | `VALOR_DUPLICADO_EN_ARCHIVO`. |
| SQL 50003 en importación | `VALOR_YA_EXISTE_EN_BD`. |
| SQL 50004 en importación | `FK_NO_EXISTE`. |
| Otros SQL 50001–50099 en importación | `ERROR_VALIDACION_<numeroSql>`. |
| Catálogo declarado histórico | `DEMASIADAS_FILAS` sigue declarado; no implica que el procesador genérico actual limite a 100 filas. Gastos directos sí impone 200 registros. |
| Inventario (422, detalle) | `CAMPO_REQUERIDO`, `CANTIDAD_INVALIDA`, `FK_NO_EXISTE`, `ITEMS_INVALIDOS`, `STOCK_INSUFICIENTE`, `STOCK_INCONSISTENTE_AL_ELIMINAR`. |
| Compras legacy (422, detalle) | `COMPRAS_PRECISION_INVALIDA`, `COMPRAS_MATERIAL_DUPLICADO`, `REQUERIMIENTO_SOLICITANTE_REQUERIDO`, `REQUERIMIENTO_TRANSICION_INVALIDA`. |
| Jerarquía importada (422, detalle) | `NIVELES_INVALIDOS`, `PADRE_CON_MONTO`, `PADRE_NO_EXISTE`, `JERARQUIA_DISTINTA`, `NOMBRE_DISTINTO`, además de errores de referencia y formato. |


### Códigos de aplicación adicionales

Cadenas declaradas en excepciones, validadores y handlers de negocio. En errores de validación acumulada aparecen en `errores[].codigoError`; en excepciones de dominio ordinarias aparecen en `error`. El status se determina por el tipo de excepción de la tabla anterior, no por el nombre de la cadena. La lista excluye constantes de estados/categorías y no supone que todos los códigos se emitan en cada acción.

| Familia | Código | Fuente |
|---|---|---|
| Seguridad | `CREDENCIALES_INVALIDAS` | [AutenticacionException.cs](../Cobranzas_Vittoria/Seguridad/Domain/Excepciones/AutenticacionException.cs) |
| Seguridad | `PERMISO_ID_INVALIDO` | [PermisoValidator.cs](../Cobranzas_Vittoria/Seguridad/Application/Common/PermisoValidator.cs) |
| Seguridad | `PERMISO_NOMBRE_REQUERIDO` | [Permiso.cs](../Cobranzas_Vittoria/Seguridad/Domain/Model/Permiso.cs) |
| Seguridad | `PERMISO_NO_ENCONTRADO` | [UpdatePermisoHandler.cs](../Cobranzas_Vittoria/Seguridad/Application/Permiso/Actualizar/UpdatePermisoHandler.cs) |
| Seguridad | `ROL_ID_INVALIDO` | [RolValidator.cs](../Cobranzas_Vittoria/Seguridad/Application/Common/RolValidator.cs) |
| Seguridad | `ROL_NOMBRE_DUPLICADO` | [CreateRolHandler.cs](../Cobranzas_Vittoria/Seguridad/Application/Rol/Crear/CreateRolHandler.cs) |
| Seguridad | `ROL_NOMBRE_REQUERIDO` | [RolValidator.cs](../Cobranzas_Vittoria/Seguridad/Application/Common/RolValidator.cs) |
| Seguridad | `ROL_NO_ENCONTRADO` | [ActualizarRolHandler.cs](../Cobranzas_Vittoria/Seguridad/Application/Rol/Actualizar/ActualizarRolHandler.cs) |
| Seguridad | `ROL_PERMISOS_REQUERIDOS` | [AsignarPermisosHandler.cs](../Cobranzas_Vittoria/Seguridad/Application/Rol/AsignarPermisos/AsignarPermisosHandler.cs) |
| Seguridad | `USUARIO_APELLIDO_REQUERIDO` | [UsuarioValidator.cs](../Cobranzas_Vittoria/Seguridad/Application/Common/UsuarioValidator.cs) |
| Seguridad | `USUARIO_AUDITORIA_CREACION_REQUERIDO` | [Usuario.cs](../Cobranzas_Vittoria/Seguridad/Domain/Model/Usuario.cs) |
| Seguridad | `USUARIO_CORREO_DUPLICADO` | [ActualizarUsuarioHandler.cs](../Cobranzas_Vittoria/Seguridad/Application/Usuario/Actualizar/ActualizarUsuarioHandler.cs) |
| Seguridad | `USUARIO_CORREO_REQUERIDO` | [UsuarioValidator.cs](../Cobranzas_Vittoria/Seguridad/Application/Common/UsuarioValidator.cs) |
| Seguridad | `USUARIO_ID_INVALIDO` | [UsuarioValidator.cs](../Cobranzas_Vittoria/Seguridad/Application/Common/UsuarioValidator.cs) |
| Seguridad | `USUARIO_LOGIN_REQUERIDO` | [UsuarioValidator.cs](../Cobranzas_Vittoria/Seguridad/Application/Common/UsuarioValidator.cs) |
| Seguridad | `USUARIO_NOMBRE_REQUERIDO` | [UsuarioValidator.cs](../Cobranzas_Vittoria/Seguridad/Application/Common/UsuarioValidator.cs) |
| Seguridad | `USUARIO_NO_ENCONTRADO` | [ActualizarUsuarioHandler.cs](../Cobranzas_Vittoria/Seguridad/Application/Usuario/Actualizar/ActualizarUsuarioHandler.cs) |
| Seguridad | `USUARIO_PASSWORD_REQUERIDO` | [UsuarioValidator.cs](../Cobranzas_Vittoria/Seguridad/Application/Common/UsuarioValidator.cs) |
| Seguridad | `USUARIO_ROLES_REQUERIDOS` | [AsignarRolesHandler.cs](../Cobranzas_Vittoria/Seguridad/Application/Usuario/AsignarRoles/AsignarRolesHandler.cs) |
| Compras: ítems | `CAMPO_REQUERIDO` | [ValidacionComprasException.cs](../Cobranzas_Vittoria/Compras/Domain/Excepciones/ValidacionComprasException.cs) |
| Compras: ítems | `COMPRAS_PRECISION_INVALIDA` | [ReglasCompras.cs](../Cobranzas_Vittoria/Compras/Domain/Model/ReglasCompras.cs) |
| Compras: ítems | `ESTADO_REQUERIMIENTO_INVALIDO` | [Requerimiento.cs](../Cobranzas_Vittoria/Compras/Domain/Model/Requerimiento.cs) |
| Compras: ítems | `IDENTIFICADOR_INVALIDO` | [ValidacionComprasException.cs](../Cobranzas_Vittoria/Compras/Domain/Excepciones/ValidacionComprasException.cs) |
| Compras: ítems | `LONGITUD_EXCEDIDA` | [ValidacionComprasException.cs](../Cobranzas_Vittoria/Compras/Domain/Excepciones/ValidacionComprasException.cs) |
| Compras: ítems | `MATERIAL_DUPLICADO` | [Requerimiento.cs](../Cobranzas_Vittoria/Compras/Domain/Model/Requerimiento.cs) |
| Compras: ítems | `REQUERIMIENTO_CANTIDAD_INVALIDA` | [RequerimientoItemValidator.cs](../Cobranzas_Vittoria/Compras/Application/Requerimiento/Items/RequerimientoItemValidator.cs) |
| Compras: ítems | `REQUERIMIENTO_DETALLE_DUPLICADO` | [Requerimiento.cs](../Cobranzas_Vittoria/Compras/Domain/Model/Requerimiento.cs) |
| Compras: ítems | `REQUERIMIENTO_FECHAS_INVALIDAS` | [Requerimiento.cs](../Cobranzas_Vittoria/Compras/Domain/Model/Requerimiento.cs) |
| Compras: ítems | `REQUERIMIENTO_ITEM_NO_ENCONTRADO` | [ItemRequerimientoNoEncontradoException.cs](../Cobranzas_Vittoria/Compras/Domain/Excepciones/ItemRequerimientoNoEncontradoException.cs) |
| Compras: ítems | `REQUERIMIENTO_ITEM_NO_PERTENECE` | [Requerimiento.cs](../Cobranzas_Vittoria/Compras/Domain/Model/Requerimiento.cs) |
| Compras: ítems | `REQUERIMIENTO_ITEM_YA_ASOCIADO` | [Requerimiento.cs](../Cobranzas_Vittoria/Compras/Domain/Model/Requerimiento.cs) |
| Compras: ítems | `REQUERIMIENTO_NO_ENCONTRADO` | [RequerimientoNoEncontradoException.cs](../Cobranzas_Vittoria/Compras/Domain/Excepciones/RequerimientoNoEncontradoException.cs) |
| Compras: ítems | `REQUERIMIENTO_PATCH_INVALIDO` | [RequerimientoItemValidator.cs](../Cobranzas_Vittoria/Compras/Application/Requerimiento/Items/RequerimientoItemValidator.cs) |
| Compras: ítems | `REQUERIMIENTO_RESULTADO_INVALIDO` | [Requerimiento.cs](../Cobranzas_Vittoria/Compras/Domain/Model/Requerimiento.cs) |
| Compras: ítems | `REQUERIMIENTO_SIN_ITEMS` | [Requerimiento.cs](../Cobranzas_Vittoria/Compras/Domain/Model/Requerimiento.cs) |
| Compras: ítems | `REQUERIMIENTO_SOLICITANTE_REQUERIDO` | [Requerimiento.cs](../Cobranzas_Vittoria/Compras/Domain/Model/Requerimiento.cs) |
| Compras legacy | `COMPRAS_MATERIAL_DUPLICADO` | [ComprasNumeros.cs](../Cobranzas_Vittoria/Application/Compras/ComprasNumeros.cs) |
| Compras legacy | `COMPRAS_PRECISION_INVALIDA` | [ComprasNumeros.cs](../Cobranzas_Vittoria/Application/Compras/ComprasNumeros.cs) |
| Compras legacy | `REQUERIMIENTO_SOLICITANTE_REQUERIDO` | [RequerimientoService.cs](../Cobranzas_Vittoria/Services/RequerimientoService.cs) |
| Compras legacy | `REQUERIMIENTO_TRANSICION_INVALIDA` | [RequerimientoRepository.cs](../Cobranzas_Vittoria/Repositories/RequerimientoRepository.cs) |
| Control Presupuestario | `AJUSTE_NO_CONFIRMADO` | [RegistrarAjusteHandler.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/PresupuestoDetalle/RegistrarAjuste/RegistrarAjusteHandler.cs) |
| Control Presupuestario | `CAMPO_REQUERIDO` | [ObtenerArbolVigenteHandler.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/ConsultaPresupuestaria/Arbol/ObtenerArbolVigenteHandler.cs) |
| Control Presupuestario | `CENTRO_COSTO_NO_ENCONTRADO` | [CentroCostoNoEncontradoException.cs](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Excepciones/CentroCostoNoEncontradoException.cs) |
| Control Presupuestario | `FILTRO_INVALIDO` | [CatalogoPartidaValidator.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/Common/CatalogoPartidaValidator.cs) |
| Control Presupuestario | `IDENTIFICADOR_INVALIDO` | [ObtenerArbolVigenteHandler.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/ConsultaPresupuestaria/Arbol/ObtenerArbolVigenteHandler.cs) |
| Control Presupuestario | `JERARQUIA_DISTINTA` | [EstructuraArchivo.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/PresupuestoDetalle/ImportarEstructura/EstructuraArchivo.cs) |
| Control Presupuestario | `LONGITUD_EXCEDIDA` | [ValidacionPresupuestariaException.cs](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Excepciones/ValidacionPresupuestariaException.cs) |
| Control Presupuestario | `MONEDAS_MIXTAS` | [ObtenerArbolVigenteHandler.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/ConsultaPresupuestaria/Arbol/ObtenerArbolVigenteHandler.cs) |
| Control Presupuestario | `MOTIVO_REQUERIDO` | [PresupuestoVersionValidator.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/Common/PresupuestoVersionValidator.cs) |
| Control Presupuestario | `MOVIMIENTO_NO_ENCONTRADO` | [MovimientoPresupuestalNoEncontradoException.cs](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Excepciones/MovimientoPresupuestalNoEncontradoException.cs) |
| Control Presupuestario | `NIVELES_INVALIDOS` | [EstructuraArchivo.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/PresupuestoDetalle/ImportarEstructura/EstructuraArchivo.cs) |
| Control Presupuestario | `NIVEL_INVALIDO` | [ObtenerDashboardHandler.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/ConsultaPresupuestaria/Dashboard/ObtenerDashboardHandler.cs) |
| Control Presupuestario | `NOMBRE_DISTINTO` | [EstructuraArchivo.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/PresupuestoDetalle/ImportarEstructura/EstructuraArchivo.cs) |
| Control Presupuestario | `PADRE_CON_MONTO` | [EstructuraArchivo.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/PresupuestoDetalle/ImportarEstructura/EstructuraArchivo.cs) |
| Control Presupuestario | `PADRE_NO_EXISTE` | [EstructuraArchivo.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/PresupuestoDetalle/ImportarEstructura/EstructuraArchivo.cs) |
| Control Presupuestario | `PARTIDA_DE_VERSION_NO_ENCONTRADA` | [PresupuestoDetalleNoEncontradoException.cs](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Excepciones/PresupuestoDetalleNoEncontradoException.cs) |
| Control Presupuestario | `PARTIDA_NO_ENCONTRADA` | [CatalogoPartidaNoEncontradoException.cs](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Excepciones/CatalogoPartidaNoEncontradoException.cs) |
| Control Presupuestario | `PRESUPUESTO_CON_REGISTROS` | [ActualizarPresupuestoHandler.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/Presupuesto/Actualizar/ActualizarPresupuestoHandler.cs) |
| Control Presupuestario | `PRESUPUESTO_NO_ENCONTRADO` | [PresupuestoNoEncontradoException.cs](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Excepciones/PresupuestoNoEncontradoException.cs) |
| Control Presupuestario | `VERSION_NO_EDITABLE` | [ImportarPresupuestoDetalleHandler.cs](../Cobranzas_Vittoria/ControlPresupuestario/Application/PresupuestoDetalle/Importar/ImportarPresupuestoDetalleHandler.cs) |
| Control Presupuestario | `VERSION_NO_ENCONTRADA` | [VersionPresupuestoNoEncontradaException.cs](../Cobranzas_Vittoria/ControlPresupuestario/Domain/Excepciones/VersionPresupuestoNoEncontradaException.cs) |
| Gastos directos | `RECURSO_NO_ENCONTRADO` | [GastoDirectoException.cs](../Cobranzas_Vittoria/Contable/GastosDirectos/Domain/Excepciones/GastoDirectoException.cs) |
| Gastos directos | `SOLICITUD_INVALIDA` | [GastoDirectoException.cs](../Cobranzas_Vittoria/Contable/GastosDirectos/Domain/Excepciones/GastoDirectoException.cs) |

### Rechazos declarados por los SP

El catálogo siguiente reúne los `THROW` con mensaje literal de las migraciones repetibles. Agrupa condiciones que comparten número y prefijo. Los errores emitidos con mensaje variable (por ejemplo stock insuficiente) siguen el traductor de su familia. Un código superior genérico puede envolver un prefijo SQL: se indica explícitamente en la columna HTTP/campo.

| Familia / número SQL | HTTP y campo | Código expuesto | Condiciones / mensajes SQL |
|---|---|---|---|
| Compras / 51410 | 409 · error | `TRANSACCION_NO_CONFIRMABLE` | la integración económica requiere rollback. |
| Compras / 51411 | 409 · error | `MONEDA_OC_INVALIDA` | IdMoneda es requerido. |
| Compras / 51412 | 409 · error | `PROYECTO_REQUERIDO` | IdProyecto es requerido. |
| Compras / 51413 | 409 · error | `MONTO_ECONOMICO_INVALIDO` | todos los movimientos deben ser positivos. |
| Compras / 51414 | 409 · error | `CONFLICTO_NEGOCIO_COMPRAS` | TIPO_MOVIMIENTO_ECONOMICO_INVALIDO. |
| Compras / 51415 | 409 · error | `CONFLICTO_NEGOCIO_COMPRAS` | CLAVE_EVENTO_DUPLICADA_EN_LOTE. |
| Compras / 51416 | 409 · error | `PARTIDA_NO_COMPATIBLE` | debe pertenecer al Proyecto, tener la moneda de la OC y provenir de una versión APROBADA/HISTORICO. |
| Compras / 51417 | 409 · error | `CONFLICTO_NEGOCIO_COMPRAS` | No se pudo serializar la validación de saldo presupuestario. |
| Compras / 51418 | 409 · error | `SALDO_PRESUPUESTARIO_INSUFICIENTE` | la operación dejaría una partida excedida. |
| Compras / 51420 | 409 · error | `PARTIDA_REQUERIMIENTO_INVALIDA` | debe pertenecer a la versión APROBADA vigente del CentroCosto del Proyecto. |
| Compras / 51430 | 409 · error | `ESTADO_COMPRA_INVALIDO` | solo una Compra REGISTRADA puede aceptarse. |
| Compras / 51431 | 409 · error | `ESTADO_OC_INVALIDO` | la Compra solo puede aceptarse contra una OC APROBADA. / solo una OC APROBADA admite registrar Compra. |
| Compras / 51432 | 409 · error | `COMPRA_NO_CUBRE_OC` | materiales y cantidades deben coincidir completamente con la OC. |
| Compras / 51433 | 409 · error | `PARTIDA_REQUERIDA` | todas las líneas de la OC deben tener partida presupuestaria. / todas las líneas deben tener partida presupuestaria. |
| Compras / 51434 | 409 · error | `CONFLICTO_NEGOCIO_COMPRAS` | Los importes y cantidades de la Compra deben ser positivos. |
| Compras / 51435 | 409 · error | `COMPRA_UNICA_POR_OC` | la OrdenCompra ya tiene una Compra. |
| Compras / 51440 | 409 · error | `CONFLICTO_NEGOCIO_COMPRAS` | TRANSICION_OC_INVALIDA. |
| Compras / 51441 | 409 · error | `OC_CON_COMPRA_ACEPTADA` | no puede anularse. |
| Compras / 51442 | 409 · error | `CONFLICTO_NEGOCIO_COMPRAS` | Las cantidades de la OC deben ser positivas y los precios no pueden ser negativos. / Proveedor y cantidades de la OC deben ser positivos y los precios no pueden ser negativos. |
| Compras / 51443 | 409 · error | `MATERIAL_FUERA_REQUERIMIENTO` | toda línea de OC debe provenir del Requerimiento. |
| Compras / 51444 | 409 · error | `CONFLICTO_NEGOCIO_COMPRAS` | La orden debe tener items. |
| Compras / 51445 | 409 · error | `MONEDAS_MIXTAS` | las partidas del requerimiento pertenecen a presupuestos en distintas monedas; genera una OC por moneda. |
| Compras / 51445 | 409 · error | `OC_NO_EDITABLE` | solo REGISTRADA o APROBADA puede modificarse. |
| Compras / 51446 | 409 · error | `MONEDA_DISTINTA_PRESUPUESTO` | la OC debe usar la moneda del presupuesto de sus partidas. |
| Compras / 51446 | 409 · error | `OC_APROBADA_IDENTIDAD_INMUTABLE` | no puede cambiar Requerimiento ni Moneda. |
| Compras / 51447 | 409 · error | `OC_CON_COMPRA_INCOMPATIBLE` | la modificación no puede invalidar una Compra registrada o aceptada. |
| Compras / 51462 | 409 · error | `ESTADO_REQUERIMIENTO_INVALIDO` | solo puede editarse el borrador registrado. |
| Compras / 51469 | 409 · error | `TRANSACCION_NO_CONFIRMABLE` | se requiere rollback externo. |
| Control Presupuestario / 51200 | 400 · error | `CAMPO_REQUERIDO` | Activo. / ClaveEvento canónica y sin espacios exteriores. / Codigo. / IdCatalogoPartida positivo. / IdCentroCosto positivo. / IdMoneda positivo. / IdMovimientoPresupuestal positivo. / IdOrigen positivo. / IdPartidaPadre positivo o NULL. / IdPresupuesto positivo. / IdPresupuestoDetalle positivo. / IdPresupuestoVersion positivo. / IdTipoCentroCosto positivo. / IdTipoPartida positivo. / Monto. / MontoPresupuestado. / Nombre y Activo. / Nombre. / Origen canónico y sin espacios exteriores. / TipoMovimiento. / el lote no trae ninguna partida. / un CentroCosto de tipo PROYECTO requiere IdProyecto. |
| Control Presupuestario / 51201 | 400 · error | `REFERENCIA_NO_EXISTE` | CatalogoPartida. / CentroCosto. / Moneda. / Proyecto activo. / TipoCentroCosto. / TipoPartida. / partida padre. |
| Control Presupuestario / 51202 | 409 · error | `RECURSO_INACTIVO` | CentroCosto. / Moneda. / Presupuesto. / TipoCentroCosto. / TipoMovimientoPresupuestal. / TipoPartida. / el presupuesto está inactivo; solo admite reversiones (liberaciones y ajustes a la baja). |
| Control Presupuestario / 51203 | 404 · error | `RECURSO_NO_EXISTE` | CatalogoPartida. / CentroCosto. / Presupuesto. / PresupuestoDetalle original. / PresupuestoDetalle. / PresupuestoVersion objetivo. / PresupuestoVersion. |
| Control Presupuestario / 51204 | 409 · error | `CATALOGO_ESTRUCTURAL_INVALIDO` | ANULADO no disponible. / BORRADOR no disponible. / BORRADOR/APROBADO no disponibles. / Moneda del presupuesto. / estados de aprobación no disponibles. |
| Control Presupuestario / 51205 | 409 · error | `CODIGO_DUPLICADO` | CatalogoPartida. / CentroCosto. / el presupuesto ya está registrado. |
| Control Presupuestario / 51205 | 409 · error | `PROYECTO_DUPLICADO` | ya está asociado a otro CentroCosto. |
| Control Presupuestario / 51206 | 409 · error | `RANGO_FECHAS_INVALIDO` | FechaFin es anterior a FechaInicio. |
| Control Presupuestario / 51207 | 409 · error | `ESTADO_INVALIDO` | el detalle debe pertenecer a APROBADO/HISTORICO. / solo puede aprobarse BORRADOR. / solo se permite BORRADOR. / solo se pueden cargar montos en una versión en BORRADOR. |
| Control Presupuestario / 51208 | 409 · error | `VERSIONES_INCONSISTENTES` | cambió la versión objetivo. / la aprobación debe dejar una sola línea base vigente. / múltiples APROBADO/BORRADOR. / no hay línea base vigente para esta revisión. / no se pudo reemplazar la línea base anterior. / se requiere un único BORRADOR y como máximo una APROBADO. |
| Control Presupuestario / 51209 | 409 · error | `SNAPSHOT_INVALIDO` | la copia no coincide con el snapshot base. / la línea base debe tener detalles válidos. / se requieren detalles válidos y sin partidas duplicadas. |
| Control Presupuestario / 51210 | 409 · error | `SIN_VERSION_APROBADA` | no existe una línea base para copiar. |
| Control Presupuestario / 51211 | 409 · error | `BORRADOR_PENDIENTE` | ya existe una revisión en preparación. |
| Control Presupuestario / 51212 | 409 · error | `PARTIDA_INACTIVA` | no puede agregarse al snapshot. / no puede copiarse a una nueva versión. / no puede formar parte de una nueva línea base. / padre no disponible. |
| Control Presupuestario / 51213 | 409 · error | `PARTIDA_NO_HOJA` | el snapshot contiene una partida con hijos. / la línea base contiene una partida con hijos. / tiene hijos, incluidos los inactivos. |
| Control Presupuestario / 51214 | 409 · error | `PARTIDA_RELEVANTE_OMITIDA` | falta un detalle real para el efecto neto del ledger. |
| Control Presupuestario / 51215 | 409 · error | `PARTIDA_DUPLICADA` | ya existe en esta versión. |
| Control Presupuestario / 51216 | 409 · error | `NUMERACION_AGOTADA` | no es posible crear otra versión INT. |
| Control Presupuestario / 51217 | 409 · error | `JERARQUIA_INVALIDA` | autorreferencia o ciclo. / la raíz debe tener nivel uno. / nivel fuera de rango. / niveles de ancestros incoherentes. / no combinar SoloRaices e IdPartidaPadre. / una partida no puede ser su propio padre. |
| Control Presupuestario / 51218 | 409 · error | `ESTRUCTURA_EN_USO` | solo se reclasifican hojas sin detalles de ninguna versión. / una partida presupuestada no puede convertirse en padre. |
| Control Presupuestario / 51219 | 409 · error | `TIPO_MOVIMIENTO_INVALIDO` | el código no existe en el catálogo. / se requiere un código semántico canónico soportado. |
| Control Presupuestario / 51220 | 409 · error | `DOMINIO_CENTRO_COSTO_INVALIDO` | solo el tipo PROYECTO admite IdProyecto. |
| Control Presupuestario / 51220 | 409 · error | `DOMINIO_MOVIMIENTO_INVALIDO` | AJUSTE requiere Afectacion y Direccion. / Afectacion. / Direccion. / el tipo normal requiere ambas dimensiones en NULL. |
| Control Presupuestario / 51221 | 409 · error | `MONTO_INVALIDO` | Monto debe ser positivo. / el presupuesto admite cero, no negativos. |
| Control Presupuestario / 51230 | 409 · error | `CONFLICTO_IDEMPOTENCIA` | ClaveEvento ya representa un contenido diferente. |
| Control Presupuestario / 51240 | 409 · error | `TRANSACCION_NO_CONFIRMABLE` | la unidad externa requiere rollback. |
| Control Presupuestario / 51251 | 409 · error | `PARTIDA_INVALIDA` | la partida presupuestal está inactiva. / la partida presupuestal no existe. / la partida tiene partidas hijas; elige una partida sin hijas. |
| Flujo de requerimientos / 51051 | 422 · codigoError | `REQUERIMIENTO_TRANSICION_INVALIDA` | El requerimiento no existe. |
| Flujo de requerimientos / 51052 | 422 · codigoError | `REQUERIMIENTO_TRANSICION_INVALIDA` | Solo el solicitante puede enviar un requerimiento registrado. |
| Flujo de requerimientos / 51053 | 422 · codigoError | `REQUERIMIENTO_TRANSICION_INVALIDA` | El resultado de almacén es inválido. |
| Flujo de requerimientos / 51054 | 422 · codigoError | `REQUERIMIENTO_TRANSICION_INVALIDA` | El usuario que aprueba el requerimiento no existe. / El usuario que envía el requerimiento a compras no existe. / El usuario que procesa el requerimiento no existe. / El usuario que rechaza el requerimiento no existe. |
| Flujo de requerimientos / 51055 | 422 · codigoError | `REQUERIMIENTO_TRANSICION_INVALIDA` | El requerimiento debe estar enviado a almacén para procesar stock. |
| Flujo de requerimientos / 51056 | 422 · codigoError | `REQUERIMIENTO_TRANSICION_INVALIDA` | Solo puede aprobarse un requerimiento validado por almacén. |
| Flujo de requerimientos / 51057 | 422 · codigoError | `REQUERIMIENTO_TRANSICION_INVALIDA` | Solo puede rechazarse un requerimiento revisado por coordinación. |
| Flujo de requerimientos / 51058 | 422 · codigoError | `REQUERIMIENTO_TRANSICION_INVALIDA` | Solo puede enviarse a compras un requerimiento aprobado por coordinación. |
| Gastos directos / 51500 | 409 · error; 422 en lote | `CAMPO_REQUERIDO` | Concepto. / Fecha. / IdCategoriaGasto. / IdMoneda. / IdPresupuestoDetalle. / número de factura o nombre de archivo. |
| Gastos directos / 51501 | 409 · error; 422 en lote | `DATOS_INVALIDOS` | Concepto y monto positivo son requeridos. |
| Gastos directos / 51501 | 409 · error; 422 en lote | `MONTO_INVALIDO` | Monto debe ser mayor a cero. |
| Gastos directos / 51502 | 409 · error; 422 en lote | `PARTIDA_INVALIDA` | PresupuestoDetalle no existe. / no existe. / presupuesto o partida inactivos. / sólo una partida hoja puede recibir ejecución. |
| Gastos directos / 51503 | 409 · error; 422 en lote | `MONEDA_INVALIDA` | la moneda no existe o está inactiva. / la moneda original no existe o está inactiva. |
| Gastos directos / 51504 | 409 · error; 422 en lote | `PROVEEDOR_INVALIDO` | el proveedor no existe o está inactivo. |
| Gastos directos / 51505 | 409 · error; 422 en lote | `GASTO_NO_EXISTE` | no se encontró el gasto directo. |
| Gastos directos / 51506 | 409 · error; 422 en lote | `ESTADO_INVALIDO` | sólo un gasto REGISTRADO puede editarse. / un gasto ANULADO no puede confirmarse. |
| Gastos directos / 51507 | 409 · error; 422 en lote | `CATEGORIA_GASTO_INVALIDA` | la categoría no existe, está inactiva o no tiene código conciliado. |
| Gastos directos / 51507 | 409 · error; 422 en lote | `VERSION_NO_VIGENTE` | la partida no existe en la línea base aprobada. / un gasto nuevo requiere la versión APROBADO. |
| Gastos directos / 51508 | 409 · error; 422 en lote | `MONEDA_INCOMPATIBLE` | gasto y presupuesto deben usar la misma moneda. |
| Gastos directos / 51509 | 409 · error; 422 en lote | `CONCURRENCIA` | no se pudo serializar el saldo presupuestario. |
| Gastos directos / 51510 | 409 · error; 422 en lote | `SALDO_INSUFICIENTE` | la confirmación dejaría la partida excedida. |
| Gastos directos / 51511 | 409 · error; 422 en lote | `DOCUMENTO_INVALIDO` | solo una referencia de factura puede carecer de archivo. |
| Gastos directos / 51511 | 409 · error; 422 en lote | `TIPO_DOCUMENTO_INVALIDO` | use Factura o Pago. |
| Gastos directos / 51520 | 409 · error; 422 en lote | `CONFLICTO_NEGOCIO_CONTABLE` | RazonSocial es requerido. |
| Gastos directos / 51522 | 409 · error; 422 en lote | `CONFLICTO_NEGOCIO_CONTABLE` | Ya existe un proveedor con ese RUC. |
| Gastos directos / 51523 | 409 · error; 422 en lote | `CONFLICTO_NEGOCIO_CONTABLE` | Ya existe otro proveedor con ese RUC. |
| Gastos directos / 51530 | 409 · error; 422 en lote | `MONEDA_REFERENCIA_INCOMPLETA` | indica la moneda, el monto original y el tipo de cambio, o ninguno. / la fecha del tipo de cambio solo aplica a una factura en otra moneda. |
| Gastos directos / 51530 | 409 · error; 422 en lote | `MONEDA_REFERENCIA_INVALIDA` | el monto original y el tipo de cambio deben ser mayores a cero. / la moneda original debe ser distinta a la del presupuesto. |
| Importación de maestros / 50001 | 422 · codigoError | `CAMPO_OBLIGATORIO` | CODIGO_NOMBRE_OBLIGATORIO / Codigo admite máximo 30 caracteres alfanuméricos o guion bajo. / Codigo y Nombre son requeridos. / Codigo, Descripcion y UnidadMedida son requeridos. / Nombre es requerido. / RazonSocial es requerido. |
| Importación de maestros / 50002 | 422 · codigoError | `VALOR_DUPLICADO_EN_ARCHIVO` | CODIGO_DUPLICADO_EN_ARCHIVO / Codigo de CategoriaGasto repetido en el archivo. / Codigo de Material repetido en el archivo. / Nombre de CategoriaGasto repetido en el archivo. / Nombre de Especialidad repetido en el archivo. / Ruc repetido en el archivo. |
| Importación de maestros / 50003 | 422 · codigoError | `VALOR_YA_EXISTE_EN_BD` | CODIGO_YA_EXISTE_EN_BD / Ya existe un Material con ese Codigo. / Ya existe un Proveedor con ese Ruc. / Ya existe una CategoriaGasto con ese Codigo o Nombre. / Ya existe una Especialidad con ese Nombre. |
| Importación de maestros / 50004 | 422 · codigoError | `FK_NO_EXISTE` | la partida debe existir, estar activa y no tener partidas hijas. |
| Inventario manual / 51100 | 422 · codigoError | `CAMPO_REQUERIDO` | cantidad / fecha / idEspecialidad / idKardexEntrada / idKardexSalida / idMaterial / idProyecto / items (debe tener al menos uno) / solicitante |
| Inventario manual / 51101 | 422 · codigoError | `FK_NO_EXISTE` | idEspecialidad / idMaterial / idProveedor / idProyecto / items contiene idMaterial que no existe en maestra.Material |
| Inventario manual / 51103 | 422 · codigoError | `CANTIDAD_INVALIDA` | items contiene filas con idMaterial NULL o cantidad invalida / la cantidad no puede ser negativa |
| Inventario manual / 51104 | 404 · error | `KARDEX_NO_ENCONTRADO` | idKardexEntrada / idKardexSalida |
| Legacy: Almacen_SPs / 51001 | 500 · error si no hay traducción previa | `SQL_ERROR` | La cantidad de salida debe ser mayor a cero. |
| Legacy: Almacen_SPs / 51002 | 500 · error si no hay traducción previa | `SQL_ERROR` | No se pudo determinar la especialidad del material. |
| Legacy: Almacen_SPs / 51003 | 500 · error si no hay traducción previa | `SQL_ERROR` | La salida supera el stock disponible para esa compra. |
| Legacy: Almacen_SPs / 51004 | 500 · error si no hay traducción previa | `SQL_ERROR` | El material seleccionado no pertenece a la compra elegida. |
| Legacy: Compras_SPs / 50040 | 500 · error si no hay traducción previa | `SQL_ERROR` | NumeroRequerimiento es requerido. |
| Legacy: Compras_SPs / 50041 | 500 · error si no hay traducción previa | `SQL_ERROR` | Ya existe el Número de Requerimiento. |
| Legacy: Compras_SPs / 50043 | 500 · error si no hay traducción previa | `SQL_ERROR` | Proyecto no existe. |
| Legacy: Compras_SPs / 50044 | 500 · error si no hay traducción previa | `SQL_ERROR` | Usuario solicitante no existe. |
| Legacy: Compras_SPs / 50045 | 500 · error si no hay traducción previa | `SQL_ERROR` | Debe registrar al menos un item. |
| Legacy: Compras_SPs / 50056 | 500 · error si no hay traducción previa | `SQL_ERROR` | Estado inválido para la transición manual de OrdenCompra. |
| Legacy: Compras_SPs / 50057 | 500 · error si no hay traducción previa | `SQL_ERROR` | Orden de compra no existe. |
| Legacy: Compras_SPs / 50060 | 500 · error si no hay traducción previa | `SQL_ERROR` | NumeroCompra es requerido. |
| Legacy: Compras_SPs / 50061 | 500 · error si no hay traducción previa | `SQL_ERROR` | Ya existe el Número de Compra. |
| Legacy: Compras_SPs / 50062 | 500 · error si no hay traducción previa | `SQL_ERROR` | Orden de compra no existe. |
| Legacy: Compras_SPs / 50064 | 500 · error si no hay traducción previa | `SQL_ERROR` | Debe registrar items en la compra. |
| Legacy: Compras_SPs / 50065 | 500 · error si no hay traducción previa | `SQL_ERROR` | Compra no existe. |
| Legacy: Compras_SPs / 51070 | 500 · error si no hay traducción previa | `SQL_ERROR` | La moneda no existe o está inactiva. |
| Legacy: Compras_SPs / 51071 | 500 · error si no hay traducción previa | `SQL_ERROR` | No se permiten materiales repetidos en una OC. |
| Legacy: Compras_SPs / 51072 | 500 · error si no hay traducción previa | `SQL_ERROR` | El requerimiento no existe. |
| Legacy: Compras_SPs / 51073 | 500 · error si no hay traducción previa | `SQL_ERROR` | No se permiten materiales repetidos en una Compra. |
| Legacy: Maestra_SPs / 50001 | 500 · error si no hay traducción previa | `SQL_ERROR` | Debes ingresar código y nombre de la unidad de medida. / Ya existe una unidad de medida con ese código. / Ya existe una unidad de medida con ese nombre. |
| Legacy: Maestra_SPs / 50010 | 500 · error si no hay traducción previa | `SQL_ERROR` | Nombre de especialidad es requerido. |
| Legacy: Maestra_SPs / 50011 | 500 · error si no hay traducción previa | `SQL_ERROR` | Ya existe la especialidad. |
| Legacy: Maestra_SPs / 50012 | 500 · error si no hay traducción previa | `SQL_ERROR` | Ya existe otra especialidad con ese nombre. |
| Legacy: Maestra_SPs / 50024 | 500 · error si no hay traducción previa | `SQL_ERROR` | Proveedor no existe. |
| Legacy: Maestra_SPs / 50025 | 500 · error si no hay traducción previa | `SQL_ERROR` | Especialidad no existe. |
| Legacy: Seguridad_Roles_SPs / 50001 | 500 · error si no hay traducción previa | `SQL_ERROR` | El rol especificado no existe. |
| Ítems de requerimiento / 51460 | 400 · error | `IDENTIFICADOR_INVALIDO` | IdPresupuestoDetalle debe ser positivo o nulo. / IdRequerimiento debe ser positivo. / IdRequerimientoDetalle debe ser positivo. / los identificadores informados deben ser positivos. |
| Ítems de requerimiento / 51460 | 400 · error | `LONGITUD_EXCEDIDA` | Observacion admite hasta 250 caracteres. |
| Ítems de requerimiento / 51460 | 400 · error | `REQUERIMIENTO_CANTIDAD_INVALIDA` | cantidad positiva DECIMAL(18,2), sin redondear. |
| Ítems de requerimiento / 51460 | 400 · error | `REQUERIMIENTO_PATCH_INVALIDO` | indica al menos un campo editable. |
| Ítems de requerimiento / 51461 | 404 · error | `REQUERIMIENTO_NO_ENCONTRADO` | el requerimiento no existe. |
| Ítems de requerimiento / 51462 | 409 · error | `ESTADO_REQUERIMIENTO_INVALIDO` | solo se gestionan ítems en estado EnviadoAlmacen. |
| Ítems de requerimiento / 51463 | 409 · error | `MATERIAL_DUPLICADO` | el material ya existe en el requerimiento. |
| Ítems de requerimiento / 51464 | 404 · error | `REQUERIMIENTO_ITEM_NO_ENCONTRADO` | el ítem no existe en el requerimiento indicado. |
| Ítems de requerimiento / 51465 | 409 · error | `REQUERIMIENTO_SIN_ITEMS` | no se puede eliminar el último ítem. |
| Ítems de requerimiento / 51466 | 409 · error | `REQUERIMIENTO_MATERIAL_INVALIDO` | el material no existe o está inactivo. |
| Ítems de requerimiento / 51467 | 409 · error | `PARTIDA_REQUERIMIENTO_INVALIDA` | la partida debe estar vigente y pertenecer al proyecto. |
| Ítems de requerimiento / 51469 | 409 · error | `TRANSACCION_NO_CONFIRMABLE` | se requiere rollback externo. |
| Ítems de requerimiento / 51469 | 409 · error | `TRANSACCION_REQUERIDA` | la validación necesita una transacción. |

Fuentes del catálogo SQL: [procedimientos repetibles](../Cobranzas_Vittoria/Migrations/Repeatable/2_StoredProcedures/). Las traducciones corresponden al [middleware](../Cobranzas_Vittoria/Middleware/ApiExceptionMiddleware.cs), [traductor presupuestario](../Cobranzas_Vittoria/ControlPresupuestario/Infrastructure/Persistence/TraductorErroresSql.cs), [traductor de ítems](../Cobranzas_Vittoria/Compras/Infrastructure/Persistence/TraductorErroresSql.cs), [traductor de Inventario](../Cobranzas_Vittoria/Application/Common/SqlExceptionTranslator.cs) y los repositorios de cada módulo.

<a id="ejemplos"></a>
## Ejemplos de consumo

Los IDs son ilustrativos y deben sustituirse por referencias válidas del entorno. Las credenciales se introducen como variables; no representan cuentas del proyecto.

### Login

```bash
curl -X POST "$BASE_URL/api/seguridad/auth/login" \
  -H 'Content-Type: application/json' \
  --data '{"usernameOrEmail":"usuario@example.test","password":"contraseña-del-usuario"}'
```

```json
{
  "token": "<access_token>",
  "expiration": "2026-10-19T18:00:00Z",
  "refreshToken": "<refresh_token>"
}
```

### Renovar y cerrar sesión

```bash
curl -X POST "$BASE_URL/api/seguridad/auth/refresh" \
  -H 'Content-Type: application/json' \
  --data '{"refreshToken":"<refresh_token_actual>"}'

curl -X POST "$BASE_URL/api/seguridad/auth/logout" \
  -H 'Content-Type: application/json' \
  --data '{"refreshToken":"<refresh_token_actual>"}'
```

Después de renovar, guardar el nuevo refresh; el anterior queda revocado.

### Consultar y editar un ítem de requerimiento

```bash
curl "$BASE_URL/api/compras/requerimientos/123" \
  -H "Authorization: Bearer $TOKEN"

curl -X PATCH "$BASE_URL/api/compras/requerimientos/123/items/456" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"cantidad":5.25,"observacion":null}'
```

El PATCH exige `requerimientos.gestionar_items_almacen`. La partida no enviada conserva su valor; la observación nula se limpia. La respuesta contiene `idRequerimientoDetalle`, `idRequerimiento`, `idMaterial`, `cantidad`, `idPresupuestoDetalle`, `observacion`.

### Crear un gasto directo

```bash
curl -X POST "$BASE_URL/api/contable/gastos-directos" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"idPresupuestoDetalle":25,"idCategoriaGasto":2,"idProveedor":10,"idMoneda":1,"fecha":"2026-10-19","concepto":"Servicio de transporte","descripcion":null,"monto":150.00}'
```

Éxito: `201`, encabezado `Location` y `{ "idGastoDirecto": 123 }`. La partida y moneda deben ser compatibles. Requiere `gasto_directo.operar`.

### Consultas con varios valores y filtros tabulares

```bash
curl "$BASE_URL/api/contable/gastos-directos?idCategoriaGasto=1&idCategoriaGasto=2&desde=2026-10-01&hasta=2026-10-19" \
  -H "Authorization: Bearer $TOKEN"

curl "$BASE_URL/api/control-presupuestario/consultas/dashboard?idCentroCosto=5&nivel=1" \
  -H "Authorization: Bearer $TOKEN"
```

### Importar archivos

```bash
curl -X POST "$BASE_URL/api/import/material" \
  -F 'archivo=@materiales.xlsx' \
  -F 'usuario=operador'

curl -X POST "$BASE_URL/api/contable/gastos-directos/importar" \
  -H "Authorization: Bearer $TOKEN" \
  -F 'archivo=@gastos-directos.xlsx'

curl -X POST "$BASE_URL/api/control-presupuestario/presupuestos/1/versiones/2/partidas/importar-estructura" \
  -H "Authorization: Bearer $TOKEN" \
  -F 'archivo=@estructura.xlsx' \
  -F 'quitarAusentes=false'
```

No establecer manualmente un `Content-Type: multipart/form-data` sin boundary; `curl -F` lo genera. Aplicar los límites particulares de cada importador.

### Adjuntar y descargar documentos

```bash
curl -X POST "$BASE_URL/api/contable/gastos-directos/123/documentos" \
  -H "Authorization: Bearer $TOKEN" \
  -F 'tipoDocumento=Factura' \
  -F 'files=@factura-1.pdf' \
  -F 'files=@factura-2.pdf'

curl "$BASE_URL/api/contable/gastos-directos/123/documentos/5/download" \
  -H "Authorization: Bearer $TOKEN" \
  --output factura.pdf

curl "$BASE_URL/api/almacen/kardex/stock-actual/exportar-excel?incluirTotales=true" \
  --output stock.xlsx
```

<a id="verificacion"></a>
## Alcance y verificación

Este contrato se obtuvo del código fuente de los controladores registrados por `MapControllers`, sus DTOs, servicios, handlers, modelos devueltos, repositorios Dapper, validadores, autorización, middleware y SP de las migraciones repetibles. Los esquemas de filas SQL reflejan los nombres de las proyecciones y las nulabilidades deducibles de las consultas; no agregan garantías adicionales de validación HTTP.

Swagger UI está disponible en `/swagger` y el documento JSON en `/swagger/v1/swagger.json` **solo en Development y Staging**. Production no registra esa superficie. No es una API de negocio adicional. `UseStaticFiles` también sirve los archivos presentes en el web root bajo sus rutas estáticas; su contenido depende del despliegue y no constituye un catálogo fijo de endpoints de controladores.

Se conservan explícitamente las diferencias de la implementación: endpoints públicos, códigos 200 de creación legacy, respuestas de Dapper con claves SQL, errores de framework, operaciones obsoletas y las dos acciones enable/disable de permisos sin implementar. Las declaraciones genéricas de Swagger no garantizan un esquema preciso para métodos que retornan `IActionResult`, `object` o `dynamic`; este documento los complementa con el código que produce las respuestas.

Hay una incompatibilidad identificada por inspección en `POST /api/contable/valorizaciones/reglas-proveedor`: el repositorio invoca `maestra.usp_ProveedorReglaValorizacion_Upsert` pasando `Usuario` y espera una fila mediante `QueryFirstAsync`, pero el SP de este repositorio no declara ese parámetro ni devuelve un result set. Con esas definiciones no existe una respuesta de éxito consumible: la ejecución puede terminar en `500 SQL_ERROR` por parámetros o `500 UNHANDLED_ERROR` si no se obtiene una fila. No se inventa un esquema de éxito. Véanse [repositorio](../Cobranzas_Vittoria/Repositories/ValorizacionRepository.cs) y [SP](../Cobranzas_Vittoria/Migrations/Repeatable/2_StoredProcedures/R__Maestra_SPs.sql).

Verificaciones realizadas: compilación del proyecto con `dotnet build --no-restore` (sin errores; advertencias preexistentes en documentación XML), comparación del inventario documental con los atributos HTTP de los 27 controladores, revisión de permisos y parámetros, comprobación de enlaces internos/locales y de esquemas referenciados. No se levantó la API ni se ejecutaron migraciones, consultas externas o pruebas de integración contra SQL Server. Los ejemplos describen el contrato y no certifican el estado de un despliegue concreto.

Al modificar una ruta, atributo de autorización, DTO, proyección SQL o mapeo de excepción, actualizar también este documento. Los mensajes de ejemplo son ilustrativos; los códigos y campos documentados son los contratos que debe distinguir el consumidor.
