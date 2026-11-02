import { centroPrueba } from '../presupuestos.fixture';
import { ListaPartidas } from '../partidas/lista-partidas';
import { ListaCentrosCosto } from '../centros-costo/lista-centros-costo';
import { simularDialogosPresupuestos } from '../dialogos.fixture';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { FormularioPresupuesto } from '../formulario-presupuesto/formulario-presupuesto';
import { ImportacionPresupuesto } from '../importacion/importacion-presupuesto';
import { CargaMontosPresupuesto } from '../carga-montos/carga-montos-presupuesto';
import { FormularioCentroCosto } from '../centros-costo/formulario-centro-costo';
import { FormularioPartida } from '../partidas/formulario-partida';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { CatalogoCentrosCosto } from '../centros-costo/catalogo-centros-costo';
import { CatalogoPartidas } from '../partidas/catalogo-partidas';
import { CatalogosPresupuestarios } from '../catalogos-presupuestarios';
import { NotificationService } from '../../app/core/services/notification.service';
import { CatalogoProyectos } from '../../catalogos/proyectos/catalogo-proyectos';
import { partidaPrueba, detallePrueba, presupuestoPrueba } from '../presupuestos.fixture';

describe('Operaciones presupuestarias separadas por concepto', () => {
  let restaurarDialogos: () => void;
  const api = {
    crearPresupuesto: vi.fn(),
    actualizarPresupuesto: vi.fn(),
    cargarDetallesLote: vi.fn(),
    importarPresupuesto: vi.fn(),
    importarEstructura: vi.fn(),
    guardarCentroCosto: vi.fn(),
    guardarPartida: vi.fn(),
  };
  const notificaciones = { show: vi.fn() };

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    notificaciones.show.mockReset();
    restaurarDialogos = simularDialogosPresupuestos();
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroPresupuestos, useValue: api },
        { provide: CatalogoCentrosCosto, useValue: api },
        { provide: CatalogoPartidas, useValue: api },
        { provide: CatalogosPresupuestarios, useValue: {} },
        { provide: NotificationService, useValue: notificaciones },
        { provide: CatalogoProyectos, useValue: {} },
      ],
    });
  });
  afterEach(() => {
    restaurarDialogos();
    vi.restoreAllMocks();
  });

  function formulario(edicion = false) {
    const fixture = TestBed.createComponent(FormularioPresupuesto);
    fixture.componentRef.setInput('centrosCosto', []);
    fixture.componentRef.setInput('monedas', []);
    if (edicion) fixture.componentRef.setInput('presupuesto', presupuestoPrueba());
    fixture.detectChanges();
    return fixture;
  }

  it('exige centro, moneda, código, nombre y fechas coherentes antes de crear', () => {
    const pagina = formulario().componentInstance;
    for (const datos of [
      {},
      { idCentroCosto: 1 },
      { idCentroCosto: 1, idMoneda: 1 },
      { idCentroCosto: 1, idMoneda: 1, codigo: 'P' },
      {
        idCentroCosto: 1,
        idMoneda: 1,
        codigo: 'P',
        nombre: 'Obra',
        fechaInicio: '2026-02-02',
        fechaFin: '2026-02-01',
      },
    ]) {
      pagina['form'] = { ...pagina.formVacio(), ...datos };
      pagina.guardarPresupuesto();
    }
    expect(api.crearPresupuesto).not.toHaveBeenCalled();
  });

  it('pide confirmación ante 409 y reenvía explícitamente la inactivación', () => {
    const pagina = formulario(true).componentInstance;
    pagina['form'].activo = false;
    api.actualizarPresupuesto
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { error: 'PRESUPUESTO_CON_REGISTROS', message: 'Tiene gastos' },
            }),
        ),
      )
      .mockReturnValueOnce(of({}));
    pagina.guardarPresupuesto();
    expect(pagina['modalConfirmarInactivar']()).toBe(true);
    expect(pagina['guardando']()).toBe(false);
    pagina.confirmarInactivacion();
    expect(api.actualizarPresupuesto).toHaveBeenLastCalledWith(10, pagina['form'], true);
    expect(pagina['modalConfirmarInactivar']()).toBe(false);
  });

  it('no interpreta otros conflictos como confirmación de inactivación', () => {
    const pagina = formulario(true).componentInstance;
    api.actualizarPresupuesto.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Conflicto' } })),
    );
    pagina.guardarPresupuesto();
    expect(pagina['modalConfirmarInactivar']()).toBe(false);
    expect(notificaciones.show).toHaveBeenCalledWith('Conflicto', 'error');
  });

  it('bloquea duplicados y conserva datos al fallar el guardado', () => {
    const pagina = formulario(true).componentInstance;
    const respuesta = new Subject<object>();
    api.actualizarPresupuesto.mockReturnValue(respuesta);
    pagina.guardarPresupuesto();
    pagina.guardarPresupuesto();
    expect(api.actualizarPresupuesto).toHaveBeenCalledTimes(1);
    respuesta.error(new Error('Falla'));
    expect(pagina['guardando']()).toBe(false);
    expect(pagina['form'].nombre).toBe('Concreto');
  });

  function carga() {
    const fixture = TestBed.createComponent(CargaMontosPresupuesto);
    for (const [clave, valor] of Object.entries({
      idPresupuesto: 10,
      idVersion: 20,
      numeroVersion: 1,
      partidas: [partidaPrueba()],
      detalles: [detallePrueba()],
    }))
      fixture.componentRef.setInput(clave, valor);
    fixture.detectChanges();
    return fixture;
  }

  it('rechaza una carga completa con monto vacío, negativo o no finito', () => {
    const pagina = carga().componentInstance;
    for (const monto of [null, -1, NaN, Infinity]) {
      pagina['filas'].at(0).controls.monto.setValue(monto);
      pagina['guardar']();
    }
    expect(api.cargarDetallesLote).not.toHaveBeenCalled();
  });

  it('una búsqueda no elimina montos del lote; 0 y observaciones existentes se conservan', () => {
    const pagina = carga().componentInstance;
    pagina['busqueda'].set('sin coincidencias');
    pagina['filas'].at(0).controls.monto.setValue(0);
    api.cargarDetallesLote.mockReturnValue(of({ agregados: 0, actualizados: 1 }));
    pagina['guardar']();
    expect(api.cargarDetallesLote).toHaveBeenCalledWith(10, 20, [
      { idCatalogoPartida: 2, montoPresupuestado: 0, observacion: 'Incluye transporte' },
    ]);
  });

  function importacion() {
    const fixture = TestBed.createComponent(ImportacionPresupuesto);
    fixture.componentRef.setInput('idPresupuesto', 10);
    fixture.componentRef.setInput('idVersion', 20);
    fixture.componentRef.setInput('numeroVersion', 1);
    fixture.detectChanges();
    fixture.componentInstance['archivoImportar'].set(new File(['x'], 'montos.csv'));
    return fixture;
  }

  it('conserva los errores por fila del 422 sin emitir una importación exitosa', () => {
    const pagina = importacion().componentInstance;
    const emitido = vi.fn();
    pagina.importado.subscribe(emitido);
    const errores = [
      { fila: 2, campo: 'Monto', codigoError: 'MONTO_INVALIDO', mensaje: 'Revisa el monto' },
    ];
    api.importarPresupuesto.mockReturnValue(
      throwError(() => ({ error: { errores, message: 'Lote rechazado' } })),
    );
    pagina.importar();
    expect(pagina['erroresImportar']()).toEqual(errores);
    expect(pagina.filaExcel(2)).toBe(3);
    expect(pagina['guardando']()).toBe(false);
    expect(emitido).not.toHaveBeenCalled();
  });

  it('la estructura emite el resultado una vez y preserva quitarAusentes', () => {
    const pagina = importacion().componentInstance;
    pagina['quitarAusentesImportar'].set(true);
    const emitido = vi.fn();
    pagina.importado.subscribe(emitido);
    api.importarEstructura.mockReturnValue(of({ partidasCreadas: 2 }));
    pagina.importarEstructura();
    expect(api.importarEstructura).toHaveBeenCalledWith(10, 20, expect.any(File), true);
    expect(emitido).toHaveBeenCalledExactlyOnceWith({ partidasCreadas: 2 });
  });

  it('destruir el importador cancela la suscripción y evita resultados tardíos', () => {
    const fixture = importacion();
    const respuesta = new Subject<object>();
    api.importarPresupuesto.mockReturnValue(respuesta);
    const emitido = vi.fn();
    fixture.componentInstance.importado.subscribe(emitido);
    fixture.componentInstance.importar();
    fixture.destroy();
    respuesta.next({});
    expect(emitido).not.toHaveBeenCalled();
  });

  it('centro de tipo PROYECTO requiere asociación y otro tipo limpia el proyecto', () => {
    const fixture = TestBed.createComponent(FormularioCentroCosto);
    fixture.componentRef.setInput('tipos', [
      {
        idTipoCentroCosto: 1,
        codigo: 'PROYECTO',
        nombre: 'Proyecto',
        descripcion: null,
        activo: true,
      },
    ]);
    fixture.componentRef.setInput('proyectos', []);
    const centro = fixture.componentInstance;
    centro['form'] = { ...centro.formVacio(), codigo: 'CC', nombre: 'Obra', idTipoCentroCosto: 1 };
    centro.save();
    expect(api.guardarCentroCosto).not.toHaveBeenCalled();
    centro['form'].idProyecto = 3;
    centro['form'].idTipoCentroCosto = 2;
    centro.onTipoChange();
    expect(centro['form'].idProyecto).toBe('');
  });

  it('una partida exige código, nombre y tipo', () => {
    const fixture = TestBed.createComponent(FormularioPartida);
    fixture.componentRef.setInput('tipos', []);
    fixture.componentRef.setInput('rows', []);
    const partida = fixture.componentInstance;
    partida['form'] = { ...partida.formVacio(), codigo: '01', nombre: 'Obra' };
    partida.save();
    expect(api.guardarPartida).not.toHaveBeenCalled();
  });
  it('impide cambiar dos veces el estado de una partida y permite reintentar tras un error', () => {
    vi.spyOn(ListaPartidas.prototype, 'ngOnInit').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const pagina = TestBed.createComponent(ListaPartidas).componentInstance;
    const respuesta = new Subject<object>();
    api.guardarPartida.mockReturnValue(respuesta);
    pagina.cambiarEstado(partidaPrueba());
    pagina.cambiarEstado(partidaPrueba());
    expect(api.guardarPartida).toHaveBeenCalledTimes(1);
    respuesta.error(new Error('Sin conexión'));
    expect(pagina.guardando).toBe(false);
  });

  it('impide cambiar dos veces el estado de un centro de costo', () => {
    vi.spyOn(ListaCentrosCosto.prototype, 'ngOnInit').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const pagina = TestBed.createComponent(ListaCentrosCosto).componentInstance;
    const respuesta = new Subject<object>();
    api.guardarCentroCosto.mockReturnValue(respuesta);
    pagina.cambiarEstado(centroPrueba());
    pagina.cambiarEstado(centroPrueba());
    expect(api.guardarCentroCosto).toHaveBeenCalledTimes(1);
    respuesta.complete();
    expect(pagina.guardando).toBe(false);
  });
});
