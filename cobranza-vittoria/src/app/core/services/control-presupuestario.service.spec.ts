import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../config/environment';
import { ControlPresupuestarioService } from './control-presupuestario.service';

describe('ControlPresupuestarioService contract', () => {
  let service: ControlPresupuestarioService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/control-presupuestario`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ControlPresupuestarioService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carga solo los catálogos vigentes', () => {
    service.catalogos().subscribe(result => expect(Object.keys(result)).not.toContain('seccionesGasto'));

    const requests = http.match(req => req.url.startsWith(`${base}/catalogos/`));
    expect(requests).toHaveLength(5);
    expect(requests.some(req => req.request.url.includes('secciones-gasto'))).toBe(false);
    requests.forEach(req => req.flush([]));
  });

  it('crea una partida sin idSeccionGasto', () => {
    service.guardarPartida({
      codigo: '01', nombre: 'Partida', idTipoPartida: 2, idPartidaPadre: '', descripcion: '', idSeccionGasto: 99
    }).subscribe();

    const req = http.expectOne(`${base}/partidas`);
    expect(req.request.method).toBe('POST');
    expect('idSeccionGasto' in req.request.body).toBe(false);
    req.flush({});
  });

  it('actualiza una partida sin idSeccionGasto', () => {
    service.guardarPartida({
      idCatalogoPartida: 8, nombre: 'Partida', idTipoPartida: 2, idPartidaPadre: null,
      descripcion: null, activo: true, idSeccionGasto: 99
    }).subscribe();

    const req = http.expectOne(`${base}/partidas/8`);
    expect(req.request.method).toBe('PUT');
    expect('idSeccionGasto' in req.request.body).toBe(false);
    req.flush({});
  });
});
