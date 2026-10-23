import { FormArray, FormControl, FormGroup } from '@angular/forms';

import { CrearTransferenciaProyectoDto } from '../contratos-transferencias-proyecto';
import { hoyInventario } from '../../presentacion-inventario/datos-presentacion-inventario';

// Límite de operación de la UI; su validación en backend está pendiente.
export const MAX_MATERIALES_TRANSFERENCIA = 10;

export function controlesItemTransferencia() {
  return new FormGroup({
    idMaterial: new FormControl<number | null>(null),
    cantidad: new FormControl<number | null>(null),
  });
}

export function controlesTransferencia() {
  return new FormGroup({
    idProyectoOrigen: new FormControl<number | null>(null),
    idProyectoDestino: new FormControl<number | null>(null),
    fecha: new FormControl(hoyInventario(), { nonNullable: true }),
    observacion: new FormControl('', { nonNullable: true }),
    items: new FormArray<ReturnType<typeof controlesItemTransferencia>>([]),
  });
}

type BorradorTransferencia = ReturnType<ReturnType<typeof controlesTransferencia>['getRawValue']>;

export function peticionTransferencia(
  form: BorradorTransferencia,
): CrearTransferenciaProyectoDto | string {
  const { idProyectoOrigen, idProyectoDestino } = form;

  if (
    !idProyectoOrigen ||
    !idProyectoDestino ||
    !Number.isInteger(idProyectoOrigen) ||
    !Number.isInteger(idProyectoDestino) ||
    idProyectoOrigen <= 0 ||
    idProyectoDestino <= 0
  )
    return 'Seleccione el proyecto origen y el proyecto destino.';
  if (idProyectoOrigen === idProyectoDestino)
    return 'El proyecto origen y destino deben ser diferentes.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha)) return 'Indique una fecha válida.';
  if (form.observacion.trim().length > 500) return 'La observación admite hasta 500 caracteres.';
  if (!form.items.length) return 'Agregue al menos un material.';
  if (form.items.length > MAX_MATERIALES_TRANSFERENCIA)
    return `Una transferencia admite como máximo ${MAX_MATERIALES_TRANSFERENCIA} materiales.`;

  const items: CrearTransferenciaProyectoDto['items'] = [];
  const materiales = new Set<number>();

  for (const item of form.items) {
    if (!item.idMaterial || !Number.isInteger(item.idMaterial) || item.idMaterial <= 0)
      return 'Seleccione el material de cada ítem.';
    if (materiales.has(item.idMaterial)) return 'No puede repetir un material en la transferencia.';
    if (item.cantidad === null || !Number.isFinite(item.cantidad) || item.cantidad <= 0)
      return 'La cantidad de cada material debe ser mayor a 0.';
    if (Math.abs(item.cantidad * 100 - Math.round(item.cantidad * 100)) > 0.000001)
      return 'La cantidad admite hasta dos decimales.';

    materiales.add(item.idMaterial);
    items.push({ idMaterial: item.idMaterial, cantidad: item.cantidad });
  }

  return {
    idProyectoOrigen,
    idProyectoDestino,
    fecha: form.fecha,
    observacion: form.observacion.trim(),
    items,
  };
}
