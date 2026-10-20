import { RequerimientoDetalleItem } from './contratos-requerimientos';
import { Material } from '../catalogos/materiales/contratos-materiales';

export interface MaterialSeleccionado {
  materiales: Material[];
  idMaterial: number;
  idEspecialidad: number;
}

export interface DatosRequerimiento {
  numeroRequerimiento: string;
  fechaRequerimiento: string;
  idProyecto: number | null;
  descripcion: string;
  fechaEntrega: string;
  observacion: string;
  items: ItemRequerimiento[];
}

export interface DatosItemRequerimiento {
  idEspecialidad: number | null;
  idMaterial: number | null;
  idPresupuestoDetalle: number | null;
  cantidad: number | null;
  observacion: string;
}

/** Una línea nueva todavía no tiene el identificador que asignará el servidor. */
export type ItemRequerimiento = Omit<
  RequerimientoDetalleItem,
  'idRequerimientoDetalle' | 'idRequerimiento'
> & {
  idRequerimientoDetalle?: number;
};
