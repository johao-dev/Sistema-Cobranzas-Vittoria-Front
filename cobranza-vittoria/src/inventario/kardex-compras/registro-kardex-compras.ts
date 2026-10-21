import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiService } from '../../app/core/services/api.service';
import {
  FiltrosMovimientosCompra,
  MovimientoCompra,
  SalidaCompraRequest,
  SalidaCompraRegistrada,
} from './contratos-kardex-compras';

/** Historial de Compras todavía publicado; no es sustituible por el kardex manual. */
@Injectable({ providedIn: 'root' })
export class RegistroKardexCompras {
  private readonly api = inject(ApiService);

  movimientos(filtros: FiltrosMovimientosCompra = {}): Observable<MovimientoCompra[]> {
    let params = new HttpParams();

    for (const [nombre, valor] of Object.entries(filtros)) {
      if (valor !== null && valor !== undefined && valor !== '') params = params.set(nombre, valor);
    }

    return this.api.http.get<MovimientoCompra[]>(
      `${this.api.baseUrl}/api/almacen/kardex/movimientos`,
      { params },
    );
  }

  registrarSalida(dto: SalidaCompraRequest): Observable<SalidaCompraRegistrada> {
    return this.api.http.post<SalidaCompraRegistrada>(
      `${this.api.baseUrl}/api/almacen/kardex/salidas-manuales`,
      dto,
    );
  }
}
