import { Presupuesto, VersionPresupuesto, DetallePresupuesto } from './contratos-presupuestos';

export function presupuestoPrueba(cambios: Partial<Presupuesto> = {}): Presupuesto {
  return {
    idPresupuesto: 10,
    codigo: '01.01',
    nombre: 'Concreto',
    descripcion: null,
    idCentroCosto: 5,
    codigoCentroCosto: null,
    centroCosto: null,
    idMoneda: 1,
    moneda: null,
    nombreMoneda: null,
    simboloMoneda: 'S/',
    fechaInicio: null,
    fechaFin: null,
    activo: true,
    fechaCreacion: null,
    fechaModificacion: null,
    idPresupuestoVersionAprobada: null,
    idPresupuestoVersionBorrador: null,
    cantidadAprobadas: 1,
    cantidadBorradores: 1,
    estadoElaboracion: null,
    ...cambios,
  };
}

export function versionPrueba(cambios: Partial<VersionPresupuesto> = {}): VersionPresupuesto {
  return {
    idPresupuestoVersion: 20,
    idPresupuesto: 10,
    numeroVersion: 1,
    estado: 'BORRADOR',
    nombreEstado: null,
    descripcion: null,
    motivoCambio: null,
    motivoAnulacion: null,
    fechaCreacion: null,
    fechaAprobacion: null,
    fechaAnulacion: null,
    usuarioCreacion: null,
    usuarioAprobacion: null,
    usuarioAnulacion: null,
    codigoPresupuesto: null,
    nombrePresupuesto: null,
    idCentroCosto: 5,
    idMoneda: 1,
    moneda: null,
    simboloMoneda: 'S/',
    ...cambios,
  };
}

export function detallePrueba(cambios: Partial<DetallePresupuesto> = {}): DetallePresupuesto {
  return {
    idPresupuestoDetalle: 30,
    idPresupuestoVersion: 20,
    idCatalogoPartida: 2,
    codigo: '01.01',
    nombre: 'Concreto',
    montoPresupuestado: 100,
    observacion: 'Incluye transporte',
    idPartidaPadre: null,
    nivel: 1,
    idTipoPartida: 1,
    codigoTipoPartida: null,
    nombreTipoPartida: null,
    partidaActiva: true,
    esHoja: true,
    fechaCreacion: null,
    fechaModificacion: null,
    ...cambios,
  };
}

import { PartidaCatalogo } from './partidas/contratos-partidas';

export function partidaPrueba(cambios: Partial<PartidaCatalogo> = {}): PartidaCatalogo {
  return {
    idCatalogoPartida: 2,
    codigo: '01.01',
    nombre: 'Concreto',
    descripcion: null,
    idPartidaPadre: null,
    codigoPartidaPadre: null,
    nombrePartidaPadre: null,
    nivel: 1,
    idTipoPartida: 1,
    codigoTipoPartida: null,
    nombreTipoPartida: null,
    activo: true,
    esHoja: true,
    fechaCreacion: null,
    fechaActualizacion: null,
    ...cambios,
  };
}

import { CentroCostoResumen } from './centros-costo/contratos-centros-costo';

export function centroPrueba(cambios: Partial<CentroCostoResumen> = {}): CentroCostoResumen {
  return {
    idCentroCosto: 5,
    codigo: '01.01',
    nombre: 'Concreto',
    descripcion: null,
    idTipoCentroCosto: 1,
    codigoTipoCentroCosto: null,
    nombreTipoCentroCosto: null,
    idProyecto: null,
    nombreProyecto: null,
    activo: true,
    fechaCreacion: null,
    fechaModificacion: null,
    ...cambios,
  };
}
