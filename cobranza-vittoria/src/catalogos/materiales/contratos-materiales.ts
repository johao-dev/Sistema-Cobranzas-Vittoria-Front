export interface Material {
  idMaterial: number;
  idEspecialidad: number;
  especialidad?: string | null;
  codigo?: string | null;
  codigoProveedor?: string | null;
  descripcion: string;
  unidadMedida: string;
  stockMinimo: number;
  activo: boolean;
  fechaCreacion?: string;
  idCatalogoPartida?: number | null;
  codigoPartida?: string | null;
  nombrePartida?: string | null;
}
export interface MaterialUpsert {
  idMaterial: number | null;
  idEspecialidad: number;
  codigo: string;
  codigoProveedor: string;
  descripcion: string;
  unidadMedida: string;
  stockMinimo: number;
  activo: boolean;
  idCatalogoPartida: number | null;
}
export interface OpcionPartida {
  idCatalogoPartida: number;
  codigo: string;
  nombre: string;
}
