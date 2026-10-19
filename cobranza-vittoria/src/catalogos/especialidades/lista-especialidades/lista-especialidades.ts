import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of, startWith, Subject, switchMap } from 'rxjs';
import { NotificationService } from '../../../app/core/services/notification.service';
import { ImportModalComponent } from '../../../app/shared/components/import-modal/import-modal.component';
import { DialogoCatalogo } from '../../dialogo-catalogo/dialogo-catalogo';
import { filtrarCatalogo } from '../../busqueda-catalogo';
import { mensajeCatalogo } from '../../mensaje-catalogo';
import { CatalogoEspecialidades } from '../catalogo-especialidades';
import { Especialidad, EspecialidadUpsert } from '../contratos-especialidades';
import { FormularioEspecialidad } from '../formulario-especialidad/formulario-especialidad';

@Component({
  selector: 'lista-especialidades',
  imports: [FormsModule, DialogoCatalogo, FormularioEspecialidad, ImportModalComponent],
  templateUrl: './lista-especialidades.html',
  styleUrl: './lista-especialidades.css',
})
export class ListaEspecialidades implements OnInit {
  private readonly api: CatalogoEspecialidades = inject(CatalogoEspecialidades);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly notificaciones: NotificationService = inject(NotificationService);
  private readonly recargas: Subject<void> = new Subject<void>();
  protected readonly filas = signal<Especialidad[]>([]);
  protected readonly busqueda = signal('');
  protected readonly filtradas = computed(() => filtrarCatalogo(this.filas(), this.busqueda()));
  protected readonly seleccionado = signal<Especialidad | null>(null);
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
          return this.api.especialidades().pipe(
            catchError((error: unknown) => {
              this.notificarError(error, 'No se pudo cargar el listado.');
              return of<Especialidad[]>([]);
            }),
            finalize(() => this.cargando.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((datos: Especialidad[]) => this.filas.set(datos));
  }

  protected actualizar(): void {
    this.recargas.next();
  }

  protected nuevo(): void {
    this.error.set('');
    this.seleccionado.set(null);
    this.modalAbierto.set(true);
  }

  protected editar(fila: Especialidad): void {
    this.error.set('');
    this.seleccionado.set(fila);
    this.modalAbierto.set(true);
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    this.modalAbierto.set(false);
    this.error.set('');
  }

  protected guardar(dto: EspecialidadUpsert): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');
    this.api
      .guardarEspecialidad(dto)
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
