import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../app/core/services/api.service';
import { ListarPermisoResponse, Permiso, UpdatePermisoRequest } from './contratos-permisos';

@Injectable({ providedIn: 'root' })
export class RegistroPermisos {
  private readonly api = inject(ApiService);
  private readonly base = `${this.api.baseUrl}/api/seguridad/permisos`;

  permisos(activo?: boolean | null): Observable<ListarPermisoResponse> {
    const params = activo == null ? new HttpParams() : new HttpParams().set('activo', activo);
    return this.api.http.get<ListarPermisoResponse>(this.base, { params });
  }
  permisoPorId(id: number): Observable<Permiso> {
    return this.api.http.get<Permiso>(`${this.base}/${id}`);
  }
  actualizarPermiso(id: number, dto: UpdatePermisoRequest): Observable<void> {
    return this.api.http.put<void>(`${this.base}/${id}`, dto);
  }
  habilitarPermiso(id: number): Observable<void> {
    return this.api.http.patch<void>(`${this.base}/${id}/enable`, null);
  }
  deshabilitarPermiso(id: number): Observable<void> {
    return this.api.http.patch<void>(`${this.base}/${id}/disable`, null);
  }
}
