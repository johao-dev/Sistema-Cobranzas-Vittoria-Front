export interface ValorizacionConfiguracion {
  idConfiguracion: number;
  idProyecto: number;
  proyecto?: string | null;
  idProveedor: number;
  proveedor?: string | null;
  idEspecialidad: number;
  especialidad?: string | null;
  servicio: string;
  moneda: string;
  montoCotizacion: number;
  porcentajeGarantia?: number;
  porcentajeDetraccion?: number;
}

export interface ValorizacionCabecera {
  idValorizacion: number;
  idConfiguracion: number;
  periodo: string;
  observacion?: string | null;
  proveedor?: string | null;
  especialidad?: string | null;
  proyecto?: string | null;
  servicio?: string | null;
  moneda?: string | null;
  montoCotizacion?: number;
  porcentajeGarantia?: number;
  porcentajeDetraccion?: number;
}

export interface ValorizacionDetalle {
  idDetalle: number;
  fechaFactura?: string | null;
  numeroFactura?: string | null;
  baseImponible?: number;
  igv?: number;
  montoFactura: number;
  descripcion?: string | null;
  detraccion?: number;
  garantia?: number;
  otrosDescuentos?: number;
  aAbonar?: number;
  fechaTransferencia?: string | null;
  numeroOperacion?: string | null;
  bancoTransferencia?: string | null;
  bancoDestino?: string | null;
  montoTransferido?: number;
  aFavor?: number;
  deuda?: number;
  porcentajeAvance?: number;
  porcentajeAcumulado?: number;
  porcentajeInicial?: number;
  porcentajeFinal?: number;
}

export interface ValorizacionResumen {
  cotizacion?: number;
  garantia?: number;
  facturado?: number;
  transferido?: number;
  resta?: number;
  liquidar?: number;
}

export interface ValorizacionListado {
  idValorizacion: number | null;
  periodo: string | null;
  proyecto: string | null;
  proveedor: string | null;
  especialidad: string | null;
  empresa: string | null;
  servicio: string | null;
  moneda: string | null;
  cotizacion: number;
  facturado: number;
  transferido: number;
  garantia: number;
  detraccion: number;
  resta: number;
  liquidar: number;
}

export interface FiltrosValorizacion {
  idProyecto?: number | null;
  idProveedor?: number | null;
  idEspecialidad?: number | null;
}
