import { DetalleErrorValidacion } from '../../models/kardex-inventario.models';

export const CODIGO_ERROR = {
  CAMPO_REQUERIDO: 'CAMPO_REQUERIDO',
  CANTIDAD_INVALIDA: 'CANTIDAD_INVALIDA',
  FK_NO_EXISTE: 'FK_NO_EXISTE',
  ITEMS_INVALIDOS: 'ITEMS_INVALIDOS',
  STOCK_INSUFICIENTE: 'STOCK_INSUFICIENTE',
  STOCK_INCONSISTENTE_AL_ELIMINAR: 'STOCK_INCONSISTENTE_AL_ELIMINAR',
  ERROR_VALIDACION: 'ERROR_VALIDACION',
  KARDEX_NO_ENCONTRADO: 'KARDEX_NO_ENCONTRADO',
  ID_RUTA_INCONSISTENTE: 'ID_RUTA_INCONSISTENTE',
  RECURSO_NO_ENCONTRADO: 'RECURSO_NO_ENCONTRADO'
} as const;

export type CodigoError = typeof CODIGO_ERROR[keyof typeof CODIGO_ERROR];

/**
 * Extrae un mensaje legible desde un `HttpErrorResponse` u objeto de error.
 * Prioriza `errores[]` del payload 422, luego `error.message`, luego `err.message`.
 */
export function extraerMensajeError(err: any, fallback = 'Ocurrió un error inesperado.'): string {
  if (!err) return fallback;
  const body = err?.error;

  if (Array.isArray(body?.errores) && body.errores.length) {
    const cabecera = (body?.message as string) || 'La operación fue rechazada.';
    const detalle = body.errores
      .map((e: DetalleErrorValidacion, i: number) => `${i + 1}) ${e?.mensaje ?? 'Error sin detalle.'}`)
      .join(' ');
    return `${cabecera} ${detalle}`;
  }

  if (body?.message) return String(body.message);
  if (typeof err?.message === 'string' && err.message) return err.message;

  return fallback;
}

/**
 * Devuelve true si el payload de error contiene al menos un `errores[]` con el `codigoError` indicado.
 * Útil para detectar casos como STOCK_INSUFICIENTE o ID_RUTA_INCONSISTENTE.
 */
export function esCodigoError(err: any, codigo: CodigoError | string): boolean {
  const errores = err?.error?.errores;
  if (!Array.isArray(errores)) return false;
  return errores.some((e: DetalleErrorValidacion) => e?.codigoError === codigo);
}

/**
 * Devuelve el arreglo `errores[]` del payload, o un arreglo vacío si no existe.
 */
export function obtenerErrores(err: any): DetalleErrorValidacion[] {
  const errores = err?.error?.errores;
  return Array.isArray(errores) ? errores : [];
}
