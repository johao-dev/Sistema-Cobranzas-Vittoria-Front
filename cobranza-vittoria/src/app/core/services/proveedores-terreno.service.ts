import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ProveedoresTerrenoService {
  constructor(private api: ApiService) {}

  proveedores(activo?: boolean | null) {
    const qs = activo === undefined || activo === null ? '' : `?activo=${activo}`;
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/maestra/proveedores-terreno${qs}`);
  }

  guardar(dto: any) {
    const id = dto?.idProveedorTerreno ?? dto?.IdProveedorTerreno;
    return id
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/maestra/proveedores-terreno/${id}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/maestra/proveedores-terreno`, dto);
  }

  desactivar(idProveedorTerreno: number) {
    return this.api.http.delete<any>(`${this.api.baseUrl}/api/maestra/proveedores-terreno/${idProveedorTerreno}`);
  }
}
