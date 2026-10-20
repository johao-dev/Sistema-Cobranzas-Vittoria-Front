import { Component, DestroyRef, effect, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EstadoRequerimientos } from '../estado-requerimientos';
import { DialogoRequerimiento } from '../dialogo-requerimiento/dialogo-requerimiento';

@Component({
  selector: 'formulario-item',
  imports: [ReactiveFormsModule, DecimalPipe, DialogoRequerimiento],
  templateUrl: './formulario-item.html',
  styleUrls: ['../presentacion-requerimientos.css', './formulario-item.css'],
})
export class FormularioItem {
  protected readonly vm = inject(EstadoRequerimientos);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly formulario = new FormGroup({
    idEspecialidad: new FormControl<number | null>(null, Validators.required),
    idMaterial: new FormControl<number | null>(null, Validators.required),
    idPresupuestoDetalle: new FormControl<number | null>(null),
    cantidad: new FormControl<number | null>(1, [Validators.required, Validators.min(0.01)]),
    observacion: new FormControl('', { nonNullable: true, validators: Validators.maxLength(250) }),
  });

  constructor() {
    effect(() => {
      this.formulario.patchValue(this.vm.modalItem(), { emitEvent: false });

      if (this.vm.guardandoItem()) this.formulario.disable({ emitEvent: false });
      else {
        this.formulario.enable({ emitEvent: false });

        if (this.vm.gestionItemsAlmacen() && this.vm.editingItemIndex() !== null) {
          this.formulario.controls.idEspecialidad.disable({ emitEvent: false });
          this.formulario.controls.idMaterial.disable({ emitEvent: false });
        } else if (!this.vm.modalItem().idEspecialidad) {
          this.formulario.controls.idMaterial.disable({ emitEvent: false });
        }

        if (
          this.vm.cargandoPartidas() ||
          (!this.vm.gestionItemsAlmacen() && !this.vm.partidasPresupuesto().length)
        ) {
          this.formulario.controls.idPresupuestoDetalle.disable({ emitEvent: false });
        }
      }
    });

    this.formulario.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const valores = this.formulario.getRawValue();
      const anterior = this.vm.modalItem();

      this.vm.modalItem.set(valores);

      if (valores.idEspecialidad !== anterior.idEspecialidad) this.vm.onModalEspecialidadChange();
      else if (valores.idMaterial !== anterior.idMaterial) this.vm.onModalMaterialChange();
    });
  }
}
