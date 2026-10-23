import { TransferenciaProyecto } from '../contratos-transferencias-proyecto';

export const transferenciaPrueba: TransferenciaProyecto = {
  idTransferencia: 7,
  idProyectoOrigen: 3,
  proyectoOrigen: 'Obra',
  idProyectoDestino: 6,
  proyectoDestino: 'Destino',
  fecha: '2026-10-22T00:00:00',
  observacion: 'Reasignación autorizada',
  idTransferenciaProyectoDetalle: 8,
  idMaterial: 10,
  codigoMaterial: 'C10',
  nombre: 'Cable',
  unidadMedida: 'M',
  idEspecialidad: 2,
  especialidad: 'Eléctrica',
  cantidad: 3.25,
};

export const transferenciasPrueba: TransferenciaProyecto[] = [
  transferenciaPrueba,
  {
    ...transferenciaPrueba,
    idTransferenciaProyectoDetalle: 9,
    idMaterial: 11,
    codigoMaterial: 'T11',
    nombre: 'Tubo',
    cantidad: 1.15,
  },
];
