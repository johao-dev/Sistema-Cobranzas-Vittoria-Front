export interface Especialidad {
  idEspecialidad: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  fechaCreacion?: string;
}
export interface EspecialidadUpsert {
  idEspecialidad: number | null;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}
