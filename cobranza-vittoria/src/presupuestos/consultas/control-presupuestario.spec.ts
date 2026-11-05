import { HttpErrorResponse } from '@angular/common/http';
import { NodoArbol } from '../arbol/contratos-arbol-presupuestario';
import { TestBed } from '@angular/core/testing';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { ControlPresupuestario } from './control-presupuestario';
import { ConsultasPresupuestarias } from './consultas-presupuestarias';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { CatalogoCentrosCosto } from '../centros-costo/catalogo-centros-costo';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { simularDialogosPresupuestos } from '../dialogos.fixture';
import { crearCsvPresupuestario } from './exportacion-presupuestaria';
import { FilaReportePresupuestario, SaldoPartida } from './contratos-consultas-presupuestarias';
import { partidaPrueba, presupuestoPrueba } from '../presupuestos.fixture';
import { CatalogoPartidas } from '../partidas/catalogo-partidas';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';

describe('ControlPresupuestario: selección y consultas concurrentes', () => {
  const api = {
    saldos: vi.fn(),
    presupuestoVsComprometido: vi.fn(),
    resumen: vi.fn(),
    presupuestoVsEjecutado: vi.fn(),
    gastosPorPartida: vi.fn(),
    gastosPorCentroCosto: vi.fn(),
  };
  const notificaciones = { show: vi.fn() };
  const catalogo = { partidas: vi.fn() };
  const sesion = { hasPermission: vi.fn() };
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    notificaciones.show.mockReset();
    catalogo.partidas.mockReset().mockReturnValue(of([]));
    sesion.hasPermission.mockReset().mockReturnValue(true);
    Object.values(api).forEach((mock) => mock.mockReturnValue(of([])));
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
      consolidado: true,
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

  it('una vista agregada no abre movimientos sin identificar una partida', () => {
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
    expect(api.saldos).toHaveBeenLastCalledWith({
      consolidado: true,
      idCentroCosto: 5,
      idPresupuesto: null,
    });
    pagina['cambiarExclusiones']([3]);
    pagina.recargar();
    expect(pagina['partidasExcluidas']()).toEqual([3]);
    expect(api.saldos).toHaveBeenCalledTimes(2);

    pagina.filtroCentroCosto = '6';
    pagina.onCentroCostoChange();
    expect(pagina['partidasExcluidas']()).toEqual([]);
    expect(api.saldos).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['saldos', 'saldos'],
    ['comprometido', 'presupuestoVsComprometido'],
    ['ejecutado', 'presupuestoVsEjecutado'],
    ['gastos-partida', 'gastosPorPartida'],
    ['gastos-centro', 'gastosPorCentroCosto'],
  ] as const)(
    'la vista %s y el resumen solicitan consolidación con los mismos filtros',
    (vista, metodo) => {
      const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
      pagina.filtroCentroCosto = '5';
      pagina.filtroPresupuesto = '10';
      pagina.cargarResumen();
      pagina.cambiarVista(vista);
      const filtro = { consolidado: true, idCentroCosto: 5, idPresupuesto: 10 };
      expect(api.resumen).toHaveBeenCalledWith(filtro);
      expect(api[metodo]).toHaveBeenCalledWith(filtro);
    },
  );

  it.each(['saldos', 'comprometido', 'ejecutado', 'gastos-partida'] as const)(
    'abre historial consolidado desde %s sin requerir ID de detalle o versión',
    (vista) => {
      const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
      pagina.cambiarVista(vista);
      pagina.verMovimientos({ idPresupuesto: 10, idCatalogoPartida: 25 });
      expect(pagina.contextoMovimientos).toEqual({
        modo: 'consolidado',
        idPresupuesto: 10,
        idCatalogoPartida: 25,
        codigo: null,
        nombre: null,
      });
      expect(pagina.modalMovimientos).toBe(true);
    },
  );

  it.each(['control_presupuestario.reporte.ver', 'control_presupuestario.movimiento.ver'])(
    'no habilita historial sin %s',
    (faltante) => {
      sesion.hasPermission.mockImplementation((permiso: string) => permiso !== faltante);
      const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
      const fila = { idPresupuesto: 10, idCatalogoPartida: 25 };
      expect(pagina.puedeAbrirHistorial(fila)).toBe(false);
      pagina.verMovimientos(fila);
      expect(pagina.modalMovimientos).toBe(false);
    },
  );

  it('el árbol vigente consulta por partida común sin requerir un detalle de versión', () => {
    const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
    const nodo: NodoArbol = {
      idPresupuesto: 10,
      idCatalogoPartida: 25,
      idPresupuestoVersion: null,
      idPresupuestoDetalle: null,
      codigo: '1',
      nombre: 'Concreto',
      idPartidaPadre: null,
      nivel: 1,
      esHoja: true,
      cantidadHijas: 0,
      cantidadHojas: 1,
      montoPresupuestado: 100,
      montoComprometido: 0,
      montoEjecutado: 0,
      saldoDisponible: 100,
      porcentajeComprometido: 0,
      porcentajeEjecutado: 0,
      excedido: false,
      partidasExcedidas: 0,
    };
    pagina.verMovimientosNodo(nodo);
    expect(pagina.contextoMovimientos).toMatchObject({
      modo: 'consolidado',
      idCatalogoPartida: 25,
    });
    pagina.cerrarModal();
    pagina.verMovimientosNodo({ ...nodo, idPresupuesto: null });
    expect(pagina.modalMovimientos).toBe(false);
    expect(notificaciones.show).toHaveBeenLastCalledWith(
      expect.stringContaining('varios presupuestos'),
      'info',
    );
  });

  it.each([
    [0, 25, 0, '0%'],
    [100, -25, -25, '0%'],
    [100, 150, 150, '100%'],
    [-100, 25, -25, '0%'],
    [200, 50, 25, '25%'],
  ])(
    'saldo con presupuesto %s y ejecutado %s conserva porcentaje y limita solo el ancho',
    (base, ejecutado, porcentaje, ancho) => {
      const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
      const fila = { montoPresupuestado: base, ejecutado };
      expect(pagina.porcentaje(fila)).toBe(porcentaje);
      expect(pagina.anchoBarra(pagina.porcentaje(fila))).toBe(ancho);
      if (porcentaje > 100) expect(pagina.claseBarra(porcentaje)).toContain('danger');
      expect(fila).toEqual({ montoPresupuestado: base, ejecutado });
    },
  );

  it.each([
    [400, { error: 'MONEDAS_MIXTAS' }, 'Selecciona un presupuesto'],
    [400, { error: 'FILTROS_INCOMPATIBLES' }, 'versión o estado'],
    [403, {}, 'permisos necesarios'],
    [400, { errors: { Id: ['Identificador inválido'] } }, 'Identificador inválido'],
  ])('limpia datos previos y conserva filtros ante HTTP %s %j', (status, error, mensaje) => {
    const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
    api.resumen.mockReturnValueOnce(
      of({ totales: { presupuestado: 100 }, partidasExcedidas: [{}], porCentroCosto: [{}] }),
    );
    pagina.cargarResumen();
    pagina.filas = [{ ejecutado: 100 }];
    pagina.filtroCentroCosto = '5';
    pagina.filtroPresupuesto = '10';
    const fallo = throwError(() => new HttpErrorResponse({ status, error }));
    api.resumen.mockReturnValue(fallo);
    api.saldos.mockReturnValue(fallo);
    pagina.recargar();
    expect(pagina.totales).toBeNull();
    expect(pagina.partidasExcedidas).toEqual([]);
    expect(pagina.porCentroCosto).toEqual([]);
    expect(pagina.filas).toEqual([]);
    expect(pagina.errorResumen).toContain(mensaje);
    expect(pagina.errorReporte).toContain(mensaje);
    expect(pagina.filtroCentroCosto).toBe('5');
    expect(pagina.filtroPresupuesto).toBe('10');
    expect(pagina.cargando || pagina.cargandoResumen).toBe(false);
  });

  it('limpia resultados y cierra el historial mientras carga otro contexto', () => {
    const pagina = TestBed.createComponent(ControlPresupuestario).componentInstance;
    pagina.filas = [{ ejecutado: 999 }];
    pagina.verMovimientos({ idPresupuesto: 10, idCatalogoPartida: 25 });
    api.resumen.mockReturnValue(NEVER);
    api.saldos.mockReturnValue(NEVER);
    pagina.recargar();
    expect(pagina.filas).toEqual([]);
    expect(pagina.totales).toBeNull();
    expect(pagina.modalMovimientos).toBe(false);
    expect(pagina.cargando && pagina.cargandoResumen).toBe(true);
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

describe('ControlPresupuestario: presentación consolidada con plantilla real', () => {
  const fila: SaldoPartida = {
    idCentroCosto: 5,
    codigoCentroCosto: 'MC2',
    centroCosto: 'Obra MC2',
    idPresupuesto: 10,
    codigoPresupuesto: 'P-10',
    presupuesto: 'Obra',
    idMoneda: 1,
    moneda: 'PEN',
    simboloMoneda: 'S/',
    idPresupuestoVersion: 103,
    numeroVersion: 3,
    estado: 'APROBADO',
    idPresupuestoDetalle: 1031,
    idCatalogoPartida: 25,
    codigoPartida: '1',
    partida: 'Concreto',
    nivel: 1,
    montoPresupuestado: 400,
    comprometido: 375,
    ejecutado: 530,
    saldoDisponible: -505,
    montoExcedido: 505,
    excedido: true,
  };
  const filaCero: SaldoPartida = {
    ...fila,
    idPresupuestoDetalle: 1032,
    idCatalogoPartida: 26,
    codigoPartida: '2',
    partida: 'Acero',
    montoPresupuestado: 0,
    comprometido: 0,
    ejecutado: 25,
    saldoDisponible: -25,
    montoExcedido: 25,
  };
  const api = {
    resumen: vi.fn(),
    saldos: vi.fn(),
    gastosPorPartida: vi.fn(),
    gastosPorCentroCosto: vi.fn(),
    movimientosConsolidados: vi.fn(),
  };
  const sesion = { hasPermission: vi.fn() };
  let restaurar: () => void;

  beforeEach(() => {
    restaurar = simularDialogosPresupuestos();
    sesion.hasPermission.mockReset().mockReturnValue(true);
    Object.values(api).forEach((mock) => mock.mockReset());
    api.resumen.mockReturnValue(
      of({
        totales: {
          presupuestado: 400,
          comprometido: 375,
          ejecutado: 555,
          saldoDisponible: -530,
          porcentajeEjecutado: 138.75,
          centrosCosto: 1,
          partidas: 2,
          partidasExcedidas: 2,
        },
        porCentroCosto: [],
        partidasExcedidas: [fila, filaCero],
      }),
    );
    api.saldos.mockReturnValue(of([fila, filaCero]));
    api.gastosPorPartida.mockReturnValue(
      of([
        {
          idPresupuesto: 10,
          idCatalogoPartida: 25,
          numeroVersion: 3,
          estado: 'APROBADO',
          codigoPartida: '1',
          partida: 'Concreto',
          montoPresupuestado: 400,
          ejecutado: 530,
          porcentajeEjecutado: 132.5,
        },
      ]),
    );
    api.gastosPorCentroCosto.mockReturnValue(
      of([
        {
          idPresupuesto: 10,
          numeroVersion: 3,
          estado: 'APROBADO',
          ejecutado: 555,
          montoPresupuestado: 400,
          comprometido: 375,
          saldoDisponible: -530,
          porcentajeEjecutado: 138.75,
        },
      ]),
    );
    api.movimientosConsolidados.mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        { provide: ConsultasPresupuestarias, useValue: api },
        { provide: CatalogoPartidas, useValue: { partidas: () => of([]) } },
        { provide: SesionUsuario, useValue: sesion },
        {
          provide: RegistroPresupuestos,
          useValue: { presupuestos: () => of([presupuestoPrueba()]) },
        },
        { provide: CatalogoCentrosCosto, useValue: { centrosCosto: () => of([]) } },
        { provide: Notificaciones, useValue: { show: vi.fn() } },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    restaurar();
  });

  it('presenta importes acumulados recibidos, porcentaje de saldo y CSV filtrado', async () => {
    const fixture = TestBed.createComponent(ControlPresupuestario);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    const tarjetas = Array.from(host.querySelectorAll('.kpi-card__value')).map((e) =>
      e.textContent?.trim(),
    );
    expect(tarjetas).toEqual(['400.00', '375.00', '555.00', '-530.00', '138.75%', '2 / 2']);
    expect(host.textContent).toContain('Versión base aprobada vigente');
    expect(host.querySelector('.table-wrap--sticky-actions')?.textContent).toContain(
      'v3 · APROBADO',
    );
    const avances = Array.from(host.querySelectorAll('.barra__label')).map((e) =>
      e.textContent?.trim(),
    );
    expect(avances).toEqual(['132.5%', '0.0%']);
    const barra = host.querySelector<HTMLElement>('.barra__fill');
    expect(barra?.style.width).toBe('100%');
    expect(barra?.className).toContain('danger');
    const busqueda = host.querySelector<HTMLInputElement>('#control-presupuestario-campo-4')!;
    busqueda.value = 'Concreto';
    busqueda.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const csv = crearCsvPresupuestario(fixture.componentInstance.filasFiltradas);
    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csv).toContain('"400";"375";"530";"-505";"505";"true"');
    expect(csv).toContain('"103";"3";"APROBADO"');
    expect(csv).not.toContain('Acero');
  });

  it.each(['excedidas', 'gastos-partida'] as const)(
    'la acción de %s abre la partida entre versiones',
    async (origen) => {
      const fixture = TestBed.createComponent(ControlPresupuestario);
      await fixture.whenStable();
      if (origen === 'gastos-partida') fixture.componentInstance.cambiarVista('gastos-partida');
      await fixture.whenStable();
      const host: HTMLElement = fixture.nativeElement;
      const alcance = origen === 'excedidas' ? '.table-wrap' : '.table-wrap--sticky-actions';
      host.querySelector<HTMLButtonElement>(`${alcance} tbody button`)!.click();
      await fixture.whenStable();
      expect(api.movimientosConsolidados).toHaveBeenCalledExactlyOnceWith(10, 25);
      expect(host.querySelector('dialog')?.textContent).toContain('Historial consolidado');
    },
  );

  it('gastos por centro no ofrece historial de partida', async () => {
    const fixture = TestBed.createComponent(ControlPresupuestario);
    await fixture.whenStable();
    fixture.componentInstance.cambiarVista('gastos-centro');
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.table-wrap--sticky-actions tbody button')).toBeNull();
    expect(api.movimientosConsolidados).not.toHaveBeenCalled();
  });

  it.each(['control_presupuestario.reporte.ver', 'control_presupuestario.movimiento.ver'])(
    'la plantilla oculta acciones sin %s',
    async (faltante) => {
      sesion.hasPermission.mockImplementation((permiso: string) => permiso !== faltante);
      const fixture = TestBed.createComponent(ControlPresupuestario);
      await fixture.whenStable();
      const host: HTMLElement = fixture.nativeElement;
      expect(
        Array.from(host.querySelectorAll('button')).filter(
          (e) => e.textContent?.trim() === 'Historial',
        ),
      ).toHaveLength(0);
    },
  );
});
