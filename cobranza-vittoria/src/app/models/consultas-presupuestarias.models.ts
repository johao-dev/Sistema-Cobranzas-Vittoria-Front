/** Respuestas de las consultas públicas consumidas por Requerimientos y presupuestos. */
export interface CentroCostoResumen {
  idCentroCosto: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  idTipoCentroCosto: number;
  codigoTipoCentroCosto: string | null;
  nombreTipoCentroCosto: string | null;
  idProyecto: number | null;
  nombreProyecto: string | null;
  activo: boolean;
  fechaCreacion: string | null;
  fechaModificacion: string | null;
}

export interface PartidaCatalogo {
  idCatalogoPartida: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  idPartidaPadre: number | null;
  codigoPartidaPadre: string | null;
  nombrePartidaPadre: string | null;
  nivel: number;
  idTipoPartida: number;
  codigoTipoPartida: string | null;
  nombreTipoPartida: string | null;
  activo: boolean;
  esHoja: boolean;
  fechaCreacion: string | null;
  fechaActualizacion: string | null;
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
