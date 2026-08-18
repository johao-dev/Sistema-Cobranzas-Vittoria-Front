
/** @deprecated Pertenece al flujo legacy de Kardex ligado a Compras. Usar interfaces de `kardex-inventario.models.ts` para el nuevo módulo manual. */
export interface KardexMovimiento {
  idKardexMovimiento: number;
  material?: string | null;
  especialidad?: string | null;
  tipoMovimiento: string;
  fechaMovimiento: string;
  cantidadEntrada: number;
  cantidadSalida: number;
  stockResultante: number;
  observacion?: string | null;
}

/** @deprecated Pertenece al flujo legacy de Kardex ligado a Compras. Usar `KardexStockActualResponseDto` de `kardex-inventario.models.ts`. */
export interface KardexResumenMaterial {
  idMaterial: number;
  material: string;
  especialidad: string;
  unidadMedida: string;
  totalEntradas: number;
  totalSalidas: number;
  stockActual: number;
}
