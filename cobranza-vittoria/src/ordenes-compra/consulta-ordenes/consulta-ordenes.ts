import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  defer,
  finalize,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { RegistroRequerimientos } from '../../requerimientos/registro-requerimientos';
import {
  RequerimientoGetResponse,
  RequerimientoResumen,
} from '../../requerimientos/contratos-requerimientos';
import { DetalleOrdenCompra, OrdenCompra } from '../contratos-ordenes-compra';
import { RegistroOrdenesCompra } from '../registro-ordenes-compra';
import { presentarDetalleOrden } from '../datos-orden';
import { mensajeOrden } from '../mensaje-orden';

type SeleccionOrden =
  | { tipo: 'requerimiento'; detalle: RequerimientoGetResponse }
  | { tipo: 'orden'; detalle: DetalleOrdenCompra };
type ConsultaSeleccion = { tipo: 'requerimiento' | 'orden'; id: number } | null;

@Injectable()
export class ConsultaOrdenes {
  private readonly registro = inject(RegistroOrdenesCompra);
  private readonly requerimientos = inject(RegistroRequerimientos);
  private readonly recargas = new Subject<void>();
  private readonly consultas = new Subject<ConsultaSeleccion>();

  readonly pendientes = signal<RequerimientoResumen[]>([]);
  readonly ordenes = signal<OrdenCompra[]>([]);
  readonly cargando = signal(false);
  readonly cargandoDetalle = signal(false);
  readonly errorPendientes = signal('');
  readonly errorOrdenes = signal('');
  readonly mensaje = signal('');
  readonly seleccion = signal<SeleccionOrden | null>(null);

  constructor() {
    this.recargas
      .pipe(
        startWith(undefined),
        switchMap(() =>
          defer(() => {
            this.cargando.set(true);
            this.errorPendientes.set('');
            this.errorOrdenes.set('');

            return forkJoin({
              pendientes: this.requerimientos.listar({ estado: 'EnviadoOC' }).pipe(
                catchError((error) => {
                  this.errorPendientes.set(
                    mensajeOrden(error, 'No se pudieron cargar los requerimientos enviados.'),
                  );
                  return of(null);
                }),
              ),
              ordenes: this.registro.listar().pipe(
                catchError((error) => {
                  this.errorOrdenes.set(
                    mensajeOrden(error, 'No se pudieron cargar las órdenes de compra.'),
                  );
                  return of(null);
                }),
              ),
            }).pipe(finalize(() => this.cargando.set(false)));
          }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        if (resultado.pendientes) this.pendientes.set(resultado.pendientes);

        if (resultado.ordenes) this.ordenes.set(resultado.ordenes);
      });

    this.consultas
      .pipe(
        switchMap((consulta) => {
          this.seleccion.set(null);
          this.mensaje.set('');

          if (!consulta) return EMPTY;

          this.cargandoDetalle.set(true);

          const lectura: Observable<SeleccionOrden> =
            consulta.tipo === 'requerimiento'
              ? this.requerimientos
                  .obtener(consulta.id)
                  .pipe(map((detalle) => ({ tipo: 'requerimiento' as const, detalle })))
              : this.registro.obtener(consulta.id).pipe(
                  map((detalle) => ({
                    tipo: 'orden' as const,
                    detalle: presentarDetalleOrden(detalle),
                  })),
                );

          return lectura.pipe(
            tap((seleccion) => this.seleccion.set(seleccion)),
            catchError((error) => {
              this.mensaje.set(
                mensajeOrden(
                  error,
                  consulta.tipo === 'requerimiento'
                    ? 'No se pudo cargar el requerimiento.'
                    : 'No se pudo cargar la orden.',
                ),
              );
              return EMPTY;
            }),
            finalize(() => this.cargandoDetalle.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  recargar(): void {
    this.recargas.next();
  }

  abrirRequerimiento(id: number): void {
    this.consultas.next({ tipo: 'requerimiento', id });
  }

  abrirOrden(id: number): void {
    this.consultas.next({ tipo: 'orden', id });
  }

  cerrar(): void {
    this.consultas.next(null);
  }
}
