import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../app/core/services/api.service';
import {
  Proveedor,
  ProveedorUpsert,
  ConsultaRuc,
  DetalleProveedor,
  ProveedorEspecialidadRequest,
} from './contratos-proveedores';

@Injectable({ providedIn: 'root' })
export class CatalogoProveedores {
  private readonly api: ApiService = inject(ApiService);

  proveedores(activo?: boolean | null, idEspecialidad?: number | null): Observable<Proveedor[]> {
    let params = new HttpParams();
    if (activo !== undefined && activo !== null) params = params.set('activo', activo);
    if (idEspecialidad !== undefined && idEspecialidad !== null)
      params = params.set('idEspecialidad', idEspecialidad);
    return this.api.http.get<Proveedor[]>(`${this.api.baseUrl}/api/maestra/proveedores`, {
      params,
    });
  }

  guardarProveedor(dto: ProveedorUpsert): Observable<{ idProveedor: number }> {
    const payload: ProveedorUpsert = dto;
    return payload.idProveedor
      ? this.api.http.put<{ idProveedor: number }>(
          `${this.api.baseUrl}/api/maestra/proveedores/${payload.idProveedor}`,
          payload,
        )
      : this.api.http.post<{ idProveedor: number }>(
          `${this.api.baseUrl}/api/maestra/proveedores`,
          payload,
        );
  }

  proveedor(id: number): Observable<DetalleProveedor> {
    return this.api.http.get<DetalleProveedor>(`${this.api.baseUrl}/api/maestra/proveedores/${id}`);
  }

  consultaRuc(ruc: string): Observable<ConsultaRuc> {
    return this.api.http.get<ConsultaRuc>(
      `${this.api.baseUrl}/api/maestra/proveedores/consulta-ruc/${encodeURIComponent(ruc)}`,
    );
  }

  setProveedorEspecialidad(
    idProveedor: number,
    dto: ProveedorEspecialidadRequest,
  ): Observable<{ ok: boolean }> {
    return this.api.http.post<{ ok: boolean }>(
      `${this.api.baseUrl}/api/maestra/proveedores/${idProveedor}/especialidades`,
      dto,
    );
  }
}
