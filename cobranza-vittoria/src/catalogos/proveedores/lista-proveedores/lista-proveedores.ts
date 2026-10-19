import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of, startWith, Subject, Subscription, switchMap } from 'rxjs';
import { NotificationService } from '../../../app/core/services/notification.service';
import { ImportModalComponent } from '../../../app/shared/components/import-modal/import-modal.component';
import { DialogoCatalogo } from '../../dialogo-catalogo/dialogo-catalogo';
import { filtrarCatalogo } from '../../busqueda-catalogo';
import { mensajeCatalogo } from '../../mensaje-catalogo';
import { CatalogoProveedores } from '../catalogo-proveedores';
import { Proveedor, ProveedorUpsert } from '../contratos-proveedores';
import { FormularioProveedor } from '../formulario-proveedor/formulario-proveedor';

@Component({
  selector: 'lista-proveedores',
  imports: [FormsModule, DialogoCatalogo, FormularioProveedor, ImportModalComponent],
  templateUrl: './lista-proveedores.html',
  styleUrl: './lista-proveedores.css',
})
export class ListaProveedores implements OnInit {
  private readonly api: CatalogoProveedores = inject(CatalogoProveedores);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly notificaciones: NotificationService = inject(NotificationService);
  private readonly recargas: Subject<void> = new Subject<void>();
  private detalleSub?: Subscription;
  protected readonly cargandoDetalle = signal(false);
  protected readonly detalleListo = signal(true);
  protected readonly filas = signal<Proveedor[]>([]);
  protected readonly busqueda = signal('');
  protected readonly filtradas = computed(() => filtrarCatalogo(this.filas(), this.busqueda()));
  protected readonly seleccionado = signal<Proveedor | null>(null);
  protected readonly modalAbierto = signal(false);
  protected readonly importAbierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.recargas
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.cargando.set(true);
          this.error.set('');
          return this.api.proveedores().pipe(
            catchError((error: unknown) => {
              this.notificarError(error, 'No se pudo cargar el listado.');
              return of<Proveedor[]>([]);
            }),
            finalize(() => this.cargando.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((datos: Proveedor[]) => this.filas.set(datos));
  }

  protected actualizar(): void {
    this.recargas.next();
  }

  protected nuevo(): void {
    this.error.set('');
    this.seleccionado.set(null);
    this.detalleSub?.unsubscribe();
    this.detalleListo.set(true);
    this.modalAbierto.set(true);
  }

  protected editar(fila: Proveedor): void {
    this.error.set('');
    this.seleccionado.set(fila);
    this.modalAbierto.set(true);
    this.detalleSub?.unsubscribe();
    this.detalleListo.set(false);
    this.cargandoDetalle.set(true);
    this.detalleSub = this.api
      .proveedor(fila.idProveedor)
      .pipe(
        finalize(() => this.cargandoDetalle.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (datos) => {
          this.seleccionado.set(datos.proveedor);
          this.detalleListo.set(true);
        },
        error: (error: unknown) =>
          this.notificarError(
            error,
            'No se pudo cargar el detalle. Cierra el formulario y vuelve a intentarlo.',
          ),
      });
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    this.detalleSub?.unsubscribe();
    this.modalAbierto.set(false);
    this.error.set('');
  }

  protected guardar(dto: ProveedorUpsert): void {
    if (this.guardando() || !this.detalleListo()) return;
    this.guardando.set(true);
    this.error.set('');
    this.api
      .guardarProveedor(dto)
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notificaciones.show('Registro guardado correctamente.', 'success');
          this.modalAbierto.set(false);
          this.actualizar();
        },
        error: (error: unknown) => this.notificarError(error, 'No se pudo guardar el registro.'),
      });
  }

  protected importado(): void {
    this.importAbierto.set(false);
    this.actualizar();
  }

  private notificarError(error: unknown, respaldo: string): void {
    const mensaje: string = mensajeCatalogo(error, respaldo);
    this.error.set(mensaje);
    this.notificaciones.show(mensaje, 'error');
  }
}
