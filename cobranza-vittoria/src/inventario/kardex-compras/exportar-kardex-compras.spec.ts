import { exportarKardexCompras } from './exportar-kardex-compras';
import {
  simularDescargasInventario,
  restaurarDescargasInventario,
} from '../pruebas/descargas-inventario';

describe('Exportación del kardex de Compras', () => {
  let descargas: ReturnType<typeof simularDescargasInventario>;

  beforeEach(() => {
    descargas = simularDescargasInventario();
  });

  afterEach(restaurarDescargasInventario);

  it('conserva la tabla visible como XLS HTML con nombre histórico y texto escapado', async () => {
    const tabla = document.createElement('table');

    tabla.insertRow().insertCell().textContent = '<Cable & Tubo>';
    exportarKardexCompras(tabla, 'excel');

    expect(descargas.nombres).toEqual(['kardex-listado.xls']);

    const blob = descargas.crearUrl.mock.calls[0][0];
    if (!(blob instanceof Blob)) throw new Error('Falta Blob de descarga');

    expect(blob.type).toBe('application/vnd.ms-excel;charset=utf-8;');

    const contenido = await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();

      lector.onload = () => resolve(String(lector.result));
      lector.onerror = () => reject(lector.error);
      lector.readAsText(blob);
    });

    expect(contenido).toContain('&lt;Cable &amp; Tubo&gt;');
  });

  it('conserva impresión PDF de la tabla y admite popup bloqueado', () => {
    vi.useFakeTimers();

    const tabla = document.createElement('table');

    tabla.insertRow().insertCell().textContent = 'Cable';

    const escribir = vi.spyOn(document, 'write').mockImplementation(() => undefined);

    vi.spyOn(document, 'close').mockImplementation(() => undefined);
    vi.spyOn(window, 'focus').mockImplementation(() => undefined);

    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const abrir = vi.spyOn(window, 'open').mockReturnValue(window);

    exportarKardexCompras(tabla, 'pdf');

    expect(escribir).toHaveBeenCalledWith(expect.stringContaining('<td>Cable</td>'));
    vi.advanceTimersByTime(500);

    expect(imprimir).toHaveBeenCalledOnce();
    abrir.mockReturnValue(null);

    expect(() => exportarKardexCompras(tabla, 'pdf')).not.toThrow();
  });
});
