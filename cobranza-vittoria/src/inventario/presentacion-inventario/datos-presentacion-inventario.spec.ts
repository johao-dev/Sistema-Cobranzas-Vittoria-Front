import {
  fechaInventario,
  cantidadInventario,
  coincideBusquedaInventario,
  codigoMaterialInventario,
  nombreMaterialInventario,
} from './datos-presentacion-inventario';
import { materialesPrueba } from '../inventario.fixture';

describe('Presentación de Inventario', () => {
  it('preserva fecha civil DateOnly sin conversiones y formato de cantidades', () => {
    expect(fechaInventario('2026-10-20')).toBe('20/10/2026');
    expect(fechaInventario(null)).toBe('-');
    expect(cantidadInventario(0)).toBe('0');
    expect(cantidadInventario(1.25)).toBe('1.25');
  });

  it('usa referencia de catálogo solo si no viene etiqueta de servidor y busca sin tildes', () => {
    expect(codigoMaterialInventario(10, 'Servidor', materialesPrueba)).toBe('Servidor');
    expect(nombreMaterialInventario(10, null, materialesPrueba)).toBe('Cable');
    expect(coincideBusquedaInventario('electrica', ['Eléctrica', null, 0])).toBe(true);
  });
});
