import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { ModalImportacion } from '../../shared/importacion/modal-importacion/modal-importacion';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';
import { ConsultaGastos } from '../consulta-gastos';
import { normalizarBusquedaGasto } from '../presentacion-gastos';
import { ProveedorTerreno } from './contratos-proveedores-terreno';
import { RegistroProveedoresTerreno } from './registro-proveedores-terreno';
import { FormularioProveedorEspecifico } from '../proveedores-especificos/formulario-proveedor-especifico';
import { EdicionProveedorEspecifico } from '../proveedores-especificos/datos-proveedor-especifico';

@Component({
  selector: 'lista-proveedores-terreno',
  imports: [FormsModule, DialogoModal, ModalImportacion, FormularioProveedorEspecifico],
  templateUrl: './lista-proveedores-terreno.html',
  styleUrls: ['./lista-proveedores-terreno.css', '../mantenimientos-gastos.css'],
})
export class ListaProveedoresTerreno implements OnInit {
  private readonly registro = inject(RegistroProveedoresTerreno);
  private readonly notifications = inject(Notificaciones);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly consulta = new ConsultaGastos<ProveedorTerreno>(
    'No se pudieron cargar los proveedores de terreno.',
  );
  protected readonly filtroActivo = signal('true');
  protected readonly filtroBusqueda = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly importOpen = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  protected readonly edicion = signal<ProveedorTerreno | null>(null);
  protected readonly datosEdicion = signal<EdicionProveedorEspecifico | null>(null);

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
    this.datosEdicion.set(null);
    this.error.set('');
    this.modalOpen.set(true);
  }

  protected cerrarModal(): void {
    if (!this.guardando()) this.modalOpen.set(false);
  }

  protected edit(row: ProveedorTerreno): void {
    this.edicion.set(row);
    this.datosEdicion.set({
      razonSocial: row.razonSocial,
      ruc: row.ruc ?? '',
      contacto: row.contacto ?? '',
      telefono: row.telefono ?? '',
      correo: row.correo ?? '',
      activo: row.activo,
      idCategoriaGasto: null,
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
        idProveedorTerreno: this.edicion()?.idProveedorTerreno ?? null,
      })
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notifications.show('Proveedor de terreno guardado correctamente.', 'success');
          this.modalOpen.set(false);
          this.load();
        },
        error: (error: unknown) =>
          this.error.set(extraerMensajeError(error, 'No se pudo guardar el proveedor de terreno.')),
      });
  }

  protected remove(row: ProveedorTerreno): void {
    if (this.guardando() || !row.activo || !confirm(`¿Desactivar ${row.razonSocial}?`)) return;
    this.guardando.set(true);
    this.registro
      .desactivar(row.idProveedorTerreno)
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

  protected onAccion(event: Event, row: ProveedorTerreno): void {
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
