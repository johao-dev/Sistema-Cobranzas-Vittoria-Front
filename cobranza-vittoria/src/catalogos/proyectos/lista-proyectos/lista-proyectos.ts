import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of, startWith, Subject, switchMap } from 'rxjs';
import { NotificationService } from '../../../app/core/services/notification.service';
import { DialogoCatalogo } from '../../dialogo-catalogo/dialogo-catalogo';
import { filtrarCatalogo } from '../../busqueda-catalogo';
import { mensajeCatalogo } from '../../mensaje-catalogo';
import { CatalogoProyectos } from '../catalogo-proyectos';
import { Proyecto, ProyectoUpsert } from '../contratos-proyectos';
import { FormularioProyecto } from '../formulario-proyecto/formulario-proyecto';

@Component({
  selector: 'lista-proyectos',
  imports: [FormsModule, DialogoCatalogo, FormularioProyecto],
  templateUrl: './lista-proyectos.html',
  styleUrl: './lista-proyectos.css',
})
export class ListaProyectos implements OnInit {
  private readonly api: CatalogoProyectos = inject(CatalogoProyectos);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly notificaciones: NotificationService = inject(NotificationService);
  private readonly recargas: Subject<void> = new Subject<void>();
  protected readonly filas = signal<Proyecto[]>([]);
  protected readonly busqueda = signal('');
  protected readonly filtradas = computed(() => filtrarCatalogo(this.filas(), this.busqueda()));
  protected readonly seleccionado = signal<Proyecto | null>(null);
  protected readonly modalAbierto = signal(false);
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
          return this.api.proyectos().pipe(
            catchError((error: unknown) => {
              this.notificarError(error, 'No se pudo cargar el listado.');
              return of<Proyecto[]>([]);
            }),
            finalize(() => this.cargando.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((datos: Proyecto[]) => this.filas.set(datos));
  }

  protected actualizar(): void {
    this.recargas.next();
  }

  protected nuevo(): void {
    this.error.set('');
    this.seleccionado.set(null);
    this.modalAbierto.set(true);
  }

  protected editar(fila: Proyecto): void {
    this.error.set('');
    this.seleccionado.set(fila);
    this.modalAbierto.set(true);
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    this.modalAbierto.set(false);
    this.error.set('');
  }

  protected guardar(dto: ProyectoUpsert): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');
    this.api
      .guardarProyecto(dto)
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

  protected formatMoney(valor: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor);
  }

  private notificarError(error: unknown, respaldo: string): void {
    const mensaje: string = mensajeCatalogo(error, respaldo);
    this.error.set(mensaje);
    this.notificaciones.show(mensaje, 'error');
  }
}
