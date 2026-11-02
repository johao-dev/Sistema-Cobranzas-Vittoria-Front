export interface CentroCostoResumen {
  idCentroCosto: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  idTipoCentroCosto: number;
  codigoTipoCentroCosto: string | null;
  nombreTipoCentroCosto: string | null;
  idProyecto: number | null;
  nombreProyecto: string | null;
  activo: boolean;
  fechaCreacion: string | null;
  fechaModificacion: string | null;
}
