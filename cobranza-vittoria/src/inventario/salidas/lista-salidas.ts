import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { RegistroInventario } from '../registro-inventario';
import { KardexSalidaResponseDto, KardexFiltroInventarioDto } from '../contratos-inventario';
import { ConsultaInventario } from '../consulta-inventario/consulta-inventario';
import { ReferenciasInventario } from '../referencias-inventario/referencias-inventario';
import { FiltrosInventario } from '../filtros-inventario/filtros-inventario';
import { FormularioSalida } from './formulario-salida';
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
  selector: 'inventario-lista-salidas',
  imports: [FormsModule, FiltrosInventario, FormularioSalida],
  providers: [ReferenciasInventario],
  templateUrl: './lista-salidas.html',
  styleUrl: '../presentacion-inventario/presentacion-inventario.css',
})
export class ListaSalidas implements OnInit {
  private readonly registro = inject(RegistroInventario);
  private readonly notificaciones = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly referencias = inject(ReferenciasInventario);

  protected readonly consulta = new ConsultaInventario<KardexSalidaResponseDto>();

  protected readonly filtros = signal<KardexFiltroInventarioDto>({});
  protected readonly busqueda = signal('');
  protected readonly eliminando = signal<number | null>(null);
  protected readonly edicion = signal<readonly KardexSalidaResponseDto[] | null>(null);

  protected readonly fecha = fechaInventario;
  protected readonly cantidad = cantidadInventario;

  protected readonly filtradas = computed(() =>
    this.consulta
      .filas()
      .filter((row) =>
        coincideBusquedaInventario(this.busqueda(), [
          row.idKardexSalida,
          row.proyecto,
          row.especialidad,
          fechaInventario(row.fecha),
          this.codigo(row),
          this.nombre(row),
          row.cantidad,
          row.numeroDocumento,
          row.solicitante,
        ]),
      ),
  );

  ngOnInit(): void {
    this.referencias.cargar('salida');
    this.cargar();
  }

  protected cargar(): void {
    this.consulta.cargar(this.registro.listarSalidas(this.filtros()));
  }

  protected filtrar(filtros: KardexFiltroInventarioDto): void {
    this.filtros.set(filtros);
    this.cargar();
  }

  protected codigo(row: KardexSalidaResponseDto): string {
    return codigoMaterialInventario(
      row.idMaterial,
      row.codigoMaterial,
      this.referencias.materiales(),
    );
  }

  protected nombre(row: KardexSalidaResponseDto): string {
    return nombreMaterialInventario(row.idMaterial, row.nombre, this.referencias.materiales());
  }

  protected nuevo(): void {
    this.edicion.set([]);
  }

  protected editar(row: KardexSalidaResponseDto): void {
    this.edicion.set(
      this.consulta.filas().filter((fila) => fila.idKardexSalida === row.idKardexSalida),
    );
  }

  protected guardada(mensaje: string): void {
    this.edicion.set(null);
    this.notificaciones.show(mensaje, 'success');
    this.cargar();
  }

  protected accion(event: Event, row: KardexSalidaResponseDto): void {
    if (!(event.target instanceof HTMLSelectElement)) return;

    const accion = event.target.value;

    event.target.value = '';
    if (accion === 'edit') this.editar(row);
    else if (accion === 'delete') this.eliminar(row);
  }

  protected eliminar(row: KardexSalidaResponseDto): void {
    if (this.eliminando() !== null) return;

    const id = row.idKardexSalida;
    const filas = this.consulta.filas().filter((fila) => fila.idKardexSalida === id);
    const detalle =
      filas.length > 1
        ? `esta salida con ${filas.length} ítems`
        : `la salida de "${this.nombre(row)}"`;
    if (!confirm(`¿Eliminar ${detalle}? Esta acción no se puede deshacer.`)) return;

    this.eliminando.set(id);

    this.registro
      .eliminarSalida(id)
      .pipe(
        finalize(() => this.eliminando.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notificaciones.show('Salida eliminada correctamente.', 'success');
          this.cargar();
        },
        error: (error: unknown) =>
          this.notificaciones.show(
            extraerMensajeError(error, 'No se pudo eliminar la salida.'),
            'error',
          ),
      });
  }
}
