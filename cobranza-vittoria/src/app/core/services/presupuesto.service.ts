import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PresupuestoService {
  constructor(private api: ApiService) {}

  getByProyecto(idProyecto: number) {
    return this.api.http.get<any>(`${this.api.baseUrl}/api/contable/presupuesto/${idProyecto}`);
  }

  guardar(dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/contable/presupuesto`, dto);
  }
}
