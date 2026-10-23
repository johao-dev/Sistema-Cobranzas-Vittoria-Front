import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ApiService } from '../../app/core/services/api.service';
import { RegistroTransferenciasProyecto } from './registro-transferencias-proyecto';
import { transferenciasPrueba } from './pruebas/transferencias.fixture';

describe('RegistroTransferenciasProyecto — contrato HTTP', () => {
  let api: RegistroTransferenciasProyecto;
  let http: HttpTestingController;
  let ruta: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(RegistroTransferenciasProyecto);
    http = TestBed.inject(HttpTestingController);
    ruta = TestBed.inject(ApiService).baseUrl + '/api/almacen/transferencias-proyecto';
  });

  afterEach(() => http.verify());

  it('lista con los cinco filtros y conserva la respuesta plana', () => {
    api
      .listar({
        idTransferencia: 7,
        idProyectoOrigen: 3,
        idProyectoDestino: 6,
        fechaDesde: '2026-10-01',
        fechaHasta: '2026-10-22',
      })
      .subscribe((filas) => expect(filas).toEqual(transferenciasPrueba));

    const req = http.expectOne((r) => r.url === ruta);

    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([
      'idTransferencia',
      'idProyectoOrigen',
      'idProyectoDestino',
      'fechaDesde',
      'fechaHasta',
    ]);
    expect(req.request.params.get('idProyectoOrigen')).toBe('3');
    expect(req.request.params.get('fechaHasta')).toBe('2026-10-22');
    req.flush(transferenciasPrueba);
  });

  it('omite filtros nulos y vacíos y consulta todos los detalles por ID', () => {
    api.listar({ idTransferencia: null, fechaDesde: '' }).subscribe();
    const listado = http.expectOne(ruta);

    expect(listado.request.params.keys()).toEqual([]);
    listado.flush([]);
    api.obtener(7).subscribe((filas) => expect(filas).toEqual(transferenciasPrueba));
    http.expectOne(ruta + '/7').flush(transferenciasPrueba);
  });

  it('crea con múltiples materiales, DateOnly y sin especialidad', () => {
    const dto = {
      idProyectoOrigen: 3,
      idProyectoDestino: 6,
      fecha: '2026-10-22',
      observacion: '',
      items: [
        { idMaterial: 10, cantidad: 3.25 },
        { idMaterial: 11, cantidad: 1.15 },
      ],
    };

    api.crear(dto).subscribe((filas) => expect(filas).toEqual(transferenciasPrueba));

    const req = http.expectOne(ruta);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(transferenciasPrueba);
  });

  it.each([404, 422])('propaga HTTP %s sin convertirlo en éxito', (status) => {
    const error = vi.fn();
    const next = vi.fn();

    api.obtener(7).subscribe({ next, error });
    http
      .expectOne(ruta + '/7')
      .flush({ message: 'Operación rechazada' }, { status, statusText: 'Error' });

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status }));
    expect(next).not.toHaveBeenCalled();
  });
});
