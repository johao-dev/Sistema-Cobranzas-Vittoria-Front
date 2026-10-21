import { Material } from '../../catalogos/materiales/contratos-materiales';

export function normalizarBusquedaInventario(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function coincideBusquedaInventario(
  termino: string,
  campos: readonly (string | number | null)[],
): boolean {
  return normalizarBusquedaInventario(campos.map((valor) => valor ?? '').join(' ')).includes(
    normalizarBusquedaInventario(termino),
  );
}

export function fechaInventario(valor: string | null): string {
  if (!valor) return '-';

  const fecha = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);

  return fecha ? `${fecha[3]}/${fecha[2]}/${fecha[1]}` : valor;
}

export function cantidadInventario(valor: number): string {
  return valor.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function codigoMaterialInventario(
  id: number,
  codigo: string | null,
  materiales: readonly Material[],
): string {
  return codigo || materiales.find((m) => m.idMaterial === id)?.codigo || '-';
}

export function nombreMaterialInventario(
  id: number,
  nombre: string | null,
  materiales: readonly Material[],
): string {
  return nombre || materiales.find((m) => m.idMaterial === id)?.descripcion || '-';
}

// Se conserva la fecha inicial UTC utilizada por las pantallas existentes; DateOnly se envía sin convertir.
export function hoyInventario(): string {
  return new Date().toISOString().slice(0, 10);
}
