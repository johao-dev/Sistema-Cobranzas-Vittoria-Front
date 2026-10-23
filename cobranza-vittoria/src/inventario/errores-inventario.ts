import {
  esCodigoError,
  extraerMensajeError,
  obtenerErrores,
} from '../app/core/utils/api-error.util';

const MENSAJES_INVENTARIO: Readonly<Record<string, string>> = {
  STOCK_PROYECTO_NO_INICIALIZADO:
    'El stock por proyecto todavía no ha sido inicializado. Contacte al administrador.',
  STOCK_PROYECTO_INCONSISTENTE:
    'Se detectó una inconsistencia entre el stock global y el stock por proyecto. La operación no fue realizada.',
  PROYECTOS_IGUALES: 'El proyecto origen y destino deben ser diferentes.',
  INVENTARIO_OCUPADO: 'El inventario está ocupado. Espere unos segundos y vuelva a intentar.',
};

export function mensajeErrorInventario(error: unknown, respaldo: string): string {
  for (const [codigo, mensaje] of Object.entries(MENSAJES_INVENTARIO)) {
    if (esCodigoError(error, codigo)) return mensaje;
  }

  if (esCodigoError(error, 'STOCK_PROYECTO_INSUFICIENTE')) {
    const detalles = obtenerErrores(error)
      .filter((detalle) => detalle.codigoError === 'STOCK_PROYECTO_INSUFICIENTE')
      .map((detalle) =>
        detalle.mensaje
          .replace(/^STOCK_PROYECTO_INSUFICIENTE:\s*/i, '')
          .replace(/idMaterial=/g, 'Material (ID): ')
          .replace(/idProyecto=/g, 'Proyecto (ID): ')
          .replace(/disponible=/g, 'Disponible: ')
          .replace(/solicitado=/g, 'Solicitado: '),
      )
      .join(' ');

    return `No hay stock suficiente del material en el proyecto seleccionado. ${detalles}`.trim();
  }

  return extraerMensajeError(error, respaldo);
}
