import { exportarComprasExcel, exportarComprasPdf } from './exportar-compras';
import { compraPrueba } from '../compras.fixture';

describe('Exportaciones de compras', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it('conserva XLS textual, proveedores plurales, escape CSV y precisión', () => {
    const blobs: BlobPart[][] = [];
    const originalBlob = Blob;
    class BlobCapturado extends originalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        blobs.push(parts);
      }
    }
    vi.stubGlobal('Blob', BlobCapturado);
    const create = vi.fn(() => 'blob:compras');
    const revoke = vi.fn();
    class URLPrueba extends URL {
      static override createObjectURL = create;
      static override revokeObjectURL = revoke;
    }
    vi.stubGlobal('URL', URLPrueba);
    let nombreDescarga = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ): void {
      nombreDescarga = this.download;
    });
    exportarComprasExcel([{ ...compraPrueba, Proveedores: 'Alfa; "Beta"' }]);
    expect(String(blobs[0][0])).toContain('"Alfa; ""Beta"""');
    expect(String(blobs[0][0])).toContain(';118.00');
    expect(nombreDescarga).toMatch(/^compras_cerradas_.*\.xls$/);
    expect(click).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:compras');
  });
  it('escapa contenido HTML y conserva el flujo de impresión PDF', () => {
    vi.useFakeTimers();
    const write = vi.spyOn(document, 'write').mockImplementation(() => undefined);
    vi.spyOn(document, 'close').mockImplementation(() => undefined);
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => undefined);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    vi.spyOn(window, 'open').mockReturnValue(window);
    exportarComprasPdf([
      { ...compraPrueba, Proveedores: '<script>Alfa</script>', NombreProyecto: 'A & B' },
    ]);
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('&lt;script&gt;Alfa&lt;/script&gt;'),
    );
    expect(write).toHaveBeenCalledWith(expect.stringContaining('A &amp; B'));
    vi.advanceTimersByTime(400);
    expect(print).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });
  it('no falla si el navegador bloquea la ventana de impresión', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() => exportarComprasPdf([compraPrueba])).not.toThrow();
  });
});
