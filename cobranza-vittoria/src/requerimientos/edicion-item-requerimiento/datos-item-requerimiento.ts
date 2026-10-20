import { Material } from '../../catalogos/materiales/contratos-materiales';
import { Especialidad } from '../../catalogos/especialidades/contratos-especialidades';
import { SaldoPartida } from '../../app/models/consultas-presupuestarias.models';
import { DatosItemRequerimiento, ItemRequerimiento } from '../contratos-formulario-requerimiento';
import {
  RequerimientoDetalleItem,
  RequerimientoItemPatchRequest,
  RequerimientoItemResponse,
} from '../contratos-requerimientos';

export function itemVacio(): DatosItemRequerimiento {
  return {
    idEspecialidad: null,
    idMaterial: null,
    idPresupuestoDetalle: null,
    cantidad: 1,
    observacion: '',
  };
}

export function cambiosItemRequerimiento(
  original: ItemRequerimiento | null,
  datos: DatosItemRequerimiento,
): RequerimientoItemPatchRequest {
  const cambios: RequerimientoItemPatchRequest = {};

  if (!original) return cambios;

  if (datos.cantidad !== original.cantidad && datos.cantidad !== null)
    cambios.cantidad = datos.cantidad;

  if (datos.idPresupuestoDetalle !== (original.idPresupuestoDetalle ?? null))
    cambios.idPresupuestoDetalle = datos.idPresupuestoDetalle;

  if (datos.observacion !== (original.observacion ?? ''))
    cambios.observacion = datos.observacion || null;

  return cambios;
}

export function validarItemAlmacen(
  original: ItemRequerimiento | null,
  datos: DatosItemRequerimiento,
  items: ItemRequerimiento[],
): string {
  const cantidad = datos.cantidad;

  if (
    cantidad === null ||
    !Number.isFinite(cantidad) ||
    cantidad <= 0 ||
    cantidad !== Number(cantidad.toFixed(2))
  ) {
    return 'La cantidad es obligatoria, debe ser positiva y tener como máximo dos decimales.';
  }

  if (datos.observacion.length > 250) return 'La observación admite hasta 250 caracteres.';

  if (original && datos.idMaterial !== original.idMaterial)
    return 'El material no puede modificarse. Agrega otro ítem y elimina el anterior.';

  if (
    items.some(
      (item) =>
        item.idMaterial === datos.idMaterial &&
        (!original || item.idRequerimientoDetalle !== original.idRequerimientoDetalle),
    )
  ) {
    return 'El material ya existe en el requerimiento.';
  }

  return '';
}

export function getIdEspecialidad(valor: Material | Especialidad | undefined): number | null {
  return valor?.idEspecialidad ?? null;
}

export function getNombreEspecialidad(valor: Material | Especialidad | undefined): string {
  return valor ? ('nombre' in valor ? valor.nombre : (valor.especialidad ?? '')).trim() : '';
}

export function getIdMaterial(valor: Material | undefined): number | null {
  return valor?.idMaterial ?? null;
}

export function getDescripcionMaterial(valor: Material | undefined): string {
  return valor?.descripcion.trim() ?? '';
}

export function getUnidadMaterial(valor: Material | undefined): string {
  return valor?.unidadMedida.trim() || '-';
}

export function completarItemPersistido(
  persistido: RequerimientoItemResponse,
  anterior: RequerimientoDetalleItem | undefined,
  material: Material | undefined,
  partida: SaldoPartida | null,
): RequerimientoDetalleItem {
  // POST/PATCH no devuelven etiquetas. Se conservan hasta recuperar el detalle completo.
  return {
    ...anterior,
    ...persistido,
    material: anterior?.material ?? getDescripcionMaterial(material),
    idEspecialidad: anterior?.idEspecialidad ?? getIdEspecialidad(material),
    especialidad: anterior?.especialidad ?? getNombreEspecialidad(material),
    unidadMedida: anterior?.unidadMedida ?? getUnidadMaterial(material),
    codigoPartida:
      persistido.idPresupuestoDetalle === anterior?.idPresupuestoDetalle
        ? anterior?.codigoPartida
        : (partida?.codigoPartida ?? null),
    nombrePartida:
      persistido.idPresupuestoDetalle === anterior?.idPresupuestoDetalle
        ? anterior?.nombrePartida
        : (partida?.partida ?? null),
  };
}
