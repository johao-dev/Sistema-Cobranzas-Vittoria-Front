export interface ReporteFiltro {
  idCentroCosto?: number | null;
  idPresupuesto?: number | null;
  idPresupuestoVersion?: number | null;
  idCatalogoPartida?: number | null;
  idMoneda?: number | null;
  estadoPresupuesto?: string | null;
  soloExcedidos?: boolean | null;
  incluirInactivos?: boolean | null;
}

export interface ResumenTotales {
  presupuestado: number;
  comprometido: number;
  ejecutado: number;
  saldoDisponible: number;
  porcentajeEjecutado: number;
  centrosCosto: number;
  partidas: number;
  partidasExcedidas: number;
}

export interface GastoPorCentroCosto {
  idCentroCosto: number;
  codigoCentroCosto: string | null;
  centroCosto: string | null;
  idPresupuesto: number;
  codigoPresupuesto: string | null;
  presupuesto: string | null;
  idMoneda: number;
  moneda: string | null;
  simboloMoneda: string | null;
  idPresupuestoVersion: number;
  numeroVersion: number;
  estado: string | null;
  montoPresupuestado: number;
  comprometido: number;
  ejecutado: number;
  saldoDisponible: number;
  porcentajeEjecutado: number;
  excedido: boolean;
}

export interface GastoPorPartida {
  idCentroCosto: number;
  codigoCentroCosto: string | null;
  centroCosto: string | null;
  idPresupuesto: number;
  codigoPresupuesto: string | null;
  presupuesto: string | null;
  idMoneda: number;
  moneda: string | null;
  simboloMoneda: string | null;
  idPresupuestoVersion: number;
  numeroVersion: number;
  estado: string | null;
  idCatalogoPartida: number;
  codigoPartida: string | null;
  partida: string | null;
  nivel: number;
  montoPresupuestado: number;
  ejecutado: number;
  diferencia: number;
  porcentajeEjecutado: number;
}

export interface PresupuestoVsComprometido {
  idCentroCosto: number;
  codigoCentroCosto: string | null;
  centroCosto: string | null;
  idPresupuesto: number;
  codigoPresupuesto: string | null;
  presupuesto: string | null;
  idMoneda: number;
  moneda: string | null;
  simboloMoneda: string | null;
  idPresupuestoVersion: number;
  numeroVersion: number;
  estado: string | null;
  idPresupuestoDetalle: number;
  idCatalogoPartida: number;
  codigoPartida: string | null;
  partida: string | null;
  nivel: number;
  montoPresupuestado: number;
  comprometido: number;
  diferencia: number;
  porcentajeComprometido: number;
}

export interface PresupuestoVsEjecutado {
  idCentroCosto: number;
  codigoCentroCosto: string | null;
  centroCosto: string | null;
  idPresupuesto: number;
  codigoPresupuesto: string | null;
  presupuesto: string | null;
  idMoneda: number;
  moneda: string | null;
  simboloMoneda: string | null;
  idPresupuestoVersion: number;
  numeroVersion: number;
  estado: string | null;
  idPresupuestoDetalle: number;
  idCatalogoPartida: number;
  codigoPartida: string | null;
  partida: string | null;
  nivel: number;
  montoPresupuestado: number;
  ejecutado: number;
  diferencia: number;
  porcentajeEjecutado: number;
}

export interface SaldoPartida {
  idCentroCosto: number;
  codigoCentroCosto: string | null;
  centroCosto: string | null;
  idPresupuesto: number;
  codigoPresupuesto: string | null;
  presupuesto: string | null;
  idMoneda: number;
  moneda: string | null;
  simboloMoneda: string | null;
  idPresupuestoVersion: number;
  numeroVersion: number;
  estado: string | null;
  idPresupuestoDetalle: number;
  idCatalogoPartida: number;
  codigoPartida: string | null;
  partida: string | null;
  nivel: number;
  montoPresupuestado: number;
  comprometido: number;
  ejecutado: number;
  saldoDisponible: number;
  montoExcedido: number;
  excedido: boolean;
}

export interface ResumenPresupuestario {
  totales: ResumenTotales;
  porCentroCosto: GastoPorCentroCosto[];
  partidasExcedidas: SaldoPartida[];
}

/** Columnas de las cinco vistas; los DTOs conservan sus campos exactos arriba. */
export type FilaReportePresupuestario = Partial<
  SaldoPartida &
    PresupuestoVsComprometido &
    PresupuestoVsEjecutado &
    GastoPorPartida &
    GastoPorCentroCosto
>;
