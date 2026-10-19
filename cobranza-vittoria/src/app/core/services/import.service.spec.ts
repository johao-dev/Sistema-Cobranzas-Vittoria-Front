import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../core/config/environment';
import { ImportService } from './import.service';
import { ImportResultado, ResultadoImportacionGastosDirectos } from '../../models/import.models';

const exito: ResultadoImportacionGastosDirectos = {
  modulo: 'gastos-directos',
  formato: 'xlsx',
  filasInsertadas: 2,
  totalFilas: 2,
  filasValidas: 2,
  filasInvalidas: 0,
  ok: true,
  resultado: 'IMPORTADO',
  errores: [],
};

const rechazo = {
  ...exito,
  ok: false,
  resultado: 'RECHAZADO',
  error: 'DATOS_INVALIDOS',
  message: 'Corrige el archivo.',
  filasInsertadas: 0,
  filasValidas: 1,
  filasInvalidas: 1,
  errores: [
    { fila: 7, campo: 'Monto', codigoError: 'FORMATO_INVALIDO', mensaje: 'Monto inválido.' },
  ],
};

describe('ImportService: gastos directos y regresión de catálogos', () => {
  let service: ImportService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/contable/gastos-directos`;
  const archivo = new File(['xlsx'], 'gastos.xlsx');
  const nombresDescargados: string[] = [];
  const crearUrl = vi.fn(() => 'blob:plantilla');

  beforeEach(() => {
    nombresDescargados.length = 0;
    crearUrl.mockClear();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static override createObjectURL = crearUrl;
        static override revokeObjectURL = vi.fn();
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      nombresDescargados.push(this.download);
    });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ImportService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('envía multipart con exactamente archivo, sin Content-Type manual y conserva el resumen HTTP 200', () => {
    let resultado: ImportResultado | undefined;
    service.importar('gastos-directos', archivo, 'operador').subscribe((r) => (resultado = r));
    const req = http.expectOne(`${base}/importar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Content-Type')).toBe(false);
    const form = req.request.body as FormData;
    expect(Array.from(form.keys())).toEqual(['archivo']);
    expect(form.get('archivo')).toBe(archivo);
    req.flush(exito);
    expect(resultado).toEqual({ ok: true, data: exito });
  });

  it.each([
    ['attachment; filename="Original.xlsx"', 'Original.xlsx'],
    [
      "attachment; filename=backup.xlsx; filename*=UTF-8''Plantilla%20gastos.xlsx",
      'Plantilla gastos.xlsx',
    ],
    [null, 'Plantilla_Carga_Masiva_Gastos_Directos.xlsx'],
  ])(
    'descarga el XLSX del endpoint original y resuelve Content-Disposition %s',
    async (header, nombre) => {
      const result = firstValueFrom(service.descargarPlantilla('gastos-directos', 'xlsx'));
      const req = http.expectOne(`${base}/plantilla`);
      expect(req.request.responseType).toBe('blob');
      const blob = new Blob(['xlsx'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      req.flush(blob, { headers: header ? { 'Content-Disposition': header } : {} });
      expect((await result).ok).toBe(true);
      expect(crearUrl).toHaveBeenCalledWith(blob);
      expect(nombresDescargados).toEqual([nombre]);
    },
  );

  it('conserva todos los errores físicos y contadores del HTTP 422', async () => {
    const result = firstValueFrom(service.importar('gastos-directos', archivo, ''));
    http
      .expectOne(`${base}/importar`)
      .flush(rechazo, { status: 422, statusText: 'Unprocessable Entity' });
    const r = await result;
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('No debe aceptarse el rechazo');
    expect(r.httpStatus).toBe(422);
    expect(r.error).toEqual(
      expect.objectContaining({
        ok: false,
        error: 'DATOS_INVALIDOS',
        message: rechazo.message,
        errores: rechazo.errores,
        totalFilas: 2,
        filasValidas: 1,
        filasInvalidas: 1,
        filasInsertadas: 0,
        resultado: 'RECHAZADO',
      }),
    );
  });

  it.each<[number, string | { message: string }, string]>([
    [400, { message: 'Los encabezados fueron alterados.' }, 'Los encabezados fueron alterados.'],
    [
      413,
      { message: 'Tamaño excesivo.' },
      'El archivo supera el tamaño máximo permitido de 10 MB.',
    ],
    [500, { message: 'Traza interna del servidor' }, 'Ocurrió un error inesperado.'],
    [500, '<html>Error del proxy</html>', 'Ocurrió un error inesperado.'],
  ])('normaliza HTTP %s sin exponer detalles internos', async (status, body, message) => {
    const result = firstValueFrom(service.importar('gastos-directos', archivo, ''));
    http.expectOne(`${base}/importar`).flush(body, { status, statusText: 'Error' });
    const r = await result;
    if (r.ok) throw new Error('No debe ser exitoso');
    expect(r.httpStatus).toBe(status);
    expect(r.error.message).toBe(message);
  });

  it('normaliza un error de red y permite otra solicitud', async () => {
    const result = firstValueFrom(service.importar('gastos-directos', archivo, ''));
    http.expectOne(`${base}/importar`).error(new ProgressEvent('error'));
    const r = await result;
    if (r.ok) throw new Error('No debe ser exitoso');
    expect(r.error.message).toBe('Ocurrió un error inesperado.');
    const retry = firstValueFrom(service.importar('gastos-directos', archivo, ''));
    http.expectOne(`${base}/importar`).flush(exito);
    expect((await retry).ok).toBe(true);
  });

  it('una respuesta 200 con ok=false nunca se comunica como éxito', async () => {
    const result = firstValueFrom(service.importar('gastos-directos', archivo, ''));
    http.expectOne(`${base}/importar`).flush(rechazo);
    expect((await result).ok).toBe(false);
  });

  it('no conserva detalles internos de un HTTP 500 como errores de fila', async () => {
    const result = firstValueFrom(service.importar('gastos-directos', archivo, ''));
    http
      .expectOne(`${base}/importar`)
      .flush({ ...rechazo, message: 'Traza interna' }, { status: 500, statusText: 'Error' });
    const r = await result;
    if (r.ok) throw new Error('No debe ser exitoso');
    expect(r.error.message).toBe('Ocurrió un error inesperado.');
    expect(r.error.errores).toBeUndefined();
  });

  it('lee el mensaje contractual de una descarga fallida con cuerpo Blob JSON', async () => {
    const blob = new Blob([], { type: 'application/json' });
    Object.defineProperty(blob, 'text', {
      value: async () => JSON.stringify({ message: 'Plantilla no disponible.' }),
    });
    const result = firstValueFrom(service.descargarPlantilla('gastos-directos', 'xlsx'));
    http.expectOne(`${base}/plantilla`).flush(blob, { status: 400, statusText: 'Bad Request' });
    expect(await result).toEqual({ ok: false, message: 'Plantilla no disponible.' });
    expect(nombresDescargados).toEqual([]);
  });

  it('conserva archivo y usuario, query de formato y endpoint genérico para las otras importaciones', () => {
    service.importar('material', archivo, 'operador').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/api/import/material`);
    expect(Array.from((req.request.body as FormData).keys())).toEqual(['archivo', 'usuario']);
    expect(req.request.body.get('usuario')).toBe('operador');
    req.flush({ modulo: 'material', formato: 'XLSX', filasInsertadas: 1 });
    service.descargarPlantilla('material', 'csv').subscribe();
    http
      .expectOne(`${environment.apiUrl}/api/import/material/plantilla?formato=csv`)
      .flush(new Blob(['csv']));
    expect(nombresDescargados).toEqual(['plantilla-material.csv']);
  });

  it('conserva los endpoints propios de partidas', () => {
    service.importar('partida', archivo, 'operador').subscribe();
    http
      .expectOne(`${environment.apiUrl}/api/control-presupuestario/partidas/importar`)
      .flush({ modulo: 'partida', formato: 'XLSX', filasInsertadas: 1 });
    service.descargarPlantilla('partida', 'csv').subscribe();
    http
      .expectOne(`${environment.apiUrl}/api/control-presupuestario/partidas/plantilla?formato=csv`)
      .flush(new Blob(['csv']));
  });
});
