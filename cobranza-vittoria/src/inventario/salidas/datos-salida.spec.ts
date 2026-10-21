import {
  controlesSalida,
  controlesItemSalida,
  itemDesdeSalida,
  peticionSalida,
} from './datos-salida';
import { materialesPrueba, salidasPrueba } from '../inventario.fixture';

describe('Salida — controles y DTO tipados', () => {
  function formulario() {
    const form = controlesSalida();

    form.patchValue({
      idKardexSalida: 4,
      idProyecto: 3,
      fecha: '2026-10-20',
      solicitante: '  José  ',
    });
    salidasPrueba.forEach((row) =>
      form.controls.items.push(controlesItemSalida(itemDesdeSalida(row, materialesPrueba))),
    );
    return form;
  }

  it('mantiene todos los materiales, cantidad cero, IDs y observación por ítem', () => {
    const form = formulario();

    expect(form.controls.items.getRawValue()[0]).toMatchObject({
      unidadMedida: 'M',
      observacion: 'Ítem',
      cantidad: 0,
    });
    expect(peticionSalida(form.getRawValue())).not.toHaveProperty('idEspecialidad');
    expect(peticionSalida(form.getRawValue())).toMatchObject({
      idKardexSalida: 4,
      solicitante: 'José',
      fecha: '2026-10-20',
      items: [
        { idMaterial: 10, cantidad: 0, observacion: 'Ítem' },
        { idMaterial: 11, cantidad: 2, observacion: 'Ítem' },
      ],
    });
  });

  it('exige proyecto, solicitante y al menos un ítem', () => {
    const form = formulario();

    form.controls.idProyecto.setValue(null);

    expect(peticionSalida(form.getRawValue())).toContain('proyecto');
    form.controls.idProyecto.setValue(3);
    form.controls.solicitante.setValue(' ');

    expect(peticionSalida(form.getRawValue())).toContain('solicitante');
    form.controls.solicitante.setValue('José');
    form.controls.items.clear();

    expect(peticionSalida(form.getRawValue())).toContain('al menos');
  });

  it.each([-1, NaN, Infinity])('rechaza cantidad inválida %s', (cantidad) => {
    const form = formulario();

    form.controls.items.at(0).controls.cantidad.setValue(cantidad);

    expect(typeof peticionSalida(form.getRawValue())).toBe('string');
  });

  it('aplica longitudes de solicitante, documento y observación de ítem', () => {
    const form = formulario();

    form.controls.solicitante.setValue('a'.repeat(151));

    expect(peticionSalida(form.getRawValue())).toContain('150');
    form.controls.solicitante.setValue('José');
    form.controls.numeroDocumento.setValue('a'.repeat(51));

    expect(peticionSalida(form.getRawValue())).toContain('50');
    form.controls.numeroDocumento.setValue('');
    form.controls.items.at(0).controls.observacion.setValue('a'.repeat(251));

    expect(peticionSalida(form.getRawValue())).toContain('250');
  });
});
