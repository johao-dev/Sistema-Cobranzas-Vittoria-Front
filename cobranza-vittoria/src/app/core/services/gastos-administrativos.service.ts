import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class GastosAdministrativosService {
  constructor(private api: ApiService) {}

  categorias(activo?: boolean | null) {
    const params = new URLSearchParams();
    if (activo !== undefined && activo !== null) params.set('activo', String(activo));
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/maestra/categorias-gasto${qs ? '?' + qs : ''}`);
  }

  guardarCategoria(dto: any) {
    const id = dto?.idCategoriaGasto ?? dto?.IdCategoriaGasto;
    return id
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/maestra/categorias-gasto/${id}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/maestra/categorias-gasto`, dto);
  }

  desactivarCategoria(idCategoriaGasto: number) {
    return this.api.http.delete<any>(`${this.api.baseUrl}/api/maestra/categorias-gasto/${idCategoriaGasto}`);
  }

  proveedores(activo?: boolean | null, idCategoriaGasto?: number | null) {
    const params = new URLSearchParams();
    if (activo !== undefined && activo !== null) params.set('activo', String(activo));
    if (idCategoriaGasto !== undefined && idCategoriaGasto !== null) params.set('idCategoriaGasto', String(idCategoriaGasto));
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/maestra/proveedores-gasto${qs ? '?' + qs : ''}`);
  }

  guardarProveedor(dto: any) {
    const id = dto?.idProveedorGastoAdministrativo ?? dto?.IdProveedorGastoAdministrativo;
    return id
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/maestra/proveedores-gasto/${id}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/maestra/proveedores-gasto`, dto);
  }

  desactivarProveedor(idProveedorGastoAdministrativo: number) {
    return this.api.http.delete<any>(`${this.api.baseUrl}/api/maestra/proveedores-gasto/${idProveedorGastoAdministrativo}`);
  }

  gastos(filters?: any) {
    const params = new URLSearchParams();
    const idCategoria = filters?.idCategoriaGasto ?? filters?.IdCategoriaGasto;
    const idProveedor = filters?.idProveedorGastoAdministrativo ?? filters?.IdProveedorGastoAdministrativo;
    const activo = filters?.activo ?? filters?.Activo;
    if (idCategoria !== undefined && idCategoria !== null && idCategoria !== '') params.set('idCategoriaGasto', String(idCategoria));
    if (idProveedor !== undefined && idProveedor !== null && idProveedor !== '') params.set('idProveedorGastoAdministrativo', String(idProveedor));
    if (activo !== undefined && activo !== null && activo !== '') params.set('activo', String(activo));
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/contable/gastos-administrativos${qs ? '?' + qs : ''}`);
  }

  gasto(id: number) {
    return this.api.http.get<any>(`${this.api.baseUrl}/api/contable/gastos-administrativos/${id}`);
  }

  guardarGasto(dto: any) {
    const id = dto?.idGastoAdministrativo ?? dto?.IdGastoAdministrativo;
    return id
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/contable/gastos-administrativos/${id}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/contable/gastos-administrativos`, dto);
  }

  desactivarGasto(idGastoAdministrativo: number) {
    return this.api.http.delete<any>(`${this.api.baseUrl}/api/contable/gastos-administrativos/${idGastoAdministrativo}`);
  }

  documentos(idGastoAdministrativo: number) {
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/contable/gastos-administrativos/${idGastoAdministrativo}/documentos`);
  }

  uploadDocumentos(idGastoAdministrativo: number, tipoDocumento: 'Factura' | 'Pago', files: File[]) {
    const formData = new FormData();
    formData.append('tipoDocumento', tipoDocumento);
    files.forEach(file => formData.append('files', file, file.name));
    return this.api.http.post<any>(`${this.api.baseUrl}/api/contable/gastos-administrativos/${idGastoAdministrativo}/documentos`, formData);
  }

  documentoDownloadUrl(idGastoAdministrativo: number, docId: number) {
    return `${this.api.baseUrl}/api/contable/gastos-administrativos/${idGastoAdministrativo}/documentos/${docId}/download`;
  }
}
