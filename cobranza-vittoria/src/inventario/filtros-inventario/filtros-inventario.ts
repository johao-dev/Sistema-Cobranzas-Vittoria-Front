import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Especialidad } from '../../catalogos/especialidades/contratos-especialidades';
import { Proyecto } from '../../catalogos/proyectos/contratos-proyectos';
import { KardexFiltroInventarioDto } from '../contratos-inventario';

@Component({
  selector: 'inventario-filtros',
  imports: [FormsModule],
  templateUrl: './filtros-inventario.html',
})
export class FiltrosInventario {
  readonly especialidades = input.required<readonly Especialidad[]>();
  readonly proyectos = input<readonly Proyecto[]>([]);
  readonly mostrarProyecto = input(true);

  readonly consultar = output<KardexFiltroInventarioDto>();
  readonly cambio = output<KardexFiltroInventarioDto>();

  protected readonly idEspecialidad = signal<number | null>(null);
  protected readonly idProyecto = signal<number | null>(null);
  protected readonly fechaDesde = signal('');
  protected readonly fechaHasta = signal('');
  protected readonly error = signal('');

  protected aplicar(): void {
    if (this.fechaDesde() && this.fechaHasta() && this.fechaDesde() > this.fechaHasta()) {
      this.error.set('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }

    this.error.set('');

    const filtros = this.actuales();

    this.cambio.emit(filtros);
    this.consultar.emit(filtros);
  }

  protected actuales(): KardexFiltroInventarioDto {
    const fechas = {
      idEspecialidad: this.idEspecialidad(),
      fechaDesde: this.fechaDesde() || null,
      fechaHasta: this.fechaHasta() || null,
    };

    return this.mostrarProyecto() ? { ...fechas, idProyecto: this.idProyecto() } : fechas;
  }

  protected limpiar(): void {
    this.idEspecialidad.set(null);
    this.idProyecto.set(null);
    this.fechaDesde.set('');
    this.fechaHasta.set('');
    this.aplicar();
  }
}
