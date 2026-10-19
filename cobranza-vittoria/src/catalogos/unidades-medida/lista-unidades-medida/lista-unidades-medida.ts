import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of, startWith, Subject, switchMap } from 'rxjs';
import { NotificationService } from '../../../app/core/services/notification.service';
import { ImportModalComponent } from '../../../app/shared/components/import-modal/import-modal.component';
import { DialogoCatalogo } from '../../dialogo-catalogo/dialogo-catalogo';
import { filtrarCatalogo } from '../../busqueda-catalogo';
import { mensajeCatalogo } from '../../mensaje-catalogo';
import { CatalogoUnidadesMedida } from '../catalogo-unidades-medida';
import { UnidadMedida, UnidadMedidaUpsert } from '../contratos-unidades-medida';
import { FormularioUnidadMedida } from '../formulario-unidad-medida/formulario-unidad-medida';

@Component({
  selector: 'lista-unidades-medida',
  imports: [FormsModule, DialogoCatalogo, FormularioUnidadMedida, ImportModalComponent],
  templateUrl: './lista-unidades-medida.html',
  styleUrl: './lista-unidades-medida.css',
})
export class ListaUnidadesMedida implements OnInit {
  private readonly api: CatalogoUnidadesMedida = inject(CatalogoUnidadesMedida);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly notificaciones: NotificationService = inject(NotificationService);
  private readonly recargas: Subject<void> = new Subject<void>();
  protected readonly filtroActivo = signal<boolean | null>(null);
  protected readonly filas = signal<UnidadMedida[]>([]);
  protected readonly busqueda = signal('');
  protected readonly filtradas = computed(() => filtrarCatalogo(this.filas(), this.busqueda()));
  protected readonly seleccionado = signal<UnidadMedida | null>(null);
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
          return this.api.unidadesMedida(this.filtroActivo()).pipe(
            catchError((error: unknown) => {
              this.notificarError(error, 'No se pudo cargar el listado.');
              return of<UnidadMedida[]>([]);
            }),
            finalize(() => this.cargando.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((datos: UnidadMedida[]) => this.filas.set(datos));
  }

  protected actualizar(): void {
    this.recargas.next();
  }

  protected nuevo(): void {
    this.error.set('');
    this.seleccionado.set(null);
    this.modalAbierto.set(true);
  }

  protected editar(fila: UnidadMedida): void {
    this.error.set('');
    this.seleccionado.set(fila);
    this.modalAbierto.set(true);
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    this.modalAbierto.set(false);
    this.error.set('');
  }

  protected guardar(dto: UnidadMedidaUpsert): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');
    this.api
      .guardarUnidadMedida(dto)
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
