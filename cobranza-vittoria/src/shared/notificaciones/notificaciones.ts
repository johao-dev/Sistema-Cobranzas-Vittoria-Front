import { Injectable, signal } from '@angular/core';

export type TipoNotificacion = 'success' | 'error' | 'info';

export interface EstadoNotificacion {
  message: string;
  type: TipoNotificacion;
  visible: boolean;
}

@Injectable({ providedIn: 'root' })
export class Notificaciones {
  readonly state = signal<EstadoNotificacion>({
    message: '',
    type: 'info',
    visible: false,
  });

  private timeoutRef: ReturnType<typeof setTimeout> | undefined;

  show(message: string, type: TipoNotificacion = 'success', duration = 3000): void {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }

    this.state.set({ message, type, visible: true });

    this.timeoutRef = setTimeout(() => {
      this.state.update((curr) => ({ ...curr, visible: false }));
    }, duration);
  }
}
