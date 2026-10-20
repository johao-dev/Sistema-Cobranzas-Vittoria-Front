import {
  prepararDatosRequerimiento,
  peticionRequerimiento,
  siguienteNumeroRequerimiento,
} from './datos-borrador-requerimiento';
import { muestraRequerimiento } from '../pruebas/muestras-requerimientos';

describe('Datos del borrador de requerimiento', () => {
  it('permite editar fechas y nulos sin modificar el detalle recibido del servidor', () => {
    const detalle = muestraRequerimiento();
    const copia = structuredClone(detalle);

    const datos = prepararDatosRequerimiento(detalle);

    expect(datos.fechaRequerimiento).toBe('2026-10-20');
    expect(datos.fechaEntrega).toBe('');
    expect(datos.items[0].observacion).toBe('');

    datos.items[0].cantidad = 9;

    expect(detalle).toEqual(copia);
  });

  it('envía fechas UTC y solo datos del contrato, conservando la imputación nullable', () => {
    const datos = prepararDatosRequerimiento(muestraRequerimiento());

    datos.fechaEntrega = '2026-10-23';
    datos.numeroRequerimiento = '  RQ-45  ';

    const copia = structuredClone(datos);

    expect(peticionRequerimiento(datos)).toEqual({
      numeroRequerimiento: 'RQ-45',
      fechaRequerimiento: '2026-10-20T00:00:00.000Z',
      fechaEntrega: '2026-10-23T00:00:00.000Z',
      idProyecto: 6,
      descripcion: '',
      observacion: '',
      items: [{ idMaterial: 93, cantidad: 2.5, idPresupuestoDetalle: null, observacion: '' }],
    });
    expect(datos).toEqual(copia);
  });

  it('mantiene la sugerencia histórica basada en todos los grupos numéricos del listado', () => {
    const muestra = muestraRequerimiento().requerimiento;

    expect(siguienteNumeroRequerimiento([])).toBe('1');
    expect(
      siguienteNumeroRequerimiento([
        { ...muestra, numeroRequerimiento: 'RQ-12-A-3' },
        { ...muestra, numeroRequerimiento: 'Sin número' },
      ]),
    ).toBe('124');
  });
});
