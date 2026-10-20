import { DetalleOrdenCompra, ItemOrdenCompra } from '../contratos-ordenes-compra';
import { presentarDetalleOrden } from '../datos-orden';

export function planillaOrden(
  detalle: DetalleOrdenCompra,
  items: ItemOrdenCompra[] = presentarDetalleOrden(detalle).items,
  proveedor: string | null = null,
): string {
  const orden = detalle.ordenCompra;
  const filas: (string | number)[][] = [
    ['Orden de compra', orden.numeroOrdenCompra],
    ['RQ', orden.numeroRequerimiento || '-'],
    ['Proyecto', orden.nombreProyecto || ''],
    ['Proveedor', proveedor || orden.proveedores || '-'],
    ['Especialidades', orden.especialidades || '-'],
    ['Filtro proveedor', proveedor || 'Todos'],
    [],
    ['Especialidad', 'Material', 'Unidad', 'Cantidad', 'Proveedor'],
    ...items.map((item) => [
      item.especialidad || '-',
      item.material || '-',
      item.unidadMedida || '-',
      item.cantidad,
      item.proveedor || '-',
    ]),
  ];

  const escapar = (valor: string | number): string => {
    const texto = String(valor);

    return /[";\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
  };

  return '\ufeff' + filas.map((fila) => fila.map(escapar).join(';')).join('\n');
}

export function nombrePlanillaOrden(numero: string, proveedor: string | null): string {
  const limpiar = (texto: string): string => texto.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const sufijo = proveedor ? '_' + limpiar(proveedor) : '';

  return `oc_${limpiar(numero || 'detalle')}${sufijo}.xls`;
}
