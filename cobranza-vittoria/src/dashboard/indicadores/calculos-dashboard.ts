import { CompraDetalleResponse, CompraFilaSql } from '../../app/models/compras.models';
import { ValorizacionListado } from '../../app/models/valorizaciones.models';
import {
  EstadisticaMaterial,
  FilaGrafico,
  MetricaMaterial,
  TarjetaResumen,
} from '../contratos-dashboard';

function redondear(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calcularTarjetas(
  compras: readonly CompraFilaSql[],
  valorizaciones: readonly ValorizacionListado[],
): TarjetaResumen[] {
  return [
    {
      key: 'compras',
      label: 'Compras registradas',
      value: compras.reduce((total, compra) => total + compra.MontoTotal, 0),
    },
    {
      key: 'facturado',
      label: 'Valorizado facturado',
      value: valorizaciones.reduce((total, fila) => total + fila.facturado, 0),
    },
    {
      key: 'transferido',
      label: 'Valorizado transferido',
      value: valorizaciones.reduce((total, fila) => total + fila.transferido, 0),
    },
    {
      key: 'garantia',
      label: 'Garantías retenidas',
      value: valorizaciones.reduce((total, fila) => total + fila.garantia, 0),
    },
    {
      key: 'detraccion',
      label: 'Detracciones',
      value: valorizaciones.reduce((total, fila) => total + fila.detraccion, 0),
    },
  ];
}

export function agruparMateriales(
  detalles: readonly CompraDetalleResponse[],
): EstadisticaMaterial[] {
  const materiales = new Map<string, EstadisticaMaterial>();

  for (const compra of detalles) {
    for (const item of compra.items) {
      const nombre: string = item.Material.trim() || '-';
      const actual: EstadisticaMaterial = materiales.get(nombre) ?? {
        material: nombre,
        cantidad: 0,
        monto: 0,
        frecuencia: 0,
      };
      // Se conserva el cálculo histórico incluso cuando el subtotal es cero.
      const monto: number = item.Subtotal || redondear(item.Cantidad * item.PrecioUnitario);
      actual.cantidad = redondear(actual.cantidad + item.Cantidad);
      actual.monto = redondear(actual.monto + monto);
      // La frecuencia cuenta líneas de detalle, incluidos materiales repetidos en una compra.
      actual.frecuencia += 1;
      materiales.set(nombre, actual);
    }
  }

  return Array.from(materiales.values());
}

export function construirFilas(
  materiales: readonly EstadisticaMaterial[],
  metrica: MetricaMaterial,
): FilaGrafico[] {
  const ordenados: EstadisticaMaterial[] = [...materiales].sort((a, b) => b[metrica] - a[metrica]);
  const maximo: number = ordenados.reduce(
    (maximo, material) => Math.max(maximo, material[metrica]),
    0,
  );
  return ordenados.map(
    (material: EstadisticaMaterial): FilaGrafico => ({
      label: material.material,
      value: material[metrica],
      width: maximo > 0 ? Math.max(6, Math.round((material[metrica] / maximo) * 100)) : 0,
    }),
  );
}

export function formatearImporte(value: number): string {
  // Se mantiene la presentación histórica; no representa una conversión de moneda.
  return `PEN ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
