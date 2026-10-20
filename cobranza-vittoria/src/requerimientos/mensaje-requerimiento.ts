import { HttpErrorResponse } from '@angular/common/http';
import { extraerMensajeError } from '../app/core/utils/api-error.util';

/** Presenta el mensaje del servidor; los fallos de transporte usan el texto de la operación. */
export function mensajeRequerimiento(error: unknown, respaldo: string): string {
  const cuerpo: unknown = error instanceof HttpErrorResponse ? error.error : undefined;

  if (typeof cuerpo === 'string' && cuerpo.trim()) return cuerpo;

  return extraerMensajeError({ error: cuerpo }, respaldo);
}
