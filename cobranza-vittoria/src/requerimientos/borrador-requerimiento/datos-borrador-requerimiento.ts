import { DatosRequerimiento } from '../contratos-formulario-requerimiento';
import {
  RequerimientoGetResponse,
  RequerimientoRequest,
  RequerimientoResumen,
} from '../contratos-requerimientos';

export function borradorVacio(): DatosRequerimiento {
  return {
    numeroRequerimiento: '',
    fechaRequerimiento: '',
    idProyecto: null,
    descripcion: '',
    fechaEntrega: '',
    observacion: '',
    items: [],
  };
}

export function fechaActualRequerimiento(): string {
  const fecha = new Date();

  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function fechaParaControl(valor: string | null | undefined): string {
  if (!valor) return '';

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString().slice(0, 10);
}

export function siguienteNumeroRequerimiento(filas: RequerimientoResumen[]): string {
  const maximo = filas.reduce((maximo, fila) => {
    const partes = fila.numeroRequerimiento?.match(/\d+/g);

    return Math.max(maximo, partes?.length ? Number(partes.join('')) || 0 : 0);
  }, 0);

  return String(maximo + 1);
}

export function prepararDatosRequerimiento(detalle: RequerimientoGetResponse): DatosRequerimiento {
  const req = detalle.requerimiento;

  return {
    numeroRequerimiento: req.numeroRequerimiento ?? '',
    fechaRequerimiento: fechaParaControl(req.fechaRequerimiento),
    idProyecto: req.idProyecto ?? null,
    descripcion: req.descripcion ?? '',
    fechaEntrega: fechaParaControl(req.fechaEntrega),
    observacion: req.observacion ?? '',
    items: detalle.items.map((item) => ({
      idRequerimientoDetalle: item.idRequerimientoDetalle,
      idMaterial: item.idMaterial,
      idEspecialidad: item.idEspecialidad ?? null,
      especialidad: item.especialidad ?? '',
      material: item.material,
      unidadMedida: item.unidadMedida ?? '-',
      cantidad: Number(item.cantidad),
      observacion: item.observacion ?? '',
      idPresupuestoDetalle: item.idPresupuestoDetalle ?? null,
      codigoPartida: item.codigoPartida ?? null,
      nombrePartida: item.nombrePartida ?? null,
    })),
  };
}

export function validarBorradorRequerimiento(datos: DatosRequerimiento): string {
  if (!datos.idProyecto) return 'Debes seleccionar un proyecto.';

  if (!datos.fechaEntrega) return 'Debes ingresar la fecha de entrega.';

  if (!datos.items.length) return 'Debes agregar al menos un ítem.';

  return '';
}

export function peticionRequerimiento(datos: DatosRequerimiento): RequerimientoRequest {
  // Se conserva la medianoche UTC del contrato de los controles date existentes.
  return {
    numeroRequerimiento: datos.numeroRequerimiento.trim(),
    fechaRequerimiento: new Date(`${datos.fechaRequerimiento}T00:00:00.000Z`).toISOString(),
    idProyecto: Number(datos.idProyecto),
    descripcion: datos.descripcion ?? '',
    fechaEntrega: new Date(`${datos.fechaEntrega}T00:00:00.000Z`).toISOString(),
    observacion: datos.observacion ?? '',
    items: datos.items.map((item) => ({
      idMaterial: Number(item.idMaterial),
      cantidad: Number(item.cantidad),
      observacion: item.observacion ?? '',
      idPresupuestoDetalle:
        item.idPresupuestoDetalle != null ? Number(item.idPresupuestoDetalle) : null,
    })),
  };
}
