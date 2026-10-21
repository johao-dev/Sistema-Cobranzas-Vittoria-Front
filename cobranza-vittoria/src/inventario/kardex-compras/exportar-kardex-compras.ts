import { descargarArchivo } from '../../app/core/utils/file-download.util';

export function exportarKardexCompras(tabla: HTMLTableElement, formato: 'excel' | 'pdf'): void {
  if (formato === 'excel') {
    const html = `
      <html>
      <head>
        <meta charset="UTF-8" />
      </head>
      <body>
        ${tabla.outerHTML}
      </body>
      </html>`;

    descargarArchivo(
      new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
      'kardex-listado.xls',
    );

    return;
  }

  const win = window.open('', '_blank');
  if (!win) return;

  win.document.write(`
      <html>
      <head>
        <title>Kardex por especialidad</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 20px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>Kardex por especialidad</h1>
        ${tabla.outerHTML}
      </body>
      </html>
    `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}
