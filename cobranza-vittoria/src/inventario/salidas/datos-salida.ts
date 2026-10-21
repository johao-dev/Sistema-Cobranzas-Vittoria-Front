import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { KardexSalidaCreateDto, KardexSalidaResponseDto } from '../contratos-inventario';
import { Material } from '../../catalogos/materiales/contratos-materiales';
import { hoyInventario } from '../presentacion-inventario/datos-presentacion-inventario';

export interface ItemBorradorSalida {
  idMaterial: number;
  codigoMaterial: string;
  nombre: string;
  unidadMedida: string;
  cantidad: number;
  observacion: string;
}

export function itemDesdeSalida(
  fila: KardexSalidaResponseDto,
  materiales: readonly Material[],
): ItemBorradorSalida {
  const material = materiales.find((m) => m.idMaterial === fila.idMaterial);

  return {
    idMaterial: fila.idMaterial,
    codigoMaterial: fila.codigoMaterial || material?.codigo || '',
    nombre: fila.nombre || material?.descripcion || '',
    unidadMedida: material?.unidadMedida || '',
    cantidad: fila.cantidad,
    observacion: fila.detalleObservacion ?? '',
  };
}

export function controlesItemSalida(item: ItemBorradorSalida) {
  return new FormGroup({
    idMaterial: new FormControl(item.idMaterial, { nonNullable: true }),
    codigoMaterial: new FormControl(item.codigoMaterial, { nonNullable: true }),
    nombre: new FormControl(item.nombre, { nonNullable: true }),
    unidadMedida: new FormControl(item.unidadMedida, { nonNullable: true }),
    cantidad: new FormControl(item.cantidad, {
      nonNullable: true,
      validators: [Validators.min(0)],
    }),
    observacion: new FormControl(item.observacion, {
      nonNullable: true,
      validators: [Validators.maxLength(250)],
    }),
  });
}

export function controlesSalida() {
  return new FormGroup({
    idKardexSalida: new FormControl<number | null>(null),
    idProyecto: new FormControl<number | null>(null, Validators.required),
    numeroDocumento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(50)],
    }),
    fecha: new FormControl(hoyInventario(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    solicitante: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    observacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(250)],
    }),
    items: new FormArray<ReturnType<typeof controlesItemSalida>>([]),
  });
}

export function peticionSalida(
  form: ReturnType<ReturnType<typeof controlesSalida>['getRawValue']>,
): KardexSalidaCreateDto | string {
  if (!form.idProyecto) return 'Debes seleccionar un proyecto.';

  const solicitante = form.solicitante.trim();
  if (!solicitante) return 'Debes ingresar el solicitante.';
  if (solicitante.length > 150) return 'El solicitante admite hasta 150 caracteres.';
  if (!form.fecha) return 'Debes seleccionar la fecha.';
  if (!form.items.length) return 'Debes agregar al menos un ítem con material y cantidad.';
  if (form.items.some((it) => !it.idMaterial || !Number.isFinite(it.cantidad) || it.cantidad < 0))
    return 'Revisa los ítems: cada uno debe tener material y cantidad mayor o igual a 0.';
  if (form.numeroDocumento.trim().length > 50)
    return 'El número de documento admite hasta 50 caracteres.';
  if (
    form.observacion.trim().length > 250 ||
    form.items.some((it) => it.observacion.trim().length > 250)
  )
    return 'Las observaciones admiten hasta 250 caracteres.';

  return {
    idKardexSalida: form.idKardexSalida,
    idProyecto: form.idProyecto,
    fecha: form.fecha,
    solicitante,
    numeroDocumento: form.numeroDocumento.trim() || null,
    observacion: form.observacion.trim() || null,
    items: form.items.map((it) => ({
      idMaterial: it.idMaterial,
      cantidad: it.cantidad,
      observacion: it.observacion.trim() || null,
    })),
  };
}
