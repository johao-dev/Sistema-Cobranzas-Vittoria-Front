import {
  CompraParaSalida,
  MovimientoCompra,
  MovimientoCompraPresentado,
} from './contratos-kardex-compras';

export function presentarMovimientosCompra(
  filas: readonly MovimientoCompra[],
): MovimientoCompraPresentado[] {
  const correlativos = new Map<string, number>();

  return filas.map((row) => {
    const compraKey = `${row.IdCompra ?? 0}|${row.IdMaterial}|${row.IdEspecialidad ?? 0}`;
    let numero = correlativos.get(compraKey);
    if (numero === undefined) {
      numero = correlativos.size + 1;
      correlativos.set(compraKey, numero);
    }

    return { ...row, compraKey, numeroCompraCorrelativo: numero };
  });
}

export function comprasParaSalida(
  filas: readonly MovimientoCompraPresentado[],
): CompraParaSalida[] {
  const compras = new Map<string, CompraParaSalida>();

  for (const fila of filas) {
    if (!fila.IdCompra || compras.has(fila.compraKey)) continue;

    compras.set(fila.compraKey, {
      compraKey: fila.compraKey,
      idCompra: fila.IdCompra,
      numeroCompra: fila.numeroCompraCorrelativo,
      numeroRequerimiento: fila.NumeroRequerimiento,
      idMaterial: fila.IdMaterial,
      material: fila.Material,
      idEspecialidad: fila.IdEspecialidad,
    });
  }

  return [...compras.values()].sort((a, b) => a.numeroCompra - b.numeroCompra);
}

export function faltanteCompra(fila: MovimientoCompra): number {
  return Math.max(fila.Entrada - fila.Salida, 0);
}

export function esNuevoGrupoCompra(filas: readonly MovimientoCompra[], indice: number): boolean {
  if (indice === 0) return true;

  return (
    filas[indice]?.IdCompra !== filas[indice - 1]?.IdCompra ||
    filas[indice]?.Especialidad !== filas[indice - 1]?.Especialidad
  );
}
