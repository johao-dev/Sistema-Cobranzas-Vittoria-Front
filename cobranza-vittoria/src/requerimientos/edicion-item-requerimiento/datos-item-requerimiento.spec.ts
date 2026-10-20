import {
  cambiosItemRequerimiento,
  completarItemPersistido,
  itemVacio,
  validarItemAlmacen,
} from './datos-item-requerimiento';
import { muestraMaterial, muestraRequerimiento } from '../pruebas/muestras-requerimientos';
import { RequerimientoItemResponse } from '../contratos-requerimientos';

describe('Datos de la edición de ítems', () => {
  it('distingue limpiar opcionales de omitirlos, sin convertir cantidad null en un PATCH', () => {
    const original = {
      ...muestraRequerimiento().items[0],
      idPresupuestoDetalle: 18,
      observacion: 'Original',
    };
    const datos = { ...itemVacio(), idMaterial: 93, cantidad: null };

    expect(cambiosItemRequerimiento(original, datos)).toEqual({
      idPresupuestoDetalle: null,
      observacion: null,
    });
    expect(validarItemAlmacen(original, datos, [original])).toContain('cantidad');
    expect(original.idPresupuestoDetalle).toBe(18);
    expect(original.observacion).toBe('Original');
  });

  it('admite 0.29 y compara duplicados por la identidad persistida de cada detalle', () => {
    const original = muestraRequerimiento().items[0];

    const datos = { ...itemVacio(), idMaterial: original.idMaterial, cantidad: 0.29 };

    expect(validarItemAlmacen(original, datos, [original])).toBe('');
    expect(cambiosItemRequerimiento(original, datos)).toEqual({ cantidad: 0.29 });
    expect(
      validarItemAlmacen(original, datos, [original, { ...original, idRequerimientoDetalle: 720 }]),
    ).toContain('ya existe');
  });

  it('conserva etiquetas persistidas aunque el material o la partida ya no estén disponibles', () => {
    const anterior = {
      ...muestraRequerimiento().items[0],
      idPresupuestoDetalle: 18,
      codigoPartida: '01',
      nombrePartida: 'Obra gris',
    };
    const persistido: RequerimientoItemResponse = {
      idRequerimiento: 45,
      idRequerimientoDetalle: 710,
      idMaterial: 93,
      cantidad: 7,
      idPresupuestoDetalle: 18,
      observacion: null,
    };
    const item = completarItemPersistido(persistido, anterior, undefined, null);

    expect(item).toEqual({ ...anterior, ...persistido });
    expect(
      completarItemPersistido(
        { ...persistido, idPresupuestoDetalle: null },
        anterior,
        muestraMaterial(),
        null,
      ).codigoPartida,
    ).toBeNull();
    expect(anterior.cantidad).toBe(2.5);
  });
});
