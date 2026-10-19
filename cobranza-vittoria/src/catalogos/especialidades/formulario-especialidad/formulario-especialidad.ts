import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Especialidad, EspecialidadUpsert } from '../contratos-especialidades';

function vacio(): EspecialidadUpsert {
  return { idEspecialidad: null, nombre: '', activo: true, descripcion: '' };
}

@Component({
  selector: 'formulario-especialidad',
  imports: [FormsModule],
  templateUrl: './formulario-especialidad.html',
})
export class FormularioEspecialidad {
  readonly valor = input<Especialidad | null>(null);
  readonly guardando = input(false);
  readonly guardar = output<EspecialidadUpsert>();
  protected readonly form = signal<EspecialidadUpsert>(vacio());
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const valor = this.valor();
      this.form.set({
        idEspecialidad: valor?.idEspecialidad ?? null,
        nombre: valor?.nombre ?? '',
        activo: valor?.activo ?? true,
        descripcion: valor?.descripcion ?? '',
      });
      this.error.set('');
    });
  }

  protected limpiar(): void {
    this.form.set(vacio());
    this.error.set('');
  }

  protected enviar(): void {
    if (this.guardando()) return;
    const valor: EspecialidadUpsert = this.form();
    if (!valor.nombre.trim()) {
      this.error.set('Completa los campos requeridos y verifica los importes.');
      return;
    }
    this.guardar.emit({ ...valor, nombre: valor.nombre.trim() });
  }
}
