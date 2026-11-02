/** Los selectores con ngModel usan cadena vacía mientras no hay selección. */
export type IdSeleccionado = number | string;
export interface BorradorPresupuesto {
  idPresupuesto: number | null;
  idCentroCosto: IdSeleccionado;
  idMoneda: IdSeleccionado;
  codigo: string;
  nombre: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
}
export interface BorradorVersion {
  descripcion: string;
  motivoCambio: string;
}
export interface BorradorDetalle {
  idPresupuestoDetalle: number | null;
  idCatalogoPartida: IdSeleccionado;
  montoPresupuestado: number | null;
  observacion: string;
}
export interface BorradorAjuste {
  afectacion: 'COMPROMISO' | 'EJECUCION';
  direccion: 'INCREMENTO' | 'DECREMENTO';
  monto: number | null;
  observacion: string;
  fecha: string;
}
export interface MontoPartida {
  idCatalogoPartida: number;
  montoPresupuestado: number;
  observacion?: string | null;
}
