import { CatalogosPresupuestarios } from '../presupuestos/catalogos-presupuestarios';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, forkJoin, of, switchMap } from 'rxjs';

import { MonedaPresupuestaria } from '../presupuestos/contratos-catalogos-presupuestarios';
import {
  CategoriaGasto,
  CentroCostoGastoDirecto,
  ProveedorGastoDirecto,
} from './contratos-gastos-directos';
import { RegistroGastosDirectos } from './registro-gastos-directos';

/** Referencias del módulo de Gastos; conserva resultados válidos ante fallos parciales. */
@Injectable()
export class ReferenciasGastos {
  private readonly catalogosPresupuestarios = inject(CatalogosPresupuestarios);

  private readonly registro = inject(RegistroGastosDirectos);
  private readonly destroyRef = inject(DestroyRef);
  private readonly solicitudes = new Subject<void>();

  readonly categorias = signal<CategoriaGasto[]>([]);
  readonly centrosCosto = signal<CentroCostoGastoDirecto[]>([]);
  readonly proveedores = signal<ProveedorGastoDirecto[]>([]);
  readonly monedas = signal<MonedaPresupuestaria[]>([]);
  readonly errorCategorias = signal('');
  readonly errores = signal<string[]>([]);
  readonly cargando = signal(false);
  readonly listas = signal(false);

  constructor() {
    this.solicitudes
      .pipe(
        switchMap(() => {
          this.cargando.set(true);
          this.listas.set(false);
          this.categorias.set([]);
          this.errores.set([]);
          this.errorCategorias.set('');
          return forkJoin({
            categorias: this.recuperar(this.registro.categorias(), 'categorías de gasto'),
            centros: this.recuperar(this.registro.centrosCosto(), 'centros de costo'),
            proveedores: this.recuperar(this.registro.proveedores(), 'proveedores'),
            monedas: this.recuperar(this.catalogosPresupuestarios.monedas(), 'monedas'),
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((datos) => {
        if (datos.centros !== null) this.centrosCosto.set(datos.centros);
        if (datos.proveedores !== null) this.proveedores.set(datos.proveedores);
        if (datos.monedas !== null) this.monedas.set(datos.monedas);

        this.categorias.set(datos.categorias ?? []);
        this.errorCategorias.set(
          datos.categorias !== null && !datos.categorias.length
            ? 'No hay categorías de gasto disponibles para registrar o editar gastos.'
            : '',
        );
        this.cargando.set(false);
        this.listas.set(this.categorias().length > 0);
      });
  }

  cargar(): void {
    this.solicitudes.next();
  }

  private recuperar<T>(consulta: Observable<T[]>, nombre: string): Observable<T[] | null> {
    return consulta.pipe(
      catchError(() => {
        this.errores.update((errores) => [...errores, `No se pudieron cargar ${nombre}.`]);
        return of(null);
      }),
    );
  }
}
