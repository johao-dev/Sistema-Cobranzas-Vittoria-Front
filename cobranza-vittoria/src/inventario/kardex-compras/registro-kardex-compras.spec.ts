import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { RegistroKardexCompras } from './registro-kardex-compras';
import { ApiService } from '../../app/core/services/api.service';
import { movimientoPrueba } from '../inventario.fixture';

describe('RegistroKardexCompras — contrato legacy vigente', () => {
  let api: RegistroKardexCompras;
  let http: HttpTestingController;
  let base: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(RegistroKardexCompras);
    http = TestBed.inject(HttpTestingController);
    base = TestBed.inject(ApiService).baseUrl + '/api/almacen/kardex';
  });

  afterEach(() => http.verify());

  it('conserva alias SQL y filtros exactos, incluido cero', () => {
    api
      .movimientos({ idCompra: 0, idMaterial: 10, idEspecialidad: null, fechaDesde: '' })
      .subscribe((rows) => expect(rows).toEqual([movimientoPrueba]));

    const req = http.expectOne((r) => r.url === base + '/movimientos');

    expect(req.request.params.keys()).toEqual(['idCompra', 'idMaterial']);
    expect(req.request.params.get('idCompra')).toBe('0');
    req.flush([movimientoPrueba]);
  });

  it('envía salida legacy a salidas-manuales y no al endpoint de Inventario manual', () => {
    const dto = {
      idCompra: 9,
      idMaterial: 10,
      idEspecialidad: 2,
      fechaMovimiento: '2026-10-20',
      cantidadSalida: 1,
      observacion: null,
    };

    api.registrarSalida(dto).subscribe((res) => expect(res.stockActual).toBe(5));

    const req = http.expectOne(base + '/salidas-manuales');

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({ ok: true, stockActual: 5, mensaje: 'Salida confirmada' });
  });
});
