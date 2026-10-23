import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { finalize, map } from 'rxjs';

import { Proyecto } from '../../../catalogos/proyectos/contratos-proyectos';
import { Material } from '../../../catalogos/materiales/contratos-materiales';
import { DialogoModal } from '../../../shared/dialogos/dialogo-modal';
import { RegistroTransferenciasProyecto } from '../registro-transferencias-proyecto';
import {
  controlesItemTransferencia,
  controlesTransferencia,
  peticionTransferencia,
  MAX_MATERIALES_TRANSFERENCIA,
} from './datos-transferencia';
import { mensajeErrorInventario } from '../../errores-inventario';

@Component({
  selector: 'inventario-formulario-transferencia',
  imports: [ReactiveFormsModule, DialogoModal],
  templateUrl: './formulario-transferencia.html',
  styleUrls: [
    '../../presentacion-inventario/presentacion-inventario.css',
    '../transferencias-proyecto.css',
  ],
})
export class FormularioTransferencia {
  private readonly registro = inject(RegistroTransferenciasProyecto);
  private readonly destroyRef = inject(DestroyRef);

  readonly proyectos = input.required<readonly Proyecto[]>();
  readonly materiales = input.required<readonly Material[]>();

  readonly cerrar = output<void>();
  readonly guardada = output<void>();

  protected readonly form = controlesTransferencia();
  protected readonly maxMateriales = MAX_MATERIALES_TRANSFERENCIA;
  protected readonly valores = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    {
      initialValue: this.form.getRawValue(),
    },
  );
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected agregar(): void {
    if (this.guardando() || this.form.controls.items.length >= this.maxMateriales) return;

    this.form.controls.items.push(controlesItemTransferencia());
  }

  protected cambiarOrigen(): void {
    const { idProyectoOrigen, idProyectoDestino } = this.form.getRawValue();

    if (idProyectoOrigen === idProyectoDestino) this.form.controls.idProyectoDestino.setValue(null);
  }

  protected quitar(indice: number): void {
    if (!this.guardando()) this.form.controls.items.removeAt(indice);
  }

  protected repetido(id: number, indice: number): boolean {
    return this.valores().items.some((item, i) => i !== indice && item.idMaterial === id);
  }

  protected solicitarCierre(): void {
    if (!this.guardando()) this.cerrar.emit();
  }

  protected guardar(): void {
    if (this.guardando()) return;

    const dto = peticionTransferencia(this.form.getRawValue());
    if (typeof dto === 'string') {
      this.error.set(dto);
      return;
    }

    this.guardando.set(true);
    this.error.set('');
    this.form.disable();

    this.registro
      .crear(dto)
      .pipe(
        finalize(() => {
          this.guardando.set(false);
          this.form.enable();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.guardada.emit(),
        error: (error: unknown) =>
          this.error.set(mensajeErrorInventario(error, 'No se pudo registrar la transferencia.')),
      });
  }
}
