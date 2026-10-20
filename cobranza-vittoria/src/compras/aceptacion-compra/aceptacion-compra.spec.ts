import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of } from 'rxjs';
import { AceptacionCompra, esCompraAceptable } from './aceptacion-compra';
import { RegistroCompras } from '../registro-compras';
import { compraPrueba } from '../compras.fixture';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { NotificationService } from '../../app/core/services/notification.service';
describe('AceptacionCompra — identidad y transición', () => {
  const api = { aceptarCompra: vi.fn<() => Observable<{ ok: boolean }>>() };
  const sesion = { session: { idUsuario: 99 } };
  let fixture: ComponentFixture<AceptacionCompra>;
  function confirmar(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.btn-success');
  }
  beforeEach(async () => {
    api.aceptarCompra.mockReset().mockReturnValue(of({ ok: true }));
    sesion.session.idUsuario = 99;
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroCompras, useValue: api },
        { provide: SesionUsuario, useValue: sesion },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(AceptacionCompra);
    fixture.componentRef.setInput('compra', compraPrueba);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });
  it('solo permite aceptar REGISTRADA sin aceptación previa', () => {
    expect(esCompraAceptable(compraPrueba)).toBe(true);
    expect(esCompraAceptable({ ...compraPrueba, Aceptada: true })).toBe(false);
    expect(esCompraAceptable({ ...compraPrueba, Estado: 'ACEPTADA' })).toBe(false);
  });
  it('conserva moneda y monto, envía identidad y observación recortada e impide duplicados', async () => {
    const respuesta = new Subject<{ ok: boolean }>();
    api.aceptarCompra.mockReturnValue(respuesta);
    const aceptada = vi.fn();
    fixture.componentInstance.aceptada.subscribe(aceptada);
    expect(fixture.nativeElement.textContent).toContain('$ 118.00');
    const input: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    input.value = '  Conforme  ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    confirmar().click();
    await fixture.whenStable();
    confirmar().click();
    expect(api.aceptarCompra).toHaveBeenCalledExactlyOnceWith(9, {
      idUsuario: 99,
      observacion: 'Conforme',
    });
    expect(confirmar().disabled).toBe(true);
    respuesta.next({ ok: true });
    respuesta.complete();
    await fixture.whenStable();
    expect(aceptada).toHaveBeenCalledOnce();
  });
  it('impide aceptar sin identidad de sesión', async () => {
    sesion.session.idUsuario = 0;
    confirmar().click();
    await fixture.whenStable();
    expect(api.aceptarCompra).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Vuelve a iniciar sesión');
  });
  it('restaura el envío ante un 403 y muestra el mensaje de permiso', async () => {
    const respuesta = new Subject<{ ok: boolean }>();
    api.aceptarCompra.mockReturnValue(respuesta);
    confirmar().click();
    respuesta.error(new HttpErrorResponse({ status: 403 }));
    await fixture.whenStable();
    expect(confirmar().disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No tienes permiso para aceptar compras.');
  });
  it('muestra conflictos presupuestarios sin cerrar la confirmación', async () => {
    const respuesta = new Subject<{ ok: boolean }>();
    api.aceptarCompra.mockReturnValue(respuesta);
    const aceptada = vi.fn();
    fixture.componentInstance.aceptada.subscribe(aceptada);
    confirmar().click();
    respuesta.error({ error: { message: 'Saldo insuficiente' } });
    await fixture.whenStable();
    expect(aceptada).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Saldo insuficiente');
  });
});
