import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CentroCostoResumen } from './contratos-centros-costo';
import { BorradorCentroCosto } from './borrador-centro-costo';
import { ApiHttp } from '../../core/http/api-http';
import { parametrosConsulta, textoOpcional } from '../parametros-presupuestarios';

@Injectable({ providedIn: 'root' })
export class CatalogoCentrosCosto {
  private readonly api = inject(ApiHttp);
  private readonly base = `${this.api.baseUrl}/api/control-presupuestario`;

  centrosCosto(
    activo?: boolean | null,
    idTipoCentroCosto?: number | null,
    busqueda?: string | null,
    idProyecto?: number | null,
  ): Observable<CentroCostoResumen[]> {
    const params = parametrosConsulta({ activo, idTipoCentroCosto, idProyecto, busqueda });
    return this.api.http.get<CentroCostoResumen[]>(`${this.base}/centros-costo`, { params });
  }

  centroCosto(id: number): Observable<CentroCostoResumen> {
    return this.api.http.get<CentroCostoResumen>(`${this.base}/centros-costo/${id}`);
  }

  guardarCentroCosto(dto: BorradorCentroCosto): Observable<CentroCostoResumen> {
    const idProyecto =
      dto.idProyecto != null && dto.idProyecto !== '' ? Number(dto.idProyecto) : null;
    return dto.idCentroCosto
      ? this.api.http.put<CentroCostoResumen>(`${this.base}/centros-costo/${dto.idCentroCosto}`, {
          nombre: (dto.nombre ?? '').toString().trim(),
          activo: !!dto.activo,
          descripcion: textoOpcional(dto.descripcion),
          idProyecto,
        })
      : this.api.http.post<CentroCostoResumen>(`${this.base}/centros-costo`, {
          codigo: (dto.codigo ?? '').toString().trim(),
          nombre: (dto.nombre ?? '').toString().trim(),
          idTipoCentroCosto: Number(dto.idTipoCentroCosto),
          descripcion: textoOpcional(dto.descripcion),
          idProyecto,
        });
  }
}
