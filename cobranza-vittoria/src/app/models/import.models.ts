export type ImportModulo =
  | 'unidad-medida'
  | 'especialidad'
  | 'material'
  | 'proveedor'
  | 'proveedor-gasto'
  | 'proveedor-terreno'
  | 'categoria-gasto';

export interface ImportModuloMeta {
  modulo: ImportModulo;
  titulo: string;
  tablaDestino: string;
  columnasRequeridas: string[];
  columnasOpcionales: string[];
}

export interface ImportExito {
  modulo: string;
  formato: 'CSV' | 'XLSX' | 'XLS' | string;
  filasInsertadas: number;
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
  | 'DATOS_INVALIDOS'
  | 'UNHANDLED_ERROR';

export type ImportFilaErrorCodigo =
  | 'CAMPO_REQUERIDO'
  | 'FORMATO_INVALIDO'
  | 'REGLA_NEGOCIO'
  | 'ERROR_VALIDACION'
  | 'VALOR_DUPLICADO_EN_ARCHIVO'
  | 'VALOR_YA_EXISTE_EN_BD';

export interface ImportFilaError {
  fila: number;
  campo: string;
  codigoError: ImportFilaErrorCodigo;
  mensaje: string;
}

export interface ImportErrorResponse {
  ok: false;
  error: ImportErrorCodigo;
  message: string;
  errores?: ImportFilaError[];
}

export type ImportResultado =
  | { ok: true; data: ImportExito }
  | { ok: false; httpStatus: number; error: ImportErrorResponse };

export const IMPORT_MODULOS_META: Record<ImportModulo, ImportModuloMeta> = {
  'unidad-medida': {
    modulo: 'unidad-medida',
    titulo: 'Unidades de medida',
    tablaDestino: 'maestra.UnidadMedida',
    columnasRequeridas: ['Codigo', 'Nombre'],
    columnasOpcionales: ['Activo']
  },
  'especialidad': {
    modulo: 'especialidad',
    titulo: 'Especialidades',
    tablaDestino: 'maestra.Especialidad',
    columnasRequeridas: ['Nombre'],
    columnasOpcionales: ['Descripcion', 'Activo']
  },
  'material': {
    modulo: 'material',
    titulo: 'Materiales',
    tablaDestino: 'maestra.Material',
    columnasRequeridas: ['IdEspecialidad', 'Descripcion', 'UnidadMedida'],
    columnasOpcionales: ['Codigo', 'StockMinimo', 'Activo', 'IdUnidadMedida', 'CodigoProveedor']
  },
  'proveedor': {
    modulo: 'proveedor',
    titulo: 'Proveedores',
    tablaDestino: 'maestra.Proveedor',
    columnasRequeridas: ['RazonSocial', 'Ruc'],
    columnasOpcionales: [
      'TrabajamosConProveedor',
      'Contacto',
      'Telefono',
      'Correo',
      'Direccion',
      'Banco',
      'CuentaCorriente',
      'CCI',
      'CuentaDetraccion',
      'Activo'
    ]
  },
  'proveedor-gasto': {
    modulo: 'proveedor-gasto',
    titulo: 'Proveedores de gasto',
    tablaDestino: 'maestra.ProveedorGastoAdministrativo',
    columnasRequeridas: ['RazonSocial'],
    columnasOpcionales: ['Ruc', 'Contacto', 'Telefono', 'Correo', 'IdCategoriaGasto', 'Activo']
  },
  'proveedor-terreno': {
    modulo: 'proveedor-terreno',
    titulo: 'Proveedores de terreno',
    tablaDestino: 'maestra.ProveedorTerreno',
    columnasRequeridas: ['RazonSocial'],
    columnasOpcionales: ['Ruc', 'Contacto', 'Telefono', 'Correo', 'Activo']
  },
  'categoria-gasto': {
    modulo: 'categoria-gasto',
    titulo: 'Categorías de gasto',
    tablaDestino: 'maestra.CategoriaGasto',
    columnasRequeridas: ['Nombre'],
    columnasOpcionales: ['Activo']
  }
};

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;
