import { Especialidad } from '../../catalogos/especialidades/contratos-especialidades';
import { Proyecto } from '../../catalogos/proyectos/contratos-proyectos';
import { UnidadMedida } from '../../catalogos/unidades-medida/contratos-unidades-medida';
import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CatalogoEspecialidades } from '../../catalogos/especialidades/catalogo-especialidades';
import { CatalogoProyectos } from '../../catalogos/proyectos/catalogo-proyectos';
import { CatalogoMateriales } from '../../catalogos/materiales/catalogo-materiales';
import { CatalogoUnidadesMedida } from '../../catalogos/unidades-medida/catalogo-unidades-medida';
import { mensajeRequerimiento } from '../mensaje-requerimiento';
import { finalize, catchError, of, forkJoin } from 'rxjs';
import { Material } from '../../catalogos/materiales/contratos-materiales';

@Injectable()
export class ReferenciasRequerimiento {
  private readonly especialidadesApi = inject(CatalogoEspecialidades);
  private readonly proyectosApi = inject(CatalogoProyectos);
  private readonly materialesApi = inject(CatalogoMateriales);
  private readonly unidadesApi = inject(CatalogoUnidadesMedida);
  private readonly destroyRef = inject(DestroyRef);

  readonly especialidades = signal<Especialidad[]>([]);
  readonly proyectos = signal<Proyecto[]>([]);
  readonly materiales = signal<Material[]>([]);
  readonly unidadesMedida = signal<UnidadMedida[]>([]);
  readonly cargandoCatalogos = signal(false);
  readonly errorCatalogos = signal<string[]>([]);

  loadCatalogos(): void {
    if (this.cargandoCatalogos()) return;

    this.cargandoCatalogos.set(true);
    this.errorCatalogos.set([]);

    forkJoin({
      especialidades: this.especialidadesApi.especialidades(true).pipe(
        catchError((error: unknown) => {
          this.errorCatalogos.update((errores) => [
            ...errores,
            mensajeRequerimiento(error, 'No se pudieron cargar las especialidades.'),
          ]);
          return of([]);
        }),
      ),
      proyectos: this.proyectosApi.proyectos(true).pipe(
        catchError((error: unknown) => {
          this.errorCatalogos.update((errores) => [
            ...errores,
            mensajeRequerimiento(error, 'No se pudieron cargar los proyectos.'),
          ]);
          return of([]);
        }),
      ),
      materiales: this.materialesApi.materiales(true).pipe(
        catchError((error: unknown) => {
          this.errorCatalogos.update((errores) => [
            ...errores,
            mensajeRequerimiento(error, 'No se pudieron cargar los materiales.'),
          ]);
          return of([]);
        }),
      ),
      unidades: this.unidadesApi.unidadesMedida(true).pipe(
        catchError((error: unknown) => {
          this.errorCatalogos.update((errores) => [
            ...errores,
            mensajeRequerimiento(error, 'No se pudieron cargar las unidades de medida.'),
          ]);
          return of([]);
        }),
      ),
    })
      .pipe(
        finalize(() => this.cargandoCatalogos.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((catalogos) => {
        this.especialidades.set(catalogos.especialidades);
        this.proyectos.set(catalogos.proyectos);
        this.materiales.set(catalogos.materiales);
        this.unidadesMedida.set(catalogos.unidades);
      });
  }
}
