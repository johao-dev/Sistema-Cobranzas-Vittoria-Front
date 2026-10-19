
export interface Requerimiento {
  idRequerimiento: number;
  numeroRequerimiento: string;
  fechaRequerimiento: string;
  especialidad?: string | null;
  nombreProyecto?: string | null;
  descripcion?: string | null;
  fechaEntrega?: string | null;
  solicitante?: string | null;
  estado: string;
  observacion?: string | null;
}

export interface RequerimientoCreate {
  numeroRequerimiento: string;
  fechaRequerimiento: string;
  idEspecialidad: number;
  idProyecto: number;
  descripcion?: string | null;
  fechaEntrega?: string | null;
  // El backend deriva al solicitante desde el JWT; nunca debe enviarlo el formulario.
  observacion?: string | null;
  items: RequerimientoItemCreate[];
}

export interface RequerimientoItemCreate {
  idMaterial: number;
  cantidad: number;
  observacion?: string | null;
}

export interface OrdenCompra {
  idOrdenCompra: number;
  numeroOrdenCompra: string;
  numeroRequerimiento?: string | null;
  proveedor?: string | null;
  nombreProyecto?: string | null;
  fechaOrdenCompra: string;
  estado: string;
  total: number;
}

export interface Compra {
  idCompra: number;
  numeroCompra: string;
  numeroOrdenCompra?: string | null;
  proveedor?: string | null;
  fechaCompra: string;
  aceptada: boolean;
  montoTotal: number;
}

// DTO de las consultas legacy: las filas Dapper conservan los alias PascalCase.
export interface CompraFilaSql {
  IdCompra: number;
  NumeroCompra: string;
  FechaCompra: string;
  Estado: string;
  Aceptada: boolean;
  IncluyeIGV: boolean;
  SubtotalSinIGV: number;
  MontoIGV: number;
  MontoTotal: number;
  Observacion: string | null;
  IdOrdenCompra: number;
  NumeroOrdenCompra: string;
  IdMoneda: number;
  CodigoMoneda: string;
  SimboloMoneda: string | null;
  Proveedores: string | null;
  NumeroRequerimiento: string;
  NombreProyecto: string;
  Especialidades: string;
}

export interface CompraItemFilaSql {
  IdCompraDetalle: number;
  IdCompra: number;
  IdMaterial: number;
  Material: string;
  UnidadMedida: string | null;
  Cantidad: number;
  PrecioUnitario: number;
  Subtotal: number;
  IdProveedor: number | null;
  Proveedor: string | null;
}

export interface CompraDocumentoFilaSql {
  IdCompraDocumento: number;
  IdCompra: number;
  NombreArchivo: string | null;
  RutaArchivo: string | null;
  Extension: string | null;
  FechaCreacion: string;
}

export interface CompraDetalleResponse {
  compra: CompraFilaSql;
  items: CompraItemFilaSql[];
  documentos: CompraDocumentoFilaSql[];
}

export interface FiltrosCompra {
  aceptada?: boolean | null;
  idProveedor?: number | null;
}
