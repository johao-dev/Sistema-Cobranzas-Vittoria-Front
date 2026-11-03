import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../core/config/environment';
import { GastoDirectoRequest } from './contratos-gastos-directos';
import { RegistroGastosDirectos } from './registro-gastos-directos';

describe('RegistroGastosDirectos', () => {
  let service: RegistroGastosDirectos;
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
    fechaTipoCambio: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RegistroGastosDirectos);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta todas las categorías sin enviar un filtro de categoría', () => {
    service.listar({ estado: 'REGISTRADO', idCategoriaGasto: null }).subscribe();
    const req = http.expectOne(`${base}?estado=REGISTRADO`);
    expect(req.request.params.has('idCategoriaGasto')).toBe(false);
    req.flush([]);
  });

  it('lista con una categoría', () => {
    service.listar({ idCategoriaGasto: [9] }).subscribe();
    const req = http.expectOne(`${base}?idCategoriaGasto=9`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('serializa varias categorías como parámetros repetidos', () => {
    service.listar({ idCategoriaGasto: [3, 4, 5] }).subscribe();
    const req = http.expectOne(`${base}?idCategoriaGasto=3&idCategoriaGasto=4&idCategoriaGasto=5`);
    expect(new URL(req.request.urlWithParams).searchParams.getAll('idCategoriaGasto')).toEqual([
      '3',
      '4',
      '5',
    ]);
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
    expect(Array.from(new URL(req.request.urlWithParams).searchParams.keys())).toEqual([
      'idCentroCosto',
    ]);
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
  it('respeta respuestas de detalle, creación, transiciones y carga multipart del contrato', () => {
    const observar = vi.fn();
    service.obtener(90).subscribe(observar);
    const detalle = { gasto: { idGastoDirecto: 90 }, documentos: [] };
    http.expectOne(`${base}/90`).flush(detalle);
    expect(observar).toHaveBeenLastCalledWith(detalle);

    service.crear(request).subscribe(observar);
    http.expectOne(base).flush({ idGastoDirecto: 90 }, { status: 201, statusText: 'Created' });
    expect(observar).toHaveBeenLastCalledWith({ idGastoDirecto: 90 });

    service.confirmar(90).subscribe(observar);
    http
      .expectOne(`${base}/90/confirmar`)
      .flush({ ok: true, idGastoDirecto: 90, estado: 'CONFIRMADO' });
    expect(observar).toHaveBeenLastCalledWith({
      ok: true,
      idGastoDirecto: 90,
      estado: 'CONFIRMADO',
    });

    const archivo = new File(['pdf'], 'factura.pdf', { type: 'application/pdf' });
    service.subirDocumentos(90, 'Factura', [archivo]).subscribe(observar);
    const subida = http.expectOne(`${base}/90/documentos`);
    expect(subida.request.body.get('tipoDocumento')).toBe('Factura');
    expect(subida.request.body.getAll('files')).toEqual([archivo]);
    subida.flush({ ok: true, cantidad: 1 });
    expect(observar).toHaveBeenLastCalledWith({ ok: true, cantidad: 1 });
  });

  it('descarga un blob autenticado y propaga el rechazo del servidor', () => {
    service.descargarDocumento(90, 5).subscribe();
    const descarga = http.expectOne(`${base}/90/documentos/5/download`);
    expect(descarga.request.responseType).toBe('blob');
    descarga.flush(new Blob(['pdf'], { type: 'application/pdf' }));
    const error = vi.fn();
    service.anular(90).subscribe({ error });
    http
      .expectOne(`${base}/90/anular`)
      .flush({ message: 'Saldo insuficiente' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
  });
});
