export type EstadoRequerimiento =
  | 'Registrado'
  | 'EnviadoAlmacen'
  | 'ValidadoAlmacen'
  | 'AprobadoCoordinador'
  | 'Rechazado'
  | 'EnviadoOC'
  | 'GeneradoOC'
  | 'Anulado';

export type ResultadoValidacionAlmacen = 'Conforme' | 'Observado';

export interface RequerimientoFilters {
  estado?: EstadoRequerimiento | '';
  idEspecialidad?: number | null;
  idProyecto?: number | null;
}

export interface RequerimientoItemRequest {
  idMaterial: number;
  cantidad: number;
  observacion?: string | null;
  /** Partida presupuestal a la que se imputa la línea. Null = sin imputar. */
  idPresupuestoDetalle?: number | null;
}

/** Omitir conserva; null limpia partida u observación. El material es inmutable. */
export interface RequerimientoItemPatchRequest {
  cantidad?: number;
  idPresupuestoDetalle?: number | null;
  observacion?: string | null;
}

export interface RequerimientoItemResponse {
  idRequerimientoDetalle: number;
  idRequerimiento: number;
  idMaterial: number;
  cantidad: number;
  idPresupuestoDetalle: number | null;
  observacion: string | null;
}

export interface RequerimientoRequest {
  numeroRequerimiento: string;
  fechaRequerimiento: string;
  idProyecto: number;
  descripcion: string;
  fechaEntrega: string | null;
  observacion?: string | null;
  items: RequerimientoItemRequest[];
}

export interface RequerimientoResumen {
  idRequerimiento: number;
  numeroRequerimiento: string;
  fechaRequerimiento: string;
  fechaEntrega: string | null;
  especialidades?: string | null;
  idProyecto: number;
  nombreProyecto?: string | null;
  solicitante?: string | null;
  estado: EstadoRequerimiento;
}

export interface Requerimiento extends RequerimientoResumen {
  descripcion?: string | null;
  fechaEntrega: string | null;
  observacion?: string | null;
  idUsuarioSolicitante?: number;
}

export interface RequerimientoDetalleItem {
  idRequerimientoDetalle: number;
  idRequerimiento: number;
  idMaterial: number;
  idEspecialidad?: number | null;
  especialidad?: string | null;
  material: string | null;
  unidadMedida?: string | null;
  cantidad: number;
  observacion?: string | null;
  idPresupuestoDetalle?: number | null;
  codigoPartida?: string | null;
  nombrePartida?: string | null;
}

export interface ValidacionRequerimiento {
  resultado: string;
  observacion?: string | null;
  fechaValidacion: string;
  usuario?: string | null;
}

export interface RequerimientoGetResponse {
  requerimiento: Requerimiento;
  items: RequerimientoDetalleItem[];
  validaciones: ValidacionRequerimiento[];
  puedeEditar: boolean;
}

export interface RequerimientoCreadoResponse {
  idRequerimiento: number;
}

export interface RequerimientoActionResponse {
  ok: true;
}

export interface RequerimientoObservacionRequest {
  observacion: string | null;
}

export interface ValidacionAlmacenRequest extends RequerimientoObservacionRequest {
  resultado: ResultadoValidacionAlmacen;
}
