import { Observable } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ConsultasPresupuestarias } from './consultas-presupuestarias';
import { environment } from '../../core/config/environment';

describe('ConsultasPresupuestarias: filtros y rutas públicas', () => {
  let consultas: ConsultasPresupuestarias;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/control-presupuestario`;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    consultas = TestBed.inject(ConsultasPresupuestarias);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it.each([
    ['resumen', 'resumen'],
    ['saldos', 'saldo'],
    ['vigente', 'vigente'],
    ['presupuestoVsComprometido', 'presupuesto-vs-comprometido'],
    ['presupuestoVsEjecutado', 'presupuesto-vs-ejecutado'],
    ['gastosPorPartida', 'gastos-por-partida'],
    ['gastosPorCentroCosto', 'gastos-por-centro-costo'],
  ] as const)('%s conserva ids, estado, false y omite nulos', (metodo, ruta) => {
    const consulta: Observable<unknown> = consultas[metodo]({
      idCentroCosto: 5,
      idPresupuesto: 10,
      idPresupuestoVersion: 20,
      idCatalogoPartida: null,
      idMoneda: 1,
      estadoPresupuesto: 'APROBADO',
      incluirInactivos: false,
    });
    consulta.subscribe();
    const req = http.expectOne((r) => r.url === `${base}/consultas/${ruta}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('idPresupuestoVersion')).toBe('20');
    expect(req.request.params.keys()).toEqual([
      'idCentroCosto',
      'idPresupuesto',
      'idPresupuestoVersion',
      'idMoneda',
      'estadoPresupuesto',
      'incluirInactivos',
    ]);
    expect(req.request.params.get('incluirInactivos')).toBe('false');
    expect(req.request.params.get('estadoPresupuesto')).toBe('APROBADO');
    expect(req.request.params.has('idCatalogoPartida')).toBe(false);
    req.flush(metodo === 'resumen' ? {} : []);
  });

  const reportes = [
    ['resumen', 'resumen'],
    ['saldos', 'saldo'],
    ['presupuestoVsComprometido', 'presupuesto-vs-comprometido'],
    ['presupuestoVsEjecutado', 'presupuesto-vs-ejecutado'],
    ['gastosPorPartida', 'gastos-por-partida'],
    ['gastosPorCentroCosto', 'gastos-por-centro-costo'],
  ] as const;

  it.each(reportes)(
    '%s admite consolidación opcional sin modificar sus filtros',
    (metodo, ruta) => {
      for (const consolidado of [undefined, false, true]) {
        const consulta: Observable<unknown> = consultas[metodo]({
          consolidado,
          idCentroCosto: 5,
          idPresupuesto: 10,
          idMoneda: 1,
        });
        consulta.subscribe();
        const req = http.expectOne((r) => r.url === `${base}/consultas/${ruta}`);
        expect(req.request.params.get('consolidado')).toBe(
          consolidado === undefined ? null : String(consolidado),
        );
        expect(req.request.params.get('idCentroCosto')).toBe('5');
        expect(req.request.params.get('idPresupuesto')).toBe('10');
        expect(req.request.params.get('idMoneda')).toBe('1');
        expect(req.request.params.has('idPresupuestoVersion')).toBe(false);
        expect(req.request.params.has('estadoPresupuesto')).toBe(false);
        req.flush(metodo === 'resumen' ? {} : []);
      }
    },
  );

  it('el historial consolidado solo envía presupuesto y partida, sin versión ni estado', () => {
    consultas.movimientosConsolidados(10, 25).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/consultas/movimientos`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual(['idPresupuesto', 'idCatalogoPartida']);
    expect(req.request.params.get('idPresupuesto')).toBe('10');
    expect(req.request.params.get('idCatalogoPartida')).toBe('25');
    req.flush([]);
  });

  it('el tablero envía el nivel y la rama sin mutar el filtro', () => {
    consultas.dashboard(5, 10, 2, 3).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/consultas/dashboard`);
    expect(req.request.params.get('nivel')).toBe('2');
    expect(req.request.params.get('idPartidaPadre')).toBe('3');
    req.flush({});
  });

  it('distingue el árbol vigente del árbol de una versión histórica', () => {
    consultas.arbolVigente(5, 10).subscribe();
    const vigente = http.expectOne((r) => r.url === `${base}/consultas/arbol`);
    expect(vigente.request.params.get('idCentroCosto')).toBe('5');
    expect(vigente.request.params.get('idPresupuesto')).toBe('10');
    vigente.flush({});
    consultas.arbolVersion(10, 20).subscribe();
    http.expectOne(`${base}/presupuestos/10/versiones/20/arbol`).flush({});
  });

  it('envía exclusiones como enteros repetidos y conserva todos los filtros previos', () => {
    consultas.dashboard(5, 10, 2, 3, [7, 9]).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/consultas/dashboard`);
    expect(req.request.params.getAll('partidasExcluidas')).toEqual(['7', '9']);
    expect(req.request.params.get('idCentroCosto')).toBe('5');
    expect(req.request.params.get('idPresupuesto')).toBe('10');
    expect(req.request.params.get('nivel')).toBe('2');
    expect(req.request.params.get('idPartidaPadre')).toBe('3');
    req.flush({});
  });

  it.each([{ ids: undefined }, { ids: [] }])(
    'omite la colección vacía de exclusiones ($ids)',
    ({ ids }) => {
      consultas.dashboard(5, null, null, null, ids).subscribe();
      const req = http.expectOne((r) => r.url === `${base}/consultas/dashboard`);
      expect(req.request.params.keys()).toEqual(['idCentroCosto']);
      req.flush({});
    },
  );

  it('propaga MONEDAS_MIXTAS al consumidor', () => {
    const error = vi.fn();
    consultas.arbolVigente(5).subscribe({ error });
    http
      .expectOne((r) => r.url === `${base}/consultas/arbol`)
      .flush({ error: 'MONEDAS_MIXTAS' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
  });
});
