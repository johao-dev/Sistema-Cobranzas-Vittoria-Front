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

export interface CompraPendienteOcFilaSql {
  IdOrdenCompra: number;
  NumeroOrdenCompra: string;
  IdMoneda: number;
  CodigoMoneda: string;
  SimboloMoneda: string | null;
  FechaOrdenCompra: string;
  Estado: string;
  Total: number;
  Proveedores: string | null;
  IdRequerimiento: number | null;
  NumeroRequerimiento: string;
  Especialidades: string;
  NombreProyecto: string;
}
export interface CompraRequest {
  numeroCompra: string;
  idOrdenCompra: number;
  fechaCompra: string;
  incluyeIGV: boolean;
  subtotalSinIGV: number;
  montoIGV: number;
  montoTotal: number;
  observacion: string | null;
  items: { idMaterial: number; cantidad: number; precioUnitario: number }[];
}
export interface CompraCreada {
  idCompra: number;
  montoTotal: number;
}
export interface AceptarCompraRequest {
  idUsuario: number | null;
  observacion: string | null;
}
