
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class KardexService {
  constructor(private api: ApiService) {}

  movimientos(filters?: any) {
    const params = new URLSearchParams();

    if (filters?.idCompra !== undefined && filters?.idCompra !== null) {
      params.append('idCompra', String(filters.idCompra));
    }

    if (filters?.idMaterial !== undefined && filters?.idMaterial !== null) {
      params.append('idMaterial', String(filters.idMaterial));
    }

    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null) {
      params.append('idEspecialidad', String(filters.idEspecialidad));
    }

    if (filters?.fechaDesde) {
      params.append('fechaDesde', String(filters.fechaDesde));
    }

    if (filters?.fechaHasta) {
      params.append('fechaHasta', String(filters.fechaHasta));
    }

    const qs = params.toString();

    return this.api.http.get<any[]>(
      `${this.api.baseUrl}/api/almacen/kardex/movimientos${qs ? '?' + qs : ''}`
    );
  }

  registrarSalida(dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/almacen/kardex/salidas`, dto);
  }

  entradas(filters?: { idEspecialidad?: number | null; idProveedor?: number | null; fechaDesde?: string | null; fechaHasta?: string | null }) {
    const params = new URLSearchParams();

    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null) {
      params.append('idEspecialidad', String(filters.idEspecialidad));
    }
    if (filters?.idProveedor !== undefined && filters?.idProveedor !== null) {
      params.append('idProveedor', String(filters.idProveedor));
    }
    if (filters?.fechaDesde) {
      params.append('fechaDesde', String(filters.fechaDesde));
    }
    if (filters?.fechaHasta) {
      params.append('fechaHasta', String(filters.fechaHasta));
    }

    const qs = params.toString();
    return this.api.http.get<any[]>(
      `${this.api.baseUrl}/api/almacen/kardex/entradas${qs ? '?' + qs : ''}`
    );
  }

  guardarEntrada(dto: any) {
    return dto.idKardexEntrada
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/almacen/kardex/entradas/${dto.idKardexEntrada}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/almacen/kardex/entradas`, dto);
  }
}
