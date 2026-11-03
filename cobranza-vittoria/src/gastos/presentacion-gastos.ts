import { GastoDirectoListado, MonedaColumnaGasto } from './contratos-gastos-directos';

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
