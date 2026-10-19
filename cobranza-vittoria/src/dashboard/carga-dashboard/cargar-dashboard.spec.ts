import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CargarDashboard } from './cargar-dashboard';
import { DatosDashboard } from '../contratos-dashboard';
import { ComprasService } from '../../app/core/services/compras.service';
import { ValorizacionesService } from '../../app/core/services/valorizaciones.service';
import { environment } from '../../core/config/environment';
import {
  crearCompra,
  crearDetalle,
  crearItem,
  crearValorizacion,
} from '../pruebas/muestras-dashboard';

const COMPRAS = `${environment.apiUrl}/api/compras/compras`;
const VALORIZACIONES = `${environment.apiUrl}/api/contable/valorizaciones`;

describe('CargarDashboard y contratos HTTP consumidos', () => {
  let http: HttpTestingController;
  let carga: CargarDashboard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    carga = TestBed.inject(CargarDashboard);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('emite primero indicadores y después materiales usando las rutas y cuerpos documentados', () => {
    const estados: DatosDashboard[] = [];
    carga.cargar().subscribe((estado: DatosDashboard) => estados.push(estado));
    const compras: TestRequest = http.expectOne(COMPRAS);
    expect(compras.request.method).toBe('GET');
    compras.flush([crearCompra()]);
    const valorizaciones: TestRequest = http.expectOne(VALORIZACIONES);
    expect(valorizaciones.request.method).toBe('GET');
    valorizaciones.flush([crearValorizacion()]);
    expect(estados[0]?.tarjetas.map((tarjeta) => tarjeta.value)).toEqual([100, 80, 50, 5, 3]);
    expect(estados[0]?.cargandoMateriales).toBe(true);
    const detalle: TestRequest = http.expectOne(`${COMPRAS}/1`);
    expect(detalle.request.method).toBe('GET');
    detalle.flush(crearDetalle());
    expect(estados[1]?.materiales[0]).toMatchObject({
      material: 'Cemento',
      cantidad: 2,
      monto: 30,
      frecuencia: 1,
    });
    expect(estados[1]?.cargandoMateriales).toBe(false);
    expect(estados[1]?.errores).toEqual([]);
  });

  it('no solicita detalles cuando no hay compras', () => {
    const recibido = vi.fn<(estado: DatosDashboard) => void>();
    carga.cargar().subscribe(recibido);
    http.expectOne(COMPRAS).flush([]);
    http.expectOne(VALORIZACIONES).flush([]);
    expect(recibido).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ cargandoMateriales: false, materiales: [], errores: [] }),
    );
    http.expectNone(`${COMPRAS}/1`);
  });

  it('conserva datos parciales y expone el fallo de cada listado', () => {
    const recibido = vi.fn<(estado: DatosDashboard) => void>();
    carga.cargar().subscribe(recibido);
    http.expectOne(COMPRAS).flush(null, { status: 500, statusText: 'Error' });
    http.expectOne(VALORIZACIONES).flush([crearValorizacion()]);
    expect(recibido).toHaveBeenCalledWith(
      expect.objectContaining({
        tarjetas: expect.arrayContaining([
          expect.objectContaining({ key: 'facturado', value: 80 }),
        ]),
        errores: ['No se pudo cargar el listado de compras.'],
      }),
    );
  });

  it('expone el fallo de valorizaciones y mantiene materiales de las compras', () => {
    const estados: DatosDashboard[] = [];
    carga.cargar().subscribe((estado: DatosDashboard) => estados.push(estado));
    http.expectOne(COMPRAS).flush([crearCompra()]);
    http.expectOne(VALORIZACIONES).flush(null, { status: 503, statusText: 'Unavailable' });
    http.expectOne(`${COMPRAS}/1`).flush(crearDetalle());
    expect(estados[1]?.materiales).toHaveLength(1);
    expect(estados[1]?.errores).toEqual(['No se pudieron cargar las valorizaciones.']);
  });

  it('informa el fallo de un detalle sin descartar materiales de las otras compras', () => {
    const estados: DatosDashboard[] = [];
    carga.cargar().subscribe((estado: DatosDashboard) => estados.push(estado));
    http.expectOne(COMPRAS).flush([crearCompra(), crearCompra({ IdCompra: 2 })]);
    http.expectOne(VALORIZACIONES).flush([]);
    http.expectOne(`${COMPRAS}/2`).flush(null, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${COMPRAS}/1`).flush(crearDetalle());
    expect(estados[1]?.materiales).toHaveLength(1);
    expect(estados[1]?.errores).toEqual(['No se pudieron cargar los materiales de la compra 2.']);
  });

  it('limita a cuatro detalles simultáneos, deduplica IDs y mantiene el orden pese a respuestas invertidas', () => {
    const estados: DatosDashboard[] = [];
    carga.cargar().subscribe((estado: DatosDashboard) => estados.push(estado));
    http.expectOne(COMPRAS).flush([1, 2, 3, 4, 5, 1].map((id) => crearCompra({ IdCompra: id })));
    http.expectOne(VALORIZACIONES).flush([]);
    const primeras: TestRequest[] = [1, 2, 3, 4].map((id) => http.expectOne(`${COMPRAS}/${id}`));
    http.expectNone(`${COMPRAS}/5`);
    primeras[3]?.flush(crearDetalle([crearItem({ Material: 'D' })]));
    http.expectOne(`${COMPRAS}/5`).flush(crearDetalle([crearItem({ Material: 'E' })]));
    primeras[2]?.flush(crearDetalle([crearItem({ Material: 'C' })]));
    primeras[1]?.flush(crearDetalle([crearItem({ Material: 'B' })]));
    primeras[0]?.flush(crearDetalle([crearItem({ Material: 'A' })]));
    expect(estados[1]?.materiales.map((material) => material.material)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
    ]);
    expect(estados[1]?.materiales[0]?.frecuencia).toBe(1);
    http.expectNone(`${COMPRAS}/1`);
  });

  it('cierra la carga de materiales tras 12 segundos y cancela el detalle pendiente', async () => {
    vi.useFakeTimers();
    const estados: DatosDashboard[] = [];
    carga.cargar().subscribe((estado: DatosDashboard) => estados.push(estado));
    http.expectOne(COMPRAS).flush([crearCompra()]);
    http.expectOne(VALORIZACIONES).flush([]);
    const pendiente: TestRequest = http.expectOne(`${COMPRAS}/1`);
    await vi.advanceTimersByTimeAsync(12000);
    expect(pendiente.cancelled).toBe(true);
    expect(estados[1]?.cargandoMateriales).toBe(false);
    expect(estados[1]?.errores).toHaveLength(1);
  });

  it('cancela ambas consultas al cancelar la suscripción', () => {
    const suscripcion = carga.cargar().subscribe();
    const compras: TestRequest = http.expectOne(COMPRAS);
    const valorizaciones: TestRequest = http.expectOne(VALORIZACIONES);
    suscripcion.unsubscribe();
    expect(compras.cancelled).toBe(true);
    expect(valorizaciones.cancelled).toBe(true);
  });

  it('preserva filtros false y cero, y omite filtros nulos en compras', () => {
    TestBed.inject(ComprasService).compras({ aceptada: false, idProveedor: 0 }).subscribe();
    const peticion = http.expectOne(`${COMPRAS}?aceptada=false&idProveedor=0`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([]);
    TestBed.inject(ComprasService).compras({ aceptada: null, idProveedor: null }).subscribe();
    http.expectOne(COMPRAS).flush([]);
  });

  it('envía los filtros de valorizaciones y propaga errores HTTP desde el servicio público', () => {
    const fallo = vi.fn<(error: HttpErrorResponse) => void>();
    TestBed.inject(ValorizacionesService)
      .valorizaciones({ idProyecto: 1, idProveedor: 2, idEspecialidad: 3 })
      .subscribe({ error: fallo });
    http
      .expectOne(`${VALORIZACIONES}?idProyecto=1&idProveedor=2&idEspecialidad=3`)
      .flush(null, { status: 500, statusText: 'Error' });
    expect(fallo).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
  });
  it('cancela los detalles activos y no inicia los encolados al salir de la carga', () => {
    const suscripcion = carga.cargar().subscribe();
    http.expectOne(COMPRAS).flush([1, 2, 3, 4, 5].map((id) => crearCompra({ IdCompra: id })));
    http.expectOne(VALORIZACIONES).flush([]);
    const pendientes: TestRequest[] = [1, 2, 3, 4].map((id) => http.expectOne(`${COMPRAS}/${id}`));
    suscripcion.unsubscribe();
    expect(pendientes.every((peticion) => peticion.cancelled)).toBe(true);
    http.expectNone(`${COMPRAS}/5`);
  });
});
