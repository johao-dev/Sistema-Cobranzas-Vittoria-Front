import { inject, Injectable } from '@angular/core';
import {
  catchError,
  concat,
  forkJoin,
  from,
  map,
  mergeMap,
  Observable,
  of,
  switchMap,
  timeout,
  toArray,
} from 'rxjs';
import { RegistroCompras } from '../../compras/registro-compras';
import { ValorizacionesService } from '../../app/core/services/valorizaciones.service';
import { CompraDetalleResponse, CompraFilaSql } from '../../compras/contratos-compras';
import { ValorizacionListado } from '../../app/models/valorizaciones.models';
import { agruparMateriales, calcularTarjetas } from '../indicadores/calculos-dashboard';
import { DatosDashboard } from '../contratos-dashboard';

interface ResultadoConsulta<T> {
  datos: T;
  errores: string[];
}

function consultar<T>(
  peticion: Observable<T>,
  vacio: T,
  mensaje: string,
): Observable<ResultadoConsulta<T>> {
  return peticion.pipe(
    map((datos: T): ResultadoConsulta<T> => ({ datos, errores: [] })),
    catchError(() => of({ datos: vacio, errores: [mensaje] })),
  );
}

@Injectable({ providedIn: 'root' })
export class CargarDashboard {
  private readonly compras: RegistroCompras = inject(RegistroCompras);
  private readonly valorizaciones: ValorizacionesService = inject(ValorizacionesService);

  cargar(): Observable<DatosDashboard> {
    return forkJoin({
      compras: consultar<CompraFilaSql[]>(
        this.compras.compras(),
        [],
        'No se pudo cargar el listado de compras.',
      ),
      valorizaciones: consultar<ValorizacionListado[]>(
        this.valorizaciones.valorizaciones(),
        [],
        'No se pudieron cargar las valorizaciones.',
      ),
    }).pipe(
      switchMap(({ compras, valorizaciones }): Observable<DatosDashboard> => {
        const ids: number[] = [
          ...new Set(compras.datos.map((compra) => compra.IdCompra).filter((id) => id > 0)),
        ];
        const resumen: DatosDashboard = {
          tarjetas: calcularTarjetas(compras.datos, valorizaciones.datos),
          materiales: [],
          cargandoMateriales: ids.length > 0,
          errores: [...compras.errores, ...valorizaciones.errores],
        };
        if (!ids.length) return of(resumen);

        // Limitar conexiones; conservar el orden de compra para los empates y el redondeo histórico.
        const detalles: Observable<DatosDashboard> = from(
          ids.map((id, indice) => ({ id, indice })),
        ).pipe(
          mergeMap(
            ({ id, indice }) =>
              consultar<CompraDetalleResponse | null>(
                this.compras.compra(id).pipe(timeout(12000)),
                null,
                `No se pudieron cargar los materiales de la compra ${id}.`,
              ).pipe(map((resultado) => ({ ...resultado, indice }))),
            4,
          ),
          toArray(),
          map((resultados) => {
            resultados.sort((a, b) => a.indice - b.indice);
            return {
              ...resumen,
              materiales: agruparMateriales(
                resultados.flatMap((resultado) => (resultado.datos ? [resultado.datos] : [])),
              ),
              cargandoMateriales: false,
              errores: [
                ...resumen.errores,
                ...resultados.flatMap((resultado) => resultado.errores),
              ],
            };
          }),
        );
        return concat(of(resumen), detalles);
      }),
    );
  }
}
