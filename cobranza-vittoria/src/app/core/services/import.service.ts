import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { extraerMensajeError } from '../utils/api-error.util';
import {
  descargarArchivo,
  extraerFilenameDeContentDisposition
} from '../utils/file-download.util';
import {
  ImportModulo,
  ImportExito,
  ImportResultado,
  ImportErrorResponse,
  MaterialPlantillaFormato
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
    form.append('usuario', usuario);

    return this.http
      .post<ImportExito>(`${this.api.baseUrl}/api/import/${modulo}`, form)
      .pipe(
        map(data => ({ ok: true as const, data })),
        catchError((err: HttpErrorResponse) => of(this.normalizarError(err)))
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
    formato: MaterialPlantillaFormato
  ): Observable<DescargarPlantillaResultado> {
    const url = `${this.api.baseUrl}/api/import/${modulo}/plantilla?formato=${formato}`;

    return this.http
      .get(url, { responseType: 'blob', observe: 'response' })
      .pipe(
        switchMap(resp => this.procesarPlantillaOk(resp, modulo, formato)),
        catchError((err: HttpErrorResponse) => of(this.procesarPlantillaError(err)))
      );
  }

  private procesarPlantillaOk(
    resp: HttpResponse<Blob>,
    modulo: ImportModulo,
    formato: MaterialPlantillaFormato
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

    const fallback = `plantilla-${modulo}.${formato}`;
    const filename = extraerFilenameDeContentDisposition(
      resp.headers.get('Content-Disposition'),
      fallback
    );
    descargarArchivo(blob, filename);
    return of({ ok: true });
  }

  private async parsearErrorJson(blob: Blob): Promise<DescargarPlantillaResultado> {
    try {
      const text = await blob.text();
      const body = JSON.parse(text);
      const message =
        body?.message ??
        (body?.error ? `Error: ${body.error}` : undefined) ??
        'No se pudo descargar la plantilla.';
      return { ok: false, message };
    } catch {
      return { ok: false, message: 'No se pudo procesar la respuesta de la plantilla.' };
    }
  }

  private procesarPlantillaError(err: HttpErrorResponse): DescargarPlantillaResultado {
    return { ok: false, message: extraerMensajeError(err, 'No se pudo descargar la plantilla.') };
  }

  private normalizarError(err: HttpErrorResponse): { ok: false; httpStatus: number; error: ImportErrorResponse } {
    const status = err.status ?? 0;
    const body = (err.error ?? {}) as Partial<ImportErrorResponse>;

    return {
      ok: false,
      httpStatus: status,
      error: {
        ok: false,
        error: (body.error as any) ?? 'UNHANDLED_ERROR',
        message: body.message ?? err.message ?? 'Error desconocido al importar.',
        errores: Array.isArray(body.errores) ? body.errores : undefined,
        detalles: Array.isArray(body.detalles) ? body.detalles : undefined
      }
    };
  }
}
