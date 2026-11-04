import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { catchError, finalize, from, map, of, switchMap } from 'rxjs';

import { RegistroInventario } from '../registro-inventario';
import { FiltrosExportacionStock } from '../contratos-inventario';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';
import {
  descargarArchivo,
  extraerFilenameDeContentDisposition,
} from '../../shared/archivos/descarga-archivos';

/**
 * Genera el nombre de archivo por defecto para el export de Kardex Stock.
 *
 * Patrón: kardex-stock-yyyyMMdd-HHmm.xlsx
 * Ejemplo: kardex-stock-20260818-1635.xlsx
 *
 * Se usa como fallback cuando el backend no envía Content-Disposition.
 */
function generarNombreKardexStockXlsx(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `kardex-stock-${yyyy}${MM}${dd}-${HH}${mm}.xlsx`;
}

const ERROR_EXPORTACION = 'No se pudo exportar el Excel.';

async function procesarRespuestaStock(respuesta: HttpResponse<Blob>): Promise<void> {
  const blob = respuesta.body;
  if (!blob) throw new Error('La respuesta no contiene un archivo Excel.');

  if (blob.type.includes('json')) {
    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(await blob.text());
    } catch {
      throw new Error(ERROR_EXPORTACION);
    }

    throw new Error(extraerMensajeError({ error: cuerpo }, ERROR_EXPORTACION));
  }

  descargarArchivo(
    blob,
    extraerFilenameDeContentDisposition(
      respuesta.headers.get('Content-Disposition'),
      generarNombreKardexStockXlsx(),
    ),
  );
}

@Injectable()
export class ExportacionStock {
  private readonly registro = inject(RegistroInventario);
  private readonly notificaciones = inject(Notificaciones);
  private readonly destroyRef = inject(DestroyRef);

  readonly exportando = signal(false);

  exportar(filtros: FiltrosExportacionStock): void {
    if (this.exportando()) return;

    if (filtros.fechaDesde && filtros.fechaHasta && filtros.fechaDesde > filtros.fechaHasta) {
      this.notificaciones.show('La fecha desde no puede ser posterior a la fecha hasta.', 'error');
      return;
    }

    this.exportando.set(true);

    this.registro
      .exportarStockExcel(filtros)
      .pipe(
        switchMap((respuesta) => from(procesarRespuestaStock(respuesta))),
        map(() => ({ exito: true, mensaje: 'Excel descargado correctamente.' })),
        catchError((error: unknown) => {
          // HttpClient sí distingue estados HTTP; el cuerpo de un 4xx puede seguir siendo Blob.
          if (
            error instanceof HttpErrorResponse &&
            error.error instanceof Blob &&
            error.error.type.includes('json')
          ) {
            return from(error.error.text()).pipe(
              map((texto) => {
                const cuerpo: unknown = JSON.parse(texto);

                return {
                  exito: false,
                  mensaje: extraerMensajeError({ error: cuerpo }, ERROR_EXPORTACION),
                };
              }),
              catchError(() => of({ exito: false, mensaje: ERROR_EXPORTACION })),
            );
          }

          return of({ exito: false, mensaje: extraerMensajeError(error, ERROR_EXPORTACION) });
        }),
        finalize(() => this.exportando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) =>
        this.notificaciones.show(resultado.mensaje, resultado.exito ? 'success' : 'error'),
      );
  }
}
