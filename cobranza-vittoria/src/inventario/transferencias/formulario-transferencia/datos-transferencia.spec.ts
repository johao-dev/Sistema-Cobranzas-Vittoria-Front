import {
  controlesTransferencia,
  controlesItemTransferencia,
  peticionTransferencia,
} from './datos-transferencia';

function borradorValido() {
  const form = controlesTransferencia();

  form.patchValue({
    idProyectoOrigen: 3,
    idProyectoDestino: 6,
    fecha: '2026-10-22',
    observacion: '  Autorizada  ',
  });
  const item = controlesItemTransferencia();

  item.setValue({ idMaterial: 10, cantidad: 3.25 });
  form.controls.items.push(item);

  return form.getRawValue();
}

describe('Transferencias — validación y petición', () => {
  it('conserva cantidades y fecha y envía únicamente campos del contrato', () => {
    const form = borradorValido();

    form.items.push({ idMaterial: 11, cantidad: 1.15 });
    expect(peticionTransferencia(form)).toEqual({
      idProyectoOrigen: 3,
      idProyectoDestino: 6,
      fecha: '2026-10-22',
      observacion: 'Autorizada',
      items: [
        { idMaterial: 10, cantidad: 3.25 },
        { idMaterial: 11, cantidad: 1.15 },
      ],
    });
  });

  it.each(['idProyectoOrigen', 'idProyectoDestino'] as const)('exige %s', (campo) => {
    const form = borradorValido();

    form[campo] = null;
    expect(peticionTransferencia(form)).toContain('Seleccione el proyecto');
  });

  it('rechaza proyectos iguales', () => {
    const form = borradorValido();

    form.idProyectoDestino = 3;
    expect(peticionTransferencia(form)).toContain('deben ser diferentes');
  });

  it('rechaza una transferencia sin ítems', () => {
    const form = borradorValido();

    form.items = [];
    expect(peticionTransferencia(form)).toContain('al menos un material');
  });

  it.each([0, -1, null, NaN, Infinity])('rechaza cantidad %s', (cantidad) => {
    const form = borradorValido();

    form.items[0].cantidad = cantidad;
    expect(peticionTransferencia(form)).toContain('mayor a 0');
  });

  it('rechaza material duplicado', () => {
    const form = borradorValido();

    form.items.push({ idMaterial: 10, cantidad: 1 });
    expect(peticionTransferencia(form)).toContain('repetir un material');
  });

  it('rechaza material vacío y precisión incompatible sin redondear', () => {
    const form = borradorValido();

    form.items[0].idMaterial = null;
    expect(peticionTransferencia(form)).toContain('Seleccione el material');
    form.items[0] = { idMaterial: 10, cantidad: 1.001 };
    expect(peticionTransferencia(form)).toContain('dos decimales');
  });

  it('exige fecha y limita observación a 500 caracteres', () => {
    const form = borradorValido();

    form.fecha = '';
    expect(peticionTransferencia(form)).toContain('fecha válida');
    form.fecha = '2026-10-22';
    form.observacion = 'x'.repeat(501);
    expect(peticionTransferencia(form)).toContain('500 caracteres');
  });
  it('admite diez materiales y rechaza once antes de construir la petición', () => {
    const form = borradorValido();

    form.items = Array.from({ length: 10 }, (_, i) => ({ idMaterial: i + 1, cantidad: 1 }));
    const dto = peticionTransferencia(form);

    if (typeof dto === 'string') throw new Error(dto);
    expect(dto.items).toHaveLength(10);
    form.items.push({ idMaterial: 11, cantidad: 1 });
    expect(peticionTransferencia(form)).toBe('Una transferencia admite como máximo 10 materiales.');
  });
});
