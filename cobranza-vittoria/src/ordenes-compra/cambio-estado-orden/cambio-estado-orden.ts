import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { NotificationService } from '../../app/core/services/notification.service';
import { RegistroOrdenesCompra } from '../registro-ordenes-compra';
import { SolicitudCambioEstadoOrden } from '../contratos-ordenes-compra';
import { accionesEstado, estadoOrden, ETIQUETA_ESTADO } from '../datos-orden';
import { mensajeOrden } from '../mensaje-orden';

@Component({
  selector: 'cambio-estado-orden',
  imports: [FormsModule, DialogoModal],
  templateUrl: './cambio-estado-orden.html',
  styleUrl: '../presentacion-ordenes.css',
})
export class CambioEstadoOrden {
  readonly cambio = input.required<SolicitudCambioEstadoOrden>();
  readonly cerrar = output<void>();
  readonly completada = output<number>();

  private readonly registro = inject(RegistroOrdenesCompra);
  private readonly sesion = inject(SesionUsuario);
  private readonly notificaciones = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly guardando = signal(false);
  protected readonly observacion = signal('');
  protected readonly mensaje = signal('');
  protected readonly etiquetas = ETIQUETA_ESTADO;
  protected readonly nota = computed(() => {
    const cambio = this.cambio();

    if (cambio.destino === 'APROBADA')
      return 'Al aprobarla, el monto de la O.C. queda comprometido en el presupuesto de sus partidas. Si la O.C. no tiene precios no se compromete nada: el gasto se ejecuta al aceptar la Compra.';

    if (cambio.destino === 'ANULADA')
      return estadoOrden(cambio.orden) === 'APROBADA'
        ? 'Al anularla se libera el monto que tenía comprometido en el presupuesto. La O.C. anulada no se puede reactivar.'
        : 'La O.C. anulada no se puede reactivar. Como no está aprobada, no afecta el presupuesto.';

    return 'La O.C. quedará cerrada y ya no admitirá cambios.';
  });

  protected solicitarCierre(): void {
    if (this.guardando()) return;

    this.cerrar.emit();
  }

  protected confirmar(): void {
    if (this.guardando()) return;

    const { orden, destino } = this.cambio();
    const idUsuario = this.sesion.session?.idUsuario;

    if (!accionesEstado(orden).includes(destino)) return;

    if (!idUsuario) {
      this.mensaje.set('No se pudo identificar al usuario de la sesión. Vuelve a iniciar sesión.');
      return;
    }

    const dto = { estadoNuevo: destino, idUsuario, observacion: this.observacion().trim() || null };

    this.guardando.set(true);
    this.mensaje.set('');

    this.registro
      .cambiarEstado(orden.idOrdenCompra, dto)
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          const accion =
            destino === 'APROBADA' ? 'aprobada' : destino === 'ANULADA' ? 'anulada' : 'cerrada';

          this.notificaciones.show(
            `O.C. ${orden.numeroOrdenCompra} ${accion} correctamente.`,
            'success',
          );
          this.completada.emit(orden.idOrdenCompra);
        },
        error: (error) => {
          const mensaje =
            error instanceof HttpErrorResponse && error.status === 403
              ? 'No tienes permiso para cambiar el estado de las órdenes de compra.'
              : mensajeOrden(error, 'No se pudo cambiar el estado de la O.C.');

          this.mensaje.set(mensaje);
        },
      });
  }
}
