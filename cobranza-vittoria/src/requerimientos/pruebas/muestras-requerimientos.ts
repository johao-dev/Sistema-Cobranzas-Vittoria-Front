import { RequerimientoGetResponse } from '../contratos-requerimientos';
import { Material } from '../../catalogos/materiales/contratos-materiales';

export function muestraRequerimiento(): RequerimientoGetResponse {
  return {
    requerimiento: {
      idRequerimiento: 45,
      numeroRequerimiento: 'RQ-45',
      fechaRequerimiento: '2026-10-20T00:00:00Z',
      fechaEntrega: null,
      idProyecto: 6,
      nombreProyecto: 'Obra',
      estado: 'Registrado',
      solicitante: 'Residente',
    },
    items: [
      {
        idRequerimientoDetalle: 710,
        idRequerimiento: 45,
        idMaterial: 93,
        material: 'Cemento',
        cantidad: 2.5,
        idEspecialidad: 4,
        especialidad: 'Estructuras',
        unidadMedida: 'BOL',
        observacion: null,
      },
    ],
    validaciones: [],
    puedeEditar: true,
  };
}

export function muestraMaterial(): Material {
  return {
    idMaterial: 93,
    idEspecialidad: 4,
    descripcion: 'Cemento',
    unidadMedida: 'BOL',
    stockMinimo: 0,
    activo: true,
    idCatalogoPartida: 10,
  };
}

/** jsdom no implementa la apertura nativa; el navegador conserva la gestión de foco. */
export function simularDialogosRequerimiento(): () => void {
  const original = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');

  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement): void {
      this.open = true;
    },
  });

  return () => {
    if (original) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', original);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  };
}
