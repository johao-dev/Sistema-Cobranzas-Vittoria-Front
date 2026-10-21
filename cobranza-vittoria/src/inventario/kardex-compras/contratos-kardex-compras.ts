// Las filas Dapper mantienen los alias PascalCase del contrato legacy.
export interface MovimientoCompra {
  IdCompra: number | null;
  NumeroCompra: string | null;
  NumeroRequerimiento: string;
  IdMaterial: number;
  IdEspecialidad: number | null;
  Especialidad: string | null;
  FechaMovimiento: string;
  Material: string;
  Entrada: number;
  Salida: number;
  Stock: number;
  Observacion: string;
}

export interface FiltrosMovimientosCompra {
  idCompra?: number | null;
  idMaterial?: number | null;
  idEspecialidad?: number | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
}

export interface SalidaCompraRequest {
  idCompra: number;
  idMaterial: number;
  idEspecialidad: number | null;
  fechaMovimiento: string;
  cantidadSalida: number;
  observacion: string | null;
}

export interface SalidaCompraRegistrada {
  ok: boolean;
  stockActual: number;
  mensaje: string;
}

export interface MovimientoCompraPresentado extends MovimientoCompra {
  compraKey: string;
  numeroCompraCorrelativo: number;
}

export interface CompraParaSalida {
  compraKey: string;
  idCompra: number;
  numeroCompra: number;
  numeroRequerimiento: string;
  idMaterial: number;
  material: string;
  idEspecialidad: number | null;
}
