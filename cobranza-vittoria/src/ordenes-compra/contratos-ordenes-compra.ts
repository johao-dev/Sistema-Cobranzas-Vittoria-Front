export type EstadoOrdenDestino = 'APROBADA' | 'ANULADA' | 'CERRADA';

export interface OrdenCompra {
  idOrdenCompra: number;
  numeroOrdenCompra: string;
  idRequerimiento: number;
  idMoneda: number;
  codigoMoneda: string | null;
  simboloMoneda: string | null;
  numeroRequerimiento: string | null;
  proveedores: string | null;
  especialidades: string | null;
  idProyecto: number;
  nombreProyecto: string | null;
  fechaOrdenCompra: string;
  descripcion: string | null;
  estado: string;
  total: number;
  rutaPdf: string | null;
  fechaCreacion: string;
  idUsuarioCreacion: number | null;
}

export interface ItemOrdenCompra {
  idOrdenCompraDetalle: number;
  idOrdenCompra: number;
  idMaterial: number;
  idProveedor: number;
  proveedor: string | null;
  material: string | null;
  especialidad: string | null;
  unidadMedida: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface HistorialOrdenCompra {
  idOrdenCompraHistorial: number;
  idOrdenCompra: number;
  estadoAnterior: string | null;
  estadoNuevo: string;
  fechaCambio: string;
  idUsuario: number | null;
  usuario: string | null;
  observacion: string | null;
}

export interface DetalleOrdenCompra {
  ordenCompra: OrdenCompra;
  items: ItemOrdenCompra[];
  historial: HistorialOrdenCompra[];
}

export interface ItemOrdenRequest {
  idMaterial: number;
  cantidad: number;
  idProveedor: number;
  precioUnitario: number;
}

export interface OrdenCompraRequest {
  numeroOrdenCompra: string;
  idRequerimiento: number;
  idMoneda?: number | null;
  fechaOrdenCompra: string;
  descripcion: string | null;
  idUsuarioCreacion: number | null;
  rutaPdf: string | null;
  items: ItemOrdenRequest[];
}

export interface FiltrosOrdenCompra {
  estado?: string;
  idProveedor?: number | null;
  idProyecto?: number | null;
}

export interface CambioEstadoOrdenRequest {
  estadoNuevo: EstadoOrdenDestino;
  idUsuario: number | null;
  observacion: string | null;
}

export interface SolicitudCambioEstadoOrden {
  orden: OrdenCompra;
  destino: EstadoOrdenDestino;
}
