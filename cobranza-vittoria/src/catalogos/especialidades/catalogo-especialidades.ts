import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../app/core/services/api.service';
import { Especialidad, EspecialidadUpsert } from './contratos-especialidades';

@Injectable({ providedIn: 'root' })
export class CatalogoEspecialidades {
  private readonly api: ApiService = inject(ApiService);

  especialidades(activo?: boolean | null): Observable<Especialidad[]> {
    let params = new HttpParams();
    if (activo !== undefined && activo !== null) params = params.set('activo', activo);
    return this.api.http.get<Especialidad[]>(`${this.api.baseUrl}/api/maestra/especialidades`, {
      params,
    });
  }

  guardarEspecialidad(dto: EspecialidadUpsert): Observable<{ idEspecialidad: number }> {
    const payload: EspecialidadUpsert = dto;
    return payload.idEspecialidad
      ? this.api.http.put<{ idEspecialidad: number }>(
          `${this.api.baseUrl}/api/maestra/especialidades/${payload.idEspecialidad}`,
          payload,
        )
      : this.api.http.post<{ idEspecialidad: number }>(
          `${this.api.baseUrl}/api/maestra/especialidades`,
          payload,
        );
  }
}
