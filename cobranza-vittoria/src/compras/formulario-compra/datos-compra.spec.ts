import { detallePrueba } from '../../ordenes-compra/ordenes-compra.fixture';
import { compraPrueba } from '../compras.fixture';
import {
  prepararItems,
  recalcularImporte,
  totalesCompra,
  peticionCompra,
  validarItemsCompra,
  siguienteNumeroCompra,
  separarEspecialidades,
} from './datos-compra';
describe('Datos de Compras — reglas preservadas y validación', () => {
  it('conserva cantidad, proveedor y monto por línea de OC', () => {
    const items = prepararItems(detallePrueba, []);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ idMaterial: 10, cantidad: 2, total: 50, idProveedor: 30 });
    expect(totalesCompra(items).total).toBe(150);
  });
  it('desglosa IGV desde el total y permite importes sin IGV', () => {
    const item = prepararItems(detallePrueba, [])[0];
    expect(recalcularImporte({ ...item, total: 118 })).toMatchObject({
      subtotalSinIgv: 100,
      montoIgv: 18,
    });
    expect(recalcularImporte({ ...item, total: 118, incluyeIgv: false })).toMatchObject({
      subtotalSinIgv: 118,
      montoIgv: 0,
    });
  });
  it('suma todos los materiales con IGV mixto y envía precios redondeados por unidad', () => {
    const items = prepararItems(detallePrueba, []);
    items[0] = recalcularImporte({
      ...items[0],
      total: 118,
      incluyeIgv: false,
      observacion: 'Primero',
    });
    items[1].observacion = 'Segundo';
    expect(totalesCompra(items)).toEqual({ subtotal: 202.74, igv: 15.26, total: 218 });
    expect(peticionCompra(8, ' 10 ', '2026-10-20', items)).toMatchObject({
      numeroCompra: '10',
      incluyeIGV: true,
      observacion: 'Primero | Segundo',
      items: [
        { idMaterial: 10, cantidad: 2, precioUnitario: 59 },
        { idMaterial: 11, cantidad: 2, precioUnitario: 25 },
        { idMaterial: 12, cantidad: 2, precioUnitario: 25 },
      ],
    });
  });
  it.each([0, -1, NaN, Infinity])('rechaza monto inválido %s en cualquier línea', (total) => {
    const items = prepararItems(detallePrueba, []);
    items[0].total = total;
    expect(validarItemsCompra(items)).toContain('todos los ítems');
  });
  it('rechaza ausencia de líneas, cantidad inválida y precio que se redondearía a cero', () => {
    expect(validarItemsCompra([])).toContain('No hay');
    const item = prepararItems(detallePrueba, [])[0];
    expect(validarItemsCompra([{ ...item, cantidad: 0 }])).toContain('cantidades');
    expect(validarItemsCompra([{ ...item, cantidad: 1000, total: 1 }])).toContain(
      'precio unitario',
    );
  });
  it('mantiene la numeración derivada de todos los grupos de dígitos', () => {
    expect(siguienteNumeroCompra([])).toBe('1');
    expect(siguienteNumeroCompra([compraPrueba, { ...compraPrueba, NumeroCompra: 'C-2-03' }])).toBe(
      '204',
    );
    expect(separarEspecialidades(' Civil, Eléctrica | Civil ')).toEqual([
      'Civil',
      'Eléctrica',
      'Civil',
    ]);
  });
});
