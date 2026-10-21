import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';

import { SalidaDesdeCompra } from './salida-desde-compra';
import { RegistroKardexCompras } from './registro-kardex-compras';
import { SalidaCompraRegistrada } from './contratos-kardex-compras';
import { comprasParaSalida, presentarMovimientosCompra } from './datos-kardex-compras';
import { movimientoPrueba } from '../inventario.fixture';
import {
  especialidadesPrueba,
  seleccionarInventario,
  botonInventario,
  escribirInventario,
} from '../pruebas/dom-inventario';

describe('SalidaDesdeCompra — selección y envío legacy', () => {
  const api = { registrarSalida: vi.fn<() => Observable<SalidaCompraRegistrada>>() };
  let fixture: ComponentFixture<SalidaDesdeCompra>;

  beforeEach(async () => {
    vi.resetAllMocks();
    api.registrarSalida.mockReturnValue(
      of({ ok: true, stockActual: 5, mensaje: 'Salida confirmada' }),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: RegistroKardexCompras, useValue: api }],
    });
    fixture = TestBed.createComponent(SalidaDesdeCompra);
    fixture.componentRef.setInput(
      'compras',
      comprasParaSalida(presentarMovimientosCompra([movimientoPrueba])),
    );
    fixture.componentRef.setInput('especialidades', especialidadesPrueba);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('deriva material/especialidad/observación de RQ y envía solo el DTO documentado', async () => {
    const registrada = vi.fn();

    fixture.componentInstance.registrada.subscribe(registrada);
    await seleccionarInventario(fixture, '#salida-desde-compra-campo-1', 'Compra 1');
    botonInventario(fixture, 'Actualizar salidas').click();

    expect(api.registrarSalida).toHaveBeenCalledWith({
      idCompra: 9,
      idMaterial: 10,
      idEspecialidad: 2,
      fechaMovimiento: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      cantidadSalida: 1,
      observacion: 'Ingresado por Requerimiento RQ-1',
    });
    expect(registrada).toHaveBeenCalledWith('Salida confirmada');
  });

  it('rechaza cantidad cero o negativa en el flujo ligado a compras', async () => {
    await seleccionarInventario(fixture, '#salida-desde-compra-campo-1', 'Compra 1');
    for (const valor of ['0', '-1']) {
      await escribirInventario(fixture, 'input[type=number]', valor);
      botonInventario(fixture, 'Actualizar salidas').click();
    }

    expect(api.registrarSalida).not.toHaveBeenCalled();
  });

  it('bloquea duplicados y conserva la selección ante un error', async () => {
    const respuesta = new Subject<SalidaCompraRegistrada>();

    api.registrarSalida.mockReturnValue(respuesta);
    await seleccionarInventario(fixture, '#salida-desde-compra-campo-1', 'Compra 1');
    botonInventario(fixture, 'Actualizar salidas').click();
    await fixture.whenStable();

    expect(botonInventario(fixture, 'Actualizar salidas').disabled).toBe(true);
    botonInventario(fixture, 'Actualizar salidas').click();
    respuesta.error({ error: { message: 'Stock insuficiente' } });
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('Stock insuficiente');
    expect(api.registrarSalida).toHaveBeenCalledOnce();
    expect(botonInventario(fixture, 'Actualizar salidas').disabled).toBe(false);
  });
});
