import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';
import { CentroCostoResumen } from './contratos-centros-costo';
import { BorradorCentroCosto } from './borrador-centro-costo';
import { TipoCentroCosto } from '../contratos-catalogos-presupuestarios';
import { Proyecto } from '../../catalogos/proyectos/contratos-proyectos';
import { CatalogoCentrosCosto } from './catalogo-centros-costo';

@Component({
  selector: 'formulario-centro-costo',
  imports: [CommonModule, FormsModule, DialogoModal],
  templateUrl: './formulario-centro-costo.html',
  styleUrls: ['../dialogos-presupuesto.css'],
})
export class FormularioCentroCosto implements OnInit {
  private readonly catalogoCentrosCosto = inject(CatalogoCentrosCosto);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(Notificaciones);
  readonly valor = input<CentroCostoResumen | null>(null);
  readonly guardado = output<void>();
  readonly cerrar = output<void>();
  protected readonly guardando = signal(false);
  readonly tipos = input.required<TipoCentroCosto[]>();
  readonly proyectos = input.required<Proyecto[]>();
  protected form: BorradorCentroCosto = this.formVacio();

  ngOnInit(): void {
    const row = this.valor();
    if (!row) return;
    this.form = {
      idCentroCosto: row.idCentroCosto,
      codigo: row.codigo ?? '',
      nombre: row.nombre ?? '',
      idTipoCentroCosto: row.idTipoCentroCosto ?? '',
      idProyecto: row.idProyecto ?? '',
      descripcion: row.descripcion ?? '',
      activo: row.activo ?? true,
    };
  }
  formVacio(): BorradorCentroCosto {
    return {
      idCentroCosto: null,
      codigo: '',
      nombre: '',
      idTipoCentroCosto: '',
      idProyecto: '',
      descripcion: '',
      activo: true,
    };
  }

  get requiereProyecto(): boolean {
    const tipo = this.tipos().find(
      (t) => String(t.idTipoCentroCosto) === String(this.form.idTipoCentroCosto),
    );
    return (tipo?.codigo ?? '').toUpperCase() === 'PROYECTO';
  }

  get esEdicion(): boolean {
    return !!this.form.idCentroCosto;
  }

  onTipoChange(): void {
    if (!this.requiereProyecto) this.form.idProyecto = '';
  }

  save(): void {
    if (this.guardando()) return;
    if (!this.esEdicion && !String(this.form.codigo ?? '').trim()) {
      this.notifications.show('Ingresa el código del centro de costo.', 'info');
      return;
    }
    if (!String(this.form.nombre ?? '').trim()) {
      this.notifications.show('Ingresa el nombre del centro de costo.', 'info');
      return;
    }
    if (!this.esEdicion && !this.form.idTipoCentroCosto) {
      this.notifications.show('Selecciona el tipo de centro de costo.', 'info');
      return;
    }
    if (this.requiereProyecto && !this.form.idProyecto) {
      this.notifications.show(
        'Un centro de costo de tipo PROYECTO requiere un proyecto asociado.',
        'info',
      );
      return;
    }

    this.guardando.set(true);
    this.catalogoCentrosCosto
      .guardarCentroCosto(this.form)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.notifications.show('Centro de costo guardado correctamente.', 'success');
          this.guardado.emit();
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.notifications.show(
            extraerMensajeError(err, 'No se pudo guardar el centro de costo.'),
            'error',
          );
        },
      });
  }
  protected cerrarFormulario(): void {
    if (!this.guardando()) this.cerrar.emit();
  }
}
