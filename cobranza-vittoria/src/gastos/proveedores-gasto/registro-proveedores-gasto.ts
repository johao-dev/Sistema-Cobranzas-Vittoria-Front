import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../app/core/services/api.service';
import { ProveedorGasto, ProveedorGastoUpsert } from './contratos-proveedores-gasto';

@Injectable({ providedIn: 'root' })
export class RegistroProveedoresGasto {
  private readonly api = inject(ApiService);
  private readonly base = `${this.api.baseUrl}/api/maestra/proveedores-gasto`;

  listar(activo?: boolean | null, idCategoriaGasto?: number | null): Observable<ProveedorGasto[]> {
    let params = new HttpParams();
    if (activo != null) params = params.set('activo', activo);
    if (idCategoriaGasto != null) params = params.set('idCategoriaGasto', idCategoriaGasto);
    return this.api.http.get<ProveedorGasto[]>(this.base, { params });
  }

  guardar(dto: ProveedorGastoUpsert): Observable<{ idProveedorGastoAdministrativo: number }> {
    return dto.idProveedorGastoAdministrativo
      ? this.api.http.put<{ idProveedorGastoAdministrativo: number }>(
          `${this.base}/${dto.idProveedorGastoAdministrativo}`,
          dto,
        )
      : this.api.http.post<{ idProveedorGastoAdministrativo: number }>(this.base, dto);
  }

  desactivar(id: number): Observable<{ ok: boolean }> {
    return this.api.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }
}
