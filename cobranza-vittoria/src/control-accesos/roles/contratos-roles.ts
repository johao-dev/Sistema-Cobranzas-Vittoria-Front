export interface Rol {
  idRol: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
  fechaCreacion: string | null;
  usuarioCreacion: string | null;
  fechaModificacion: string | null;
  usuarioModificacion: string | null;
}

export interface PermisoAsignadoResponse {
  idPermiso: number;
  codigo: string;
  nombre: string;
}
export interface RolConPermisosResponse {
  idRol: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
  permisos: PermisoAsignadoResponse[];
}
export interface CrearRolRequest {
  nombre: string;
  descripcion: string;
}
export interface ActualizarRolRequest {
  nombre?: string | null;
  descripcion?: string | null;
  activo?: boolean | null;
}
export interface AsignarPermisosRolRequest {
  idPermisos: number[];
}
