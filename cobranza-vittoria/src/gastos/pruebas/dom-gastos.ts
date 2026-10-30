import { ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';

export function simularDialogosGastos(): void {
  // jsdom no implementa el diálogo nativo; Angular mantiene reales los eventos y el estado.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(),
  });
}

export function botonGasto<T>(fixture: ComponentFixture<T>, texto: string): HTMLButtonElement {
  const raiz: HTMLElement = fixture.nativeElement;
  const boton = Array.from(raiz.querySelectorAll('button')).find(
    (elemento) => elemento.textContent?.trim() === texto,
  );
  if (!boton) throw new Error(`No se encontró el botón: ${texto}`);
  return boton;
}

export async function escribirGasto<T>(
  fixture: ComponentFixture<T>,
  selector: string,
  valor: string,
): Promise<void> {
  const raiz: HTMLElement = fixture.nativeElement;
  const input = raiz.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Falta el campo ${selector}`);
  input.value = valor;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
  await fixture.whenStable();
}

export async function seleccionarGasto<T>(
  fixture: ComponentFixture<T>,
  selector: string,
  texto: string,
): Promise<void> {
  const raiz: HTMLElement = fixture.nativeElement;
  const select = raiz.querySelector<HTMLSelectElement>(selector);
  const opcion = Array.from(select?.options ?? []).find((item) =>
    item.textContent?.includes(texto),
  );
  if (!select || !opcion) throw new Error(`Falta la opción ${texto}`);
  select.value = opcion.value;
  select.dispatchEvent(new Event('change'));
  await fixture.whenStable();
}

export function restaurarDialogosGastos(): void {
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
}
