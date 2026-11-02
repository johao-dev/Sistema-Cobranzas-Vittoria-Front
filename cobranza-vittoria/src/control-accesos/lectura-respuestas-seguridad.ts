/** La compatibilidad de envolturas históricas se limita al borde HTTP de Seguridad. */
export function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function leerListaSeguridad(respuesta: unknown, propiedades: readonly string[]): unknown[] {
  if (Array.isArray(respuesta)) return respuesta;
  if (!esRegistro(respuesta)) throw new Error('Respuesta de Seguridad inválida.');
  const data = respuesta['data'];
  if (Array.isArray(data)) return data;
  const contenedores = [respuesta, data].filter(esRegistro);
  for (const contenedor of contenedores) {
    for (const propiedad of [...propiedades, 'items', 'Items', '$values']) {
      const lista = contenedor[propiedad];
      if (Array.isArray(lista)) return lista;
    }
  }
  throw new Error('No se encontró el listado en la respuesta de Seguridad.');
}

export function leerTexto(registro: Record<string, unknown>, ...claves: string[]): string {
  for (const clave of claves) {
    const valor = registro[clave];
    if (typeof valor === 'string') return valor;
  }
  return '';
}

export function leerIdentificador(registro: Record<string, unknown>, ...claves: string[]): number {
  for (const clave of claves) {
    const valor = registro[clave];
    const numero = typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : NaN;
    if (Number.isInteger(numero) && numero > 0) return numero;
  }
  throw new Error('La respuesta de Seguridad no identifica el registro.');
}

export function leerActivo(registro: Record<string, unknown>): boolean {
  const valor = registro['activo'] ?? registro['Activo'];
  if (valor === undefined || valor === null) return true;
  if (typeof valor !== 'boolean') throw new Error('Estado de Seguridad inválido.');
  return valor;
}
