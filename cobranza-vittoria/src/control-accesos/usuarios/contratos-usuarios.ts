export interface Usuario {
  idUsuario: number;
  nombres: string;
  apellidos: string;
  correo: string;
  usuarioLogin: string;
  activo: boolean;
  fechaCreacion: string | null;
  usuarioCreacion: string | null;
}

export interface UsuarioCreateRequest {
  nombres: string;
  apellidos: string;
  correo: string;
  usuarioLogin: string;
  password: string;
}

/** Compatibilidad del formulario actual conservada por indicación del responsable.
 * La discrepancia password/passwordHash del PUT sigue pendiente de revisión del contrato.
 */
export interface UsuarioUpdateRequest {
  nombres: string;
  apellidos: string;
  correo: string;
  usuarioLogin: string;
  activo: boolean;
  password?: string;
}

export interface AsignarRolesRequest {
  idRoles: number[];
}

/** Presentación de los roles adicionales que admite el detalle histórico; no es un DTO confirmado. */
export interface RolUsuario {
  nombreRol: string;
}
export interface DetalleUsuario {
  usuario: Usuario;
  roles: RolUsuario[];
}
