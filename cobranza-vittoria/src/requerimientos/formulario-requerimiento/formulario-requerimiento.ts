import { Component, DestroyRef, effect, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EstadoRequerimientos } from '../estado-requerimientos';
import { DialogoRequerimiento } from '../dialogo-requerimiento/dialogo-requerimiento';

@Component({
  selector: 'formulario-requerimiento',
  imports: [ReactiveFormsModule, DialogoRequerimiento],
  templateUrl: './formulario-requerimiento.html',
  styleUrls: ['../presentacion-requerimientos.css', './formulario-requerimiento.css'],
})
export class FormularioRequerimiento {
  protected readonly vm = inject(EstadoRequerimientos);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cabecera = new FormGroup({
    numeroRequerimiento: new FormControl('', { nonNullable: true }),
    fechaRequerimiento: new FormControl('', { nonNullable: true, validators: Validators.required }),
    idProyecto: new FormControl<number | null>(null, Validators.required),
    fechaEntrega: new FormControl('', { nonNullable: true, validators: Validators.required }),
    descripcion: new FormControl('', { nonNullable: true }),
    observacion: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      this.cabecera.patchValue(this.vm.form(), { emitEvent: false });

      if (this.vm.gestionItemsAlmacen() || this.vm.saving())
        this.cabecera.disable({ emitEvent: false });
      else this.cabecera.enable({ emitEvent: false });
    });

    this.cabecera.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const valores = this.cabecera.getRawValue();
      const cambioProyecto = valores.idProyecto !== this.vm.form().idProyecto;

      this.vm.form.update((form) => ({ ...form, ...valores }));

      if (cambioProyecto) this.vm.onProyectoChange();
    });
  }
}
