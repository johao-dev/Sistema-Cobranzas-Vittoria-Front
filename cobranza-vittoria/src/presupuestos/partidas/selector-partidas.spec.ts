import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectorPartidas } from './selector-partidas';
import { partidaPrueba } from '../presupuestos.fixture';

describe('SelectorPartidas: selección jerárquica', () => {
  let fixture: ComponentFixture<SelectorPartidas>;
  const partidas = [
    partidaPrueba({ idCatalogoPartida: 1, codigo: 'X', nombre: 'Categoría', esHoja: false }),
    partidaPrueba({ idCatalogoPartida: 2, codigo: 'Z', nombre: 'Terreno', idPartidaPadre: 1 }),
    partidaPrueba({
      idCatalogoPartida: 3,
      codigo: 'A',
      nombre: 'Alcabala',
      idPartidaPadre: 1,
      esHoja: false,
    }),
    partidaPrueba({ idCatalogoPartida: 4, codigo: 'B', nombre: 'Impuesto', idPartidaPadre: 3 }),
    partidaPrueba({ idCatalogoPartida: 5, codigo: 'X.1', nombre: 'Otra raíz', activo: false }),
  ];

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectorPartidas);
    fixture.componentRef.setInput('partidas', partidas);
    fixture.componentInstance.excluidasChange.subscribe((ids) =>
      fixture.componentRef.setInput('excluidas', ids),
    );
    fixture.detectChanges();
  });

  function casilla(nombre: string): HTMLInputElement {
    const host: HTMLElement = fixture.nativeElement;
    const etiquetas = Array.from(host.querySelectorAll<HTMLLabelElement>('.selector-opcion'));
    const etiqueta = etiquetas.find((e) => e.textContent?.includes(nombre));
    if (!etiqueta) throw new Error(`No se encontró ${nombre}`);
    return etiqueta.querySelector('input')!;
  }

  function cambiar(nombre: string, incluir: boolean): void {
    const input = casilla(nombre);
    input.checked = incluir;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('inicia con todo incluido, incluidas las partidas inactivas', () => {
    expect(fixture.componentInstance.excluidas()).toEqual([]);
    for (const nombre of ['Categoría', 'Terreno', 'Alcabala', 'Impuesto', 'Otra raíz']) {
      expect(casilla(nombre).checked).toBe(true);
      expect(casilla(nombre).indeterminate).toBe(false);
    }
  });

  it('excluye/reincorpora una hoja y muestra su padre indeterminado', () => {
    cambiar('Terreno', false);
    expect(fixture.componentInstance.excluidas()).toEqual([2]);
    expect(casilla('Categoría').indeterminate).toBe(true);
    expect(casilla('Alcabala').checked).toBe(true);
    cambiar('Terreno', true);
    expect(fixture.componentInstance.excluidas()).toEqual([]);
    expect(casilla('Categoría').checked).toBe(true);
  });

  it('excluye categorías a toda profundidad mediante IDs, aunque los códigos no coincidan', () => {
    cambiar('Categoría', false);
    expect(fixture.componentInstance.excluidas()).toEqual([1, 2, 3, 4]);
    expect(casilla('Impuesto').checked).toBe(false);
    expect(casilla('Categoría').indeterminate).toBe(false);
    expect(casilla('Otra raíz').checked).toBe(true);
    cambiar('Impuesto', true);
    expect(fixture.componentInstance.excluidas()).toEqual([2]);
    expect(casilla('Categoría').indeterminate).toBe(true);
    expect(casilla('Alcabala').checked).toBe(true);
    cambiar('Categoría', true);
    expect(fixture.componentInstance.excluidas()).toEqual([]);
  });

  it('desmarca el padre cuando se excluye su último descendiente y lo deja parcial al reincorporar uno', () => {
    cambiar('Terreno', false);
    cambiar('Impuesto', false);
    expect(fixture.componentInstance.excluidas()).toEqual([1, 2, 3, 4]);
    expect(casilla('Categoría').checked).toBe(false);
    expect(casilla('Categoría').indeterminate).toBe(false);
    expect(casilla('Alcabala').indeterminate).toBe(false);
    cambiar('Impuesto', true);
    expect(fixture.componentInstance.excluidas()).toEqual([2]);
    expect(casilla('Categoría').indeterminate).toBe(true);
  });

  it('la búsqueda y el cierre conservan la selección; las acciones globales afectan todo el catálogo', async () => {
    cambiar('Terreno', false);
    const buscar: HTMLInputElement = fixture.nativeElement.querySelector('input[type=search]');
    buscar.value = 'alcabala';
    buscar.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.selector-opcion')).toHaveLength(1);
    expect(fixture.componentInstance.excluidas()).toEqual([2]);

    const details: HTMLDetailsElement = fixture.nativeElement.querySelector('details');
    details.open = true;
    const summary: HTMLElement = fixture.nativeElement.querySelector('summary');
    summary.focus();
    summary.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    details.open = true;
    expect(fixture.componentInstance.excluidas()).toEqual([2]);

    const botones: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
      '.selector-acciones button',
    );
    botones[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.excluidas()).toEqual([1, 2, 3, 4, 5]);
    botones[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.excluidas()).toEqual([]);
    expect(buscar.value).toBe('alcabala');
  });

  it('busca por código y muestra un estado vacío para términos sin coincidencias', async () => {
    const buscar: HTMLInputElement = fixture.nativeElement.querySelector('input[type=search]');
    buscar.value = 'X.1';
    buscar.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.selector-opcion')).toHaveLength(1);
    expect(casilla('Otra raíz').checked).toBe(true);
    buscar.value = 'inexistente';
    buscar.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No hay partidas para esta búsqueda.');
  });

  it('mantiene abierto el desplegable al mover el foco entre sus controles', () => {
    const host: HTMLElement = fixture.nativeElement;
    const desplegable = host.querySelector('details')!;
    desplegable.open = true;
    const buscar = host.querySelector<HTMLInputElement>('input[type=search]')!;
    const checkbox = casilla('Terreno');
    buscar.focus();
    checkbox.focus();
    checkbox.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    cambiar('Terreno', false);
    expect(desplegable.open).toBe(true);
    expect(fixture.componentInstance.excluidas()).toEqual([2]);
  });

  it('cierra al abrir otro seleccionable y conserva la búsqueda y las exclusiones', () => {
    const host: HTMLElement = fixture.nativeElement;
    const desplegable = host.querySelector('details')!;
    cambiar('Terreno', false);
    const buscar = host.querySelector<HTMLInputElement>('input[type=search]')!;
    buscar.value = 'alcabala';
    buscar.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    desplegable.open = true;
    buscar.focus();
    const otroSelector = document.createElement('select');
    document.body.append(otroSelector);
    try {
      otroSelector.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      otroSelector.focus();
      expect(desplegable.open).toBe(false);
      expect(document.activeElement).toBe(otroSelector);
      expect(fixture.componentInstance.excluidas()).toEqual([2]);
      expect(buscar.value).toBe('alcabala');
    } finally {
      otroSelector.remove();
    }
  });

  it('cierra al salir con el teclado o perder el foco sin un nuevo destino', () => {
    const host: HTMLElement = fixture.nativeElement;
    const desplegable = host.querySelector('details')!;
    const buscar = host.querySelector<HTMLInputElement>('input[type=search]')!;
    const boton = document.createElement('button');
    document.body.append(boton);
    try {
      desplegable.open = true;
      buscar.focus();
      boton.focus();
      expect(desplegable.open).toBe(false);
      expect(document.activeElement).toBe(boton);
      desplegable.open = true;
      buscar.focus();
      buscar.blur();
      expect(desplegable.open).toBe(false);
    } finally {
      boton.remove();
    }
  });

  it('cierra al pulsar una zona exterior que no puede recibir foco', () => {
    const host: HTMLElement = fixture.nativeElement;
    const desplegable = host.querySelector('details')!;
    desplegable.open = true;
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(desplegable.open).toBe(false);
  });
});
