import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { RequerimientoCreate, RequerimientoGetResponse } from '../../models/requerimientos.models';

@Injectable({ providedIn: 'root' })
export class RequerimientosService {
  constructor(private api: ApiService) { }

  crear(dto: RequerimientoCreate) {
    return this.api.http.post<{ idRequerimiento: number }>(`${this.api.baseUrl}/api/requerimientos`, dto);
  }

  obtener(id: number) {
    return this.api.http.get<RequerimientoGetResponse>(`${this.api.baseUrl}/api/requerimientos/${id}`);
  }
}
