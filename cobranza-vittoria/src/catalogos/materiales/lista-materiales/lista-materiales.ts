import {
  MaterialPlantillaFormato,
  MATERIAL_PLANTILLA_FORMATOS,
} from '../../../app/models/import.models';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of, startWith, Subject, Subscription, switchMap } from 'rxjs';
import { NotificationService } from '../../../app/core/services/notification.service';
import { ImportModalComponent } from '../../../app/shared/components/import-modal/import-modal.component';
import { DialogoCatalogo } from '../../dialogo-catalogo/dialogo-catalogo';
import { filtrarCatalogo } from '../../busqueda-catalogo';
import { mensajeCatalogo } from '../../mensaje-catalogo';
import { CatalogoMateriales } from '../catalogo-materiales';
import { Material, MaterialUpsert, OpcionPartida } from '../contratos-materiales';
import { FormularioMaterial } from '../formulario-material/formulario-material';
import { CatalogoEspecialidades } from '../../especialidades/catalogo-especialidades';
import { CatalogoUnidadesMedida } from '../../unidades-medida/catalogo-unidades-medida';
import { Especialidad } from '../../especialidades/contratos-especialidades';
import { UnidadMedida } from '../../unidades-medida/contratos-unidades-medida';
import { ControlPresupuestarioService } from '../../../app/core/services/control-presupuestario.service';
import { leerOpcionesPartida } from '../opciones-partida';

@Component({
  selector: 'lista-materiales',
  imports: [FormsModule, DialogoCatalogo, FormularioMaterial, ImportModalComponent],
  templateUrl: './lista-materiales.html',
  styleUrl: './lista-materiales.css',
})
export class ListaMateriales implements OnInit {
  private readonly api: CatalogoMateriales = inject(CatalogoMateriales);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly notificaciones: NotificationService = inject(NotificationService);
  private readonly recargas: Subject<void> = new Subject<void>();
  private readonly especialidadesApi: CatalogoEspecialidades = inject(CatalogoEspecialidades);
  private readonly unidadesApi: CatalogoUnidadesMedida = inject(CatalogoUnidadesMedida);
  private readonly presupuesto: ControlPresupuestarioService = inject(ControlPresupuestarioService);
  protected readonly especialidades = signal<Especialidad[]>([]);
  protected readonly unidades = signal<UnidadMedida[]>([]);
  protected readonly partidas = signal<OpcionPartida[]>([]);
  protected readonly filtroEspecialidad = signal<number | null>(null);
  private detalleSub?: Subscription;
  protected readonly cargandoDetalle = signal(false);
  protected readonly detalleListo = signal(true);
  protected readonly importFormato = signal<MaterialPlantillaFormato>('xlsx');
  protected readonly formatosPlantilla = MATERIAL_PLANTILLA_FORMATOS;
  protected readonly filas = signal<Material[]>([]);
  protected readonly busqueda = signal('');
  protected readonly filtradas = computed(() => filtrarCatalogo(this.filas(), this.busqueda()));
  protected readonly seleccionado = signal<Material | null>(null);
  protected readonly modalAbierto = signal(false);
  protected readonly importAbierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.especialidadesApi
      .especialidades(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => this.especialidades.set(datos),
        error: (error: unknown) =>
          this.notificarError(error, 'No se pudieron cargar las especialidades.'),
      });
    this.unidadesApi
      .unidadesMedida(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => this.unidades.set(datos),
        error: (error: unknown) =>
          this.notificarError(error, 'No se pudieron cargar las unidades.'),
      });
    this.presupuesto
      .partidas({ activo: true, esHoja: true })
      .pipe(
        switchMap((datos: unknown) => of(leerOpcionesPartida(datos))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (datos) => this.partidas.set(datos), error: () => this.partidas.set([]) });
    this.recargas
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.cargando.set(true);
          this.error.set('');
          return this.api.materiales(undefined, this.filtroEspecialidad()).pipe(
            catchError((error: unknown) => {
              this.notificarError(error, 'No se pudo cargar el listado.');
              return of<Material[]>([]);
            }),
            finalize(() => this.cargando.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((datos: Material[]) => this.filas.set(datos));
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

  protected editar(fila: Material): void {
    this.error.set('');
    this.seleccionado.set(fila);
    this.modalAbierto.set(true);
    this.detalleSub?.unsubscribe();
    this.detalleListo.set(false);
    this.cargandoDetalle.set(true);
    this.detalleSub = this.api
      .material(fila.idMaterial)
      .pipe(
        finalize(() => this.cargandoDetalle.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (datos) => {
          this.seleccionado.set(datos);
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

  protected guardar(dto: MaterialUpsert): void {
    if (this.guardando() || !this.detalleListo()) return;
    this.guardando.set(true);
    this.error.set('');
    this.api
      .guardarMaterial(dto)
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
    const cuerpo: unknown = error instanceof HttpErrorResponse ? error.error : undefined;
    const conflictoEspecialidad =
      error instanceof HttpErrorResponse &&
      error.status === 409 &&
      typeof cuerpo === 'object' &&
      cuerpo !== null &&
      'error' in cuerpo &&
      cuerpo.error === 'ESPECIALIDAD_MATERIAL_CON_MOVIMIENTOS';

    const mensaje = conflictoEspecialidad
      ? 'No se puede cambiar la especialidad porque el material ya tiene movimientos de inventario.'
      : mensajeCatalogo(error, respaldo);
    this.error.set(mensaje);
    this.notificaciones.show(mensaje, 'error');
  }
}
