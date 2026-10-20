import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, of, switchMap } from 'rxjs';
import { ControlPresupuestarioService } from '../app/core/services/control-presupuestario.service';
import {
  CentroCostoResumen,
  PartidaCatalogo,
  SaldoPartida,
} from '../app/models/consultas-presupuestarias.models';
import { mensajeRequerimiento } from './mensaje-requerimiento';

/** Consultas presupuestarias del editor; nunca modifica el presupuesto. */
@Injectable()
export class PartidasRequerimiento {
  private readonly api = inject(ControlPresupuestarioService);
  private readonly destroyRef = inject(DestroyRef);

  readonly centros = signal<CentroCostoResumen[]>([]);
  readonly catalogo = signal<PartidaCatalogo[]>([]);
  readonly partidas = signal<SaldoPartida[]>([]);
  readonly cargando = signal(false);
  readonly cargandoCentros = signal(false);
  readonly error = signal('');
  readonly errorCentros = signal('');
  readonly errorCatalogo = signal('');

  readonly actualizadas = new Subject<void>();
  private readonly consultar = new Subject<number | null>();

  private proyecto: number | null = null;

  constructor() {
    this.consultar
      .pipe(
        switchMap((idProyecto) => {
          this.partidas.set([]);
          this.error.set('');

          const centro = this.centros().find((centro) => centro.idProyecto === idProyecto);

          this.cargando.set(!!centro);

          if (!centro) return of([]);

          return this.api
            .saldos({ idCentroCosto: centro.idCentroCosto, estadoPresupuesto: 'APROBADO' })
            .pipe(
              catchError((error: unknown) => {
                this.error.set(
                  mensajeRequerimiento(
                    error,
                    'No se pudieron cargar las partidas del presupuesto.',
                  ),
                );
                return of([]);
              }),
              finalize(() => this.cargando.set(false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((partidas) => {
        this.partidas.set(partidas);

        this.actualizadas.next();
      });
  }

  iniciar(): void {
    this.cargandoCentros.set(true);

    this.api
      .centrosCosto(true, null, null)
      .pipe(
        finalize(() => this.cargandoCentros.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (centros) => {
          this.centros.set(centros);

          // El editor puede abrirse antes de que termine esta consulta.
          if (this.proyecto !== null) this.cargar(this.proyecto);
        },
        error: (error: unknown) =>
          this.errorCentros.set(
            mensajeRequerimiento(error, 'No se pudieron consultar los centros de costo.'),
          ),
      });

    this.api
      .partidas({ activo: true, esHoja: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (partidas) => this.catalogo.set(partidas),
        error: (error: unknown) =>
          this.errorCatalogo.set(
            mensajeRequerimiento(error, 'No se pudo cargar el catálogo de partidas.'),
          ),
      });
  }

  cargar(idProyecto: number | null): void {
    this.proyecto = idProyecto;

    this.consultar.next(idProyecto);
  }
}
