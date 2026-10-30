export interface CategoriaGasto {
  idCategoriaGasto: number;
  codigo: string;
  nombre: string;
}

export interface CentroCostoGastoDirecto {
  idProyecto: number | null;
  codigoTipoCentroCosto: string | null;
  idCentroCosto: number;
  codigo: string;
  nombre: string;
}

export interface PartidaDisponibleGastoDirecto {
  idPresupuesto: number;
  codigoPresupuesto: string;
  idPresupuestoVersion: number;
  numeroVersion: number;
  idPresupuestoDetalle: number;
  idCatalogoPartida: number;
  codigoPartida: string;
  nombrePartida: string;
  montoPresupuestado: number;
  montoComprometido: number;
  montoEjecutado: number;
  saldoDisponible: number;
  idMoneda: number;
  codigoMoneda: string | null;
  simboloMoneda: string | null;
}

export interface ProveedorGastoDirecto {
  idProveedor: number;
  razonSocial: string;
  ruc: string | null;
}

export interface GastoDirectoListado {
  fechaCreacion: string;
  fechaActualizacion: string | null;
  usuarioCreacion: string | null;
  idPresupuesto: number;
  codigoCentroCosto: string;
  idProyecto: number | null;
  idGastoDirecto: number;
  idPresupuestoDetalle: number;
  idCentroCosto: number;
  idCatalogoPartida: number;
  idCategoriaGasto: number | null;
  codigoCategoriaGasto: string | null;
  nombreCategoriaGasto: string | null;
  idProveedor: number | null;
  idMoneda: number;
  fecha: string;
  concepto: string;
  descripcion: string | null;
  monto: number;
  estado: string;
  proveedor: string | null;
  centroCosto: string;
  codigoPartida: string;
  partida: string;
  moneda: string;
  codigoPresupuesto: string;
  totalDocumentos: number;
  idMonedaOriginal: number | null;
  monedaOriginal: string | null;
  montoOriginal: number | null;
  tipoCambio: number | null;
  fechaTipoCambio: string | null;
}

export interface GastoDirectoDocumento {
  idGastoDirectoDocumento: number;
  idGastoDirecto: number;
  tipoDocumento: string;
  nombreArchivo: string;
  rutaArchivo: string | null;
  extension: string | null;
  fechaCreacion: string;
  numeroFactura: string | null;
  tieneArchivo: boolean;
}

export interface GastoDirectoRequest {
  idPresupuestoDetalle: number;
  idCategoriaGasto: number;
  idProveedor: number | null;
  idMoneda: number;
  fecha: string;
  concepto: string;
  descripcion: string | null;
  monto: number;
  idMonedaOriginal: number | null;
  montoOriginal: number | null;
  tipoCambio: number | null;
  fechaTipoCambio: string | null;
}

export interface GastoDirectoFiltro {
  estado?: string | null;
  idProveedor?: number | null;
  idCentroCosto?: number | null;
  desde?: string | null;
  hasta?: string | null;
  idCategoriaGasto?: number[] | null;
}

export interface GastoDirectoVistaConfig {
  titulo: string;
  subtitulo: string;
  codigosCategoria: string[];
  permiteSeleccionCategoria: boolean;
}

export interface GastoDirectoGuardado {
  idGastoDirecto: number;
}
export interface GastoDirectoTransicion extends GastoDirectoGuardado {
  ok: boolean;
  estado: string;
}
export interface GastoDirectoDetalle {
  gasto: GastoDirectoListado;
  documentos: GastoDirectoDocumento[];
}
export interface DocumentosGastoAdjuntados {
  ok: boolean;
  cantidad: number;
}
export type AccionGasto = 'confirmar' | 'anular';
export type MonedaColumnaGasto = 'PEN' | 'USD';
