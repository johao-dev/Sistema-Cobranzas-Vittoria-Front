export type ImportModulo =
  | 'unidad-medida'
  | 'especialidad'
  | 'material'
  | 'proveedor'
  | 'proveedor-gasto'
  | 'proveedor-terreno'
  | 'categoria-gasto'
  | 'partida'
  | 'centro-costo'
  | 'gastos-directos';

export interface ImportModuloMeta {
  modulo: ImportModulo;
  titulo: string;
  tablaDestino: string;
  columnasRequeridas: string[];
  columnasOpcionales: string[];
  /**
   * Endpoints propios (relativos a la base de la API). Si se omiten se usa el
   * genérico /api/import/{modulo}. Los módulos con permisos propios, como el
   * catálogo de partidas, importan por su controlador autenticado.
   */
  urlImportar?: string;
  urlPlantilla?: string;
  extensiones?: readonly string[];
  maxFileSizeBytes?: number;
  maxRegistros?: number;
  instrucciones?: string;
  nombrePlantilla?: string;
  plantillaConFormato?: boolean;
  enviarUsuario?: boolean;
  permiso?: string;
}

export interface ImportResumen {
  totalFilas: number;
  filasValidas: number;
  filasInvalidas: number;
  filasInsertadas: number;
}

export interface ImportExito extends Partial<ImportResumen> {
  modulo: string;
  formato: 'CSV' | 'XLSX' | 'XLS' | string;
  filasInsertadas: number;
  ok?: boolean;
  resultado?: 'IMPORTADO' | 'RECHAZADO';
  errores?: ImportFilaError[];
}

export interface ResultadoImportacionGastosDirectos extends ImportExito {
  totalFilas: number;
  filasValidas: number;
  filasInvalidas: number;
  ok: boolean;
  resultado: 'IMPORTADO' | 'RECHAZADO';
  errores: ImportFilaError[];
}

export type ImportErrorCodigo =
  | 'EXTENSION_INVALIDA'
  | 'MIME_INVALIDO'
  | 'ARCHIVO_VACIO'
  | 'ENCABEZADOS_INCORRECTOS'
  | 'ARCHIVO_SIN_DATOS'
  | 'DEMASIADAS_FILAS'
  | 'MODULO_NO_SOPORTADO'
  | 'TAMANIO_EXCEDIDO'
  | 'FORMATO_INVALIDO'
  | 'ESTRUCTURA_INVALIDA'
  | 'FORMATO_PLANTILLA_INVALIDO'
  | 'PLANTILLA_NO_DISPONIBLE'
  | 'DATOS_INVALIDOS'
  | 'UNHANDLED_ERROR';

export type ImportFilaErrorCodigo =
  | 'CAMPO_REQUERIDO'
  | 'FORMATO_INVALIDO'
  | 'REGLA_NEGOCIO'
  | 'ERROR_VALIDACION'
  | 'VALOR_DUPLICADO_EN_ARCHIVO'
  | 'VALOR_YA_EXISTE_EN_BD'
  | 'FK_NO_EXISTE'
  // Importación de estructura jerárquica de presupuesto.
  | 'NIVELES_INVALIDOS'
  | 'PADRE_NO_EXISTE'
  | 'JERARQUIA_DISTINTA'
  | 'NOMBRE_DISTINTO'
  | 'PADRE_CON_MONTO'
  | 'LIMITE_REGISTROS';

export interface ImportFilaError {
  fila: number;
  campo: string;
  codigoError: ImportFilaErrorCodigo;
  mensaje: string;
}

/**
 * Estructura de detalle de error de fila para la versión v2 del endpoint
 * de importación de Materiales. El backend envía un arreglo `detalles[]`
 * con la fila del archivo y el mensaje legible.
 */
export interface ImportDetalleFila {
  _fila: number;
  mensaje: string;
}

export interface ImportErrorResponse extends Partial<ImportResumen> {
  ok: false;
  error: ImportErrorCodigo;
  message: string;
  errores?: ImportFilaError[];
  detalles?: ImportDetalleFila[];
  resultado?: 'RECHAZADO';
}

export type ImportResultado =
  | { ok: true; data: ImportExito }
  | { ok: false; httpStatus: number; error: ImportErrorResponse };

export interface DescargarPlantillaResultado {
  ok: boolean;
  message?: string;
}

export const MATERIAL_PLANTILLA_FORMATOS = ['xlsx', 'csv'] as const;
export type MaterialPlantillaFormato = (typeof MATERIAL_PLANTILLA_FORMATOS)[number];
