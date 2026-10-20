import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  RequerimientoDetalleItem,
  RequerimientoGetResponse,
} from '../../requerimientos/contratos-requerimientos';
import { OrdenCompraRequest } from '../contratos-ordenes-compra';
import { precioOrden } from '../datos-orden';

export function controlesItemOrden(item: RequerimientoDetalleItem) {
  return new FormGroup({
    idMaterial: new FormControl(item.idMaterial, { nonNullable: true }),
    cantidad: new FormControl(item.cantidad, { nonNullable: true }),
    especialidad: new FormControl(item.especialidad || '-', { nonNullable: true }),
    material: new FormControl(item.material || '-', { nonNullable: true }),
    unidadMedida: new FormControl(item.unidadMedida || '-', { nonNullable: true }),
    idProveedor: new FormControl<number | null>(null, Validators.required),
    precioUnitario: new FormControl<number | null>(null, Validators.min(0)),
  });
}

export type ControlesItemOrden = ReturnType<typeof controlesItemOrden>;
export type DatosItemOrden = ReturnType<ControlesItemOrden['getRawValue']>;

export function validarFormularioOrden(
  detalle: RequerimientoGetResponse,
  items: DatosItemOrden[],
): string {
  if (items.some((item) => item.precioUnitario != null && item.precioUnitario < 0))
    return 'El precio unitario no puede ser negativo.';

  if (items.some((item) => item.precioUnitario != null && !Number.isFinite(item.precioUnitario)))
    return 'Ingresa un precio unitario válido.';

  if (!detalle.requerimiento.idRequerimiento) return 'Debes seleccionar un RQ enviado a O.C.';

  if (!detalle.requerimiento.idProyecto) return 'Debes seleccionar proyecto.';

  if (!items.length) return 'La orden debe tener ítems.';

  if (items.some((item) => !item.idProveedor))
    return 'Debes seleccionar proveedor por cada material.';

  return '';
}

export function peticionOrden(
  detalle: RequerimientoGetResponse,
  numero: string,
  fecha: string,
  items: DatosItemOrden[],
): OrdenCompraRequest {
  return {
    numeroOrdenCompra: numero.trim(),
    idRequerimiento: detalle.requerimiento.idRequerimiento,
    fechaOrdenCompra: fecha,
    descripcion: '',
    idUsuarioCreacion: detalle.requerimiento.idUsuarioSolicitante ?? null,
    rutaPdf: '',
    items: items.map((item) => ({
      idMaterial: item.idMaterial,
      cantidad: item.cantidad,
      idProveedor: item.idProveedor ?? 0,
      precioUnitario: precioOrden(item.precioUnitario),
    })),
  };
}
