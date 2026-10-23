import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, finalize, of, switchMap } from 'rxjs';

import { mensajeErrorInventario } from '../errores-inventario';

/** Estado de lectura compartido por los cuatro listados; cada vista conserva sus filtros y acciones. */
export class ConsultaInventario<T> {
  readonly filas = signal<T[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  private readonly consultas = new Subject<Observable<T[]>>();

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.consultas
      .pipe(
        switchMap((consulta) => {
          this.cargando.set(true);
          this.error.set('');

          return consulta.pipe(
            catchError((error: unknown) => {
              this.error.set(mensajeErrorInventario(error, 'No se pudo cargar el inventario.'));
              return of([]);
            }),
            finalize(() => this.cargando.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filas) => this.filas.set(filas));
  }

  cargar(consulta: Observable<T[]>): void {
    this.consultas.next(consulta);
  }
}
