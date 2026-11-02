import { DetalleErrorValidacion } from '../../../shared/errores-api/contratos-error-validacion';

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
  RECURSO_NO_ENCONTRADO: 'RECURSO_NO_ENCONTRADO',
} as const;

export type CodigoError = (typeof CODIGO_ERROR)[keyof typeof CODIGO_ERROR];

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function cuerpoError(error: unknown): Record<string, unknown> | undefined {
  if (!esRegistro(error)) return undefined;
  const cuerpo = error['error'];
  return esRegistro(cuerpo) ? cuerpo : undefined;
}

/** Normaliza detalles parciales de los distintos validadores de la API. */
function leerDetalle(valor: unknown): DetalleErrorValidacion {
  const detalle = esRegistro(valor) ? valor : {};
  const fila = detalle['fila'];
  return {
    fila: typeof fila === 'number' && Number.isFinite(fila) ? fila : null,
    campo: typeof detalle['campo'] === 'string' ? detalle['campo'] : '',
    codigoError: typeof detalle['codigoError'] === 'string' ? detalle['codigoError'] : '',
    mensaje: detalle['mensaje'] == null ? 'Error sin detalle.' : String(detalle['mensaje']),
  };
}

/**
 * Extrae un mensaje legible de un error desconocido.
 * Prioriza errores[] del payload 422, errors de modelo y los mensajes del servidor.
 */
export function extraerMensajeError(
  error: unknown,
  fallback = 'Ocurrió un error inesperado.',
): string {
  const cuerpo = cuerpoError(error);
  const errores = cuerpo?.['errores'];
  if (Array.isArray(errores) && errores.length) {
    const cabecera = cuerpo?.['message']
      ? String(cuerpo['message'])
      : 'La operación fue rechazada.';
    const detalles: unknown[] = errores;
    const detalle = detalles
      .map((valor, indice) => `${indice + 1}) ${leerDetalle(valor).mensaje}`)
      .join(' ');
    return `${cabecera} ${detalle}`;
  }

  // ASP.NET Core publica errores de modelo bajo errors: { Campo: [mensajes] }.
  const erroresModelo = cuerpo?.['errors'];
  if (esRegistro(erroresModelo)) {
    const mensajes = Object.values(erroresModelo)
      .flatMap((valor: unknown): unknown[] => (Array.isArray(valor) ? valor : [valor]))
      .map(String)
      .filter(Boolean);
    if (mensajes.length) return mensajes.join(' ');
  }

  if (cuerpo?.['message']) return String(cuerpo['message']);
  if (esRegistro(error) && typeof error['message'] === 'string' && error['message']) {
    return error['message'];
  }

  return fallback;
}

/** Detecta un código de negocio sin exigir otros campos del detalle. */
export function esCodigoError(error: unknown, codigo: CodigoError | string): boolean {
  const errores = cuerpoError(error)?.['errores'];
  if (!Array.isArray(errores)) return false;
  const detalles: unknown[] = errores;
  return detalles.some((detalle) => esRegistro(detalle) && detalle['codigoError'] === codigo);
}

/** Devuelve detalles tipados incluso cuando el servidor omite campos opcionales. */
export function obtenerErrores(error: unknown): DetalleErrorValidacion[] {
  const errores = cuerpoError(error)?.['errores'];
  if (!Array.isArray(errores)) return [];
  const detalles: unknown[] = errores;
  return detalles.map(leerDetalle);
}
