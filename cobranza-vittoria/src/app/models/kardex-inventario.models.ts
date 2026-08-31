export interface KardexFiltroInventarioDto {
  idEspecialidad?: number | null;
  idProyecto?: number | null;
  idProveedor?: number | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
}

export interface KardexStockFiltroDto {
  idEspecialidad?: number | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
}

export interface KardexEntradaCreateDto {
  idKardexEntrada?: number | null;
  idEspecialidad: number;
  idMaterial: number;
  idProveedor?: number | null;
  idProyecto?: number | null;
  numeroDocumento?: string | null;
  fecha: string;
  cantidad: number;
  observacion?: string | null;
}

export interface KardexEntradaResponseDto {
  idKardexEntrada: number;
  idEspecialidad: number;
  especialidad: string | null;
  idMaterial: number;
  codigoMaterial: string | null;
  nombre: string | null;
  idProveedor: number | null;
  proveedor: string | null;
  idProyecto: number | null;
  proyecto: string | null;
  numeroDocumento: string | null;
  fecha: string;
  cantidad: number;
  observacion: string | null;
  fechaCreacion: string;
}

export interface KardexSalidaItemCreateDto {
  idMaterial: number;
  cantidad: number;
  observacion?: string | null;
}

export interface KardexSalidaCreateDto {
  idKardexSalida?: number | null;
  idEspecialidad: number;
  idProyecto?: number | null;
  numeroDocumento?: string | null;
  fecha: string;
  solicitante: string;
  observacion?: string | null;
  items: KardexSalidaItemCreateDto[];
}

export interface KardexSalidaResponseDto {
  idKardexSalida: number;
  idEspecialidad: number;
  especialidad: string | null;
  idProyecto: number | null;
  proyecto: string | null;
  numeroDocumento: string | null;
  fecha: string;
  solicitante: string;
  observacion: string | null;
  idKardexSalidaDetalle: number;
  idMaterial: number;
  codigoMaterial: string | null;
  nombre: string | null;
  cantidad: number;
  detalleObservacion: string | null;
  fechaCreacion: string;
}

export interface KardexStockActualResponseDto {
  idKardexStock: number;
  idMaterial: number;
  codigoMaterial: string | null;
  nombre: string | null;
  unidadMedida: string | null;
  idEspecialidad: number;
  especialidad: string | null;
  totalEntrada: number;
  totalSalida: number;
  stock: number;
  fechaUltimaMovimiento: string;
}

export interface DetalleErrorValidacion {
  fila: number | null;
  campo: string;
  codigoError: string;
  mensaje: string;
}

export interface RespuestaValidacion422 {
  ok: false;
  error: string;
  message: string;
  errores: DetalleErrorValidacion[];
}
