import { DetalleOrdenCompra, ItemOrdenCompra } from '../contratos-ordenes-compra';
import { presentarDetalleOrden } from '../datos-orden';
import { descargarArchivo } from '../../app/core/utils/file-download.util';
import { documentoOrden } from './documento-orden';
import { nombrePlanillaOrden, planillaOrden } from './planilla-orden';

export type FormatoOrden = 'pdf' | 'excel';

export function exportarOrden(
  detalle: DetalleOrdenCompra,
  formato: FormatoOrden,
  items: ItemOrdenCompra[] = presentarDetalleOrden(detalle).items,
  proveedor: string | null = null,
): boolean {
  if (formato === 'excel') {
    const contenido = planillaOrden(detalle, items, proveedor);
    const archivo = new Blob([contenido], { type: 'application/vnd.ms-excel;charset=utf-8;' });

    descargarArchivo(
      archivo,
      nombrePlanillaOrden(detalle.ordenCompra.numeroOrdenCompra, proveedor),
    );
    return true;
  }

  const ventana = window.open('', '_blank');

  if (!ventana) return false;

  ventana.document.write(documentoOrden(detalle, items, proveedor));
  ventana.document.close();

  ventana.focus();
  setTimeout(() => ventana.print(), 400);
  return true;
}
