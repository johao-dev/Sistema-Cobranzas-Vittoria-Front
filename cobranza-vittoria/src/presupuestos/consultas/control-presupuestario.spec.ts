import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ControlPresupuestario } from './control-presupuestario';
import { ConsultasPresupuestarias } from './consultas-presupuestarias';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { CatalogoCentrosCosto } from '../centros-costo/catalogo-centros-costo';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { FilaReportePresupuestario } from './contratos-consultas-presupuestarias';
import { presupuestoPrueba } from '../presupuestos.fixture';

describe('ControlPresupuestario: selección y consultas concurrentes', () => {
  const api = { saldos: vi.fn(), presupuestoVsComprometido: vi.fn(), resumen: vi.fn() };
  const notificaciones = { show: vi.fn() };
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    notificaciones.show.mockReset();
    api.saldos.mockReturnValue(of([]));
    api.presupuestoVsComprometido.mockReturnValue(of([]));
    api.resumen.mockReturnValue(of({ totales: null, porCentroCosto: [], partidasExcedidas: [] }));
    TestBed.configureTestingModule({
      providers: [
        { provide: ConsultasPresupuestarias, useValue: api },
        { provide: RegistroPresupuestos, useValue: {} },
        { provide: CatalogoCentrosCosto, useValue: {} },
        { provide: Notificaciones, useValue: notificaciones },
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
});
