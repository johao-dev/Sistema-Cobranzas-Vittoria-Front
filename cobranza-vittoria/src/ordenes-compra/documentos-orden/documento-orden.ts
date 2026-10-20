import { DetalleOrdenCompra, ItemOrdenCompra } from '../contratos-ordenes-compra';
import { presentarDetalleOrden } from '../datos-orden';

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function documentoOrden(
  detalle: DetalleOrdenCompra,
  items: ItemOrdenCompra[] = presentarDetalleOrden(detalle).items,
  proveedorFiltrado: string | null = null,
): string {
  const oc = detalle.ordenCompra;
  const numeroRequerimiento = oc.numeroRequerimiento || '-';
  const especialidades = oc.especialidades || '-';
  const proveedorDocumento = proveedorFiltrado || oc.proveedores || '-';

  const rows = items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.especialidad || '-')}</td>
        <td>${escapeHtml(item.material || '-')}</td>
        <td>${escapeHtml(item.unidadMedida || '-')}</td>
        <td>${Number(item.cantidad || 0).toLocaleString('es-PE')}</td>
        <td>${escapeHtml(item.proveedor || '-')}</td>
      </tr>`,
    )
    .join('');

  return `
      <html>
      <head>
        <title>Orden de compra ${escapeHtml(oc.numeroOrdenCompra || '')}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { font-size: 22px; margin: 0 0 16px; }
          .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; margin-bottom: 18px; font-size: 13px; }
          .meta div { border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d6deea; padding: 8px; text-align: left; }
          th { background: #f5f7fb; }
        </style>
      </head>
      <body>
        <h1>Orden de compra ${escapeHtml(oc.numeroOrdenCompra || '')}</h1>
        <div class="meta">
          <div><strong>Fecha:</strong> ${escapeHtml(oc.fechaOrdenCompra ? new Date(oc.fechaOrdenCompra).toLocaleDateString('es-PE') : '-')}</div>
          <div><strong>RQ:</strong> ${escapeHtml(numeroRequerimiento)}</div>
          <div><strong>Proyecto:</strong> ${escapeHtml(oc.nombreProyecto || '-')}</div>
          <div><strong>Proveedor:</strong> ${escapeHtml(proveedorDocumento)}</div>
          <div><strong>Especialidades:</strong> ${escapeHtml(especialidades)}</div>
          <div><strong>Estado:</strong> ${escapeHtml(oc.estado || '-')}</div>
        </div>
        <table>
          <thead><tr><th>Especialidad</th><th>Material</th><th>Unidad</th><th>Cantidad</th><th>Proveedor</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">Sin detalle</td></tr>'}</tbody>
        </table>
      </body>
      </html>
    `;
}
