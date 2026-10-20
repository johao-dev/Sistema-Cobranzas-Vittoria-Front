import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../app/core/services/notification.service';
import { RegistroRequerimientos } from '../registro-requerimientos';
import { mensajeRequerimiento } from '../mensaje-requerimiento';
import {
  RequerimientoFilters,
  RequerimientoGetResponse,
  RequerimientoResumen,
} from '../contratos-requerimientos';
import { finalize, switchMap, Subject, catchError, of } from 'rxjs';

@Injectable()
export class ConsultaRequerimientos {
  private readonly requerimientos = inject(RegistroRequerimientos);
  private readonly notifyService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rows = signal<RequerimientoResumen[]>([]);
  readonly filtros = signal<RequerimientoFilters>({
    estado: '',
    idEspecialidad: null,
    idProyecto: null,
  });
  readonly detalle = signal<RequerimientoGetResponse | null>(null);
  readonly cargando = signal(false);
  readonly errorListado = signal('');
  readonly cargandoDetalle = signal(false);

  private readonly recargarListado = new Subject<RequerimientoFilters>();
  private readonly consultarDetalle = new Subject<number | null>();
  private readonly listadoActualizado = new Subject<void>();

  readonly listadoRecibido = this.listadoActualizado.asObservable();

  private readonly detalleCargado = new Subject<RequerimientoGetResponse | null>();

  readonly detalleRecibido = this.detalleCargado.asObservable();

  constructor() {
    this.recargarListado
      .pipe(
        switchMap((filtros) => {
          this.cargando.set(true);
          this.errorListado.set('');
          return this.requerimientos.listar(filtros).pipe(
            catchError((error: unknown) => {
              this.errorListado.set(
                mensajeRequerimiento(error, 'No se pudieron cargar los requerimientos.'),
              );
              return of([]);
            }),
            finalize(() => this.cargando.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this.rows.set(rows);

        this.listadoActualizado.next();
      });

    this.consultarDetalle
      .pipe(
        switchMap((id) => {
          if (id === null) return of(null);

          this.cargandoDetalle.set(true);
          return this.requerimientos.obtener(id).pipe(
            catchError((error: unknown) => {
              this.notifyService.show(
                mensajeRequerimiento(error, 'No se pudo cargar el detalle.'),
                'error',
              );
              return of(null);
            }),
            finalize(() => this.cargandoDetalle.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detalle) => {
        this.detalle.set(detalle);

        this.detalleCargado.next(detalle);
      });
  }

  load(): void {
    this.recargarListado.next({ ...this.filtros() });
  }

  consultar(id: number | null): void {
    this.consultarDetalle.next(id);
  }
}
