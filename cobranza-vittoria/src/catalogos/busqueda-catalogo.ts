function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filtrarCatalogo<T extends object>(filas: readonly T[], busqueda: string): T[] {
  const termino: string = normalizar(busqueda);
  return filas.filter(
    (fila) => !termino || normalizar(Object.values(fila).join(' ')).includes(termino),
  );
}
