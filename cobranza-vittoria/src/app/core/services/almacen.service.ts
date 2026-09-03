import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AlmacenService {
  constructor(private api: ApiService) { }

  kardex(filters?: any) {
    const params = new URLSearchParams();

    if (filters?.idMaterial !== undefined && filters?.idMaterial !== null)
      params.append('idMaterial', String(filters.idMaterial));

    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null)
      params.append('idEspecialidad', String(filters.idEspecialidad));

    if (filters?.fechaDesde)
      params.append('fechaDesde', filters.fechaDesde);

    if (filters?.fechaHasta)
      params.append('fechaHasta', filters.fechaHasta);

    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/almacen/kardex${qs ? '?' + qs : ''}`);
  }
  resumen(filters?: any) {
    const params = new URLSearchParams();

    if (filters?.idMaterial !== undefined && filters?.idMaterial !== null)
      params.append('idMaterial', String(filters.idMaterial));

    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null)
      params.append('idEspecialidad', String(filters.idEspecialidad));

    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/almacen/kardex/resumen${qs ? '?' + qs : ''}`);
  }
}
