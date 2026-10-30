export interface CategoriaGastoReferencia {
  idCategoriaGasto: number;
  codigo: string | null;
  nombre: string;
  activo: boolean;
}

export interface CategoriaGastoUpsert {
  idCategoriaGasto: number | null;
  codigo: string;
  nombre: string;
  activo: boolean;
}
