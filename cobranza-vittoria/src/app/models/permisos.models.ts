export interface Permiso {
  idPermiso: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  fechaCreacion?: string;
  usuarioCreacion?: string;
  fechaModificacion?: string;
  usuarioModificacion?: string;
}

export interface ListarPermisoResponse {
  permisos: Permiso[];
}

export interface CreatePermisoRequest {
  codigo: string;
  nombre: string;
  descripcion?: string;
}

export interface UpdatePermisoRequest {
  nombre?: string;
  descripcion?: string;
}
