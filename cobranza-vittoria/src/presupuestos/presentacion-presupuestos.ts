/** Búsqueda local sin distinguir mayúsculas ni tildes. */
export function normalizarBusqueda(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
