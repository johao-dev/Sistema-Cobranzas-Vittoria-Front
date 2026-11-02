export interface TarjetaResumen {
  key: 'compras';
  label: string;
  value: number;
}

export interface EstadisticaMaterial {
  material: string;
  cantidad: number;
  monto: number;
  frecuencia: number;
}

export type MetricaMaterial = 'cantidad' | 'monto' | 'frecuencia';

export interface FilaGrafico {
  label: string;
  value: number;
  width: number;
}

export interface DatosDashboard {
  tarjetas: TarjetaResumen[];
  materiales: EstadisticaMaterial[];
  cargandoMateriales: boolean;
  errores: string[];
}
