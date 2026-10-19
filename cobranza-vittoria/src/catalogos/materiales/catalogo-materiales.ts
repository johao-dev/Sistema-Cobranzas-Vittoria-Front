import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../app/core/services/api.service';
import { Material, MaterialUpsert } from './contratos-materiales';

@Injectable({ providedIn: 'root' })
export class CatalogoMateriales {
  private readonly api: ApiService = inject(ApiService);

  materiales(activo?: boolean | null, idEspecialidad?: number | null): Observable<Material[]> {
    let params = new HttpParams();
    if (activo !== undefined && activo !== null) params = params.set('activo', activo);
    if (idEspecialidad !== undefined && idEspecialidad !== null)
      params = params.set('idEspecialidad', idEspecialidad);
    return this.api.http.get<Material[]>(`${this.api.baseUrl}/api/maestra/materiales`, { params });
  }

  guardarMaterial(dto: MaterialUpsert): Observable<{ idMaterial: number }> {
    const payload: MaterialUpsert = {
      ...dto,
      idMaterial: dto.idMaterial ? Number(dto.idMaterial) : null,
      idEspecialidad: Number(dto.idEspecialidad),
      codigo: (dto.codigo ?? '').trim(),
      codigoProveedor: (dto.codigoProveedor ?? '').trim(),
      descripcion: dto.descripcion.trim(),
      unidadMedida: dto.unidadMedida.trim(),
      stockMinimo: Number(dto.stockMinimo ?? 0),
      activo: !!dto.activo,
      // PUT reemplaza el material completo: conservar siempre su partida actual.
      idCatalogoPartida: dto.idCatalogoPartida != null ? Number(dto.idCatalogoPartida) : null,
    };
    return payload.idMaterial
      ? this.api.http.put<{ idMaterial: number }>(
          `${this.api.baseUrl}/api/maestra/materiales/${payload.idMaterial}`,
          payload,
        )
      : this.api.http.post<{ idMaterial: number }>(
          `${this.api.baseUrl}/api/maestra/materiales`,
          payload,
        );
  }

  material(id: number): Observable<Material> {
    return this.api.http.get<Material>(`${this.api.baseUrl}/api/maestra/materiales/${id}`);
  }

  siguienteCodigo(): Observable<{ codigo: string }> {
    return this.api.http.get<{ codigo: string }>(
      `${this.api.baseUrl}/api/maestra/materiales/siguiente-codigo`,
    );
  }
}
