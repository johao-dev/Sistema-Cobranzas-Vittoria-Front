export interface DatosArbolPresupuestario {
  encabezado: EncabezadoArbol;
  totales: TotalesArbol;
  nodos: NodoArbol[];
}

export interface EncabezadoArbol {
  idCentroCosto: number;
  codigoCentroCosto: string | null;
  nombreCentroCosto: string | null;
  idPresupuesto: number | null;
  idPresupuestoVersion: number | null;
  estadoPresupuesto: string | null;
  codigoMoneda: string | null;
  simboloMoneda: string | null;
}

export interface TotalesArbol {
  montoPresupuestado: number;
  montoComprometido: number;
  montoEjecutado: number;
  saldoDisponible: number;
  porcentajeComprometido: number;
  porcentajeEjecutado: number;
  cantidadPartidas: number;
  partidasExcedidas: number;
}

export interface NodoArbol {
  idCatalogoPartida: number;
  codigo: string;
  nombre: string;
  idPartidaPadre: number | null;
  nivel: number;
  esHoja: boolean;
  cantidadHijas: number;
  cantidadHojas: number;
  idPresupuesto: number | null;
  idPresupuestoVersion: number | null;
  idPresupuestoDetalle: number | null;
  montoPresupuestado: number;
  montoComprometido: number;
  montoEjecutado: number;
  saldoDisponible: number;
  porcentajeComprometido: number;
  porcentajeEjecutado: number;
  excedido: boolean;
  partidasExcedidas: number;
}
