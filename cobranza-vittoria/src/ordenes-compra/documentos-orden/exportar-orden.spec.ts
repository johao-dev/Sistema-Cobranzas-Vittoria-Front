import { detallePrueba } from '../ordenes-compra.fixture';
import { presentarDetalleOrden } from '../datos-orden';
import { exportarOrden } from './exportar-orden';

describe('Exportación de órdenes en el navegador', () => {
  afterEach(() => vi.restoreAllMocks());

  it('descarga la planilla histórica con su MIME y nombre por proveedor', () => {
    const crearUrl = vi.fn<(archivo: Blob) => string>(() => 'blob:orden');
    const liberarUrl = vi.fn();
    const descriptorCrear = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const descriptorLiberar = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: crearUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: liberarUrl });
    let nombreDescarga = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      nombreDescarga = this.download;
    });
    vi.useFakeTimers();

    try {
      const detalle = presentarDetalleOrden(detallePrueba);

      expect(exportarOrden(detalle, 'excel', detalle.items.slice(0, 1), 'Beta')).toBe(true);
      expect(nombreDescarga).toBe('oc_OC-8_Beta.xls');
      expect(crearUrl.mock.calls[0][0].type).toBe('application/vnd.ms-excel;charset=utf-8;');
      vi.runAllTimers();
      expect(liberarUrl).toHaveBeenCalledWith('blob:orden');
    } finally {
      vi.useRealTimers();
      if (descriptorCrear) Object.defineProperty(URL, 'createObjectURL', descriptorCrear);
      else Reflect.deleteProperty(URL, 'createObjectURL');
      if (descriptorLiberar) Object.defineProperty(URL, 'revokeObjectURL', descriptorLiberar);
      else Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('informa cuando el navegador bloquea la ventana de impresión', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    expect(exportarOrden(detallePrueba, 'pdf')).toBe(false);
  });
});
