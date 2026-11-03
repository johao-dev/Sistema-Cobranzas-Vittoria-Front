import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ApiHttp } from '../../core/http/api-http';
import { mensajeImportacion, normalizarErrorImportacion } from './errores-importacion';
import {
  descargarArchivo,
  extraerFilenameDeContentDisposition,
} from '../archivos/descarga-archivos';
import {
  ImportModulo,
  ImportExito,
  ImportResultado,
  MaterialPlantillaFormato,
  DescargarPlantillaResultado,
} from './contratos-importacion';
import { IMPORT_MODULOS_META } from './metadatos-importacion';

@Injectable({ providedIn: 'root' })
export class RegistroImportacion {
  private readonly api = inject(ApiHttp);

  importar(modulo: ImportModulo, archivo: File, usuario: string): Observable<ImportResultado> {
    const form = new FormData();
    form.append('archivo', archivo);
    if (IMPORT_MODULOS_META[modulo].enviarUsuario !== false) form.append('usuario', usuario);

    const ruta = IMPORT_MODULOS_META[modulo]?.urlImportar ?? `/api/import/${modulo}`;
    return this.api.http.post<ImportExito>(`${this.api.baseUrl}${ruta}`, form).pipe(
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
      catchError((error: unknown) => of(normalizarErrorImportacion(error, modulo))),
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
    const params =
      IMPORT_MODULOS_META[modulo].plantillaConFormato === false
        ? new HttpParams()
        : new HttpParams().set('formato', formato);

    return this.api.http
      .get(`${this.api.baseUrl}${ruta}`, {
        params,
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        switchMap((resp) => this.procesarPlantillaOk(resp, modulo, formato)),
        catchError((error: unknown) => this.procesarPlantillaError(error)),
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
      const message = mensajeImportacion(body, 'No se pudo descargar la plantilla.');
      return { ok: false, message };
    } catch {
      return { ok: false, message: 'No se pudo procesar la respuesta de la plantilla.' };
    }
  }

  private procesarPlantillaError(err: unknown): Observable<DescargarPlantillaResultado> {
    const fallback = 'No se pudo descargar la plantilla.';
    if (!(err instanceof HttpErrorResponse) || err.status === 0 || err.status >= 500)
      return of({ ok: false, message: fallback });
    if (err.error instanceof Blob) return from(this.parsearErrorJson(err.error));
    return of({ ok: false, message: mensajeImportacion(err.error, fallback) });
  }
}
