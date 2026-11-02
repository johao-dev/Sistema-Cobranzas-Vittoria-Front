import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  afterEach(() => vi.useRealTimers());

  it('cancela el temporizador anterior al mostrar otra notificación', () => {
    vi.useFakeTimers();
    const servicio = TestBed.inject(NotificationService);
    servicio.show('Primera', 'info', 1000);
    vi.advanceTimersByTime(500);
    servicio.show('Segunda', 'success', 1000);
    vi.advanceTimersByTime(500);
    expect(servicio.state()).toEqual({ message: 'Segunda', type: 'success', visible: true });
    vi.advanceTimersByTime(500);
    expect(servicio.state().visible).toBe(false);
  });
});
