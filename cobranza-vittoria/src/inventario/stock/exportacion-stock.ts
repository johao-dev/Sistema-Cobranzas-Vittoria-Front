import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { catchError, finalize, from, map, of, switchMap } from 'rxjs';

import { RegistroInventario } from '../registro-inventario';
import { KardexStockFiltroDto } from '../contratos-inventario';
import { NotificationService } from '../../app/core/services/notification.service';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import {
  descargarArchivo,
  extraerFilenameDeContentDisposition,
  generarNombreKardexStockXlsx,
} from '../../app/core/utils/file-download.util';

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
  private readonly notificaciones = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly exportando = signal(false);

  exportar(filtros: KardexStockFiltroDto, incluirTotales: boolean): void {
    if (this.exportando()) return;

    this.exportando.set(true);

    this.registro
      .exportarStockExcel(filtros, incluirTotales)
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
