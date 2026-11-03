import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import {
  EstadoPresupuesto,
  MonedaPresupuestaria,
  TipoCentroCosto,
  TipoPartida,
  TipoMovimientoPresupuestal,
  CatalogosPresupuestariosDatos,
} from './contratos-catalogos-presupuestarios';
import { ApiHttp } from '../core/http/api-http';

@Injectable({ providedIn: 'root' })
export class CatalogosPresupuestarios {
  private readonly api = inject(ApiHttp);
  private readonly base = `${this.api.baseUrl}/api/control-presupuestario`;

  catalogos(): Observable<CatalogosPresupuestariosDatos> {
    const c = `${this.base}/catalogos`;
    return forkJoin({
      tiposCentroCosto: this.api.http.get<TipoCentroCosto[]>(`${c}/tipos-centro-costo`),
      tiposPartida: this.api.http.get<TipoPartida[]>(`${c}/tipos-partida`),
      estadosPresupuesto: this.api.http.get<EstadoPresupuesto[]>(`${c}/estados-presupuesto`),
      tiposMovimiento: this.api.http.get<TipoMovimientoPresupuestal[]>(`${c}/tipos-movimiento`),
      monedas: this.api.http.get<MonedaPresupuestaria[]>(`${c}/monedas`),
    });
  }

  monedas(): Observable<MonedaPresupuestaria[]> {
    return this.api.http.get<MonedaPresupuestaria[]>(`${this.base}/catalogos/monedas`);
  }
}
