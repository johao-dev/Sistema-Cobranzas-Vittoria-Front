import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorImporte } from './editor-importe';
import { prepararItems } from '../formulario-compra/datos-compra';
import { detallePrueba } from '../../ordenes-compra/ordenes-compra.fixture';

describe('EditorImporte — borrador independiente', () => {
  let fixture: ComponentFixture<EditorImporte>;
  const original = prepararItems(detallePrueba, [])[0];
  function boton(texto: string): HTMLButtonElement {
    const botones: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const button = Array.from(botones).find((x) => x.textContent?.trim() === texto);
    if (!button) throw new Error('Falta botón: ' + texto);
    return button;
  }
  async function monto(valor: string): Promise<void> {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[type=number]:not([readonly])',
    );
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }
  beforeEach(async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    fixture = TestBed.createComponent(EditorImporte);
    fixture.componentRef.setInput('item', original);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });
  it('calcula IGV al escribir, guarda con y sin IGV y conserva el original', async () => {
    const guardar = vi.fn();
    fixture.componentInstance.guardar.subscribe(guardar);
    await monto('118');
    const subtotal: HTMLInputElement = fixture.nativeElement.querySelector('input[readonly]');
    expect(subtotal.value).toBe('100');
    boton('No').click();
    await fixture.whenStable();
    expect(subtotal.value).toBe('118');
    boton('Guardar monto').click();
    expect(guardar).toHaveBeenCalledWith(
      expect.objectContaining({ total: 118, subtotalSinIgv: 118, montoIgv: 0 }),
    );
    expect(original.total).toBe(50);
  });
  it('rechaza montos vacíos, cero y negativos sin emitir cambios', async () => {
    const guardar = vi.fn();
    fixture.componentInstance.guardar.subscribe(guardar);
    for (const valor of ['', '0', '-1']) {
      await monto(valor);
      boton('Guardar monto').click();
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain('monto total positivo');
    }
    expect(guardar).not.toHaveBeenCalled();
  });
  it('agrega y quita adjuntos sin mutar los archivos originales', async () => {
    const file = new File(['x'], 'sustento.pdf');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=file]');
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('sustento.pdf');
    expect(original.files).toEqual([]);
    boton('Quitar').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('sustento.pdf');
  });
});
