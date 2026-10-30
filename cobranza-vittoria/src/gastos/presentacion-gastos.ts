import {
  CategoriaGasto,
  GastoDirectoListado,
  MonedaColumnaGasto,
} from './contratos-gastos-directos';

export function resolverCategoriasPorCodigo(
  catalogo: CategoriaGasto[],
  codigos: string[],
): {
  categorias: CategoriaGasto[];
  faltantes: string[];
} {
  const porCodigo = new Map(
    catalogo.map((categoria) => [categoria.codigo.trim().toUpperCase(), categoria]),
  );
  const normalizados = codigos.map((codigo) => codigo.trim().toUpperCase());
  return {
    categorias: normalizados
      .map((codigo) => porCodigo.get(codigo))
      .filter((item): item is CategoriaGasto => !!item),
    faltantes: normalizados.filter((codigo) => !porCodigo.has(codigo)),
  };
}

export function normalizarBusquedaGasto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function montoEnGasto(
  row: GastoDirectoListado,
  moneda: MonedaColumnaGasto,
): { valor: number; referencia: boolean } | null {
  if (row.moneda === moneda) return { valor: row.monto, referencia: false };
  if (row.monedaOriginal === moneda && row.montoOriginal !== null)
    return { valor: row.montoOriginal, referencia: true };
  return null;
}

export function esGastoHistorico(row: GastoDirectoListado): boolean {
  return row.codigoPresupuesto.toUpperCase().startsWith('HIST-');
}
