import { DetalleOrdenCompra } from '../../ordenes-compra/contratos-ordenes-compra';
import { Material } from '../../catalogos/materiales/contratos-materiales';
import { CompraFilaSql, CompraRequest } from '../contratos-compras';

export interface PrecioItem {
  idMaterial: number;
  especialidad: string;
  material: string;
  unidadMedida: string;
  cantidad: number;
  idProveedor: number;
  proveedor: string;
  precioUnitario: number;
  incluyeIgv: boolean;
  subtotalSinIgv: number;
  montoIgv: number;
  total: number;
  observacion: string;
  files: File[];
}
export function redondearCompra(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
export function recalcularImporte(item: PrecioItem): PrecioItem {
  const subtotalSinIgv = redondearCompra(item.incluyeIgv ? item.total / 1.18 : item.total);
  return {
    ...item,
    subtotalSinIgv,
    montoIgv: item.incluyeIgv ? redondearCompra(item.total - subtotalSinIgv) : 0,
  };
}
export function prepararItems(
  detalle: DetalleOrdenCompra,
  materiales: readonly Material[],
): PrecioItem[] {
  return detalle.items.map((item) => {
    const material = materiales.find((m) => m.idMaterial === item.idMaterial);
    return recalcularImporte({
      idMaterial: item.idMaterial,
      especialidad: item.especialidad || material?.especialidad || '-',
      material: item.material || material?.descripcion || '-',
      unidadMedida: item.unidadMedida || material?.unidadMedida || '-',
      cantidad: item.cantidad,
      idProveedor: item.idProveedor,
      proveedor: item.proveedor || '-',
      precioUnitario: item.precioUnitario,
      incluyeIgv: true,
      subtotalSinIgv: 0,
      montoIgv: 0,
      total: item.subtotal,
      observacion: '',
      files: [],
    });
  });
}
export function separarEspecialidades(valor: string): string[] {
  return valor
    .split(/[,|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
export function totalesCompra(items: readonly PrecioItem[]): {
  subtotal: number;
  igv: number;
  total: number;
} {
  return {
    subtotal: redondearCompra(items.reduce((acc, x) => acc + x.subtotalSinIgv, 0)),
    igv: redondearCompra(items.reduce((acc, x) => acc + x.montoIgv, 0)),
    total: redondearCompra(items.reduce((acc, x) => acc + x.total, 0)),
  };
}
export function validarItemsCompra(items: readonly PrecioItem[]): string {
  if (!items.length) return 'No hay ítems para registrar.';
  if (items.some((x) => !Number.isFinite(x.total) || x.total <= 0))
    return 'Debes colocar el monto total positivo a todos los ítems.';
  if (items.some((x) => !Number.isFinite(x.cantidad) || x.cantidad <= 0))
    return 'Las cantidades deben ser positivas.';
  if (items.some((x) => redondearCompra(x.total / x.cantidad) <= 0))
    return 'El precio unitario calculado debe ser mayor que cero.';
  return '';
}
export function peticionCompra(
  idOrdenCompra: number,
  numeroCompra: string,
  fechaCompra: string,
  items: readonly PrecioItem[],
): CompraRequest {
  const totales = totalesCompra(items);
  return {
    numeroCompra: numeroCompra.trim(),
    idOrdenCompra,
    fechaCompra,
    incluyeIGV: items.some((x) => x.incluyeIgv),
    subtotalSinIGV: totales.subtotal,
    montoIGV: totales.igv,
    montoTotal: totales.total,
    observacion: items
      .map((x) => x.observacion)
      .filter(Boolean)
      .join(' | '),
    items: items.map((x) => ({
      idMaterial: x.idMaterial,
      cantidad: x.cantidad,
      precioUnitario: redondearCompra(x.total / x.cantidad),
    })),
  };
}
export function siguienteNumeroCompra(compras: readonly CompraFilaSql[]): string {
  const maximo = compras.reduce(
    (max, compra) => Math.max(max, Number(compra.NumeroCompra.match(/\d+/g)?.join('') || 0)),
    0,
  );
  return String(maximo + 1);
}
export function fechaLocalCompra(): string {
  const fecha = new Date();
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function archivosSeleccionados(event: Event): File[] {
  return event.target instanceof HTMLInputElement ? Array.from(event.target.files || []) : [];
}
