import { borradorEntrada, peticionEntrada } from './datos-entrada';
import { entradaPrueba } from '../inventario.fixture';

describe('Entrada — preparación y validación', () => {
  it('conserva cero, fecha, ID y recorta campos opcionales', () => {
    const form = borradorEntrada({ ...entradaPrueba, observacion: '  Nota  ' });

    expect(peticionEntrada(form)).toMatchObject({
      idKardexEntrada: 1,
      cantidad: 0,
      fecha: '2026-10-20',
      observacion: 'Nota',
      numeroDocumento: null,
    });
    expect(peticionEntrada(form)).not.toHaveProperty('idEspecialidad');
    expect(entradaPrueba.observacion).toBeNull();
  });

  it('mantiene cantidad vacía como cero', () => {
    expect(peticionEntrada({ ...borradorEntrada(entradaPrueba), cantidad: null })).toMatchObject({
      cantidad: 0,
    });
  });

  it.each(['idEspecialidad', 'idMaterial', 'idProyecto'] as const)('exige %s', (campo) => {
    expect(typeof peticionEntrada({ ...borradorEntrada(entradaPrueba), [campo]: null })).toBe(
      'string',
    );
  });

  it.each([-1, NaN, Infinity])('rechaza cantidad %s', (cantidad) => {
    expect(peticionEntrada({ ...borradorEntrada(entradaPrueba), cantidad })).toContain(
      'mayor o igual',
    );
  });

  it('valida fecha y límites documentados', () => {
    const form = borradorEntrada(entradaPrueba);

    expect(peticionEntrada({ ...form, fecha: '' })).toContain('fecha');
    expect(peticionEntrada({ ...form, numeroDocumento: 'a'.repeat(51) })).toContain('50');
    expect(peticionEntrada({ ...form, observacion: 'a'.repeat(251) })).toContain('250');
  });
});
