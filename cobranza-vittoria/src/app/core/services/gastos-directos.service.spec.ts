import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../config/environment';
import { GastoDirectoRequest, GastosDirectosService } from './gastos-directos.service';

describe('GastosDirectosService', () => {
  let service: GastosDirectosService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/contable/gastos-directos`;

  const request: GastoDirectoRequest = {
    idPresupuestoDetalle: 42,
    idCategoriaGasto: 7,
    idProveedor: 10,
    idMoneda: 1,
    fecha: '2026-10-07',
    concepto: 'Campaña',
    descripcion: null,
    monto: 5000,
    idMonedaOriginal: null,
    montoOriginal: null,
    tipoCambio: null,
    fechaTipoCambio: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(GastosDirectosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista con una categoría', () => {
    service.listar({ idCategoriaGasto: [9] }).subscribe();
    const req = http.expectOne(`${base}?idCategoriaGasto=9`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('serializa varias categorías como parámetros repetidos', () => {
    service.listar({ idCategoriaGasto: [3, 4, 5] }).subscribe();
    const req = http.expectOne(`${base}?idCategoriaGasto=3&idCategoriaGasto=4&idCategoriaGasto=5`);
    expect(new URL(req.request.urlWithParams).searchParams.getAll('idCategoriaGasto')).toEqual(['3', '4', '5']);
    req.flush([]);
  });

  it('consulta centros de costo sin parámetros de contexto', () => {
    service.centrosCosto().subscribe();
    const req = http.expectOne(`${base}/centros-costo`);
    expect(req.request.urlWithParams).toBe(`${base}/centros-costo`);
    req.flush([]);
  });

  it('consulta partidas únicamente por centro de costo', () => {
    service.partidasDisponibles(12).subscribe();
    const req = http.expectOne(`${base}/partidas-disponibles?idCentroCosto=12`);
    expect(Array.from(new URL(req.request.urlWithParams).searchParams.keys())).toEqual(['idCentroCosto']);
    req.flush([]);
  });

  it('consulta proveedores canónicos sin parámetros de contexto', () => {
    service.proveedores().subscribe();
    const req = http.expectOne(`${base}/proveedores`);
    expect(req.request.urlWithParams).toBe(`${base}/proveedores`);
    req.flush([]);
  });

  it('consulta el catálogo de categorías del agregado', () => {
    service.categorias().subscribe();
    const req = http.expectOne(`${base}/categorias`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('crea con idCategoriaGasto y sin el contrato retirado', () => {
    service.crear(request).subscribe();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.idCategoriaGasto).toBe(7);
    expect('seccion' in req.request.body).toBe(false);
    req.flush({});
  });

  it('actualiza con idCategoriaGasto y sin el contrato retirado', () => {
    service.actualizar(21, request).subscribe();
    const req = http.expectOne(`${base}/21`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.idCategoriaGasto).toBe(7);
    expect('seccion' in req.request.body).toBe(false);
    req.flush({});
  });

  it('mantiene los endpoints de confirmar y anular', () => {
    service.confirmar(21).subscribe();
    const confirmar = http.expectOne(`${base}/21/confirmar`);
    expect(confirmar.request.body).toEqual({});
    confirmar.flush({});

    service.anular(21).subscribe();
    const anular = http.expectOne(`${base}/21/anular`);
    expect(anular.request.body).toEqual({});
    anular.flush({});
  });
});
