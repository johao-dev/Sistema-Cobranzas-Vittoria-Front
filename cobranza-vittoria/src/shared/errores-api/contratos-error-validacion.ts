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
