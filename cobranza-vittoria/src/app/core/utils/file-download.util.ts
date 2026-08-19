/**
 * Utilidades para descarga de archivos en el navegador.
 *
 * Centraliza la mecánica de Blob + ObjectURL + <a download> para evitar
 * duplicación entre páginas que descargan binarios (CSV, XLSX, etc.).
 */

/**
 * Dispara la descarga de un Blob en el navegador.
 *
 * Crea un <a> temporal con download, hace click programático y libera
 * el ObjectURL después. El <a> se inserta fuera de pantalla y se
 * elimina del DOM para no afectar el layout ni acumular nodos.
 */
export function descargarArchivo(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Liberar el ObjectURL en el siguiente tick para asegurar que la descarga arrancó.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Extrae el filename del header HTTP Content-Disposition.
 *
 * Soporta las dos formas comunes:
 *   - attachment; filename="kardex-stock-20260818-1635.xlsx"
 *   - attachment; filename=kardex-stock-20260818-1635.xlsx
 *
 * Si no se encuentra filename, devuelve el fallback.
 */
export function extraerFilenameDeContentDisposition(
  header: string | null,
  fallback: string
): string {
  if (!header) return fallback;
  const m = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return m ? m[1].trim() : fallback;
}

/**
 * Genera el nombre de archivo por defecto para el export de Kardex Stock.
 *
 * Patrón: kardex-stock-yyyyMMdd-HHmm.xlsx
 * Ejemplo: kardex-stock-20260818-1635.xlsx
 *
 * Se usa como fallback cuando el backend no envía Content-Disposition.
 */
export function generarNombreKardexStockXlsx(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `kardex-stock-${yyyy}${MM}${dd}-${HH}${mm}.xlsx`;
}
