import { CompraFilaSql } from '../contratos-compras';
export function exportarComprasExcel(compras: readonly CompraFilaSql[]): void {
  const rows: (string | number)[][] = [
    ['N° Compra', 'Fecha', 'Proveedor', 'Proyecto', 'Estado', 'Total'],
  ];
  compras.forEach((row: CompraFilaSql) =>
    rows.push([
      row.NumeroCompra || '',
      row.FechaCompra ? new Date(row.FechaCompra).toLocaleDateString('es-PE') : '',
      row.Proveedores || '',
      row.NombreProyecto || '',
      row.Estado || '',
      Number(row.MontoTotal).toFixed(2),
    ]),
  );
  downloadExcel(rows, `compras_cerradas_${new Date().toISOString().slice(0, 10)}.xls`);
}

export function exportarComprasPdf(compras: readonly CompraFilaSql[]): void {
  const body = compras
    .map(
      (row: CompraFilaSql) => `
      <tr>
        <td>${escapeHtml(row.NumeroCompra || '-')}</td>
        <td>${escapeHtml(row.FechaCompra ? new Date(row.FechaCompra).toLocaleDateString('es-PE') : '-')}</td>
        <td>${escapeHtml(row.Proveedores || '-')}</td>
        <td>${escapeHtml(row.NombreProyecto || '-')}</td>
        <td>${escapeHtml(row.Estado || '-')}</td>
        <td class="num">${Number(row.MontoTotal).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>`,
    )
    .join('');

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
      <html>
      <head>
        <title>Compras cerradas</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 22px; color: #111827; }
          h1 { font-size: 20px; margin: 0 0 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #dbe3ef; padding: 6px 8px; text-align: left; }
          th { background: #f3f6fb; }
          .num { text-align: right; white-space: nowrap; }
        </style>
      </head>
      <body>
        <h1>Compras cerradas</h1>
        <table>
          <thead><tr><th>N° Compra</th><th>Fecha</th><th>Proveedor</th><th>Proyecto</th><th>Estado</th><th>Total</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </body>
      </html>
    `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function downloadExcel(rows: (string | number)[][], filename: string): void {
  const escapeCell = (value: string | number | null | undefined) => {
    const text = String(value ?? '');
    return /[";\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  const csv = rows.map((row) => row.map(escapeCell).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
