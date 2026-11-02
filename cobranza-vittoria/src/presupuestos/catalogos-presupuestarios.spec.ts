import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../core/config/environment';
import { CatalogosPresupuestarios } from './catalogos-presupuestarios';
import { CatalogoPartidas } from './partidas/catalogo-partidas';

describe('RegistroPresupuestos contract', () => {
  let catalogos: CatalogosPresupuestarios;
  let partidas: CatalogoPartidas;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/control-presupuestario`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    catalogos = TestBed.inject(CatalogosPresupuestarios);
    partidas = TestBed.inject(CatalogoPartidas);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carga solo los catálogos vigentes', () => {
    catalogos
      .catalogos()
      .subscribe((result) => expect(Object.keys(result)).not.toContain('seccionesGasto'));

    const requests = http.match((req) => req.url.startsWith(`${base}/catalogos/`));
    expect(requests).toHaveLength(5);
    expect(requests.some((req) => req.request.url.includes('secciones-gasto'))).toBe(false);
    requests.forEach((req) => req.flush([]));
  });

  it('crea una partida sin idSeccionGasto', () => {
    partidas
      .guardarPartida({
        codigo: '01',
        nombre: 'Partida',
        idTipoPartida: 2,
        idPartidaPadre: '',
        descripcion: '',
        activo: true,
      })
      .subscribe();

    const req = http.expectOne(`${base}/partidas`);
    expect(req.request.method).toBe('POST');
    expect('idSeccionGasto' in req.request.body).toBe(false);
    req.flush({});
  });

  it('actualiza una partida sin idSeccionGasto', () => {
    partidas
      .guardarPartida({
        idCatalogoPartida: 8,
        nombre: 'Partida',
        idTipoPartida: 2,
        idPartidaPadre: null,
        descripcion: null,
        activo: true,
      })
      .subscribe();

    const req = http.expectOne(`${base}/partidas/8`);
    expect(req.request.method).toBe('PUT');
    expect('idSeccionGasto' in req.request.body).toBe(false);
    req.flush({});
  });
  it('Gastos consulta únicamente las monedas del catálogo público', () => {
    const monedas = [{ idMoneda: 1, codigo: 'PEN', nombre: 'Soles', simbolo: 'S/', activo: true }];
    const respuesta = vi.fn();
    catalogos.monedas().subscribe(respuesta);
    http.expectOne(`${base}/catalogos/monedas`).flush(monedas);
    expect(respuesta).toHaveBeenCalledWith(monedas);
  });
});
