export interface Presupuesto {
  idPresupuesto: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  idCentroCosto: number;
  codigoCentroCosto: string | null;
  centroCosto: string | null;
  idMoneda: number;
  moneda: string | null;
  nombreMoneda: string | null;
  simboloMoneda: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  activo: boolean;
  fechaCreacion: string | null;
  fechaModificacion: string | null;
  idPresupuestoVersionAprobada: number | null;
  idPresupuestoVersionBorrador: number | null;
  cantidadAprobadas: number;
  cantidadBorradores: number;
  estadoElaboracion: string | null;
}

export interface VersionPresupuesto {
  idPresupuestoVersion: number;
  idPresupuesto: number;
  numeroVersion: number;
  estado: string;
  nombreEstado: string | null;
  descripcion: string | null;
  motivoCambio: string | null;
  motivoAnulacion: string | null;
  fechaCreacion: string | null;
  fechaAprobacion: string | null;
  fechaAnulacion: string | null;
  usuarioCreacion: string | null;
  usuarioAprobacion: string | null;
  usuarioAnulacion: string | null;
  codigoPresupuesto: string | null;
  nombrePresupuesto: string | null;
  idCentroCosto: number;
  idMoneda: number;
  moneda: string | null;
  simboloMoneda: string | null;
}

export interface DetallePresupuesto {
  idPresupuestoDetalle: number;
  idPresupuestoVersion: number;
  idCatalogoPartida: number;
  codigo: string | null;
  nombre: string | null;
  montoPresupuestado: number;
  observacion: string | null;
  idPartidaPadre: number | null;
  nivel: number;
  idTipoPartida: number;
  codigoTipoPartida: string | null;
  nombreTipoPartida: string | null;
  partidaActiva: boolean;
  esHoja: boolean;
  fechaCreacion: string | null;
  fechaModificacion: string | null;
}

export interface PresupuestoCreado {
  idPresupuesto: number;
  idPresupuestoVersion: number;
  numeroVersion: number;
  estado: string;
}

export interface VersionCreada {
  idPresupuestoVersion: number;
  numeroVersion: number;
  estado: string;
  idPresupuesto: number;
  idPresupuestoVersionBase: number | null;
  cantidadDetallesCopiados: number;
}

export interface ResultadoCargaPresupuesto {
  idPresupuestoVersion: number;
  agregados: number;
  actualizados: number;
  eliminados: number;
  partidasEnVersion: number;
  montoTotal: number;
}

export interface ResultadoEstructuraPresupuesto {
  idPresupuestoVersion: number;
  agregados: number;
  actualizados: number;
  eliminados: number;
  partidasEnVersion: number;
  montoTotal: number;
  partidasCreadas: number;
}

export interface MovimientoPresupuestario {
  idMovimientoPresupuestal: number;
  idPresupuestoDetalle: number;
  tipo: string;
  nombreTipo: string | null;
  origen: string | null;
  idOrigen: number;
  claveEvento: string | null;
  fecha: string;
  monto: number;
  afectacion: string | null;
  direccion: string | null;
  observacion: string | null;
  idPresupuesto: number;
  idPresupuestoVersion: number;
  numeroVersion: number;
  estadoPresupuesto: string | null;
  idCatalogoPartida: number;
  codigoPartida: string | null;
  partida: string | null;
  codigoPresupuesto: string | null;
  idMoneda: number;
  moneda: string | null;
  simboloMoneda: string | null;
  esNuevo: boolean;
}
