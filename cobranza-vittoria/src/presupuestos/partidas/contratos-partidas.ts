export interface PartidaCatalogo {
  idCatalogoPartida: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  idPartidaPadre: number | null;
  codigoPartidaPadre: string | null;
  nombrePartidaPadre: string | null;
  nivel: number;
  idTipoPartida: number;
  codigoTipoPartida: string | null;
  nombreTipoPartida: string | null;
  activo: boolean;
  esHoja: boolean;
  fechaCreacion: string | null;
  fechaActualizacion: string | null;
}
