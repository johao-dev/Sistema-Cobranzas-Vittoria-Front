import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';
import { AccionGasto, GastoDirectoListado } from '../contratos-gastos-directos';
import { RegistroGastosDirectos } from '../registro-gastos-directos';
import { esGastoHistorico } from '../presentacion-gastos';

@Component({
  selector: 'transicion-gasto',
  imports: [CommonModule, DialogoModal],
  templateUrl: './transicion-gasto.html',
  styleUrl: '../gastos-directos.css',
})
export class TransicionGasto {
  private readonly registro = inject(RegistroGastosDirectos);
  private readonly sesion = inject(SesionUsuario);
  private readonly notifications = inject(Notificaciones);
  private readonly destroyRef = inject(DestroyRef);

  readonly gasto = input.required<GastoDirectoListado>();
  readonly accion = input.required<AccionGasto>();

  readonly cancelar = output<void>();
  readonly actualizado = output<void>();

  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected ejecutarConfirmacion(): void {
    if (this.guardando() || !this.sesion.hasPermission('gasto_directo.operar')) return;

    const row = this.gasto();
    const accion = this.accion();
    if (accion === 'confirmar' && (row.estado !== 'REGISTRADO' || esGastoHistorico(row))) return;
    if (accion === 'anular' && row.estado === 'ANULADO') return;

    this.guardando.set(true);
    this.error.set('');
    (accion === 'confirmar'
      ? this.registro.confirmar(row.idGastoDirecto)
      : this.registro.anular(row.idGastoDirecto)
    )
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notifications.show(
            accion === 'confirmar'
              ? 'Gasto confirmado: el monto quedó ejecutado.'
              : row.estado === 'CONFIRMADO'
                ? 'Gasto anulado: se devolvió el monto con un ajuste.'
                : 'Gasto anulado.',
            'success',
          );
          this.actualizado.emit();
        },
        error: (error: unknown) =>
          this.error.set(
            extraerMensajeError(
              error,
              accion === 'confirmar'
                ? 'No se pudo confirmar el gasto.'
                : 'No se pudo anular el gasto.',
            ),
          ),
      });
  }

  protected cerrar(): void {
    if (!this.guardando()) this.cancelar.emit();
  }
}
