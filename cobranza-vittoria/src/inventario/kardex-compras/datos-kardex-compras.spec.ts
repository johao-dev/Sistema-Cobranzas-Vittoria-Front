import { movimientoPrueba } from '../inventario.fixture';
import {
  presentarMovimientosCompra,
  comprasParaSalida,
  faltanteCompra,
  esNuevoGrupoCompra,
} from './datos-kardex-compras';

describe('Kardex desde Compras — agrupación histórica', () => {
  it('conserva movimientos y asigna correlativo por compra/material/especialidad', () => {
    const filas = presentarMovimientosCompra([
      movimientoPrueba,
      { ...movimientoPrueba, Salida: 5 },
      { ...movimientoPrueba, IdMaterial: 11, Material: 'Tubo' },
    ]);

    expect(filas.map((r) => r.numeroCompraCorrelativo)).toEqual([1, 1, 2]);
    expect(filas).toHaveLength(3);
    expect(comprasParaSalida(filas)).toHaveLength(2);
    expect(comprasParaSalida(filas)[0]).toMatchObject({
      compraKey: '9|10|2',
      idCompra: 9,
      idMaterial: 10,
      idEspecialidad: 2,
      numeroRequerimiento: 'RQ-1',
    });
  });

  it('no ofrece salidas sin compra y diferencia la especialidad', () => {
    const filas = presentarMovimientosCompra([
      { ...movimientoPrueba, IdCompra: null },
      movimientoPrueba,
      { ...movimientoPrueba, IdEspecialidad: 3 },
    ]);

    expect(comprasParaSalida(filas)).toHaveLength(2);
    expect(esNuevoGrupoCompra(filas, 0)).toBe(true);
    expect(esNuevoGrupoCompra(filas, 2)).toBe(false);
  });

  it('mantiene faltante como entrada menos salida sin valores negativos', () => {
    expect(faltanteCompra(movimientoPrueba)).toBe(6);
    expect(faltanteCompra({ ...movimientoPrueba, Salida: 12 })).toBe(0);
  });
});
