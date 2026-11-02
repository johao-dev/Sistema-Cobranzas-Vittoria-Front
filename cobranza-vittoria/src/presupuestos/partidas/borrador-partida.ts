export interface BorradorPartida {
  idCatalogoPartida?: number | null;
  codigo?: string;
  nombre: string;
  idTipoPartida: number | string;
  idPartidaPadre: number | string | null;
  descripcion: string | null;
  activo: boolean;
  esHoja?: boolean;
}
export interface FiltroPartidas {
  activo?: boolean | null;
  idTipoPartida?: number | null;
  idPartidaPadre?: number | null;
  soloRaices?: boolean | null;
  esHoja?: boolean | null;
  busqueda?: string | null;
}
