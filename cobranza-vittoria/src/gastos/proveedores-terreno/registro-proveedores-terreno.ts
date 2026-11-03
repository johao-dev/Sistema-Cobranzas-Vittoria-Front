import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiHttp } from '../../core/http/api-http';
import { ProveedorTerreno, ProveedorTerrenoUpsert } from './contratos-proveedores-terreno';

@Injectable({ providedIn: 'root' })
export class RegistroProveedoresTerreno {
  private readonly api = inject(ApiHttp);
  private readonly base = `${this.api.baseUrl}/api/maestra/proveedores-terreno`;

  listar(activo?: boolean | null): Observable<ProveedorTerreno[]> {
    let params = new HttpParams();
    if (activo != null) params = params.set('activo', activo);
    return this.api.http.get<ProveedorTerreno[]>(this.base, { params });
  }

  guardar(dto: ProveedorTerrenoUpsert): Observable<{ idProveedorTerreno: number }> {
    return dto.idProveedorTerreno
      ? this.api.http.put<{ idProveedorTerreno: number }>(
          `${this.base}/${dto.idProveedorTerreno}`,
          dto,
        )
      : this.api.http.post<{ idProveedorTerreno: number }>(this.base, dto);
  }

  desactivar(id: number): Observable<{ ok: boolean }> {
    return this.api.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }
}
