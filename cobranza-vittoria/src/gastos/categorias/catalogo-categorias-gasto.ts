import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../app/core/services/api.service';
import { CategoriaGastoReferencia, CategoriaGastoUpsert } from './contratos-categorias-gasto';

@Injectable({ providedIn: 'root' })
export class CatalogoCategoriasGasto {
  private readonly api = inject(ApiService);
  private readonly base = `${this.api.baseUrl}/api/maestra/categorias-gasto`;

  listar(activo?: boolean | null): Observable<CategoriaGastoReferencia[]> {
    let params = new HttpParams();
    if (activo != null) params = params.set('activo', activo);
    return this.api.http.get<CategoriaGastoReferencia[]>(this.base, { params });
  }

  guardar(dto: CategoriaGastoUpsert): Observable<{ idCategoriaGasto: number }> {
    return dto.idCategoriaGasto
      ? this.api.http.put<{ idCategoriaGasto: number }>(`${this.base}/${dto.idCategoriaGasto}`, dto)
      : this.api.http.post<{ idCategoriaGasto: number }>(this.base, dto);
  }

  desactivar(id: number): Observable<{ ok: boolean }> {
    return this.api.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }
}
