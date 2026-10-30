import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { ImportModalComponent } from '../../app/shared/components/import-modal/import-modal.component';
import { NotificationService } from '../../app/core/services/notification.service';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import { ConsultaGastos } from '../consulta-gastos';
import { normalizarBusquedaGasto } from '../presentacion-gastos';
import { CategoriaGastoReferencia, CategoriaGastoUpsert } from './contratos-categorias-gasto';
import { CatalogoCategoriasGasto } from './catalogo-categorias-gasto';
import { FormularioCategoriaGasto } from './formulario-categoria-gasto';

@Component({
  selector: 'lista-categorias-gasto',
  imports: [FormsModule, DialogoModal, ImportModalComponent, FormularioCategoriaGasto],
  templateUrl: './lista-categorias-gasto.html',
  styleUrls: ['./lista-categorias-gasto.css', '../mantenimientos-gastos.css'],
})
export class ListaCategoriasGasto implements OnInit {
  private readonly registro = inject(CatalogoCategoriasGasto);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly consulta = new ConsultaGastos<CategoriaGastoReferencia>(
    'No se pudieron cargar las categorías.',
  );
  protected readonly filtroActivo = signal('true');
  protected readonly filtroBusqueda = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly importOpen = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  protected readonly edicion = signal<CategoriaGastoReferencia | null>(null);

  protected readonly rowsFiltradas = computed(() => {
    const termino = normalizarBusquedaGasto(this.filtroBusqueda());
    return this.consulta
      .filas()
      .filter((row) => normalizarBusquedaGasto(Object.values(row).join(' ')).includes(termino));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const activo = this.filtroActivo() === '' ? null : this.filtroActivo() === 'true';
    this.consulta.cargar(this.registro.listar(activo));
  }

  protected abrirModalNuevo(): void {
    this.edicion.set(null);
    this.error.set('');
    this.modalOpen.set(true);
  }

  protected cerrarModal(): void {
    if (!this.guardando()) this.modalOpen.set(false);
  }

  protected edit(row: CategoriaGastoReferencia): void {
    this.edicion.set(row);
    this.error.set('');
    this.modalOpen.set(true);
  }

  protected save(dto: CategoriaGastoUpsert): void {
    if (this.guardando()) return;

    this.guardando.set(true);
    this.error.set('');
    this.registro
      .guardar(dto)
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notifications.show('Categoría guardada correctamente.', 'success');
          this.modalOpen.set(false);
          this.load();
        },
        error: (error: unknown) =>
          this.error.set(extraerMensajeError(error, 'No se pudo guardar la categoría.')),
      });
  }

  protected remove(row: CategoriaGastoReferencia): void {
    if (this.guardando() || !row.activo || !confirm(`¿Desactivar ${row.nombre}?`)) return;
    this.guardando.set(true);
    this.registro
      .desactivar(row.idCategoriaGasto)
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notifications.show('Categoría desactivada correctamente.', 'success');
          this.load();
        },
        error: (error: unknown) =>
          this.notifications.show(
            extraerMensajeError(error, 'No se pudo desactivar la categoría.'),
            'error',
          ),
      });
  }

  protected onAccion(event: Event, row: CategoriaGastoReferencia): void {
    if (!(event.target instanceof HTMLSelectElement) || this.guardando()) return;
    const value = event.target.value;
    event.target.value = '';
    if (value === 'edit') this.edit(row);
    if (value === 'estado') this.remove(row);
  }

  protected onImportSuccess(): void {
    this.importOpen.set(false);
    this.load();
  }
}
