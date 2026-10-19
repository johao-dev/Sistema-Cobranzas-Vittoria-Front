import { Component, DestroyRef, inject, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { SesionUsuario } from '../core/sesion/sesion-usuario';
import { LoginPayload } from '../core/sesion/contratos-sesion';
import { NotificationService } from '../app/core/services/notification.service';
import { extraerMensajeError } from '../app/core/utils/api-error.util';

@Component({
  selector: 'inicio-sesion',
  imports: [FormsModule],
  templateUrl: './inicio-sesion.html',
  styleUrl: './inicio-sesion.css',
})
export class InicioSesion {
  private readonly sesion: SesionUsuario = inject(SesionUsuario);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  protected readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly showPassword: WritableSignal<boolean> = signal(false);
  protected readonly form: LoginPayload = { usernameOrEmail: '', password: '' };

  protected submit(): void {
    if (this.loading()) return;

    if (!this.form.usernameOrEmail.trim() || !this.form.password.trim()) {
      this.notifications.show('Ingresa tu usuario y contraseña.', 'info');
      return;
    }

    const credenciales: LoginPayload = {
      usernameOrEmail: this.form.usernameOrEmail.trim(),
      password: this.form.password,
    };

    this.loading.set(true);
    this.sesion
      .login(credenciales)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: () => {
          const returnUrl: string =
            this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
          void this.router.navigateByUrl(returnUrl);
        },
        error: (error: unknown) => {
          // No mostrar el mensaje técnico que HttpClient genera cuando el servidor no envía cuerpo.
          const respuesta: unknown = error instanceof HttpErrorResponse ? error.error : undefined;
          const mensaje: string = extraerMensajeError(
            { error: respuesta },
            'Usuario o contraseña incorrectos.',
          );
          this.notifications.show(mensaje, 'error');
        },
      });
  }
}
