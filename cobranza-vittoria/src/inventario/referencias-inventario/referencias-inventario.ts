import { DestroyRef, Injectable, WritableSignal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';

import { CatalogoEspecialidades } from '../../catalogos/especialidades/catalogo-especialidades';
import { CatalogoMateriales } from '../../catalogos/materiales/catalogo-materiales';
import { CatalogoProyectos } from '../../catalogos/proyectos/catalogo-proyectos';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';
import { Especialidad } from '../../catalogos/especialidades/contratos-especialidades';
import { Material } from '../../catalogos/materiales/contratos-materiales';
import { Proyecto } from '../../catalogos/proyectos/contratos-proyectos';
import { Proveedor } from '../../catalogos/proveedores/contratos-proveedores';

@Injectable()
export class ReferenciasInventario {
  private readonly especialidadesApi = inject(CatalogoEspecialidades);
  private readonly materialesApi = inject(CatalogoMateriales);
  private readonly proyectosApi = inject(CatalogoProyectos);
  private readonly proveedoresApi = inject(CatalogoProveedores);
  private readonly destroyRef = inject(DestroyRef);

  readonly especialidades = signal<Especialidad[]>([]);
  readonly materiales = signal<Material[]>([]);
  readonly proyectos = signal<Proyecto[]>([]);
  readonly proveedores = signal<Proveedor[]>([]);
  readonly errores = signal<string[]>([]);
  readonly pendientes = signal(0);

  cargar(tipo: 'entrada' | 'salida' | 'stock' | 'compras' | 'transferencia'): void {
    if (this.pendientes()) return;

    this.errores.set([]);

    this.consultar(
      this.especialidadesApi.especialidades(true),
      this.especialidades,
      'especialidades',
    );
    if (tipo !== 'stock')
      this.consultar(this.materialesApi.materiales(true), this.materiales, 'materiales');
    if (tipo !== 'compras')
      this.consultar(this.proyectosApi.proyectos(true), this.proyectos, 'proyectos');
    if (tipo === 'entrada')
      this.consultar(this.proveedoresApi.proveedores(true), this.proveedores, 'proveedores');
  }

  private consultar<T>(
    consulta: Observable<T[]>,
    destino: WritableSignal<T[]>,
    nombre: string,
  ): void {
    this.pendientes.update((n) => n + 1);

    consulta
      .pipe(
        finalize(() => this.pendientes.update((n) => n - 1)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (filas) => destino.set(filas),
        error: () =>
          this.errores.update((errores) => [
            ...errores,
            `No se pudo cargar el catálogo de ${nombre}.`,
          ]),
      });
  }
}
