export interface BorradorCentroCosto {
  idCentroCosto?: number | null;
  codigo?: string;
  nombre: string;
  idTipoCentroCosto?: number | string;
  idProyecto: number | string | null;
  descripcion: string | null;
  activo: boolean;
}
