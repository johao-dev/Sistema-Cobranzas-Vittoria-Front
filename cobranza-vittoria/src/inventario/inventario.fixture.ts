import {
  KardexEntradaResponseDto,
  KardexSalidaResponseDto,
  KardexStockActualResponseDto,
} from './contratos-inventario';
import { MovimientoCompra } from './kardex-compras/contratos-kardex-compras';
import { Material } from '../catalogos/materiales/contratos-materiales';

export const entradaPrueba: KardexEntradaResponseDto = {
  idKardexEntrada: 1,
  idEspecialidad: 2,
  especialidad: 'Eléctrica',
  idMaterial: 10,
  codigoMaterial: 'C10',
  nombre: 'Cable',
  idProveedor: null,
  proveedor: null,
  idProyecto: 3,
  proyecto: 'Obra',
  numeroDocumento: null,
  fecha: '2026-10-20',
  cantidad: 0,
  observacion: null,
  fechaCreacion: '2026-10-20',
};

export const salidaPrueba: KardexSalidaResponseDto = {
  idKardexSalida: 4,
  idEspecialidad: 2,
  especialidad: 'Eléctrica',
  idProyecto: 3,
  proyecto: 'Obra',
  numeroDocumento: 'S-1',
  fecha: '2026-10-20',
  solicitante: 'José',
  observacion: 'General',
  idKardexSalidaDetalle: 1,
  idMaterial: 10,
  codigoMaterial: 'C10',
  nombre: 'Cable',
  cantidad: 0,
  detalleObservacion: 'Ítem',
  fechaCreacion: '2026-10-20',
};

export const salidasPrueba: KardexSalidaResponseDto[] = [
  salidaPrueba,
  {
    ...salidaPrueba,
    idKardexSalidaDetalle: 2,
    idMaterial: 11,
    codigoMaterial: 'T11',
    nombre: 'Tubo',
    cantidad: 2,
  },
];

export const stockPrueba: KardexStockActualResponseDto = {
  idKardexStock: 8,
  idMaterial: 10,
  codigoMaterial: 'C10',
  nombre: 'Cañería',
  unidadMedida: 'M',
  idEspecialidad: 2,
  especialidad: 'Eléctrica',
  totalEntrada: 10,
  totalSalida: 4,
  stock: 6,
  fechaUltimaMovimiento: '2026-10-20',
};

export const movimientoPrueba: MovimientoCompra = {
  IdCompra: 9,
  NumeroCompra: 'CP-9',
  NumeroRequerimiento: 'RQ-1',
  IdMaterial: 10,
  IdEspecialidad: 2,
  Especialidad: 'Eléctrica',
  FechaMovimiento: '2026-10-20',
  Material: 'Cable',
  Entrada: 10,
  Salida: 4,
  Stock: 6,
  Observacion: '',
};

export const materialesPrueba: Material[] = [
  {
    idMaterial: 10,
    idEspecialidad: 2,
    descripcion: 'Cable',
    codigo: 'C10',
    unidadMedida: 'M',
    stockMinimo: 0,
    activo: true,
  },
  {
    idMaterial: 11,
    idEspecialidad: 2,
    descripcion: 'Tubo',
    codigo: 'T11',
    unidadMedida: 'UND',
    stockMinimo: 0,
    activo: true,
  },
  {
    idMaterial: 12,
    idEspecialidad: 5,
    descripcion: 'Cemento',
    codigo: 'C12',
    unidadMedida: 'BOL',
    stockMinimo: 0,
    activo: true,
  },
];
