export interface EstadoPresupuesto {
  idEstadoPresupuesto: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface MonedaPresupuestaria {
  idMoneda: number;
  codigo: string;
  nombre: string;
  simbolo: string | null;
  activo: boolean;
}

export interface TipoCentroCosto {
  idTipoCentroCosto: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface TipoPartida {
  idTipoPartida: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface TipoMovimientoPresupuestal {
  idTipoMovimientoPresupuestal: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface CatalogosPresupuestariosDatos {
  tiposCentroCosto: TipoCentroCosto[];
  tiposPartida: TipoPartida[];
  estadosPresupuesto: EstadoPresupuesto[];
  tiposMovimiento: TipoMovimientoPresupuestal[];
  monedas: MonedaPresupuestaria[];
}
