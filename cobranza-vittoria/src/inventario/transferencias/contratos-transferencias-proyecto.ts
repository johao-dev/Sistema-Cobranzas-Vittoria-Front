export interface FiltrosTransferenciasProyecto {
  idTransferencia?: number | null;
  idProyectoOrigen?: number | null;
  idProyectoDestino?: number | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
}

export interface CrearTransferenciaProyectoDto {
  idProyectoOrigen: number;
  idProyectoDestino: number;
  fecha: string;
  observacion: string;
  items: { idMaterial: number; cantidad: number }[];
}

export interface TransferenciaProyectoDetalle {
  idTransferenciaProyectoDetalle: number;
  idMaterial: number;
  codigoMaterial: string;
  nombre: string;
  unidadMedida: string;
  idEspecialidad: number;
  especialidad: string;
  cantidad: number;
}

/** La API devuelve una fila por detalle con la cabecera repetida. */
export interface TransferenciaProyecto extends TransferenciaProyectoDetalle {
  idTransferencia: number;
  idProyectoOrigen: number;
  proyectoOrigen: string;
  idProyectoDestino: number;
  proyectoDestino: string;
  fecha: string;
  observacion: string;
}
