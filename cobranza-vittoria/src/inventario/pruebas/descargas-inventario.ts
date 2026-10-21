import { vi } from 'vitest';

/** Solo se simulan los límites nativos de descarga que jsdom no implementa. */
export function simularDescargasInventario() {
  const crearUrl = vi.fn<(blob: Blob | MediaSource) => string>(() => 'blob:inventario');
  const liberarUrl = vi.fn();
  class URLPrueba extends URL {
    static override createObjectURL = crearUrl;
    static override revokeObjectURL = liberarUrl;
  }
  vi.stubGlobal('URL', URLPrueba);

  const nombres: string[] = [];
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ): void {
    nombres.push(this.download);
  });

  return { crearUrl, liberarUrl, click, nombres };
}

export async function restaurarDescargasInventario(): Promise<void> {
  if (vi.isFakeTimers()) vi.runOnlyPendingTimers();
  else await new Promise<void>((resolve) => setTimeout(resolve, 0));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
}
