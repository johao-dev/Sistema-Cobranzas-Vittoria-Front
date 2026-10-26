export interface Permiso {
  idPermiso: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  fechaCreacion?: string | null;
  usuarioCreacion?: string | null;
  fechaModificacion?: string | null;
  usuarioModificacion?: string | null;
}

export interface ListarPermisoResponse {
  permisos: Permiso[];
}

export interface UpdatePermisoRequest {
  nombre?: string | null;
  descripcion?: string | null;
}
