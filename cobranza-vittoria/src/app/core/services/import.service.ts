import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
  ImportModulo,
  ImportExito,
  ImportResultado,
  ImportErrorResponse
} from '../../models/import.models';

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
        errores: Array.isArray(body.errores) ? body.errores : undefined
      }
    };
  }
}
