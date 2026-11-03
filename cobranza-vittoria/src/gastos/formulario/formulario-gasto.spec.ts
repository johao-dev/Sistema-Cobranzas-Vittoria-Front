import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { ReferenciasGastos } from '../referencias-gastos';
import { RegistroGastosDirectos } from '../registro-gastos-directos';
import { GastoDirectoGuardado, PartidaDisponibleGastoDirecto } from '../contratos-gastos-directos';
import { categoriasGastoPrueba, gastoPrueba, partidaGastoPrueba } from '../gastos.fixture';
import {
  botonGasto,
  escribirGasto,
  seleccionarGasto,
  simularDialogosGastos,
  restaurarDialogosGastos,
} from '../pruebas/dom-gastos';
import { FormularioGasto } from './formulario-gasto';

describe('FormularioGasto: partidas, importes y guardado', () => {
  let fixture: ComponentFixture<FormularioGasto>;
  let permiso: boolean;
  const api = {
    partidasDisponibles: vi.fn<() => Observable<PartidaDisponibleGastoDirecto[]>>(),
    crear: vi.fn<() => Observable<GastoDirectoGuardado>>(),
    actualizar: vi.fn<() => Observable<GastoDirectoGuardado>>(),
  };
  beforeEach(() => {
    vi.resetAllMocks();
    simularDialogosGastos();
    permiso = true;
    api.partidasDisponibles.mockReturnValue(of([partidaGastoPrueba]));
    api.crear.mockReturnValue(of({ idGastoDirecto: 90 }));
    api.actualizar.mockReturnValue(of({ idGastoDirecto: 90 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroGastosDirectos, useValue: api },
        { provide: SesionUsuario, useValue: { hasPermission: () => permiso } },
        { provide: Notificaciones, useValue: { show: vi.fn() } },
        {
          provide: ReferenciasGastos,
          useValue: {
            categorias: signal(categoriasGastoPrueba),
            centrosCosto: signal([
              { idCentroCosto: 12, codigo: 'CC-12', nombre: 'Proyecto' },
              { idCentroCosto: 20, codigo: 'CC-20', nombre: 'Oficina' },
            ]),
            proveedores: signal([]),
            monedas: signal([
              { idMoneda: 1, codigo: 'PEN', nombre: 'Soles', simbolo: 'S/', activo: true },
              { idMoneda: 2, codigo: 'USD', nombre: 'Dólares', simbolo: '$', activo: true },
            ]),
          },
        },
      ],
    });
  });
  afterEach(restaurarDialogosGastos);

  async function abrir(edicion = true): Promise<void> {
    fixture = TestBed.createComponent(FormularioGasto);
    fixture.componentRef.setInput('valor', edicion ? gastoPrueba : null);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('selecciona gastos administrativos por código al crear, sin depender del ID ni del orden', async () => {
    TestBed.inject(ReferenciasGastos).categorias.set([
      ...categoriasGastoPrueba.slice(1),
      { ...categoriasGastoPrueba[0], idCategoriaGasto: 731 },
    ]);
    await abrir(false);
    const raiz: HTMLElement = fixture.nativeElement;
    const selector = raiz.querySelector<HTMLSelectElement>('#formulario-gasto-campo-1');
    expect(selector?.selectedOptions[0]?.textContent?.trim()).toBe('GASTOS ADMINISTRATIVOS');

    await seleccionarGasto(fixture, '#formulario-gasto-campo-2', 'Proyecto');
    await seleccionarGasto(fixture, '#formulario-gasto-campo-3', 'Estudios');
    await escribirGasto(fixture, '#formulario-gasto-campo-6', 'Nuevo gasto administrativo');
    await escribirGasto(fixture, '#formulario-gasto-campo-4', '100');
    botonGasto(fixture, 'Guardar gasto').click();
    expect(api.crear).toHaveBeenCalledWith(expect.objectContaining({ idCategoriaGasto: 731 }));
  });

  it('deja la categoría sin seleccionar si gastos administrativos no está disponible', async () => {
    TestBed.inject(ReferenciasGastos).categorias.set([categoriasGastoPrueba[4]]);
    await abrir(false);
    const raiz: HTMLElement = fixture.nativeElement;
    const selector = raiz.querySelector<HTMLSelectElement>('#formulario-gasto-campo-1');
    expect(selector?.value).toBe('');
    botonGasto(fixture, 'Guardar gasto').click();
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Selecciona una categoría de gasto disponible');
    expect(api.crear).not.toHaveBeenCalled();
  });

  it('edita preservando fechas, moneda de partida y referencia original', async () => {
    await abrir();
    botonGasto(fixture, 'Guardar gasto').click();
    expect(api.actualizar).toHaveBeenCalledWith(90, {
      idPresupuestoDetalle: 42,
      idCategoriaGasto: 13,
      idProveedor: null,
      idMoneda: 1,
      fecha: '2026-10-07',
      concepto: 'Estudio técnico',
      descripcion: null,
      monto: 100,
      idMonedaOriginal: 2,
      montoOriginal: 25,
      tipoCambio: 4,
      fechaTipoCambio: '2026-10-07',
    });
  });

  it('ofrece todo el catálogo y permite cambiar de categoría al editar', async () => {
    await abrir();
    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.querySelectorAll('#formulario-gasto-campo-1 option')).toHaveLength(8);
    await seleccionarGasto(fixture, '#formulario-gasto-campo-1', 'MARKETING Y VENTAS');
    botonGasto(fixture, 'Guardar gasto').click();
    expect(api.actualizar).toHaveBeenCalledWith(
      90,
      expect.objectContaining({ idCategoriaGasto: 22 }),
    );
  });

  it.each([null, 999])(
    'exige elegir una categoría vigente si la original es %s',
    async (idCategoriaGasto) => {
      fixture = TestBed.createComponent(FormularioGasto);
      fixture.componentRef.setInput('valor', {
        ...gastoPrueba,
        idCategoriaGasto,
        nombreCategoriaGasto: null,
      });
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain('no está disponible');
      botonGasto(fixture, 'Guardar gasto').click();
      expect(api.actualizar).not.toHaveBeenCalled();
      await seleccionarGasto(fixture, '#formulario-gasto-campo-1', 'OTROS GASTOS');
      botonGasto(fixture, 'Guardar gasto').click();
      expect(api.actualizar).toHaveBeenCalledWith(
        90,
        expect.objectContaining({ idCategoriaGasto: 35 }),
      );
    },
  );

  it('el cálculo sugerido solo cambia el monto cuando el usuario lo aplica', async () => {
    await abrir();
    await escribirGasto(fixture, '#formulario-gasto-campo-11', '3');
    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.querySelector<HTMLInputElement>('#formulario-gasto-campo-4')?.value).toBe('100');
    botonGasto(fixture, 'Usar como monto').click();
    await fixture.whenStable();
    expect(raiz.querySelector<HTMLInputElement>('#formulario-gasto-campo-4')?.value).toBe('75');
  });

  it('valida la categoría obligatoria y crea en moneda presupuestaria sin confirmar', async () => {
    await abrir(false);
    await seleccionarGasto(fixture, '#formulario-gasto-campo-1', 'Seleccione');
    botonGasto(fixture, 'Guardar gasto').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'Selecciona una categoría de gasto disponible',
    );
    expect(api.crear).not.toHaveBeenCalled();
    await seleccionarGasto(fixture, '#formulario-gasto-campo-1', 'GASTOS ADMINISTRATIVOS');
    await seleccionarGasto(fixture, '#formulario-gasto-campo-2', 'Proyecto');
    await seleccionarGasto(fixture, '#formulario-gasto-campo-3', 'Estudios');
    await escribirGasto(fixture, '#formulario-gasto-campo-6', 'Nuevo estudio');
    await escribirGasto(fixture, '#formulario-gasto-campo-4', '900');
    expect(fixture.nativeElement.textContent).toContain('El monto supera el saldo disponible');
    botonGasto(fixture, 'Guardar gasto').click();
    expect(api.crear).toHaveBeenCalledWith(
      expect.objectContaining({ idCategoriaGasto: 61, idMoneda: 1, monto: 900 }),
    );
  });

  it('bloquea guardados/cierre duplicados y conserva el borrador ante un rechazo', async () => {
    const respuesta = new Subject<GastoDirectoGuardado>();
    api.actualizar.mockReturnValue(respuesta);
    await abrir();
    const cerrado = vi.fn();
    fixture.componentInstance.cancelar.subscribe(cerrado);
    botonGasto(fixture, 'Guardar gasto').click();
    botonGasto(fixture, 'Guardar gasto').click();
    botonGasto(fixture, 'Cancelar').click();
    expect(api.actualizar).toHaveBeenCalledTimes(1);
    expect(cerrado).not.toHaveBeenCalled();
    respuesta.error({ error: { errors: { Monto: ['Monto rechazado'] } } });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Monto rechazado');
    expect(botonGasto(fixture, 'Guardar gasto').disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('#formulario-gasto-campo-6').value).toBe(
      'Estudio técnico',
    );
  });

  it('cancela partidas del centro anterior y no permite guardar una selección desactualizada', async () => {
    const anterior = new Subject<PartidaDisponibleGastoDirecto[]>();
    const actual = new Subject<PartidaDisponibleGastoDirecto[]>();
    api.partidasDisponibles.mockReturnValueOnce(anterior).mockReturnValue(actual);
    await abrir();
    await seleccionarGasto(fixture, '#formulario-gasto-campo-2', 'Oficina');
    expect(anterior.observed).toBe(false);
    actual.next([]);
    actual.complete();
    anterior.next([partidaGastoPrueba]);
    await fixture.whenStable();
    botonGasto(fixture, 'Guardar gasto').click();
    await fixture.whenStable();
    expect(api.actualizar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Selecciona la partida');
  });

  it('un fallo de partidas ofrece reintento y destruir el formulario cancela la consulta', async () => {
    const respuesta = new Subject<PartidaDisponibleGastoDirecto[]>();
    api.partidasDisponibles.mockReturnValue(respuesta);
    await abrir();
    respuesta.error({ error: { message: 'Partidas no disponibles' } });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Partidas no disponibles');
    const reintento = new Subject<PartidaDisponibleGastoDirecto[]>();
    api.partidasDisponibles.mockReturnValue(reintento);
    botonGasto(fixture, 'Reintentar partidas').click();
    expect(reintento.observed).toBe(true);
    fixture.destroy();
    expect(reintento.observed).toBe(false);
  });

  it('no guarda sin permiso de operar', async () => {
    permiso = false;
    await abrir();
    botonGasto(fixture, 'Guardar gasto').click();
    expect(api.actualizar).not.toHaveBeenCalled();
  });
});
