import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PartidasRequerimiento } from './partidas-requerimiento';
import { ControlPresupuestarioService } from '../app/core/services/control-presupuestario.service';
import { environment } from '../core/config/environment';

describe('PartidasRequerimiento y consultas presupuestarias públicas', () => {
  const base = `${environment.apiUrl}/api/control-presupuestario`;
  let estado: PartidasRequerimiento;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PartidasRequerimiento, provideHttpClient(), provideHttpClientTesting()],
    });

    estado = TestBed.inject(PartidasRequerimiento);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function iniciar(): void {
    estado.iniciar();

    const catalogo = http.expectOne((req) => req.url === `${base}/partidas`);

    expect(catalogo.request.params.get('activo')).toBe('true');
    expect(catalogo.request.params.get('esHoja')).toBe('true');

    catalogo.flush([]);

    const centros = http.expectOne((req) => req.url === `${base}/centros-costo`);

    expect(centros.request.params.get('activo')).toBe('true');

    centros.flush([
      { idCentroCosto: 8, idProyecto: 6 },
      { idCentroCosto: 9, idProyecto: 7 },
    ]);
  }

  it('consulta la versión aprobada y cancela la respuesta del proyecto anterior', () => {
    iniciar();

    estado.cargar(6);

    const anterior = http.expectOne((req) => req.url === `${base}/consultas/saldo`);

    expect(anterior.request.params.get('idCentroCosto')).toBe('8');
    expect(anterior.request.params.get('estadoPresupuesto')).toBe('APROBADO');

    estado.cargar(7);

    expect(anterior.cancelled).toBe(true);

    const actual = http.expectOne((req) => req.url === `${base}/consultas/saldo`);

    expect(actual.request.params.get('idCentroCosto')).toBe('9');

    actual.flush([{ idPresupuestoDetalle: 18, idCatalogoPartida: 10, saldoDisponible: 234.56 }]);

    expect(estado.partidas()[0].saldoDisponible).toBe(234.56);
    expect(estado.cargando()).toBe(false);
  });

  it('resuelve el centro de costo aunque la consulta llegue después de abrir el editor', () => {
    estado.iniciar();

    estado.cargar(6);

    http.expectNone((req) => req.url === `${base}/consultas/saldo`);
    http.expectOne((req) => req.url === `${base}/partidas`).flush([]);
    http
      .expectOne((req) => req.url === `${base}/centros-costo`)
      .flush([{ idCentroCosto: 8, idProyecto: 6 }]);
    http.expectOne((req) => req.url === `${base}/consultas/saldo`).flush([]);

    expect(estado.cargandoCentros()).toBe(false);
  });

  it('cambiar a un proyecto sin centro elimina las partidas y cancela la carga anterior', () => {
    iniciar();

    estado.cargar(6);

    const anterior = http.expectOne((req) => req.url === `${base}/consultas/saldo`);

    estado.cargar(99);

    expect(anterior.cancelled).toBe(true);
    expect(estado.partidas()).toEqual([]);
    expect(estado.cargando()).toBe(false);
  });

  it('hace visible el error de saldo y permite recuperar la consulta', () => {
    iniciar();

    estado.cargar(6);

    http
      .expectOne((req) => req.url === `${base}/consultas/saldo`)
      .flush({ message: 'Sin acceso al presupuesto' }, { status: 403, statusText: 'Forbidden' });

    expect(estado.error()).toContain('Sin acceso');
    expect(estado.cargando()).toBe(false);

    estado.cargar(6);

    http.expectOne((req) => req.url === `${base}/consultas/saldo`).flush([]);

    expect(estado.error()).toBe('');
  });

  it('expone fallos de catálogos sin inventar un presupuesto vacío exitoso', () => {
    estado.iniciar();
    http
      .expectOne((req) => req.url === `${base}/partidas`)
      .flush(null, { status: 403, statusText: 'Forbidden' });
    http
      .expectOne((req) => req.url === `${base}/centros-costo`)
      .flush(null, { status: 503, statusText: 'Unavailable' });

    expect(estado.errorCatalogo()).toBeTruthy();
    expect(estado.errorCentros()).toBeTruthy();
    expect(estado.cargandoCentros()).toBe(false);
  });

  it('preserva false y los identificadores en los filtros públicos tipados', () => {
    const api = TestBed.inject(ControlPresupuestarioService);

    api.centrosCosto(false, 2, 'Obra', 6).subscribe();

    const centros = http.expectOne((req) => req.url === `${base}/centros-costo`);

    expect(centros.request.params.get('activo')).toBe('false');
    expect(centros.request.params.get('idProyecto')).toBe('6');
    expect(centros.request.params.get('busqueda')).toBe('Obra');

    centros.flush([]);

    api.partidas({ activo: false, esHoja: false, idPartidaPadre: 10 }).subscribe();

    const partidas = http.expectOne((req) => req.url === `${base}/partidas`);

    expect(partidas.request.params.get('activo')).toBe('false');
    expect(partidas.request.params.get('esHoja')).toBe('false');
    expect(partidas.request.params.get('idPartidaPadre')).toBe('10');

    partidas.flush([]);
  });

  it('cancela la consulta de saldo cuando se destruye su propietario', () => {
    iniciar();

    estado.cargar(6);

    const request = http.expectOne((req) => req.url === `${base}/consultas/saldo`);

    TestBed.resetTestingModule();

    expect(request.cancelled).toBe(true);
  });
});
