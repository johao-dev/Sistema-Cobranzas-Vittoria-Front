import { FiltroPartidas, BorradorPartida } from './borrador-partida';
import { parametrosConsulta, textoOpcional } from '../parametros-presupuestarios';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PartidaCatalogo } from './contratos-partidas';
import { ApiService } from '../../app/core/services/api.service';

@Injectable({ providedIn: 'root' })
export class CatalogoPartidas {
  private readonly api = inject(ApiService);
  private readonly base = `${this.api.baseUrl}/api/control-presupuestario`;

  partidas(filtros: FiltroPartidas = {}): Observable<PartidaCatalogo[]> {
    return this.api.http.get<PartidaCatalogo[]>(`${this.base}/partidas`, {
      params: parametrosConsulta({ ...filtros }),
    });
  }

  partida(id: number): Observable<PartidaCatalogo> {
    return this.api.http.get<PartidaCatalogo>(`${this.base}/partidas/${id}`);
  }

  guardarPartida(dto: BorradorPartida): Observable<PartidaCatalogo> {
    const padre =
      dto.idPartidaPadre != null && dto.idPartidaPadre !== '' ? Number(dto.idPartidaPadre) : null;
    return dto.idCatalogoPartida
      ? this.api.http.put<PartidaCatalogo>(`${this.base}/partidas/${dto.idCatalogoPartida}`, {
          nombre: (dto.nombre ?? '').toString().trim(),
          idTipoPartida: Number(dto.idTipoPartida),
          activo: !!dto.activo,
          idPartidaPadre: padre,
          descripcion: textoOpcional(dto.descripcion),
        })
      : this.api.http.post<PartidaCatalogo>(`${this.base}/partidas`, {
          codigo: (dto.codigo ?? '').toString().trim(),
          nombre: (dto.nombre ?? '').toString().trim(),
          idTipoPartida: Number(dto.idTipoPartida),
          idPartidaPadre: padre,
          descripcion: textoOpcional(dto.descripcion),
        });
  }
}
