import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { CotizacionCreate, CotizacionGetResponse } from '../../models/cotizaciones.models';

@Injectable({ providedIn: 'root' })
export class CotizacionesService {
  constructor(private api: ApiService) { }

  crear(idRequerimiento: number, dto: CotizacionCreate) {
    return this.api.http.post<{ idCotizacion: number }>(
      `${this.api.baseUrl}/api/requerimientos/${idRequerimiento}/cotizaciones`,
      dto
    );
  }

  obtener(idCotizacion: number) {
    return this.api.http.get<CotizacionGetResponse>(`${this.api.baseUrl}/api/cotizaciones/${idCotizacion}`);
  }
}
