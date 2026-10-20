import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { CambioEstadoOrden } from './cambio-estado-orden';
import { RegistroOrdenesCompra } from '../registro-ordenes-compra';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { NotificationService } from '../../app/core/services/notification.service';
import { ordenPrueba } from '../ordenes-compra.fixture';

describe('CambioEstadoOrden', () => {
  let usuario: number;
  const registro = { cambiarEstado: vi.fn(() => of({ ok: true })) };
  const notificaciones = { show: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    // jsdom no implementa este límite nativo; el componente y su estado siguen siendo reales.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    usuario = 99;
    registro.cambiarEstado.mockReturnValue(of({ ok: true }));
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroOrdenesCompra, useValue: registro },
        {
          provide: SesionUsuario,
          useValue: {
            get session() {
              return { idUsuario: usuario };
            },
          },
        },
        { provide: NotificationService, useValue: notificaciones },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });

  async function preparar() {
    const fixture = TestBed.createComponent(CambioEstadoOrden);
    fixture.componentRef.setInput('cambio', { orden: ordenPrueba, destino: 'APROBADA' });
    await fixture.whenStable();
    const raiz: HTMLElement = fixture.nativeElement;
    const confirmar = raiz.querySelector<HTMLButtonElement>('.toolbar button');
    const textarea = raiz.querySelector<HTMLTextAreaElement>('textarea');
    const dialogo = raiz.querySelector('dialog');
    if (!confirmar || !textarea || !dialogo) throw new Error('Falta formulario de confirmación');
    return { fixture, raiz, confirmar, textarea, dialogo };
  }

  it('requiere sesión, recorta observación y comunica la orden actualizada', async () => {
    const { fixture, raiz, confirmar, textarea } = await preparar();
    usuario = 0;
    confirmar.click();
    await fixture.whenStable();
    expect(registro.cambiarEstado).not.toHaveBeenCalled();
    expect(raiz.textContent).toContain('Vuelve a iniciar sesión');
    usuario = 99;
    textarea.value = '  Revisado  ';
    textarea.dispatchEvent(new Event('input'));
    const completada = vi.fn();
    fixture.componentInstance.completada.subscribe(completada);
    confirmar.click();
    expect(registro.cambiarEstado).toHaveBeenCalledWith(8, {
      estadoNuevo: 'APROBADA',
      idUsuario: 99,
      observacion: 'Revisado',
    });
    expect(completada).toHaveBeenCalledWith(8);
    expect(notificaciones.show).toHaveBeenCalledWith(
      'O.C. OC-8 aprobada correctamente.',
      'success',
    );
  });

  it('bloquea duplicados y Escape durante PATCH, muestra 403 y permite recuperación', async () => {
    const pendiente = new Subject<{ ok: boolean }>();
    registro.cambiarEstado.mockReturnValueOnce(pendiente);
    const { fixture, raiz, confirmar, dialogo } = await preparar();
    const cerrar = vi.fn();
    fixture.componentInstance.cerrar.subscribe(cerrar);
    confirmar.click();
    confirmar.click();
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(registro.cambiarEstado).toHaveBeenCalledOnce();
    expect(cerrar).not.toHaveBeenCalled();
    pendiente.error(new HttpErrorResponse({ status: 403 }));
    await fixture.whenStable();
    expect(raiz.textContent).toContain('No tienes permiso');
    expect(confirmar.disabled).toBe(false);
    confirmar.click();
    expect(registro.cambiarEstado).toHaveBeenCalledTimes(2);
  });

  it('rechaza una transición no permitida aunque se solicite fuera de la plantilla', async () => {
    const { fixture, confirmar } = await preparar();
    fixture.componentRef.setInput('cambio', {
      orden: { ...ordenPrueba, estado: 'ANULADA' },
      destino: 'APROBADA',
    });
    await fixture.whenStable();
    confirmar.click();
    expect(registro.cambiarEstado).not.toHaveBeenCalled();
  });
});
