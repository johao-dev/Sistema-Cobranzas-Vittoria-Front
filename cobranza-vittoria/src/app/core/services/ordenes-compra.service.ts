import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { OrdenCompraGenerar, OrdenCompraGenerarResponse, OrdenCompraGetResponse } from '../../models/ordenes-compra.models';

@Injectable({ providedIn: 'root' })
export class OrdenesCompraService {
  constructor(private api: ApiService) { }

  generar(dto: OrdenCompraGenerar) {
    return this.api.http.post<OrdenCompraGenerarResponse>(`${this.api.baseUrl}/api/ordenes-compra/generar`, dto);
  }

  obtener(idOrdenCompra: number) {
    return this.api.http.get<OrdenCompraGetResponse>(`${this.api.baseUrl}/api/ordenes-compra/${idOrdenCompra}`);
  }
}
