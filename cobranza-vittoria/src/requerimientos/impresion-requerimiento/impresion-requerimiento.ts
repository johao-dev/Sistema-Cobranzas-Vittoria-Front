import { RequerimientoGetResponse } from '../contratos-requerimientos';

export function normalizarTexto(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizarNombreSolicitante(value: string | null | undefined): string {
  const normalized = normalizarTexto(value);

  if (!normalized) return '-';

  if (normalized.includes('administrador')) return 'Administrador';

  if (normalized.includes('contable')) return 'Contable';

  if (normalized.includes('ingeniero')) return 'Ingeniero';

  if (normalized.includes('jefe') && normalized.includes('almacen')) return 'Jefe de Almacen';

  return (
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim() || '-'
  );
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function documentoRequerimiento(detalle: RequerimientoGetResponse): string {
  const req = detalle.requerimiento;
  const items = detalle.items;

  const rows = items
    .map(
      (x) => `
      <tr>
        <td>${escapeHtml(x.especialidad || '-')}</td>
        <td>${escapeHtml(x.material || '-')}</td>
        <td>${escapeHtml(x.unidadMedida || '-')}</td>
        <td style="text-align:right;">${Number(x.cantidad || 0).toLocaleString('es-PE')}</td>
        <td>${escapeHtml(x.observacion || '-')}</td>
      </tr>
    `,
    )
    .join('');

  return `
      <html>
      <head>
        <title>Requerimiento ${escapeHtml(req.numeroRequerimiento || '')}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1f2430; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px 18px; margin: 18px 0; font-size: 12px; }
          .meta div { border: 1px solid #d6deea; border-radius: 8px; padding: 8px 10px; }
          .meta strong { display:block; color:#5f6b84; font-size:11px; margin-bottom:4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d6deea; padding: 8px; text-align: left; }
          th { background: #f5f7fb; }
        </style>
      </head>
      <body>
        <h1>Requerimiento N° ${escapeHtml(req.numeroRequerimiento || '-')}</h1>
        <div>Detalle del requerimiento</div>
        <div class="meta">
          <div><strong>Proyecto</strong>${escapeHtml(req.nombreProyecto || '-')}</div>
          <div><strong>Solicitante</strong>${escapeHtml(normalizarNombreSolicitante(req.solicitante || '-'))}</div>
          <div><strong>Fecha</strong>${req.fechaRequerimiento ? new Date(req.fechaRequerimiento).toLocaleDateString('es-PE') : '-'}</div>
          <div><strong>Estado</strong>${escapeHtml(req.estado || '-')}</div>
          <div><strong>Especialidades</strong>${escapeHtml(req.especialidades || '-')}</div>
          <div><strong>Fecha entrega</strong>${req.fechaEntrega ? new Date(req.fechaEntrega).toLocaleDateString('es-PE') : '-'}</div>
        </div>
        <table>
          <thead><tr><th>Especialidad</th><th>Material</th><th>Unidad</th><th>Cantidad</th><th>Observación</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">Sin materiales.</td></tr>'}</tbody>
        </table>
      </body>
      </html>
    `;
}

export function imprimirRequerimiento(detalle: RequerimientoGetResponse): void {
  const ventana = window.open('', '_blank');

  if (!ventana) return;

  ventana.document.write(documentoRequerimiento(detalle));
  ventana.document.close();

  ventana.focus();
  setTimeout(() => ventana.print(), 400);
}
