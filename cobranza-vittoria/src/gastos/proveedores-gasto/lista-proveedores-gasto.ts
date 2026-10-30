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
import { ProveedorGasto } from './contratos-proveedores-gasto';
import { RegistroProveedoresGasto } from './registro-proveedores-gasto';
import { FormularioProveedorEspecifico } from '../proveedores-especificos/formulario-proveedor-especifico';
import { EdicionProveedorEspecifico } from '../proveedores-especificos/datos-proveedor-especifico';
import { CatalogoCategoriasGasto } from '../categorias/catalogo-categorias-gasto';
import { CategoriaGastoReferencia } from '../categorias/contratos-categorias-gasto';

@Component({
  selector: 'lista-proveedores-gasto',
  imports: [FormsModule, DialogoModal, ImportModalComponent, FormularioProveedorEspecifico],
  templateUrl: './lista-proveedores-gasto.html',
  styleUrls: ['./lista-proveedores-gasto.css', '../mantenimientos-gastos.css'],
})
export class ListaProveedoresGasto implements OnInit {
  private readonly catalogoCategorias = inject(CatalogoCategoriasGasto);
  private readonly registro = inject(RegistroProveedoresGasto);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly consulta = new ConsultaGastos<ProveedorGasto>(
    'No se pudieron cargar los proveedores de gasto.',
  );
  protected readonly filtroActivo = signal('true');
  protected readonly filtroBusqueda = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly importOpen = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  protected readonly edicion = signal<ProveedorGasto | null>(null);
  protected readonly categorias = new ConsultaGastos<CategoriaGastoReferencia>(
    'No se pudieron cargar las categorías.',
  );
  protected readonly filtroCategoria = signal('');
  protected readonly datosEdicion = signal<EdicionProveedorEspecifico | null>(null);

  protected readonly rowsFiltradas = computed(() => {
    const termino = normalizarBusquedaGasto(this.filtroBusqueda());
    return this.consulta
      .filas()
      .filter((row) => normalizarBusquedaGasto(Object.values(row).join(' ')).includes(termino));
  });

  ngOnInit(): void {
    this.load();
    this.cargarCategorias();
  }

  protected load(): void {
    const activo = this.filtroActivo() === '' ? null : this.filtroActivo() === 'true';
    this.consulta.cargar(
      this.registro.listar(activo, this.filtroCategoria() ? Number(this.filtroCategoria()) : null),
    );
  }

  protected cargarCategorias(): void {
    this.categorias.cargar(this.catalogoCategorias.listar(true));
  }

  protected abrirModalNuevo(): void {
    this.edicion.set(null);
    this.datosEdicion.set(null);
    this.error.set('');
    this.modalOpen.set(true);
  }

  protected cerrarModal(): void {
    if (!this.guardando()) this.modalOpen.set(false);
  }

  protected edit(row: ProveedorGasto): void {
    this.edicion.set(row);
    this.datosEdicion.set({
      razonSocial: row.razonSocial,
      ruc: row.ruc ?? '',
      contacto: row.contacto ?? '',
      telefono: row.telefono ?? '',
      correo: row.correo ?? '',
      activo: row.activo,
      idCategoriaGasto: row.idCategoriaGasto,
    });
    this.error.set('');
    this.modalOpen.set(true);
  }

  protected save(dto: EdicionProveedorEspecifico): void {
    if (this.guardando()) return;

    this.guardando.set(true);
    this.error.set('');
    this.registro
      .guardar({
        razonSocial: dto.razonSocial,
        ruc: dto.ruc,
        contacto: dto.contacto,
        telefono: dto.telefono,
        correo: dto.correo,
        activo: dto.activo,
        idProveedorGastoAdministrativo: this.edicion()?.idProveedorGastoAdministrativo ?? null,
        idCategoriaGasto: Number(dto.idCategoriaGasto),
      })
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notifications.show('Proveedor de gasto guardado correctamente.', 'success');
          this.modalOpen.set(false);
          this.load();
        },
        error: (error: unknown) =>
          this.error.set(extraerMensajeError(error, 'No se pudo guardar el proveedor de gasto.')),
      });
  }

  protected remove(row: ProveedorGasto): void {
    if (this.guardando() || !row.activo || !confirm(`¿Desactivar ${row.razonSocial}?`)) return;
    this.guardando.set(true);
    this.registro
      .desactivar(row.idProveedorGastoAdministrativo)
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notifications.show('Proveedor desactivado correctamente.', 'success');
          this.load();
        },
        error: (error: unknown) =>
          this.notifications.show(
            extraerMensajeError(error, 'No se pudo desactivar el proveedor.'),
            'error',
          ),
      });
  }

  protected onAccion(event: Event, row: ProveedorGasto): void {
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
