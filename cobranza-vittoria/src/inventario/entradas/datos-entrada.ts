import { KardexEntradaCreateDto, KardexEntradaResponseDto } from '../contratos-inventario';
import { hoyInventario } from '../presentacion-inventario/datos-presentacion-inventario';

export interface BorradorEntrada {
  idKardexEntrada: number | null;
  idEspecialidad: number | null;
  idMaterial: number | null;
  idProveedor: number | null;
  idProyecto: number | null;
  numeroDocumento: string;
  fecha: string;
  cantidad: number | null;
  observacion: string;
}

export function borradorEntrada(entrada: KardexEntradaResponseDto | null): BorradorEntrada {
  return entrada
    ? {
        idKardexEntrada: entrada.idKardexEntrada,
        idEspecialidad: entrada.idEspecialidad,
        idMaterial: entrada.idMaterial,
        idProveedor: entrada.idProveedor,
        idProyecto: entrada.idProyecto,
        numeroDocumento: entrada.numeroDocumento ?? '',
        fecha: entrada.fecha,
        cantidad: entrada.cantidad,
        observacion: entrada.observacion ?? '',
      }
    : {
        idKardexEntrada: null,
        idEspecialidad: null,
        idMaterial: null,
        idProveedor: null,
        idProyecto: null,
        numeroDocumento: '',
        fecha: hoyInventario(),
        cantidad: 0,
        observacion: '',
      };
}

export function peticionEntrada(form: BorradorEntrada): KardexEntradaCreateDto | string {
  if (!form.idEspecialidad) return 'Debes seleccionar una especialidad.';
  if (!form.idMaterial) return 'Debes seleccionar un material.';
  if (!form.idProyecto) return 'Debes seleccionar un proyecto.';
  if (!form.fecha) return 'Debes seleccionar la fecha.';

  const cantidad = form.cantidad ?? 0;
  if (!Number.isFinite(cantidad) || cantidad < 0) return 'La cantidad debe ser mayor o igual a 0.';
  if (form.numeroDocumento.trim().length > 50)
    return 'El número de documento admite hasta 50 caracteres.';
  if (form.observacion.trim().length > 250) return 'La observación admite hasta 250 caracteres.';

  return {
    ...form,
    idEspecialidad: form.idEspecialidad,
    idMaterial: form.idMaterial,
    cantidad,
    numeroDocumento: form.numeroDocumento.trim() || null,
    observacion: form.observacion.trim() || null,
  };
}
