/** Exporta las columnas de la primera fila en el mismo orden para todos los DTOs del reporte. */
export function crearCsvPresupuestario(filas: readonly object[]): string {
  if (!filas.length) return '';
  const columnas = Object.keys(filas[0]);
  const escapar = (valor: unknown): string => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return `"${texto.replace(/"/g, '""')}"`;
  };
  return [
    columnas.join(';'),
    ...filas.map((fila) => {
      // La reflexión de las columnas es un límite dinámico, independiente de cada DTO HTTP.
      const valores: ReadonlyMap<string, unknown> = new Map(Object.entries(fila));
      return columnas.map((columna) => escapar(valores.get(columna))).join(';');
    }),
  ].join('\r\n');
}
