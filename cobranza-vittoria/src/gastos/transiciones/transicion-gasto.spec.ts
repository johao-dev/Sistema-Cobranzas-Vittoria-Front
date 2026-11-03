import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { RegistroGastosDirectos } from '../registro-gastos-directos';
import {
  AccionGasto,
  GastoDirectoListado,
  GastoDirectoTransicion,
} from '../contratos-gastos-directos';
import { gastoPrueba } from '../gastos.fixture';
import { botonGasto, simularDialogosGastos, restaurarDialogosGastos } from '../pruebas/dom-gastos';
import { TransicionGasto } from './transicion-gasto';

describe('Transiciones de Gastos', () => {
  let fixture: ComponentFixture<TransicionGasto>;
  let permiso: boolean;
  const api = { confirmar: vi.fn(), anular: vi.fn() };
  const notifications = { show: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    simularDialogosGastos();
    permiso = true;
    api.confirmar.mockReturnValue(of({ ok: true, idGastoDirecto: 90, estado: 'CONFIRMADO' }));
    api.anular.mockReturnValue(of({ ok: true, idGastoDirecto: 90, estado: 'ANULADO' }));
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroGastosDirectos, useValue: api },
        { provide: Notificaciones, useValue: notifications },
        { provide: SesionUsuario, useValue: { hasPermission: () => permiso } },
      ],
    });
  });
  afterEach(restaurarDialogosGastos);
  async function abrir(
    accion: AccionGasto,
    gasto: GastoDirectoListado = gastoPrueba,
  ): Promise<void> {
    fixture = TestBed.createComponent(TransicionGasto);
    fixture.componentRef.setInput('gasto', gasto);
    fixture.componentRef.setInput('accion', accion);
    fixture.detectChanges();
    await fixture.whenStable();
  }
  it.each(['confirmar', 'anular'] as const)('%s recarga solo tras éxito', async (accion) => {
    await abrir(accion);
    const actualizado = vi.fn();
    fixture.componentInstance.actualizado.subscribe(actualizado);
    botonGasto(fixture, accion === 'confirmar' ? 'Confirmar gasto' : 'Anular gasto').click();
    expect(api[accion]).toHaveBeenCalledExactlyOnceWith(90);
    expect(actualizado).toHaveBeenCalledTimes(1);
  });
  it('anular un confirmado informa la devolución mediante ajuste', async () => {
    await abrir('anular', { ...gastoPrueba, estado: 'CONFIRMADO' });
    botonGasto(fixture, 'Anular gasto').click();
    expect(notifications.show).toHaveBeenCalledWith(
      'Gasto anulado: se devolvió el monto con un ajuste.',
      'success',
    );
  });
  it.each([
    ['confirmar', { ...gastoPrueba, estado: 'CONFIRMADO' }],
    ['confirmar', { ...gastoPrueba, codigoPresupuesto: 'HIST-2025' }],
    ['anular', { ...gastoPrueba, estado: 'ANULADO' }],
  ] as const)('impide %s en un estado incompatible', async (accion, gasto) => {
    await abrir(accion, gasto);
    botonGasto(fixture, accion === 'confirmar' ? 'Confirmar gasto' : 'Anular gasto').click();
    expect(api[accion]).not.toHaveBeenCalled();
  });
  it('no escribe sin permiso ni duplica solicitudes y permite reintento ante 409', async () => {
    const respuesta = new Subject<GastoDirectoTransicion>();
    api.confirmar.mockReturnValue(respuesta);
    await abrir('confirmar');
    permiso = false;
    botonGasto(fixture, 'Confirmar gasto').click();
    expect(api.confirmar).not.toHaveBeenCalled();
    permiso = true;
    botonGasto(fixture, 'Confirmar gasto').click();
    botonGasto(fixture, 'Confirmar gasto').click();
    expect(api.confirmar).toHaveBeenCalledTimes(1);
    respuesta.error({ error: { message: 'Saldo insuficiente' } });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Saldo insuficiente');
    expect(botonGasto(fixture, 'Confirmar gasto').disabled).toBe(false);
  });
});
