import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoriaGastoReferencia, CategoriaGastoUpsert } from './contratos-categorias-gasto';

function vacio(): CategoriaGastoUpsert {
  return { idCategoriaGasto: null, codigo: '', nombre: '', activo: true };
}

@Component({
  selector: 'formulario-categoria-gasto',
  imports: [FormsModule],
  templateUrl: './formulario-categoria-gasto.html',
  styleUrl: '../mantenimientos-gastos.css',
})
export class FormularioCategoriaGasto {
  readonly valor = input<CategoriaGastoReferencia | null>(null);
  readonly guardando = input(false);

  readonly guardar = output<CategoriaGastoUpsert>();
  protected readonly form = signal<CategoriaGastoUpsert>(vacio());
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const valor = this.valor();
      this.form.set(valor ? { ...valor, codigo: valor.codigo ?? '' } : vacio());
      this.error.set('');
    });
  }

  protected limpiar(): void {
    if (!this.guardando()) {
      this.form.set(vacio());
      this.error.set('');
    }
  }

  protected enviar(): void {
    if (this.guardando()) return;

    const datos = this.form();
    if (!datos.nombre.trim() || !datos.codigo.trim()) {
      this.error.set('Ingresa el código y el nombre de la categoría.');
      return;
    }
    this.error.set('');
    this.guardar.emit({ ...datos, codigo: datos.codigo.trim(), nombre: datos.nombre.trim() });
  }
}
