import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Proyecto, ProyectoUpsert } from '../contratos-proyectos';

function vacio(): ProyectoUpsert {
  return {
    idProyecto: null,
    nombreProyecto: '',
    activo: true,
    descripcion: '',
    cotizacionGeneral: 0,
  };
}

@Component({
  selector: 'formulario-proyecto',
  imports: [FormsModule],
  templateUrl: './formulario-proyecto.html',
})
export class FormularioProyecto {
  readonly valor = input<Proyecto | null>(null);
  readonly guardando = input(false);
  readonly guardar = output<ProyectoUpsert>();
  protected readonly form = signal<ProyectoUpsert>(vacio());
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const valor = this.valor();
      this.form.set({
        idProyecto: valor?.idProyecto ?? null,
        nombreProyecto: valor?.nombreProyecto ?? '',
        activo: valor?.activo ?? true,
        descripcion: valor?.descripcion ?? '',
        cotizacionGeneral: valor?.cotizacionGeneral ?? 0,
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
    const valor: ProyectoUpsert = this.form();
    if (!valor.nombreProyecto.trim() || valor.cotizacionGeneral < 0) {
      this.error.set('Completa los campos requeridos y verifica los importes.');
      return;
    }
    this.guardar.emit({
      ...valor,
      nombreProyecto: valor.nombreProyecto.trim(),
      cotizacionGeneral: Number(valor.cotizacionGeneral ?? 0),
    });
  }
}
