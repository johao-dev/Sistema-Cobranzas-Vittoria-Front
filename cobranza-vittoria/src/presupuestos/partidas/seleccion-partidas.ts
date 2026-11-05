import { PartidaCatalogo } from './contratos-partidas';

export interface OpcionPartida {
  partida: PartidaCatalogo;
  profundidad: number;
  rama: readonly number[];
  ancestros: readonly number[];
}

/** La jerarquía depende de los IDs, incluso si los códigos o niveles históricos difieren. */
export function opcionesPartidas(partidas: readonly PartidaCatalogo[]): OpcionPartida[] {
  const porId = new Map(partidas.map((p) => [p.idCatalogoPartida, p]));
  const hijos = new Map<number | null, PartidaCatalogo[]>();
  for (const partida of partidas) {
    const padre = porId.has(partida.idPartidaPadre ?? -1) ? partida.idPartidaPadre : null;
    const hermanos = hijos.get(padre) ?? [];
    hermanos.push(partida);
    hijos.set(padre, hermanos);
  }
  for (const hermanos of hijos.values()) {
    hermanos.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  }

  const opciones: OpcionPartida[] = [];
  const visitados = new Set<number>();
  const visitar = (partida: PartidaCatalogo, ancestros: readonly number[]): number[] => {
    const id = partida.idCatalogoPartida;
    if (visitados.has(id)) return [];
    visitados.add(id);
    const rama = [id];
    opciones.push({ partida, profundidad: ancestros.length, rama, ancestros });
    for (const hijo of hijos.get(id) ?? []) {
      rama.push(...visitar(hijo, [...ancestros, id]));
    }
    return rama;
  };
  for (const raiz of hijos.get(null) ?? []) visitar(raiz, []);
  // Evita ocultar registros ante relaciones cíclicas o incompletas del catálogo.
  for (const partida of partidas)
    if (!visitados.has(partida.idCatalogoPartida)) visitar(partida, []);
  return opciones;
}

export function cambiarInclusionPartida(
  opciones: readonly OpcionPartida[],
  excluidas: readonly number[],
  id: number,
  incluir: boolean,
): number[] {
  const opcion = opciones.find((o) => o.partida.idCatalogoPartida === id);
  if (!opcion) return [...excluidas];
  const resultado = new Set(excluidas);
  for (const descendiente of opcion.rama) {
    if (incluir) resultado.delete(descendiente);
    else resultado.add(descendiente);
  }
  for (const ancestro of [...opcion.ancestros].reverse()) {
    // Un padre excluido haría que el backend volviera a excluir el hijo reincorporado.
    if (incluir) {
      resultado.delete(ancestro);
      continue;
    }
    const padre = opciones.find((o) => o.partida.idCatalogoPartida === ancestro);
    if (padre?.rama.slice(1).every((descendiente) => resultado.has(descendiente))) {
      resultado.add(ancestro);
    }
  }
  return [...resultado].sort((a, b) => a - b);
}
