export function normalizarBusquedaAccesos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filtrarRegistrosAccesos<T extends object>(
  filas: readonly T[],
  busqueda: string,
): T[] {
  const termino = normalizarBusquedaAccesos(busqueda);
  return filas.filter((fila) =>
    normalizarBusquedaAccesos(Object.values(fila).join(' ')).includes(termino),
  );
}
