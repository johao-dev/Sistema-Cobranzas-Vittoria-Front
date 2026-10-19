import {
  CompraDetalleResponse,
  CompraFilaSql,
  CompraItemFilaSql,
} from '../../app/models/compras.models';
import { ValorizacionListado } from '../../app/models/valorizaciones.models';

export function crearCompra(cambios: Partial<CompraFilaSql> = {}): CompraFilaSql {
  return {
    IdCompra: 1,
    NumeroCompra: 'C-001',
    FechaCompra: '2026-10-19',
    Estado: 'REGISTRADA',
    Aceptada: false,
    IncluyeIGV: false,
    SubtotalSinIGV: 100,
    MontoIGV: 0,
    MontoTotal: 100,
    Observacion: null,
    IdOrdenCompra: 1,
    NumeroOrdenCompra: 'OC-001',
    IdMoneda: 1,
    CodigoMoneda: 'PEN',
    SimboloMoneda: 'S/',
    Proveedores: null,
    NumeroRequerimiento: 'R-001',
    NombreProyecto: 'Obra',
    Especialidades: 'Estructuras',
    ...cambios,
  };
}

export function crearItem(cambios: Partial<CompraItemFilaSql> = {}): CompraItemFilaSql {
  return {
    IdCompraDetalle: 1,
    IdCompra: 1,
    IdMaterial: 1,
    Material: 'Cemento',
    UnidadMedida: 'Bolsa',
    Cantidad: 2,
    PrecioUnitario: 15,
    Subtotal: 30,
    IdProveedor: null,
    Proveedor: null,
    ...cambios,
  };
}

export function crearDetalle(items: CompraItemFilaSql[] = [crearItem()]): CompraDetalleResponse {
  return { compra: crearCompra(), items, documentos: [] };
}

export function crearValorizacion(cambios: Partial<ValorizacionListado> = {}): ValorizacionListado {
  return {
    idValorizacion: 1,
    periodo: null,
    proyecto: null,
    proveedor: null,
    especialidad: null,
    empresa: null,
    servicio: null,
    moneda: 'PEN',
    cotizacion: 100,
    facturado: 80,
    transferido: 50,
    garantia: 5,
    detraccion: 3,
    resta: 20,
    liquidar: 30,
    ...cambios,
  };
}
