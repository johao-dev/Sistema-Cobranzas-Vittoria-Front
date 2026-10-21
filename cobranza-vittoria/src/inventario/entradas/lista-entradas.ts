import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { RegistroInventario } from '../registro-inventario';
import { KardexEntradaResponseDto, KardexFiltroInventarioDto } from '../contratos-inventario';
import { ConsultaInventario } from '../consulta-inventario/consulta-inventario';
import { ReferenciasInventario } from '../referencias-inventario/referencias-inventario';
import { FiltrosInventario } from '../filtros-inventario/filtros-inventario';
import { FormularioEntrada } from './formulario-entrada';
import { NotificationService } from '../../app/core/services/notification.service';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import {
  coincideBusquedaInventario,
  fechaInventario,
  cantidadInventario,
  codigoMaterialInventario,
  nombreMaterialInventario,
} from '../presentacion-inventario/datos-presentacion-inventario';

@Component({
  selector: 'inventario-lista-entradas',
  imports: [FormsModule, FiltrosInventario, FormularioEntrada],
  providers: [ReferenciasInventario],
  templateUrl: './lista-entradas.html',
  styleUrl: '../presentacion-inventario/presentacion-inventario.css',
})
export class ListaEntradas implements OnInit {
  private readonly registro = inject(RegistroInventario);
  private readonly notificaciones = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly referencias = inject(ReferenciasInventario);

  protected readonly consulta = new ConsultaInventario<KardexEntradaResponseDto>();

  protected readonly filtros = signal<KardexFiltroInventarioDto>({});
  protected readonly busqueda = signal('');
  protected readonly eliminando = signal<number | null>(null);
  protected readonly edicion = signal<KardexEntradaResponseDto | null | undefined>(undefined);

  protected readonly fecha = fechaInventario;
  protected readonly cantidad = cantidadInventario;

  protected readonly filtradas = computed(() =>
    this.consulta
      .filas()
      .filter((row) =>
        coincideBusquedaInventario(this.busqueda(), [
          row.idKardexEntrada,
          row.proyecto,
          row.especialidad,
          fechaInventario(row.fecha),
          this.codigo(row),
          this.nombre(row),
          row.cantidad,
        ]),
      ),
  );

  ngOnInit(): void {
    this.referencias.cargar('entrada');
    this.cargar();
  }

  protected cargar(): void {
    this.consulta.cargar(this.registro.listarEntradas(this.filtros()));
  }

  protected filtrar(filtros: KardexFiltroInventarioDto): void {
    this.filtros.set(filtros);
    this.cargar();
  }

  protected codigo(row: KardexEntradaResponseDto): string {
    return codigoMaterialInventario(
      row.idMaterial,
      row.codigoMaterial,
      this.referencias.materiales(),
    );
  }

  protected nombre(row: KardexEntradaResponseDto): string {
    return nombreMaterialInventario(row.idMaterial, row.nombre, this.referencias.materiales());
  }

  protected nuevo(): void {
    this.edicion.set(null);
  }

  protected editar(row: KardexEntradaResponseDto): void {
    this.edicion.set(row);
  }

  protected guardada(mensaje: string): void {
    this.edicion.set(undefined);
    this.notificaciones.show(mensaje, 'success');
    this.cargar();
  }

  protected accion(event: Event, row: KardexEntradaResponseDto): void {
    if (!(event.target instanceof HTMLSelectElement)) return;

    const accion = event.target.value;

    event.target.value = '';
    if (accion === 'edit') this.editar(row);
    else if (accion === 'delete') this.eliminar(row);
  }

  protected eliminar(row: KardexEntradaResponseDto): void {
    if (this.eliminando() !== null) return;

    const id = row.idKardexEntrada;
    if (
      !confirm(`¿Eliminar la entrada de "${this.nombre(row)}"? Esta acción no se puede deshacer.`)
    )
      return;

    this.eliminando.set(id);

    this.registro
      .eliminarEntrada(id)
      .pipe(
        finalize(() => this.eliminando.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notificaciones.show('Entrada eliminada correctamente.', 'success');
          this.cargar();
        },
        error: (error: unknown) =>
          this.notificaciones.show(
            extraerMensajeError(error, 'No se pudo eliminar la entrada.'),
            'error',
          ),
      });
  }
}
