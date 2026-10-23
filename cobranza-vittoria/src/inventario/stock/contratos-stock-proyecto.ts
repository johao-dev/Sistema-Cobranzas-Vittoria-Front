import { KardexStockFiltroDto } from '../contratos-inventario';

export interface FiltrosStockProyecto extends KardexStockFiltroDto {
  idProyecto?: number | null;
  idMaterial?: number | null;
}

export interface StockProyecto {
  idStockProyecto: number;
  idProyecto: number;
  proyecto: string;
  idMaterial: number;
  codigoMaterial: string;
  nombre: string;
  unidadMedida: string;
  idEspecialidad: number;
  especialidad: string;
  stock: number;
  fechaUltimoMovimiento: string;
}
