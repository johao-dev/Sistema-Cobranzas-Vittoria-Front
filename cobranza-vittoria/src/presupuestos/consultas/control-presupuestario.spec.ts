import { TestBed } from '@angular/core/testing';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { ControlPresupuestario } from './control-presupuestario';
import { ConsultasPresupuestarias } from './consultas-presupuestarias';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { CatalogoCentrosCosto } from '../centros-costo/catalogo-centros-costo';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { FilaReportePresupuestario } from './contratos-consultas-presupuestarias';
import { partidaPrueba, presupuestoPrueba } from '../presupuestos.fixture';
import { CatalogoPartidas } from '../partidas/catalogo-partidas';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';

describe('ControlPresupuestario: selección y consultas concurrentes', () => {
  const api = { saldos: vi.fn(), presupuestoVsComprometido: vi.fn(), resumen: vi.fn() };
  const notificaciones = { show: vi.fn() };
  const catalogo = { partidas: vi.fn() };
  const sesion = { hasPermission: vi.fn() };
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    notificaciones.show.mockReset();
    catalogo.partidas.mockReset().mockReturnValue(of([]));
    sesion.hasPermission.mockReset().mockReturnValue(true);
    api.saldos.mockReturnValue(of([]));
    api.presupuestoVsComprometido.mockReturnValue(of([]));
    api.resumen.mockReturnValue(of({ totales: null, porCentroCosto: [], partidasExcedidas: [] }));
    TestBed.configureTestingModule({
      providers: [
        { provide: ConsultasPresupuestarias, useValue: api },
        { provide: RegistroPresupuestos, useValue: {} },
        { provide: CatalogoCentrosCosto, useValue: {} },
        { provide: Notificaciones, useValue: notificaciones },
        { provide: CatalogoPartidas, useValue: catalogo },
        { provide: SesionUsuario, useValue: sesion },
      ],
    });
    TestBed.overrideComponent(ControlPresupuestario, { set: { template: '' } });
    vi.spyOn(ControlPresupuestario.prototype, 'ngOnInit').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('cambiar centro descarta un presupuesto ajeno y envía solo el centro actual', () => {
    const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
    pagina.presupuestos = [presupuestoPrueba()];
    pagina.filtroPresupuesto = '10';
    pagina.filtroCentroCosto = '6';
    pagina.onCentroCostoChange();
    expect(pagina.filtroPresupuesto).toBe('');
    expect(api.saldos).toHaveBeenLastCalledWith({
      idCentroCosto: 6,
      idPresupuesto: null,
    });
  });

  it('al cambiar vista cancela las filas anteriores sin sobreescribir el reporte actual', () => {
    const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
    const anterior = new Subject<FilaReportePresupuestario[]>();
    api.saldos.mockReturnValue(anterior);
    pagina.cargarVista();
    api.presupuestoVsComprometido.mockReturnValue(of([{ partida: 'Actual', comprometido: 10 }]));
    pagina.cambiarVista('comprometido');
    anterior.next([{ partida: 'Antigua' }]);
    expect(pagina.filas[0].partida).toBe('Actual');
    expect(pagina.cargando).toBe(false);
  });

  it('el resumen anterior tampoco puede sustituir el filtro nuevo', () => {
    const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
    const anterior = new Subject<object>();
    api.resumen
      .mockReturnValueOnce(anterior)
      .mockReturnValueOnce(of({ totales: null, porCentroCosto: [], partidasExcedidas: [] }));
    pagina.cargarResumen();
    pagina.cargarResumen();
    anterior.next({ totales: { presupuestado: 999 } });
    expect(pagina.totales).toBeNull();
    expect(pagina.cargandoResumen).toBe(false);
  });

  it('una vista agregada no abre movimientos sin identificar un detalle', () => {
    const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
    pagina.verMovimientos({ idPresupuesto: 10, ejecutado: 20 });
    expect(pagina.modalMovimientos).toBe(false);
    expect(notificaciones.show).toHaveBeenCalledWith(expect.stringContaining('historial'), 'info');
  });

  it('solo reinicia exclusiones y recarga reportes cuando cambian IDs normalizados', () => {
    const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
    pagina.presupuestos = [presupuestoPrueba()];
    pagina.filtroCentroCosto = '5';
    pagina.filtroPresupuesto = '10';
    pagina.recargar();
    pagina['cambiarExclusiones']([7, 3]);
    expect(pagina['partidasExcluidas']()).toEqual([3, 7]);
    expect(api.saldos).toHaveBeenCalledTimes(1);
    expect(api.resumen).toHaveBeenCalledTimes(1);

    pagina.filtroCentroCosto = '05';
    pagina.filtroPresupuesto = '010';
    pagina.onCentroCostoChange();
    pagina.recargar();
    pagina.filtroNivel = '2';
    expect(pagina['partidasExcluidas']()).toEqual([3, 7]);
    expect(api.saldos).toHaveBeenCalledTimes(1);

    pagina.filtroPresupuesto = '';
    pagina.recargar();
    expect(pagina['partidasExcluidas']()).toEqual([]);
    expect(api.saldos).toHaveBeenLastCalledWith({ idCentroCosto: 5, idPresupuesto: null });
    pagina['cambiarExclusiones']([3]);
    pagina.recargar();
    expect(pagina['partidasExcluidas']()).toEqual([3]);
    expect(api.saldos).toHaveBeenCalledTimes(2);

    pagina.filtroCentroCosto = '6';
    pagina.onCentroCostoChange();
    expect(pagina['partidasExcluidas']()).toEqual([]);
    expect(api.saldos).toHaveBeenCalledTimes(3);
  });

  it('comparte una única carga del catálogo completo, sin filtro de activos', () => {
    const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
    const respuesta = new Subject<never[]>();
    catalogo.partidas.mockReturnValue(respuesta);
    pagina['cargarPartidas']();
    pagina['cargarPartidas']();
    expect(catalogo.partidas).toHaveBeenCalledExactlyOnceWith();
    expect(pagina['cargandoPartidas']()).toBe(true);
    respuesta.next([]);
    respuesta.complete();
    pagina['cargarPartidas']();
    expect(catalogo.partidas).toHaveBeenCalledTimes(1);
    expect(pagina['cargandoPartidas']()).toBe(false);
  });

  it('los usuarios de reportes no solicitan el catálogo sin su permiso específico', () => {
    sesion.hasPermission.mockReturnValue(false);
    const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
    pagina['cargarPartidas']();
    pagina.recargar();
    expect(catalogo.partidas).not.toHaveBeenCalled();
    expect(api.saldos).toHaveBeenCalledTimes(1);
  });

  it('el error de catálogo permite reintentar y no detiene los otros reportes', () => {
    const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
    catalogo.partidas.mockReturnValueOnce(throwError(() => new Error('fallo')));
    pagina['cargarPartidas']();
    pagina.recargar();
    expect(pagina['cargandoPartidas']()).toBe(false);
    expect(pagina['errorPartidas']()).not.toBe('');
    expect(api.saldos).toHaveBeenCalledTimes(1);
    pagina['cargarPartidas']();
    expect(catalogo.partidas).toHaveBeenCalledTimes(2);
    expect(pagina['errorPartidas']()).toBe('');
  });
});

describe('ControlPresupuestario: integración del selector con los reportes', () => {
  it('actualiza solo el dashboard mediante la plantilla real y signals sin Zone.js', async () => {
    const api = {
      saldos: vi.fn(() => of([])),
      resumen: vi.fn(() => of({ totales: null, porCentroCosto: [], partidasExcedidas: [] })),
      dashboard: vi.fn(() => NEVER),
      arbolVigente: vi.fn(() => NEVER),
    };
    const partidas = { partidas: vi.fn(() => of([partidaPrueba()])) };
    TestBed.configureTestingModule({
      providers: [
        { provide: ConsultasPresupuestarias, useValue: api },
        { provide: CatalogoPartidas, useValue: partidas },
        { provide: SesionUsuario, useValue: { hasPermission: () => true } },
        {
          provide: RegistroPresupuestos,
          useValue: { presupuestos: () => of([presupuestoPrueba()]) },
        },
        { provide: CatalogoCentrosCosto, useValue: { centrosCosto: () => of([]) } },
        { provide: Notificaciones, useValue: { show: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ControlPresupuestario);
    fixture.componentInstance.filtroCentroCosto = '5';
    fixture.detectChanges();
    await fixture.whenStable();
    const resumenes = api.resumen.mock.calls.length;
    const reportes = api.saldos.mock.calls.length;
    const arboles = api.arbolVigente.mock.calls.length;
    const tableros = api.dashboard.mock.calls.length;
    const host: HTMLElement = fixture.nativeElement;
    const casilla = host.querySelector<HTMLInputElement>('.selector-opcion input')!;
    casilla.click();
    await fixture.whenStable();
    expect(casilla.checked).toBe(false);
    expect(fixture.componentInstance['partidasExcluidas']()).toEqual([2]);
    expect(host.querySelector('summary')?.textContent).toContain('1 partidas excluidas');
    expect(api.dashboard).toHaveBeenCalledTimes(tableros);
    await new Promise<void>((resolve) => setTimeout(resolve, 280));
    await fixture.whenStable();
    expect(api.dashboard).toHaveBeenCalledTimes(tableros + 1);
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, null, null, [2]);
    expect(api.resumen).toHaveBeenCalledTimes(resumenes);
    expect(api.saldos).toHaveBeenCalledTimes(reportes);
    expect(api.arbolVigente).toHaveBeenCalledTimes(arboles);
    expect(partidas.partidas).toHaveBeenCalledTimes(1);
    expect(host.querySelector('summary')?.textContent).toContain('1 partidas excluidas');
    fixture.componentInstance.onCentroCostoChange();
    await fixture.whenStable();
    expect(api.dashboard).toHaveBeenCalledTimes(tableros + 1);
  });
});
