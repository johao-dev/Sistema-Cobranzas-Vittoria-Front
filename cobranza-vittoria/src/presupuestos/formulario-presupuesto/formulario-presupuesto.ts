import { Component, DestroyRef, inject, input, output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Presupuesto } from '../contratos-presupuestos';
import { BorradorPresupuesto } from '../borradores-presupuesto';
import { CentroCostoResumen } from '../centros-costo/contratos-centros-costo';
import { MonedaPresupuestaria } from '../contratos-catalogos-presupuestarios';

@Component({
  selector: 'formulario-presupuesto',
  imports: [FormsModule, DialogoModal],
  templateUrl: './formulario-presupuesto.html',
  styleUrls: ['../dialogos-presupuesto.css', './formulario-presupuesto.css'],
})
export class FormularioPresupuesto implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly registroPresupuestos = inject(RegistroPresupuestos);
  private readonly notifications = inject(Notificaciones);
  readonly cerrar = output<void>();
  readonly presupuesto = input<Presupuesto | null>(null);
  readonly centrosCosto = input.required<CentroCostoResumen[]>();
  readonly monedas = input.required<MonedaPresupuestaria[]>();
  readonly guardado = output<void>();
  protected readonly guardando = signal(false);
  protected readonly modalConfirmarInactivar = signal(false);
  protected readonly mensajeInactivar = signal('');
  protected form: BorradorPresupuesto = this.formVacio();

  ngOnInit(): void {
    const row = this.presupuesto();
    if (row)
      this.form = {
        idPresupuesto: row.idPresupuesto,
        idCentroCosto: row.idCentroCosto,
        idMoneda: row.idMoneda,
        codigo: row.codigo,
        nombre: row.nombre,
        descripcion: row.descripcion ?? '',
        fechaInicio: this.soloFecha(row.fechaInicio),
        fechaFin: this.soloFecha(row.fechaFin),
        activo: row.activo,
      };
  }
  protected cerrarFormulario(): void {
    if (!this.guardando()) this.cerrar.emit();
  }

  formVacio(): BorradorPresupuesto {
    return {
      idPresupuesto: null,
      idCentroCosto: '',
      idMoneda: '',
      codigo: '',
      nombre: '',
      descripcion: '',
      fechaInicio: '',
      fechaFin: '',
      activo: true,
    };
  }

  get esEdicion(): boolean {
    return !!this.form.idPresupuesto;
  }

  guardarPresupuesto(confirmarInactivacion = false): void {
    if (this.guardando()) return;
    if (!this.esEdicion) {
      if (!this.form.idCentroCosto) {
        this.notifications.show('Selecciona el centro de costo.', 'info');
        return;
      }
      if (!this.form.idMoneda) {
        this.notifications.show('Selecciona la moneda del presupuesto.', 'info');
        return;
      }
      if (!String(this.form.codigo ?? '').trim()) {
        this.notifications.show('Ingresa el código del presupuesto.', 'info');
        return;
      }
    }
    if (!String(this.form.nombre ?? '').trim()) {
      this.notifications.show('Ingresa el nombre del presupuesto.', 'info');
      return;
    }
    if (this.form.fechaInicio && this.form.fechaFin && this.form.fechaFin < this.form.fechaInicio) {
      this.notifications.show('La fecha fin no puede ser anterior a la fecha inicio.', 'info');
      return;
    }

    this.guardando.set(true);
    const peticion: Observable<object> = this.esEdicion
      ? this.registroPresupuestos.actualizarPresupuesto(
          Number(this.form.idPresupuesto),
          this.form,
          confirmarInactivacion,
        )
      : this.registroPresupuestos.crearPresupuesto(this.form);

    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.guardando.set(false);

        this.modalConfirmarInactivar.set(false);
        this.notifications.show('Presupuesto guardado correctamente.', 'success');
        this.guardado.emit();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        // Con gastos, movimientos o requerimientos el backend pide confirmar la inactivación.
        if (
          err instanceof HttpErrorResponse &&
          err.status === 409 &&
          err.error?.error === 'PRESUPUESTO_CON_REGISTROS' &&
          !confirmarInactivacion
        ) {
          this.mensajeInactivar.set(
            extraerMensajeError(
              err,
              'Este presupuesto tiene registros asociados. ¿Inactivarlo de todos modos?',
            ),
          );
          this.modalConfirmarInactivar.set(true);
        } else {
          this.notifications.show(
            extraerMensajeError(err, 'No se pudo guardar el presupuesto.'),
            'error',
          );
        }
      },
    });
  }

  confirmarInactivacion(): void {
    this.guardarPresupuesto(true);
  }

  cancelarInactivacion(): void {
    if (this.guardando()) return;
    this.modalConfirmarInactivar.set(false);
  }

  private soloFecha(valor: string | null): string {
    if (!valor) return '';
    const texto = String(valor);
    return texto.length >= 10 ? texto.substring(0, 10) : texto;
  }
}
