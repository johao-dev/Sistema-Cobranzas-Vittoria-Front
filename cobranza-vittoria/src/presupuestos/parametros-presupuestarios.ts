import { HttpParams } from '@angular/common/http';

export function parametrosConsulta(
  filtros: Record<string, string | number | boolean | null | undefined>,
): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') params = params.set(clave, valor);
  }
  return params;
}

export function textoOpcional(valor: string | null | undefined): string | null {
  return valor?.trim() || null;
}
