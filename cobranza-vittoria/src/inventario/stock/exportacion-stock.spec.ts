import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';

import { RegistroInventario } from '../registro-inventario';
import { ExportacionStock } from './exportacion-stock';
import { NotificationService } from '../../app/core/services/notification.service';
import {
  simularDescargasInventario,
  restaurarDescargasInventario,
} from '../pruebas/descargas-inventario';

describe('ExportacionStock — XLSX y errores binarios', () => {
  const api = { exportarStockExcel: vi.fn<() => Observable<HttpResponse<Blob>>>() };
  const notify = { show: vi.fn() };
  let exportacion: ExportacionStock;
  let descargas: ReturnType<typeof simularDescargasInventario>;
  function blobJson(texto: string): Blob {
    const blob = new Blob([texto], { type: 'application/json' });

    Object.defineProperty(blob, 'text', { value: async () => texto });
    return blob;
  }
  async function completar(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    descargas = simularDescargasInventario();
    TestBed.configureTestingModule({
      providers: [
        ExportacionStock,
        { provide: RegistroInventario, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    exportacion = TestBed.inject(ExportacionStock);
  });

  afterEach(restaurarDescargasInventario);

  it('descarga con nombre del servidor y conserva filtros/incluirTotales false', async () => {
    const blob = new Blob(['xlsx']);

    api.exportarStockExcel.mockReturnValue(
      of(
        new HttpResponse({
          body: blob,
          headers: new HttpHeaders({
            'Content-Disposition': "attachment; filename*=UTF-8''stock%20obra.xlsx",
          }),
        }),
      ),
    );
    exportacion.exportar({ idEspecialidad: 2, fechaDesde: '2026-10-01' }, false);
    await completar();

    expect(api.exportarStockExcel).toHaveBeenCalledWith(
      { idEspecialidad: 2, fechaDesde: '2026-10-01' },
      false,
    );
    expect(descargas.crearUrl).toHaveBeenCalledWith(blob);
    expect(descargas.nombres).toEqual(['stock obra.xlsx']);
    expect(notify.show).toHaveBeenCalledWith('Excel descargado correctamente.', 'success');
    expect(exportacion.exportando()).toBe(false);
  });

  it('usa nombre de respaldo si falta Content-Disposition', async () => {
    api.exportarStockExcel.mockReturnValue(of(new HttpResponse({ body: new Blob(['xlsx']) })));
    exportacion.exportar({}, true);
    await completar();

    expect(descargas.nombres[0]).toMatch(/^kardex-stock-\d{8}-\d{4}\.xlsx$/);
  });

  it('bloquea exportaciones duplicadas mientras hay una respuesta pendiente', async () => {
    const respuesta = new Subject<HttpResponse<Blob>>();

    api.exportarStockExcel.mockReturnValue(respuesta);
    exportacion.exportar({}, false);
    exportacion.exportar({}, true);

    expect(api.exportarStockExcel).toHaveBeenCalledOnce();
    respuesta.next(new HttpResponse({ body: new Blob(['xlsx']) }));
    respuesta.complete();
    await completar();

    expect(exportacion.exportando()).toBe(false);
  });

  it('no descarga JSON devuelto con 200 ni muestra éxito', async () => {
    api.exportarStockExcel.mockReturnValue(
      of(new HttpResponse({ body: blobJson('{"message":"No disponible"}') })),
    );
    exportacion.exportar({}, false);
    await completar();

    expect(descargas.crearUrl).not.toHaveBeenCalled();
    expect(notify.show).toHaveBeenCalledWith('No disponible', 'error');
    expect(exportacion.exportando()).toBe(false);
  });

  it('interpreta 422 con Blob JSON y conserva errores por campo', async () => {
    api.exportarStockExcel.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: blobJson('{"errors":{"fecha":["Rango inválido"]}}'),
          }),
      ),
    );
    exportacion.exportar({}, false);
    await completar();

    expect(notify.show).toHaveBeenCalledWith('Rango inválido', 'error');
    expect(descargas.crearUrl).not.toHaveBeenCalled();
    expect(exportacion.exportando()).toBe(false);
  });

  it('informa cuerpo vacío o JSON inválido sin descargar', async () => {
    api.exportarStockExcel.mockReturnValue(of(new HttpResponse<Blob>({ body: null })));
    exportacion.exportar({}, false);
    await completar();

    expect(notify.show).toHaveBeenCalledWith('La respuesta no contiene un archivo Excel.', 'error');
    api.exportarStockExcel.mockReturnValue(of(new HttpResponse({ body: blobJson('no json') })));
    exportacion.exportar({}, false);
    await completar();

    expect(notify.show).toHaveBeenCalledWith('No se pudo exportar el Excel.', 'error');
    expect(descargas.crearUrl).not.toHaveBeenCalled();
  });
});
