import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { CategoriaGasto, Proveedor, Material } from '../../models/catalogos.models';

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly api = inject(ApiService);

  categorias() {
    return this.api.http.get<CategoriaGasto[]>(`${this.api.baseUrl}/api/catalogos/categorias`);
  }

  proveedores() {
    return this.api.http.get<Proveedor[]>(`${this.api.baseUrl}/api/catalogos/proveedores`);
  }

  materiales(idCategoriaGasto?: number | null) {
    const qs = idCategoriaGasto ? `?idCategoriaGasto=${idCategoriaGasto}` : '';
    return this.api.http.get<Material[]>(`${this.api.baseUrl}/api/catalogos/materiales${qs}`);
  }
}
