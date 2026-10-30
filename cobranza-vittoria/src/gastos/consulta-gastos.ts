import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, finalize, of, switchMap } from 'rxjs';
import { extraerMensajeError } from '../app/core/utils/api-error.util';

/** Cada propietario mantiene su consulta; una nueva lectura cancela la anterior. */
export class ConsultaGastos<T> {
  readonly filas = signal<T[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');

  private readonly consultas = new Subject<Observable<T[]>>();
  private readonly destroyRef = inject(DestroyRef);

  constructor(private readonly mensaje: string) {
    this.consultas
      .pipe(
        switchMap((consulta) => {
          this.cargando.set(true);
          this.error.set('');
          return consulta.pipe(
            catchError((error: unknown) => {
              this.error.set(extraerMensajeError(error, this.mensaje));
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
