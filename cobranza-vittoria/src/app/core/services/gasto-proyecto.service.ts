import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

export type TipoGastoProyecto = 'terreno' | 'marketing-publicidad' | 'otros-gastos' | 'gastos-municipales-distritales';

@Injectable({ providedIn: 'root' })
export class GastoProyectoService {
  constructor(private api: ApiService) {}

  listar(tipoModulo: TipoGastoProyecto, filters?: any) {
    const params = new URLSearchParams();
    const idProyecto = filters?.idProyecto ?? filters?.IdProyecto;
    const concepto = filters?.concepto ?? filters?.Concepto;
    const estado = filters?.estado ?? filters?.Estado;
    const activo = filters?.activo ?? filters?.Activo;
    if (idProyecto !== undefined && idProyecto !== null && idProyecto !== '') params.set('idProyecto', String(idProyecto));
    if (concepto !== undefined && concepto !== null && concepto !== '') params.set('concepto', String(concepto));
    if (estado !== undefined && estado !== null && estado !== '') params.set('estado', String(estado));
    if (activo !== undefined && activo !== null && activo !== '') params.set('activo', String(activo));
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/contable/gastos-proyecto/${tipoModulo}${qs ? '?' + qs : ''}`);
  }

  obtener(tipoModulo: TipoGastoProyecto, id: number) {
    return this.api.http.get<any>(`${this.api.baseUrl}/api/contable/gastos-proyecto/${tipoModulo}/${id}`);
  }

  guardar(tipoModulo: TipoGastoProyecto, dto: any) {
    const id = dto?.idGastoProyecto ?? dto?.IdGastoProyecto;
    return id
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/contable/gastos-proyecto/${tipoModulo}/${id}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/contable/gastos-proyecto/${tipoModulo}`, dto);
  }

  desactivar(tipoModulo: TipoGastoProyecto, id: number) {
    return this.api.http.delete<any>(`${this.api.baseUrl}/api/contable/gastos-proyecto/${tipoModulo}/${id}`);
  }

  documentos(tipoModulo: TipoGastoProyecto, id: number) {
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/contable/gastos-proyecto/${tipoModulo}/${id}/documentos`);
  }

  uploadDocumentos(tipoModulo: TipoGastoProyecto, id: number, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file, file.name));
    return this.api.http.post<any>(`${this.api.baseUrl}/api/contable/gastos-proyecto/${tipoModulo}/${id}/documentos`, formData);
  }

  documentoDownloadUrl(tipoModulo: TipoGastoProyecto, id: number, docId: number) {
    return `${this.api.baseUrl}/api/contable/gastos-proyecto/${tipoModulo}/${id}/documentos/${docId}/download`;
  }
}
