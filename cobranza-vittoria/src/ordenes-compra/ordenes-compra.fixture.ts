import { RequerimientoGetResponse } from '../requerimientos/contratos-requerimientos';
import { DetalleOrdenCompra, OrdenCompra } from './contratos-ordenes-compra';

export const requerimientoPrueba: RequerimientoGetResponse = {
  requerimiento: {
    idRequerimiento: 4,
    numeroRequerimiento: 'RQ-4',
    fechaRequerimiento: '2026-10-20',
    fechaEntrega: null,
    idProyecto: 6,
    nombreProyecto: 'Obra',
    idUsuarioSolicitante: 7,
    solicitante: '  Ingeniero de Obra  ',
    estado: 'EnviadoOC',
  },
  items: [
    {
      idRequerimientoDetalle: 1,
      idRequerimiento: 4,
      idMaterial: 10,
      material: 'Cemento',
      especialidad: 'Estructuras',
      unidadMedida: 'BOL',
      cantidad: 2.5,
    },
    {
      idRequerimientoDetalle: 2,
      idRequerimiento: 4,
      idMaterial: 20,
      material: 'Acero',
      especialidad: 'Estructuras',
      unidadMedida: 'KG',
      cantidad: 3,
    },
  ],
  validaciones: [],
  puedeEditar: false,
};

export const ordenPrueba: OrdenCompra = {
  idOrdenCompra: 8,
  numeroOrdenCompra: 'OC-8',
  idRequerimiento: 4,
  idMoneda: 2,
  numeroRequerimiento: 'RQ-4',
  proveedores: 'Alfa, Beta',
  especialidades: 'Estructuras',
  idProyecto: 6,
  nombreProyecto: 'Obra',
  fechaOrdenCompra: '2026-10-20',
  fechaCreacion: '2026-10-20',
  descripcion: null,
  rutaPdf: null,
  idUsuarioCreacion: 7,
  total: 150,
  estado: 'REGISTRADA',
  codigoMoneda: 'USD',
  simboloMoneda: '$',
};

export const detallePrueba: DetalleOrdenCompra = {
  ordenCompra: ordenPrueba,
  historial: [],
  items: [' Beta ', 'Alfa', 'Beta'].map((proveedor, indice) => ({
    idOrdenCompraDetalle: indice + 1,
    idOrdenCompra: 8,
    idMaterial: indice + 10,
    idProveedor: indice + 30,
    proveedor,
    material: 'Material ' + indice,
    especialidad: null,
    unidadMedida: 'KG',
    cantidad: 2,
    precioUnitario: 25,
    subtotal: 50,
  })),
};
