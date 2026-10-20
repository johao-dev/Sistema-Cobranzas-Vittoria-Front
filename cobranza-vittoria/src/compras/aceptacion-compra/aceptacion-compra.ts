import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { NotificationService } from '../../app/core/services/notification.service';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import { CompraFilaSql } from '../contratos-compras';
import { RegistroCompras } from '../registro-compras';
export function esCompraAceptable(compra: CompraFilaSql): boolean {
  return compra.Estado.trim().toUpperCase() === 'REGISTRADA' && !compra.Aceptada;
}
@Component({
  selector: 'compra-aceptacion',
  imports: [DecimalPipe, FormsModule, DialogoModal],
  templateUrl: './aceptacion-compra.html',
  styleUrls: ['../presentacion-compras.css', './aceptacion-compra.css'],
})
export class AceptacionCompra {
  private readonly registro = inject(RegistroCompras);
  private readonly sesion = inject(SesionUsuario);
  private readonly notificaciones = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly compra = input.required<CompraFilaSql>();
  readonly cerrar = output<void>();
  readonly aceptada = output<void>();
  protected readonly aceptando = signal(false);
  protected readonly error = signal('');
  protected readonly observacion = signal('');
  protected solicitarCierre(): void {
    if (!this.aceptando()) this.cerrar.emit();
  }

  protected confirmar(): void {
    if (this.aceptando() || !esCompraAceptable(this.compra())) return;
    const idUsuario = this.sesion.session?.idUsuario;
    if (!idUsuario) {
      this.error.set('No se pudo identificar al usuario de la sesión. Vuelve a iniciar sesión.');
      return;
    }
    this.aceptando.set(true);
    this.error.set('');
    this.registro
      .aceptarCompra(this.compra().IdCompra, {
        idUsuario,
        observacion: this.observacion().trim() || null,
      })
      .pipe(
        finalize(() => this.aceptando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notificaciones.show(
            `Compra ${this.compra().NumeroCompra} aceptada: el gasto quedó ejecutado en el presupuesto.`,
            'success',
          );
          this.aceptada.emit();
        },
        error: (error: unknown) => {
          const mensaje =
            error instanceof HttpErrorResponse && error.status === 403
              ? 'No tienes permiso para aceptar compras.'
              : extraerMensajeError(error, 'No se pudo aceptar la compra.');
          this.error.set(mensaje);
          this.notificaciones.show(mensaje, 'error');
        },
      });
  }
}
