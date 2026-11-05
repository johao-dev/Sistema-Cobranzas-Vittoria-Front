import { HttpErrorResponse } from '@angular/common/http';
import { esCodigoError, extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';

export function mensajeErrorConsultaPresupuestaria(error: unknown, fallback: string): string {
  const codigo: unknown = error instanceof HttpErrorResponse ? error.error?.error : undefined;
  if (codigo === 'MONEDAS_MIXTAS' || esCodigoError(error, 'MONEDAS_MIXTAS')) {
    return 'Los presupuestos seleccionados usan monedas distintas. Selecciona un presupuesto para consultar sus importes sin mezclar monedas.';
  }
  if (codigo === 'FILTROS_INCOMPATIBLES' || esCodigoError(error, 'FILTROS_INCOMPATIBLES')) {
    return 'La consulta consolidada no admite filtros de versión o estado. Vuelve a seleccionar el centro de costo y el presupuesto.';
  }
  if (error instanceof HttpErrorResponse && error.status === 401) {
    return 'La sesión no es válida. Inicia sesión para realizar esta consulta.';
  }
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return 'No tienes los permisos necesarios para realizar esta consulta.';
  }
  if (error instanceof HttpErrorResponse && error.status === 404) {
    return extraerMensajeError(
      { error: error.error },
      'No se encontró el presupuesto o la partida seleccionada.',
    );
  }
  return extraerMensajeError(error, fallback);
}
