export interface UnidadMedida {
  idUnidadMedida: number;
  codigo: string;
  nombre: string;
  activo: boolean;
}
export interface UnidadMedidaUpsert {
  idUnidadMedida: number | null;
  codigo: string;
  nombre: string;
  activo: boolean;
}
