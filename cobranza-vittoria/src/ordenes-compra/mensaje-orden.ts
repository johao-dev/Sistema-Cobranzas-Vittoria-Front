import { HttpErrorResponse } from '@angular/common/http';
import { extraerMensajeError } from '../app/core/utils/api-error.util';

export function mensajeOrden(error: unknown, respaldo: string): string {
  const cuerpo: unknown = error instanceof HttpErrorResponse ? error.error : undefined;

  if (typeof cuerpo === 'string' && cuerpo.trim()) return cuerpo;

  return extraerMensajeError({ error: cuerpo }, respaldo);
}
