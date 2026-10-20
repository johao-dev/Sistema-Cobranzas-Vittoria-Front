import {
  OrdenCompra,
  ItemOrdenCompra,
  DetalleOrdenCompra,
  EstadoOrdenDestino,
} from './contratos-ordenes-compra';

export const ETIQUETA_ESTADO: Record<EstadoOrdenDestino, string> = {
  APROBADA: 'Aprobar',
  ANULADA: 'Anular',
  CERRADA: 'Cerrar',
};

const TRANSICIONES: Record<string, EstadoOrdenDestino[]> = {
  REGISTRADA: ['APROBADA', 'ANULADA'],
  APROBADA: ['ANULADA'],
  ATENDIDA: ['CERRADA'],
};

export function estadoOrden(orden: OrdenCompra): string {
  return orden.estado.trim().toUpperCase();
}

export function accionesEstado(orden: OrdenCompra): EstadoOrdenDestino[] {
  return TRANSICIONES[estadoOrden(orden)] ?? [];
}

export function precioOrden(precio: number | null): number {
  if (precio == null || !Number.isFinite(precio) || precio < 0) return 0;

  return Math.round(precio * 100) / 100;
}

export function subtotalOrden(cantidad: number, precio: number | null): number {
  return Math.round(precioOrden(precio) * cantidad * 100) / 100;
}

export function textoTotalOrden(orden: OrdenCompra): string {
  if (!(orden.total > 0)) return 'Sin precio (se define en la Compra)';

  const simbolo = orden.simboloMoneda ?? orden.codigoMoneda ?? '';
  const total = orden.total.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${simbolo} ${total}`.trim();
}

export function siguienteNumeroOrden(ordenes: OrdenCompra[]): string {
  const numeros = ordenes.map(
    (orden) => Number(orden.numeroOrdenCompra.match(/\d+/g)?.join('')) || 0,
  );

  return String(Math.max(0, ...numeros) + 1);
}

export function fechaLocalOrden(): string {
  const hoy = new Date();
  const desplazamiento = hoy.getTimezoneOffset() * 60000;

  return new Date(hoy.getTime() - desplazamiento).toISOString().slice(0, 10);
}

export function presentarDetalleOrden(detalle: DetalleOrdenCompra): DetalleOrdenCompra {
  const orden = detalle.ordenCompra;

  return {
    ...detalle,
    items: detalle.items.map((item) => ({
      ...item,
      especialidad: item.especialidad || orden.especialidades || '-',
      proveedor: item.proveedor || orden.proveedores || '-',
    })),
  };
}

export function proveedoresOrden(detalle: DetalleOrdenCompra): string[] {
  const nombres = detalle.items
    .map((item) => (item.proveedor || '').trim())
    .filter((nombre) => nombre && nombre !== '-');

  return [...new Set(nombres)].sort((a, b) => a.localeCompare(b));
}

export function filtrarItemsOrden(
  detalle: DetalleOrdenCompra,
  proveedor: string,
): ItemOrdenCompra[] {
  if (!proveedor || proveedor === 'TODOS') return detalle.items;

  return detalle.items.filter((item) => item.proveedor?.trim() === proveedor);
}
