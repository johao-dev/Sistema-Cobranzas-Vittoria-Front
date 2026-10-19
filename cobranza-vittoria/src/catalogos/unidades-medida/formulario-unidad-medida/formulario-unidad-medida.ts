import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UnidadMedida, UnidadMedidaUpsert } from '../contratos-unidades-medida';

function vacio(): UnidadMedidaUpsert {
  return { idUnidadMedida: null, nombre: '', activo: true, codigo: '' };
}

@Component({
  selector: 'formulario-unidad-medida',
  imports: [FormsModule],
  templateUrl: './formulario-unidad-medida.html',
})
export class FormularioUnidadMedida {
  readonly valor = input<UnidadMedida | null>(null);
  readonly guardando = input(false);
  readonly guardar = output<UnidadMedidaUpsert>();
  protected readonly form = signal<UnidadMedidaUpsert>(vacio());
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const valor = this.valor();
      this.form.set({
        idUnidadMedida: valor?.idUnidadMedida ?? null,
        nombre: valor?.nombre ?? '',
        activo: valor?.activo ?? true,
        codigo: valor?.codigo ?? '',
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
    const valor: UnidadMedidaUpsert = this.form();
    if (!valor.nombre.trim() || !valor.codigo.trim()) {
      this.error.set('Completa los campos requeridos y verifica los importes.');
      return;
    }
    this.guardar.emit({ ...valor, nombre: valor.nombre.trim(), codigo: valor.codigo.trim() });
  }
}
