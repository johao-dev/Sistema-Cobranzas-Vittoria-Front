import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { extraerMensajeError } from '../utils/api-error.util';
import { descargarArchivo, extraerFilenameDeContentDisposition } from '../utils/file-download.util';
import {
  ImportModulo,
  ImportExito,
  ImportResultado,
  ImportErrorResponse,
  MaterialPlantillaFormato,
  ResultadoImportacionGastosDirectos,
  IMPORT_MODULOS_META,
} from '../../models/import.models';

export interface DescargarPlantillaResultado {
  ok: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ImportService {
  private api = inject(ApiService);
  private http: HttpClient = inject(HttpClient);

  importar(modulo: ImportModulo, archivo: File, usuario: string): Observable<ImportResultado> {
    const form = new FormData();
    form.append('archivo', archivo);
    if (IMPORT_MODULOS_META[modulo].enviarUsuario !== false) form.append('usuario', usuario);

    const ruta = IMPORT_MODULOS_META[modulo]?.urlImportar ?? `/api/import/${modulo}`;
    return this.http
      .post<ImportExito | ResultadoImportacionGastosDirectos>(`${this.api.baseUrl}${ruta}`, form)
      .pipe(
        map(
          (data): ImportResultado =>
            data.ok === false || data.resultado === 'RECHAZADO'
              ? {
                  ok: false,
                  httpStatus: 422,
                  error: {
                    ...data,
                    ok: false,
                    resultado: 'RECHAZADO',
                    error: 'DATOS_INVALIDOS',
                    message: 'La operación fue rechazada. No se registró ninguna fila.',
                  },
                }
              : { ok: true, data },
        ),
        catchError((err: HttpErrorResponse) => of(this.normalizarError(err, modulo))),
      );
  }

  /**
   * Descarga la plantilla vacía de un módulo desde el backend.
   *
   * Endpoint: GET /api/import/{modulo}/plantilla?formato={xlsx|csv}
   *
   * Reutiliza los utilitarios centralizados de descarga (`descargarArchivo`,
   * `extraerFilenameDeContentDisposition`) y valida el `Content-Type` del
   * Blob para detectar errores JSON camuflados en respuestas binarias
   * (lección aprendida del proyecto con HttpClient + responseType blob).
   */
  descargarPlantilla(
    modulo: ImportModulo,
    formato: MaterialPlantillaFormato,
  ): Observable<DescargarPlantillaResultado> {
    const ruta = IMPORT_MODULOS_META[modulo]?.urlPlantilla ?? `/api/import/${modulo}/plantilla`;
    const query =
      IMPORT_MODULOS_META[modulo].plantillaConFormato === false ? '' : `?formato=${formato}`;
    const url = `${this.api.baseUrl}${ruta}${query}`;

    return this.http.get(url, { responseType: 'blob', observe: 'response' }).pipe(
      switchMap((resp) => this.procesarPlantillaOk(resp, modulo, formato)),
      catchError((err: HttpErrorResponse) => this.procesarPlantillaError(err)),
    );
  }

  private procesarPlantillaOk(
    resp: HttpResponse<Blob>,
    modulo: ImportModulo,
    formato: MaterialPlantillaFormato,
  ): Observable<DescargarPlantillaResultado> {
    const blob = resp.body;
    if (!blob) {
      return of({ ok: false, message: 'No se recibió el archivo de plantilla.' });
    }

    // El backend puede responder 200 con un Blob JSON cuando hay error
    // (FORMATO_PLANTILLA_INVALIDO, PLANTILLA_NO_DISPONIBLE).
    if (blob.type && blob.type.includes('application/json')) {
      return from(this.parsearErrorJson(blob));
    }

    const fallback =
      IMPORT_MODULOS_META[modulo].nombrePlantilla ?? `plantilla-${modulo}.${formato}`;
    const filename = extraerFilenameDeContentDisposition(
      resp.headers.get('Content-Disposition'),
      fallback,
    );
    descargarArchivo(blob, filename);
    return of({ ok: true });
  }

  private async parsearErrorJson(blob: Blob): Promise<DescargarPlantillaResultado> {
    try {
      const text = await blob.text();
      const body: unknown = JSON.parse(text);
      const message = this.mensajeFuncional(body, 'No se pudo descargar la plantilla.');
      return { ok: false, message };
    } catch {
      return { ok: false, message: 'No se pudo procesar la respuesta de la plantilla.' };
    }
  }

  private procesarPlantillaError(err: HttpErrorResponse): Observable<DescargarPlantillaResultado> {
    const fallback = 'No se pudo descargar la plantilla.';
    if (err.status === 0 || err.status >= 500) return of({ ok: false, message: fallback });
    if (err.error instanceof Blob) return from(this.parsearErrorJson(err.error));
    return of({ ok: false, message: this.mensajeFuncional(err.error, fallback) });
  }

  private mensajeFuncional(body: unknown, fallback: string): string {
    if (!body || typeof body !== 'object') return fallback;
    const mensaje = extraerMensajeError({ error: body }, fallback);
    return /<[^>]+>/.test(mensaje) ? fallback : mensaje;
  }

  private normalizarError(
    err: HttpErrorResponse,
    modulo: ImportModulo,
  ): { ok: false; httpStatus: number; error: ImportErrorResponse } {
    const status = err.status ?? 0;
    const body = (
      err.error && typeof err.error === 'object' && !(err.error instanceof Blob) ? err.error : {}
    ) as Partial<ImportErrorResponse>;
    const fallback = 'Ocurrió un error inesperado.';
    const limiteMb =
      (IMPORT_MODULOS_META[modulo].maxFileSizeBytes ?? 5 * 1024 * 1024) / (1024 * 1024);
    const message =
      status === 413
        ? `El archivo supera el tamaño máximo permitido de ${limiteMb} MB.`
        : status === 0 || status >= 500
          ? fallback
          : this.mensajeFuncional({ message: body.message }, 'No se pudo importar el archivo.');

    return {
      ok: false,
      httpStatus: status,
      error: {
        ok: false,
        error: body.error ?? 'UNHANDLED_ERROR',
        message,
        errores: status === 422 && Array.isArray(body.errores) ? body.errores : undefined,
        detalles: status === 422 && Array.isArray(body.detalles) ? body.detalles : undefined,
        totalFilas: body.totalFilas,
        filasValidas: body.filasValidas,
        filasInvalidas: body.filasInvalidas,
        filasInsertadas: body.filasInsertadas,
        resultado: body.resultado,
      },
    };
  }
}
