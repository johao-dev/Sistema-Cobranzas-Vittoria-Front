export interface Tablero {
  encabezado: TableroEncabezado;
  resumen: TableroResumen;
  rubros: TableroRubro[];
  semanas: TableroPuntoSemana[];
  alCorte: TableroAlCorte;
  desviacionPorRubro: TableroDesviacionRubro[];
}

export interface TableroEncabezado {
  idCentroCosto: number;
  codigoCentroCosto: string;
  nombreCentroCosto: string;
  nombreProyecto: string | null;
  codigoMoneda: string | null;
  simboloMoneda: string | null;
  cantidadPresupuestos: number;
  fechaInicio: string;
  fechaFin: string;
  fechaCorte: string;
  tieneCronograma: boolean;
  nivel: number | null;
  nivelMaximo: number;
  rama: TableroRama[];
}

export interface TableroResumen {
  presupuestado: number;
  comprometido: number;
  ejecutado: number;
  desviacion: number;
  desviacionPorcentaje: number | null;
  porcentajeEjecutado: number | null;
}

export interface TableroRubro {
  idCatalogoPartida: number;
  codigo: string;
  nombre: string;
  presupuestado: number;
  comprometido: number;
  ejecutado: number;
  porcentajeDelTotal: number;
}

export interface TableroPuntoSemana {
  semana: number;
  fecha: string;
  realAcumulado: number | null;
  presupuestoAcumulado: number | null;
}

export interface TableroAlCorte {
  presupuestoAcumulado: number | null;
  realAcumulado: number;
  desviacion: number | null;
  desviacionPorcentaje: number | null;
}

export interface TableroDesviacionRubro {
  codigo: string;
  nombre: string;
  presupuestoAcumulado: number;
  realAcumulado: number;
  desviacion: number;
  desviacionPorcentaje: number | null;
}

export interface TableroRama {
  idCatalogoPartida: number;
  codigo: string;
  nombre: string;
  nivel: number;
}
