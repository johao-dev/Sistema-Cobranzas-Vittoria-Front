import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info';

export interface NotificationState {
  message: string;
  type: NotificationType;
  visible: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly state = signal<NotificationState>({
    message: '',
    type: 'info',
    visible: false
  });

  private timeoutRef: any;

  show(message: string, type: NotificationType = 'success', duration = 3000) {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }

    this.state.set({ message, type, visible: true });

    this.timeoutRef = setTimeout(() => {
      this.state.update(curr => ({ ...curr, visible: false }));
    }, duration);
  }
}
