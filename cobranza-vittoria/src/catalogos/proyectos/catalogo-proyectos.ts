import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../app/core/services/api.service';
import { Proyecto, ProyectoUpsert } from './contratos-proyectos';

@Injectable({ providedIn: 'root' })
export class CatalogoProyectos {
  private readonly api: ApiService = inject(ApiService);

  proyectos(activo?: boolean | null): Observable<Proyecto[]> {
    let params = new HttpParams();
    if (activo !== undefined && activo !== null) params = params.set('activo', activo);
    return this.api.http.get<Proyecto[]>(`${this.api.baseUrl}/api/maestra/proyectos`, { params });
  }

  guardarProyecto(dto: ProyectoUpsert): Observable<{ idProyecto: number }> {
    const payload: ProyectoUpsert = dto;
    return payload.idProyecto
      ? this.api.http.put<{ idProyecto: number }>(
          `${this.api.baseUrl}/api/maestra/proyectos/${payload.idProyecto}`,
          payload,
        )
      : this.api.http.post<{ idProyecto: number }>(
          `${this.api.baseUrl}/api/maestra/proyectos`,
          payload,
        );
  }
}
