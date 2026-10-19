import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../app/core/services/api.service';
import { UnidadMedida, UnidadMedidaUpsert } from './contratos-unidades-medida';

@Injectable({ providedIn: 'root' })
export class CatalogoUnidadesMedida {
  private readonly api: ApiService = inject(ApiService);

  unidadesMedida(activo?: boolean | null): Observable<UnidadMedida[]> {
    let params = new HttpParams();
    if (activo !== undefined && activo !== null) params = params.set('activo', activo);
    return this.api.http.get<UnidadMedida[]>(`${this.api.baseUrl}/api/maestra/unidades-medida`, {
      params,
    });
  }

  guardarUnidadMedida(dto: UnidadMedidaUpsert): Observable<{ idUnidadMedida: number }> {
    const payload: UnidadMedidaUpsert = dto;
    return payload.idUnidadMedida
      ? this.api.http.put<{ idUnidadMedida: number }>(
          `${this.api.baseUrl}/api/maestra/unidades-medida/${payload.idUnidadMedida}`,
          payload,
        )
      : this.api.http.post<{ idUnidadMedida: number }>(
          `${this.api.baseUrl}/api/maestra/unidades-medida`,
          payload,
        );
  }
}
