import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiService } from '../../app/core/services/api.service';
import {
  CrearTransferenciaProyectoDto,
  FiltrosTransferenciasProyecto,
  TransferenciaProyecto,
} from './contratos-transferencias-proyecto';

@Injectable({ providedIn: 'root' })
export class RegistroTransferenciasProyecto {
  private readonly api = inject(ApiService);
  private readonly ruta = `${this.api.baseUrl}/api/almacen/transferencias-proyecto`;

  listar(filtros: FiltrosTransferenciasProyecto = {}): Observable<TransferenciaProyecto[]> {
    let params = new HttpParams();

    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, valor);
    }

    return this.api.http.get<TransferenciaProyecto[]>(this.ruta, { params });
  }

  obtener(id: number): Observable<TransferenciaProyecto[]> {
    return this.api.http.get<TransferenciaProyecto[]>(`${this.ruta}/${id}`);
  }

  crear(dto: CrearTransferenciaProyectoDto): Observable<TransferenciaProyecto[]> {
    return this.api.http.post<TransferenciaProyecto[]>(this.ruta, dto);
  }
}
