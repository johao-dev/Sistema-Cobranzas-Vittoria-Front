export type ImportModulo =
  | 'unidad-medida'
  | 'especialidad'
  | 'material'
  | 'proveedor'
  | 'proveedor-gasto'
  | 'proveedor-terreno'
  | 'categoria-gasto'
  | 'partida'
  | 'centro-costo';

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
  | 'PADRE_CON_MONTO';

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

export interface ImportErrorResponse {
  ok: false;
  error: ImportErrorCodigo;
  message: string;
  errores?: ImportFilaError[];
  detalles?: ImportDetalleFila[];
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
    columnasRequeridas: ['Especialidad', 'Nombre', 'UnidadMedida', 'Codigo'],
    columnasOpcionales: ['Partida']
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
  },
  'partida': {
    modulo: 'partida',
    titulo: 'Catálogo de partidas',
    tablaDestino: 'ControlPresupuestario.CatalogoPartida',
    columnasRequeridas: ['Codigo', 'Nombre', 'Tipo'],
    columnasOpcionales: ['CodigoPadre', 'Descripcion'],
    urlImportar: '/api/control-presupuestario/partidas/importar',
    urlPlantilla: '/api/control-presupuestario/partidas/plantilla'
  },
  'centro-costo': {
    modulo: 'centro-costo',
    titulo: 'Centros de costo',
    tablaDestino: 'ControlPresupuestario.CentroCosto',
    columnasRequeridas: ['Codigo', 'Nombre', 'Tipo'],
    columnasOpcionales: ['Proyecto', 'Descripcion'],
    urlImportar: '/api/control-presupuestario/centros-costo/importar',
    urlPlantilla: '/api/control-presupuestario/centros-costo/plantilla'
  }
};

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;

export const MATERIAL_PLANTILLA_FORMATOS = ['xlsx', 'csv'] as const;
export type MaterialPlantillaFormato = typeof MATERIAL_PLANTILLA_FORMATOS[number];
