import { TestBed } from '@angular/core/testing';
import { AvisoNotificacion } from './aviso-notificacion';
import { Notificaciones } from '../notificaciones';

describe('AvisoNotificacion', () => {
  it('anuncia los mensajes y actualiza el DOM sin detección manual de cambios', async () => {
    const fixture = TestBed.createComponent(AvisoNotificacion);
    await fixture.whenStable();
    const elemento: unknown = fixture.nativeElement;
    if (!(elemento instanceof HTMLElement)) throw new Error('Falta la notificación');
    const notificaciones = TestBed.inject(Notificaciones);
    const control = elemento.querySelector('[role="status"]');
    expect(control?.getAttribute('aria-live')).toBe('polite');
    expect(elemento.querySelector('.notification-message')?.textContent?.trim()).toBe('');

    notificaciones.show('Guardado correctamente.');
    await fixture.whenStable();
    expect(control?.classList.contains('show')).toBe(true);
    expect(control?.classList.contains('success')).toBe(true);
    expect(elemento.textContent).toContain('Guardado correctamente.');

    notificaciones.show('No se pudo guardar.', 'error');
    await fixture.whenStable();
    expect(control?.classList.contains('error')).toBe(true);
    expect(elemento.textContent).toContain('No se pudo guardar.');
    expect(elemento.textContent).not.toContain('Guardado correctamente.');
  });
});
