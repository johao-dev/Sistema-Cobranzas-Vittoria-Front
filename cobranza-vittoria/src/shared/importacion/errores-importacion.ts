import { HttpErrorResponse } from '@angular/common/http';
import { extraerMensajeError } from '../errores-api/mensajes-error-api';
import {
  ImportDetalleFila,
  ImportErrorCodigo,
  ImportErrorResponse,
  ImportFilaError,
  ImportFilaErrorCodigo,
  ImportModulo,
} from './contratos-importacion';
import { IMPORT_MODULOS_META, MAX_FILE_SIZE_BYTES } from './metadatos-importacion';

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function contador(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : undefined;
}

function codigoError(valor: unknown): ImportErrorCodigo {
  switch (valor) {
    case 'EXTENSION_INVALIDA':
    case 'MIME_INVALIDO':
    case 'ARCHIVO_VACIO':
    case 'ENCABEZADOS_INCORRECTOS':
    case 'ARCHIVO_SIN_DATOS':
    case 'DEMASIADAS_FILAS':
    case 'MODULO_NO_SOPORTADO':
    case 'TAMANIO_EXCEDIDO':
    case 'FORMATO_INVALIDO':
    case 'ESTRUCTURA_INVALIDA':
    case 'FORMATO_PLANTILLA_INVALIDO':
    case 'PLANTILLA_NO_DISPONIBLE':
    case 'DATOS_INVALIDOS':
      return valor;
    default:
      return 'UNHANDLED_ERROR';
  }
}

function esCodigoFila(valor: unknown): valor is ImportFilaErrorCodigo {
  switch (valor) {
    case 'CAMPO_REQUERIDO':
    case 'FORMATO_INVALIDO':
    case 'REGLA_NEGOCIO':
    case 'ERROR_VALIDACION':
    case 'VALOR_DUPLICADO_EN_ARCHIVO':
    case 'VALOR_YA_EXISTE_EN_BD':
    case 'FK_NO_EXISTE':
    case 'NIVELES_INVALIDOS':
    case 'PADRE_NO_EXISTE':
    case 'JERARQUIA_DISTINTA':
    case 'NOMBRE_DISTINTO':
    case 'PADRE_CON_MONTO':
    case 'LIMITE_REGISTROS':
      return true;
    default:
      return false;
  }
}

function esErrorFila(valor: unknown): valor is ImportFilaError {
  return (
    esRegistro(valor) &&
    contador(valor['fila']) !== undefined &&
    typeof valor['campo'] === 'string' &&
    esCodigoFila(valor['codigoError']) &&
    typeof valor['mensaje'] === 'string'
  );
}

function esDetalleFila(valor: unknown): valor is ImportDetalleFila {
  return (
    esRegistro(valor) &&
    contador(valor['_fila']) !== undefined &&
    typeof valor['mensaje'] === 'string'
  );
}

function leerFilas<T>(valor: unknown, validar: (fila: unknown) => fila is T): T[] | undefined {
  if (!Array.isArray(valor)) return undefined;

  const filas: unknown[] = valor;
  return filas.filter(validar);
}

export function mensajeImportacion(cuerpo: unknown, respaldo: string): string {
  const mensaje = extraerMensajeError({ error: cuerpo }, respaldo);
  return /<[^>]+>/.test(mensaje) ? respaldo : mensaje;
}

/** El error HTTP es una frontera desconocida; no se presupone que contenga el DTO. */
export function normalizarErrorImportacion(
  error: unknown,
  modulo: ImportModulo,
): { ok: false; httpStatus: number; error: ImportErrorResponse } {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  const cuerpo: unknown = error instanceof HttpErrorResponse ? error.error : null;
  const datos = esRegistro(cuerpo) && !(cuerpo instanceof Blob) ? cuerpo : {};
  const limiteMb =
    (IMPORT_MODULOS_META[modulo].maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES) / (1024 * 1024);
  const message =
    status === 413
      ? `El archivo supera el tamaño máximo permitido de ${limiteMb} MB.`
      : status === 0 || status >= 500
        ? 'Ocurrió un error inesperado.'
        : mensajeImportacion({ message: datos['message'] }, 'No se pudo importar el archivo.');

  return {
    ok: false,
    httpStatus: status,
    error: {
      ok: false,
      error: codigoError(datos['error']),
      message,
      errores: status === 422 ? leerFilas(datos['errores'], esErrorFila) : undefined,
      detalles: status === 422 ? leerFilas(datos['detalles'], esDetalleFila) : undefined,
      totalFilas: contador(datos['totalFilas']),
      filasValidas: contador(datos['filasValidas']),
      filasInvalidas: contador(datos['filasInvalidas']),
      filasInsertadas: contador(datos['filasInsertadas']),
      resultado: datos['resultado'] === 'RECHAZADO' ? 'RECHAZADO' : undefined,
    },
  };
}
