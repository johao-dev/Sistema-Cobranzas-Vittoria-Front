import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../app/core/services/api.service';
import {
  CambioEstadoOrdenRequest,
  DetalleOrdenCompra,
  FiltrosOrdenCompra,
  OrdenCompra,
  OrdenCompraRequest,
} from './contratos-ordenes-compra';

@Injectable({ providedIn: 'root' })
export class RegistroOrdenesCompra {
  private readonly api = inject(ApiService);
  private readonly endpoint = `${this.api.baseUrl}/api/compras/ordenes-compra`;

  listar(filtros: FiltrosOrdenCompra = {}): Observable<OrdenCompra[]> {
    let params = new HttpParams();

    if (filtros.estado) params = params.set('estado', filtros.estado);

    if (filtros.idProveedor != null) params = params.set('idProveedor', filtros.idProveedor);

    if (filtros.idProyecto != null) params = params.set('idProyecto', filtros.idProyecto);

    return this.api.http.get<OrdenCompra[]>(this.endpoint, { params });
  }

  obtener(id: number): Observable<DetalleOrdenCompra> {
    return this.api.http.get<DetalleOrdenCompra>(`${this.endpoint}/${id}`);
  }

  crear(dto: OrdenCompraRequest): Observable<{ idOrdenCompra: number; total: number }> {
    return this.api.http.post<{ idOrdenCompra: number; total: number }>(this.endpoint, dto);
  }

  actualizar(id: number, dto: OrdenCompraRequest): Observable<{ ok: boolean }> {
    return this.api.http.put<{ ok: boolean }>(`${this.endpoint}/${id}`, dto);
  }

  cambiarEstado(id: number, dto: CambioEstadoOrdenRequest): Observable<{ ok: boolean }> {
    return this.api.http.patch<{ ok: boolean }>(`${this.endpoint}/${id}/estado`, dto);
  }
}
